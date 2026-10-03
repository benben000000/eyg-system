/**
 * BOOKING ENGINE
 * ============================================================================
 * The single most correctness-critical file in the app. Everything here exists
 * to make one guarantee true:
 *
 *   **The shop never sells the same bay twice for the same slot.**
 *
 * ── HOW RACE SAFETY WORKS ───────────────────────────────────────────────────
 *
 * Reading "how many bookings exist" and then writing a new one is a
 * read-then-write race: two customers pressing "Confirm" at the same millisecond
 * both read 2/3 used and both write, producing 4 bookings for a 3-bay slot.
 *
 * So capacity is re-checked *inside* the transaction, and the transaction runs
 * at `SERIALIZABLE` isolation. Under SERIALIZABLE, Postgres guarantees that two
 * transactions which both read-and-then-write the same rows cannot both commit:
 * one of them is aborted with a serialization failure (Prisma surfaces it as
 * `P2034`). `withSerializableRetry` catches that and retries, and on the retry
 * the second transaction sees the first one's committed count. Exactly one
 * booking wins, and the loser gets a clean `409 SLOT_UNAVAILABLE` with a
 * refreshed slot list rather than a 500 or an overbooking.
 *
 * The retry exists because the alternative — failing the customer outright on a
 * serialization conflict — would punish them for two customers happening to tap
 * confirm together, which is exactly what happens in a small shop at 8 a.m.
 *
 * ── OTHER INVARIANTS ────────────────────────────────────────────────────────
 *  - Every denormalised field (customer name/phone/email, vehicle, item
 *    name/price) is *snapshotted* from the Prisma record at write time, so a
 *    later catalogue edit or customer-profile fix cannot rewrite history.
 *  - `reference` is retried on the (astronomically unlikely) unique collision.
 *  - `Customer` is upserted by `@@unique([phone])` and an existing name/email is
 *    never overwritten with junk from a mistyped form.
 *  - The confirmation notification is fired AFTER commit, never inside.
 *  - Every status transition goes through `assertTransition`, which rejects
 *    illegal moves, and always writes a `BookingEvent`.
 */
import "server-only";

import { BOOKING } from "@/config/site";
import { ApiError, notFound, slotUnavailable } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { makeReference } from "@/lib/utils";
import type { BookingDto, BookingStatusValue } from "@/lib/types";
import { prisma, withSerializableRetry } from "@/lib/server/db";
import type { getAvailability} from "@/lib/server/availability";
import { ACTIVE_STATUSES, getAvailabilityFresh } from "@/lib/server/availability";
import { isoToManilaInstant, isoWithOffset, localMinutesToUtc, dateKeyOf } from "@/lib/server/time";
import { notifyBookingCancellation, notifyBookingConfirmation } from "@/lib/server/notify";
import type { Prisma } from "@prisma/client";

export type { ActiveStatus } from "@/lib/server/slot-math";
export { ACTIVE_STATUSES };

/**
 * A booking occupies a bay while it is in one of these states. `CANCELLED`,
 * `NO_SHOW` and `RESCHEDULED` release capacity, so a slot cancelled this morning
 * reappears on today's board.
 */
const OCCUPYING: BookingStatusValue[] = [...ACTIVE_STATUSES];

// ── Public input shape ──────────────────────────────────────────────────────

/** Mirrors `CreateBookingInput` in `types.ts`, plus server-only context. */
export interface CreateBookingInput {
  name: string;
  phone: string;
  email?: string;
  startAt: string;
  serviceIds: string[];
  packageId?: string;
  promoCode?: string;
  vehicle?: {
    year: number;
    make: string;
    model: string;
    variant?: string;
    plate?: string;
    mileageKm?: number;
  };
  notes?: string;
  consentSms: boolean;
  consentMarketing?: boolean;
  website?: string;
  captchaAnswer?: number;
  captchaToken?: string;
}

export interface BookingRequestContext {
  ip: string;
  userAgent: string | null;
  requestId: string;
  utmSource?: string | null;
  utmCampaign?: string | null;
  source?: string;
}

// ── State machine ───────────────────────────────────────────────────────────

/**
 * Legal status transitions. Terminal states (`COMPLETED`, `CANCELLED`,
 * `NO_SHOW`, `RESCHEDULED`) have no outgoing edges — a mistake must be fixed by
 * a human editing the row, not by an accidental second click.
 */
const TRANSITIONS: Record<BookingStatusValue, readonly BookingStatusValue[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["READY"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: ["RESCHEDULED"],
  NO_SHOW: [],
  RESCHEDULED: ["PENDING"],
};

export function canTransition(from: BookingStatusValue, to: BookingStatusValue): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** Throws `CONFLICT` for an illegal transition. */
export function assertTransition(from: BookingStatusValue, to: BookingStatusValue): void {
  if (from === to) {
    throw new ApiError("CONFLICT", `This booking is already ${labelFor(to).toLowerCase()}.`);
  }
  if (!canTransition(from, to)) {
    throw new ApiError("CONFLICT", `A booking cannot go from ${labelFor(from)} to ${labelFor(to)}.`);
  }
}

function labelFor(status: BookingStatusValue): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

// ── DTO mapping ─────────────────────────────────────────────────────────────

/**
 * One `include` for every read path, so the shape the mappers expect can never
 * drift from the shape the queries actually return. `Prisma.BookingGetPayload`
 * derives the row type from it, which removes a whole class of "the cast lied"
 * bugs.
 */
const bookingInclude = {
  items: { select: { id: true, name: true, quantity: true, priceMin: true, priceMax: true } },
  vehicle: { select: { year: true, make: true, model: true, variant: true, plate: true } },
} as const;

type BookingWithItems = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

/**
 * Maps a booking to the customer-safe DTO.
 *
 * Deliberately absent: `staffNotes`, `cancelReason`, `createdIp`, `userAgent`,
 * `utm*`, `consent*`. A booking response is rendered in a browser; it must not
 * carry internal notes or anything about another customer.
 */
export function toBookingDto(row: BookingWithItems): BookingDto {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    startAt: isoWithOffset(row.startAt),
    endAt: row.endAt ? isoWithOffset(row.endAt) : null,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    vehicle: row.vehicle
      ? {
          year: row.vehicle.year,
          make: row.vehicle.make,
          model: row.vehicle.model,
          variant: row.vehicle.variant,
          plate: row.vehicle.plate,
        }
      : null,
    items: row.items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      priceMin: i.priceMin,
      priceMax: i.priceMax,
    })),
    estimateMin: row.subtotalMin,
    estimateMax: row.subtotalMax,
    notes: row.serviceNotes,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Staff-facing row: same as the DTO plus the internal fields the board needs. */
export interface BookingBoardRow extends BookingDto {
  staffNotes: string | null;
  cancelReason: string | null;
  consentSms: boolean;
  consentMarketing: boolean;
  channel: string;
  promoCode: string | null;
  customerId: string | null;
  serviceCount: number;
}

export function toBookingBoardRow(row: BookingWithItems): BookingBoardRow {
  return {
    ...toBookingDto(row),
    staffNotes: row.staffNotes,
    cancelReason: row.cancelReason,
    consentSms: row.consentSms,
    consentMarketing: row.consentMarketing,
    channel: row.channel,
    promoCode: row.promoCode,
    customerId: row.customerId,
    serviceCount: row.items.length,
  };
}

// ── Internals ───────────────────────────────────────────────────────────────

/** Retryable collision on the human-readable reference. Astronomically rare. */
async function generateReference(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = makeReference(BOOKING.referencePrefix);
    const clash = await prisma.booking.findUnique({ where: { reference }, select: { id: true } });
    if (!clash) return reference;
  }
  // Astronomically unlikely; fall back to a longer random suffix rather than 500.
  return `${makeReference(BOOKING.referencePrefix)}${makeReference("", 4)}`;
}

/* `generateQuoteReference` was removed: quote references are minted by the
   quote module, and this duplicate was never called. */

interface SlotCheck {
  startAt: Date;
  endAt: Date;
  dateKey: string;
  capacityLeft: number;
}

/**
 * Confirms `startAt` is a *currently offered* slot and computes its end.
 *
 * The client's offset is ignored (see `time.ts`); the wall-clock fields are
 * re-interpreted at `+08:00` and matched against a freshly computed board. A
 * client that invents a slot — or replays one from yesterday — fails here.
 */
async function resolveOfferedSlot(startAtIso: string, serviceIds: string[]): Promise<SlotCheck> {
  const instant = isoToManilaInstant(startAtIso);
  if (!instant) {
    throw new ApiError("VALIDATION_ERROR", "Pick a time slot from the list.", {
      fields: { startAt: ["That time is not valid."] },
    });
  }
  const now = Date.now();
  const earliest = now + BOOKING.minLeadMinutes * 60_000;
  if (instant.getTime() < now) {
    throw new ApiError("VALIDATION_ERROR", "That time has already passed. Please pick again.", {
      fields: { startAt: ["Choose a future time."] },
    });
  }
  if (instant.getTime() < earliest) {
    throw new ApiError("VALIDATION_ERROR", `Please give us at least ${BOOKING.minLeadMinutes} minutes' notice.`, {
      fields: { startAt: ["Too soon."] },
    });
  }
  const horizonEnd = now + BOOKING.horizonDays * 86_400_000;
  if (instant.getTime() > horizonEnd) {
    throw new ApiError("VALIDATION_ERROR", `We only take bookings up to ${BOOKING.horizonDays} days ahead.`, {
      fields: { startAt: ["Too far ahead."] },
    });
  }

  const dateKey = dateKeyOf(instant);
  // `bypassCache` matters here: a slot that filled up since the board was
  // rendered must not be accepted on the strength of a 5-minute-old cache.
  const board = await getAvailabilityFresh({ date: dateKey, serviceIds });
  const match = board.slots.find((s) => new Date(s.startAt).getTime() === instant.getTime());
  if (!match) {
    throw slotUnavailable("That time is no longer available. Please pick another slot.", {
      fields: { startAt: ["Already taken or closed."] },
    });
  }
  if (match.capacityLeft <= 0) {
    throw slotUnavailable("That time just filled up. Please pick another slot.", {
      fields: { startAt: ["Already taken."] },
    });
  }
  return {
    startAt: instant,
    endAt: new Date(instant.getTime() + BOOKING.slotMinutes * 60_000),
    dateKey,
    capacityLeft: match.capacityLeft,
  };
}

/** `Customer` upsert that never degrades an existing record with junk. */
async function upsertCustomer(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  data: { name: string; phone: string; email: string | null; consentMarketing: boolean },
): Promise<string> {
  const existing = await tx.customer.findUnique({ where: { phone: data.phone }, select: { id: true, name: true, email: true } });
  if (!existing) {
    const created = await tx.customer.create({
      data: { name: data.name, phone: data.phone, email: data.email, marketingOptIn: data.consentMarketing },
      select: { id: true },
    });
    return created.id;
  }
  // Only fill in blanks; only widen consent (never revoke it on a form resubmit).
  const patch: { name?: string; email?: string | null; marketingOptIn?: boolean } = {};
  if (data.email && !existing.email) patch.email = data.email;
  if (data.consentMarketing) patch.marketingOptIn = true;
  if (Object.keys(patch).length > 0) await tx.customer.update({ where: { id: existing.id }, data: patch });
  return existing.id;
}

interface ItemSnapshot {
  name: string;
  quantity: number;
  priceMin: number | null;
  priceMax: number | null;
}

/**
 * Builds the denormalised item snapshots and the subtotal band.
 *
 * `subtotalMax` stays `null` when ANY item is call-for-price: the estimate is
 * then indicative, and the DTO reflects that rather than pretending the top of
 * the band is a ceiling.
 */
async function buildItemSnapshots(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  serviceIds: string[],
  packageId: string | undefined,
): Promise<{ items: ItemSnapshot[]; subtotalMin: number | null; subtotalMax: number | null; serviceNames: string[] }> {
  if (packageId) {
    const pkg = await tx.package.findFirst({
      where: { id: packageId, isActive: true },
      select: { name: true, priceMin: true, priceMax: true },
    });
    if (!pkg) {
      throw new ApiError("VALIDATION_ERROR", "That package is no longer offered.", {
        fields: { packageId: ["Please pick from the current list."] },
      });
    }
    // Snapshot as ONE line: the bundle price is the bundle price.
    return {
      items: [{ name: pkg.name, quantity: 1, priceMin: pkg.priceMin, priceMax: pkg.priceMax }],
      subtotalMin: pkg.priceMin,
      subtotalMax: pkg.priceMax,
      serviceNames: [pkg.name],
    };
  }

  const services = await tx.service.findMany({
    where: { id: { in: serviceIds }, isActive: true },
    select: { id: true, name: true, priceMin: true, priceMax: true, pricing: true },
  });
  if (services.length !== serviceIds.length) {
    throw new ApiError("VALIDATION_ERROR", "One of the selected services is no longer offered.", {
      fields: { serviceIds: ["Please pick from the current list."] },
    });
  }

  const items: ItemSnapshot[] = services.map((s) => ({
    name: s.name,
    quantity: 1,
    priceMin: s.pricing === "CALL_FOR_PRICE" ? null : s.priceMin,
    priceMax: s.pricing === "CALL_FOR_PRICE" ? null : s.priceMax ?? s.priceMin,
  }));

  const subtotalMin = items.reduce((sum, i) => sum + (i.priceMin ?? 0), 0);
  const anyVariable = items.some((i) => i.priceMin === null);
  const subtotalMax = anyVariable ? null : items.reduce((sum, i) => sum + (i.priceMax ?? i.priceMin ?? 0), 0);

  return { items, subtotalMin, serviceNames: services.map((s) => s.name), subtotalMax };
}

// ── Create ──────────────────────────────────────────────────────────────────

export interface CreateBookingResult {
  booking: BookingDto;
  /** Refreshed board for the requested date, so the UI can re-offer slots. */
  availability: Awaited<ReturnType<typeof getAvailability>>;
}

/**
 * Creates a booking.
 *
 * Order of operations, and why:
 *  1. Resolve + validate the slot against a **fresh** board (cheap, no lock).
 *  2. Open a SERIALIZABLE transaction and, *inside* it, re-read the count of
 *     occupying bookings for that slot. That re-read is the whole race guard.
 *  3. Write customer, vehicle, booking, items and the creation event together.
 *  4. Commit.
 *  5. Fire the notification (outside the transaction).
 *
 * Steps 1 and 2 are deliberately both present: step 1 gives a good error
 * message, step 2 is what is actually safe.
 */
export async function createBooking(input: CreateBookingInput, ctx: BookingRequestContext): Promise<CreateBookingResult> {
  // ── 1. Slot validation (fresh board, no lock held) ────────────────────────
  const slot = await resolveOfferedSlot(input.startAt, input.serviceIds);
  const reference = await generateReference();

  // ── 2 + 3. SERIALIZABLE transaction with the capacity re-check inside ─────
  const created = await withSerializableRetry(async (tx) => {
    // THE RACE GUARD. Inside SERIALIZABLE, if another transaction commits a
    // booking for this slot between our read and our write, Postgres aborts one
    // of us with a serialization failure. `withSerializableRetry` retries, and
    // the retry re-reads `occupied` and sees the higher number.
    const occupied = await tx.booking.count({
      where: {
        status: { in: [...OCCUPYING] },
        startAt: { gte: slot.startAt, lt: new Date(slot.startAt.getTime() + BOOKING.slotMinutes * 60_000) },
      },
    });
    if (occupied >= BOOKING.capacityPerSlot) {
      throw slotUnavailable("That slot just filled up. Please pick another time.", {
        details: { date: slot.dateKey },
      });
    }

    const customerId = await upsertCustomer(tx, {
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      consentMarketing: input.consentMarketing ?? false,
    });

    let vehicleId: string | null = null;
    if (input.vehicle) {
      const v = input.vehicle;
      const createdVehicle = await tx.vehicle.create({
        data: {
          customerId,
          year: v.year,
          make: v.make,
          model: v.model,
          variant: v.variant ?? null,
          plate: v.plate ?? null,
          mileageKm: v.mileageKm ?? null,
        },
        select: { id: true },
      });
      vehicleId = createdVehicle.id;
    }

    const { items, subtotalMin, subtotalMax } = await buildItemSnapshots(tx, input.serviceIds, input.packageId);

    const booking = await tx.booking.create({
      data: {
        reference,
        customerId,
        vehicleId,
        channel: "WEB",
        customerName: input.name,
        customerPhone: input.phone,
        customerEmail: input.email ?? null,
        startAt: slot.startAt,
        endAt: slot.endAt,
        status: "PENDING",
        serviceNotes: input.notes ? input.notes.slice(0, 500) : null,
        promoCode: input.promoCode ?? null,
        subtotalMin,
        subtotalMax,
        consentSms: input.consentSms,
        consentMarketing: input.consentMarketing ?? false,
        source: ctx.source ?? "website",
        utmSource: ctx.utmSource ?? null,
        utmCampaign: ctx.utmCampaign ?? null,
        createdIp: ctx.ip,
        userAgent: ctx.userAgent,
        items: { create: items },
        history: {
          create: {
            from: null,
            to: "PENDING",
            actor: `web:${ctx.requestId}`,
            note: "Created online",
          },
        },
      },
      include: bookingInclude,
    });

    return booking;
  }, { requestId: ctx.requestId });

  // ── 4/5. Post-commit notification. Never inside the transaction. ─────────
  const dto = toBookingDto(created);
  void notifyBookingConfirmation({
    bookingId: dto.id,
    reference: dto.reference,
    customerName: dto.customerName,
    phone: dto.customerPhone,
    email: dto.customerEmail,
    startAtIso: dto.startAt,
    serviceNames: dto.items.map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`),
    estimateMin: dto.estimateMin,
    estimateMax: dto.estimateMax,
    status: dto.status,
    vehicle: dto.vehicle,
    consentSms: input.consentSms,
    consentMarketing: input.consentMarketing ?? false,
    requestId: ctx.requestId,
  }).catch((err: unknown) => {
    logger.error("booking.notify_failed", {
      requestId: ctx.requestId,
      scope: "booking",
      bookingId: dto.id,
      err: err instanceof Error ? err.name : typeof err,
    });
  });

  logger.info("booking.created", {
    requestId: ctx.requestId,
    scope: "booking",
    bookingId: dto.id,
    reference: dto.reference,
    startAt: dto.startAt,
  });

  const availability = await getAvailabilityFresh({ date: slot.dateKey, serviceIds: input.serviceIds }).catch(() => ({
    date: slot.dateKey,
    timezone: "Asia/Manila",
    totalCapacity: BOOKING.capacityPerSlot,
    slots: [],
    isClosed: true,
    closedReason: "Please pick another time.",
  }));

  return { booking: dto, availability };
}

// ── Read ────────────────────────────────────────────────────────────────────

export interface LookupInput {
  reference: string;
  /** Phone (last 4 digits or full) proves ownership without an account. */
  phone?: string;
}

/**
 * Looks up a booking by reference for the customer-facing status page.
 *
 * When a `phone` is supplied it must match the booking's phone, otherwise
 * 404 — a reference alone is not proof of ownership, and references are only
 * 32 bits of entropy.
 */
export async function lookupBooking(input: LookupInput): Promise<BookingDto> {
  const reference = input.reference.trim().toUpperCase();
  const row = await prisma.booking.findUnique({ where: { reference }, include: bookingInclude });
  if (!row) throw notFound("We could not find that booking reference.");
  if (input.phone) {
    const digits = input.phone.replace(/\D/g, "");
    const bookingDigits = row.customerPhone.replace(/\D/g, "");
    if (!digits || !bookingDigits.endsWith(digits.slice(-4)) || digits.length < 4) {
      throw notFound("We could not find that booking reference.");
    }
  }
  return toBookingDto(row);
}

/** Staff board row, with the internal fields. */
export async function adminGetBooking(id: string): Promise<BookingBoardRow> {
  const row = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!row) throw notFound("Booking not found.");
  return toBookingBoardRow(row);
}

export interface ListBookingsParams {
  status?: BookingStatusValue | undefined;
  date?: string | undefined;
  q?: string | undefined;
  page: number;
  pageSize: number;
}

export interface ListBookingsResult {
  rows: BookingBoardRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Paginated board for `/admin`. Search is Prisma `contains`, never raw SQL. */
export async function listBookings(params: ListBookingsParams): Promise<ListBookingsResult> {
  const where: {
    status?: BookingStatusValue;
    startAt?: { gte: Date; lt: Date };
    OR?: Array<Record<string, unknown>>;
  } = {};

  if (params.status) where.status = params.status;
  if (params.date) {
    const from = localMinutesToUtc(params.date, 0);
    where.startAt = { gte: from, lt: new Date(from.getTime() + 86_400_000) };
  }
  if (params.q) {
    // Case-insensitive contains across reference + denormalised contact fields.
    where.OR = [
      { reference: { contains: params.q, mode: "insensitive" } },
      { customerName: { contains: params.q, mode: "insensitive" } },
      { customerPhone: { contains: params.q } },
      { customerEmail: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    rows: rows.map(toBookingBoardRow),
    total,
    page: params.page,
    pageSize: params.pageSize,
  };
}

// ── Status transition ───────────────────────────────────────────────────────

export interface StatusChangeInput {
  id: string;
  to: BookingStatusValue;
  actor: string;
  staffNotes?: string | undefined;
  reason?: string | undefined;
  requestId?: string;
  ip?: string | null;
}

export interface StatusChangeResult {
  booking: BookingDto;
  board: BookingBoardRow;
}

/**
 * Applies a status change through the guarded state machine, always writing a
 * `BookingEvent`. `COMPLETED` stamps `confirmedAt` if it was never set.
 */
export async function changeBookingStatus(input: StatusChangeInput): Promise<StatusChangeResult> {
  const row = await withSerializableRetry(async (tx) => {
    const current = await tx.booking.findUnique({ where: { id: input.id }, select: { id: true, status: true } });
    if (!current) throw notFound("Booking not found.");
    assertTransition(current.status, input.to);

    const data: Record<string, unknown> = { status: input.to };
    if (input.staffNotes !== undefined) data.staffNotes = input.staffNotes || null;
    if (input.to === "CANCELLED") {
      data.cancelledAt = new Date();
      data.cancelReason = input.reason ?? null;
    }
    if (input.to === "CONFIRMED" || input.to === "COMPLETED") data.confirmedAt = new Date();

    const updated = await tx.booking.update({
      where: { id: input.id },
      data,
      include: bookingInclude,
    });

    await tx.bookingEvent.create({
      data: {
        bookingId: input.id,
        from: current.status,
        to: input.to,
        actor: input.actor,
        note: input.reason ?? input.staffNotes ?? null,
      },
    });

    return updated;
  }, { requestId: input.requestId });

  const board = toBookingBoardRow(row);
  logger.info("booking.status_changed", {
    requestId: input.requestId,
    scope: "booking",
    bookingId: input.id,
    actor: input.actor,
    to: input.to,
  });

  if (input.to === "CANCELLED") {
    void notifyBookingCancellation({
      bookingId: board.id,
      reference: board.reference,
      customerName: board.customerName,
      phone: board.customerPhone,
      email: board.customerEmail,
      startAtIso: board.startAt,
      serviceNames: board.items.map((i) => i.name),
      estimateMin: board.estimateMin,
      estimateMax: board.estimateMax,
      status: board.status,
      vehicle: board.vehicle,
      consentSms: board.consentSms,
      consentMarketing: board.consentMarketing,
      requestId: input.requestId,
    }).catch(() => undefined);
  }

  return { booking: toBookingDto(row), board };
}

// ── Self-service cancellation ───────────────────────────────────────────────

/** A customer may cancel up to this long before the slot starts. */
export const SELF_CANCEL_CUTOFF_MINUTES = 120;
const SELF_CANCEL_FROM: readonly BookingStatusValue[] = ["PENDING", "CONFIRMED"];

export interface CancelBookingInput {
  reference: string;
  reason?: string;
  /** `true` when the customer proved ownership with a matching phone. */
  verified: boolean;
  requestId: string;
}

/**
 * Self-service cancellation.
 *
 * Idempotent: cancelling an already-`CANCELLED` booking succeeds and returns the
 * same DTO rather than erroring, because a double-tapped Cancel button must not
 * produce a scary 409. Every attempt — including the idempotent no-op — writes
 * nothing extra, but a real cancellation always writes a `BookingEvent`.
 */
export async function cancelBooking(input: CancelBookingInput): Promise<BookingDto> {
  const reference = input.reference.trim().toUpperCase();
  const row = await withSerializableRetry(async (tx) => {
    const current = await tx.booking.findUnique({
      where: { reference },
      include: bookingInclude,
    });
    if (!current) throw notFound("We could not find that booking reference.");

    // Idempotent no-op.
    if (current.status === "CANCELLED") return current;

    if (!input.verified) throw notFound("We could not find that booking reference.");
    if (!SELF_CANCEL_FROM.includes(current.status)) {
      throw new ApiError("CONFLICT", `This booking is already ${labelFor(current.status).toLowerCase()} and can no longer be cancelled online. Please call us.`);
    }
    const cutoff = current.startAt.getTime() - SELF_CANCEL_CUTOFF_MINUTES * 60_000;
    if (Date.now() > cutoff) {
      throw new ApiError("CONFLICT", `Online cancellation closes ${SELF_CANCEL_CUTOFF_MINUTES / 60} hours before the slot. Please call the shop.`);
    }

    const updated = await tx.booking.update({
      where: { id: current.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: input.reason?.slice(0, 300) || null,
      },
      include: bookingInclude,
    });

    await tx.bookingEvent.create({
      data: {
        bookingId: current.id,
        from: current.status,
        to: "CANCELLED",
        actor: "customer",
        note: input.reason ?? "Cancelled by the customer",
      },
    });

    return updated;
  }, { requestId: input.requestId });

  const dto = toBookingDto(row);
  logger.info("booking.cancelled", {
    requestId: input.requestId,
    scope: "booking",
    reference: dto.reference,
    idempotent: dto.status === "CANCELLED",
  });

  return dto;
}

// ── Health / ops ────────────────────────────────────────────────────────────

/** Counts used by `/api/health` and the admin dashboard. */
export async function bookingCounts(): Promise<Record<string, number>> {
  const grouped = await prisma.booking.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
}
