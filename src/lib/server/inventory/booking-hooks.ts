/**
 * BOOKING → INVENTORY LIFECYCLE BINDINGS
 * ============================================================================
 * The four moments stock cares about in a booking, and nothing else:
 *
 *   PENDING → CONFIRMED   check availability, then hold the parts (TTL)
 *   * → CANCELLED         release every HELD hold — the parts are still on the shelf
 *   hold expires (cron)   release automatically, mark EXPIRED
 *   IN_PROGRESS → READY   CONSUME each hold as a ledger row against the booking
 *                          / COMPLETED
 *
 * ── WHAT THIS FILE IS, AND WHAT IT IS NOT ────────────────────────────────────
 * A2 owns the stock engine (`reserve` / `releaseForBooking` / `consume` /
 * `expireHolds`) and the bill-of-materials arithmetic
 * (`deriveFromBooking`). This file owns the *booking* half only:
 *
 *   - WHEN each hook fires, and what it does when the booking is not in the
 *     state that hook belongs to;
 *   - IDEMPOTENCY, at a layer above A2's, so a webhook retry, a double-tapped
 *     status button or a replayed cron never double-reserves and never
 *     double-consumes;
 *   - the STAFF READ MODEL (`getBookingPartsSnapshot`) that the booking panel
 *     renders. That model is mine and it is deliberately cost-free.
 *
 * Nothing here writes stock directly. There is exactly one write path: A2's.
 * A booking cancelled between this file's read pass and `reserve()` can leave a
 * 24-hour hold behind; the TTL sweep collects it, and `available` is never
 * broken by it. Wire `onBookingCancelled` after `changeBookingStatus` returns.
 *
 * ── WHY AVAILABILITY IS CHECKED BEFORE THE PROMISE ───────────────────────────
 * A stockout is not a supply problem here; it is a customer standing at the
 * counter with their car already up on the lift. So the check happens at the
 * moment the shop makes the promise (`CONFIRMED`), not afterwards.
 *
 * `getBookingPartsAvailability()` answers "can we do this job on this date?"
 * and is logged for the record. It is deliberately NOT load-bearing: it is a
 * read, so it has a window in which somebody else takes the last filter. The
 * authoritative answer is the one `reserve()` computes atomically while it
 * takes the hold — `ReserveResult.blocked`.
 *
 * ── CONCURRENCY ─────────────────────────────────────────────────────────────
 * Everything this file owns runs inside `withSerializableRetry` — the same
 * primitive the booking engine uses for its bay-capacity race. A2's writes open
 * their own SERIALIZABLE transaction, so the read/gate pass and the write pass
 * are separate by design: the guard that makes the split safe is A2's
 * conditional `UPDATE`, which refuses rather than clamps. Two counters
 * confirming two bookings that both need the last oil filter cannot both
 * commit — one is aborted with `P2034`, retried, sees the committed hold, and
 * writes a shortfall instead.
 *
 * ── ONE TRAP WORTH NAMING ───────────────────────────────────────────────────
 * `reserve()` treats an EXPLICIT `items` list as "staff named these on purpose",
 * so every line in it is blocking. The booking path must therefore pass
 * `fromServices: true` and let A2 derive the BOM, or a short wiper blade would
 * block a customer's brake job. That one boolean is the difference between a
 * soft warning and a lost customer.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT DO ─────────────────────────────────
 *  - It does not block a booking for a non-blocking part.
 *  - It never derives a quantity it cannot stand behind: if neither the bill of
 *    materials nor the hold yields a positive whole number, it consumes nothing
 *    and reports the line instead.
 *  - It reads no cost, margin or supplier field. See
 *    {@link getBookingPartsSnapshot}.
 *  - It does not change a single customer-facing booking step. The wizard is
 *    untouched; the honesty copy that depends on these results is a content
 *    request, not an implementation detail.
 */
import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma, withSerializableRetry } from "@/lib/server/db";
import { logger } from "@/lib/logger";
import {
  deriveFromBooking,
  reserve,
  releaseForBooking,
  consume,
  expireHolds,
  type DerivedRequirement,
} from "@/lib/server/inventory/reservations";
import { getBookingPartsAvailability } from "@/lib/server/inventory/availability";
import type { PostMovementContext } from "@/lib/server/inventory/stock-engine";
import {
  PRODUCT_KINDS,
  RESERVATION_STATUSES,
  UNITS,
  type ProductKindValue,
  type ReservationDto,
  type ReservationStatusValue,
  type ReserveResult,
  type UnitValue,
} from "@/lib/inventory-types";

/** A Prisma transaction handle. Matches A2's `Tx`. */
export type InventoryTx = Prisma.TransactionClient;

// ── Options ──────────────────────────────────────────────────────────────────

export interface BookingHookOptions {
  /** Correlates the log line with the request that triggered the hook. */
  requestId?: string;
  actorId?: string | null;
  /** Denormalised onto the ledger row so history survives a deleted account. */
  actorName?: string | null;
  /** Injectable clock. Tests pass it; production never does. */
  now?: Date;
}

export interface ConfirmHookOptions extends BookingHookOptions {
  /** Defaults to A2's 24h clamp. Never "no expiry". */
  ttlMinutes?: number;
}

/**
 * Booking states in which the parts are still physically on the shelf and the
 * shop is owed them back. A consumption must never be written for these.
 *
 * A DEAD list, not an allowed list, so that adding a terminal status later
 * forces a decision here instead of silently consuming into it.
 */
const BOOKING_DEAD_STATES: ReadonlySet<string> = new Set(["CANCELLED", "NO_SHOW"]);

function toCtx(options: BookingHookOptions): PostMovementContext {
  return {
    actorId: options.actorId ?? null,
    actorName: options.actorName ?? null,
    ...(options.requestId !== undefined ? { requestId: options.requestId } : {}),
  };
}

// ── Normalisation helpers ────────────────────────────────────────────────────

const UNIT_VALUES: ReadonlySet<string> = new Set<string>(UNITS);
const KIND_VALUES: ReadonlySet<string> = new Set<string>(PRODUCT_KINDS);
const STATUS_VALUES: ReadonlySet<string> = new Set<string>(RESERVATION_STATUSES);

function toUnit(value: string): UnitValue {
  return UNIT_VALUES.has(value) ? (value as UnitValue) : "EA";
}

function toKind(value: string): ProductKindValue {
  return KIND_VALUES.has(value) ? (value as ProductKindValue) : "OTHER";
}

function toStatus(value: string): ReservationStatusValue {
  return STATUS_VALUES.has(value) ? (value as ReservationStatusValue) : "HELD";
}

/**
 * A reason is mandatory for every write, and "because" is not a reason. A blank
 * reason is replaced with an honest description of *what* happened rather than
 * silently discarded, and the caller logs the substitution.
 */
function normaliseReason(raw: string | null | undefined, fallback: string): { reason: string; substituted: boolean } {
  const trimmed = (raw ?? "").trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return { reason: fallback, substituted: true };
  return { reason: trimmed.slice(0, 300), substituted: false };
}

function positiveWhole(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

// ── Booking context (reads only) ─────────────────────────────────────────────

/**
 * One product this booking needs.
 *
 * `qtyNeeded` and `isBlocking` come straight from A2's `deriveFromBooking`, so
 * the multiplication (`qtyPerService × BookingItem.quantity`) and the
 * blocking-wins aggregation exist in exactly one place. This type adds only the
 * display and reporting fields the panel needs.
 */
export interface BomLine {
  productId: string;
  sku: string;
  name: string;
  size: string | null;
  kind: ProductKindValue;
  unit: UnitValue;
  qtyNeeded: number;
  isBlocking: boolean;
  /** Names of the services that pull it in. Staff context for the panel. */
  usedBy: string[];
  isActive: boolean;
}

export interface Bom {
  lines: BomLine[];
  serviceIds: string[];
  /** At least one booking item carried a service we could look up. */
  hasServiceRows: boolean;
  /**
   * The booking has items with no `serviceId` — a package, snapshotted as a
   * single priced line. Packages carry no parts list, so nothing can be
   * derived. Reported, never guessed at.
   */
  hasUnservicedItems: boolean;
  /** `ServicePartRequirement` rows for this booking whose qty is unusable. */
  defects: Array<{ productId: string; serviceId: string; qtyPerService: number }>;
}

interface BookingStatusRow {
  id: string;
  reference: string;
  status: string;
}

async function readBookingStatus(tx: InventoryTx, bookingId: string): Promise<BookingStatusRow | null> {
  return tx.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, reference: true, status: true },
  });
}

/**
 * Builds the booking's bill of materials from A2's derivation plus the product
 * metadata and service names a staff screen needs.
 *
 * Read-only. Two queries after A2's derivation, both cheap and both optional in
 * the sense that a failure here degrades the panel copy rather than the stock.
 */
async function loadBom(tx: InventoryTx, bookingId: string): Promise<Bom> {
  const items = await tx.bookingItem.findMany({
    where: { bookingId },
    select: { serviceId: true, name: true },
    orderBy: { id: "asc" },
  });
  const serviceIds = [...new Set(items.flatMap((i) => (i.serviceId === null ? [] : [i.serviceId])))];
  const hasUnservicedItems = items.length > serviceIds.length;

  const derived: DerivedRequirement[] = await deriveFromBooking(tx, bookingId);
  if (derived.length === 0) {
    return { lines: [], serviceIds, hasServiceRows: serviceIds.length > 0, hasUnservicedItems, defects: [] };
  }

  const productIds = derived.map((d) => d.productId);
  const [products, requirements] = await Promise.all([
    tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sku: true, name: true, size: true, kind: true, unit: true, isActive: true },
    }),
    tx.servicePartRequirement.findMany({
      where: { serviceId: { in: serviceIds }, productId: { in: productIds } },
      select: { serviceId: true, productId: true, qtyPerService: true },
      orderBy: [{ productId: "asc" }, { serviceId: "asc" }],
    }),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const nameByService = new Map<string, string>();
  for (const item of items) {
    if (item.serviceId !== null && !nameByService.has(item.serviceId)) nameByService.set(item.serviceId, item.name);
  }

  const usedBy = new Map<string, string[]>();
  for (const req of requirements) {
    const list = usedBy.get(req.productId) ?? [];
    const serviceName = nameByService.get(req.serviceId);
    if (serviceName !== undefined && !list.includes(serviceName)) list.push(serviceName);
    usedBy.set(req.productId, list);
  }

  const defects = requirements
    .filter((r) => !positiveWhole(r.qtyPerService))
    .map((r) => ({ productId: r.productId, serviceId: r.serviceId, qtyPerService: r.qtyPerService }));

  const lines: BomLine[] = derived.flatMap((d) => {
    const product = productById.get(d.productId);
    if (!product) return [];
    return [
      {
        productId: d.productId,
        sku: product.sku,
        name: product.name,
        size: product.size,
        kind: toKind(product.kind),
        unit: toUnit(product.unit),
        qtyNeeded: d.qty,
        isBlocking: d.isBlocking,
        usedBy: usedBy.get(d.productId) ?? [],
        isActive: product.isActive,
      },
    ];
  });

  return { lines, serviceIds, hasServiceRows: serviceIds.length > 0, hasUnservicedItems, defects };
}

// ── Reservation reads (for the panel and the idempotency gates) ──────────────

const reservationSelect = {
  id: true,
  productId: true,
  qty: true,
  status: true,
  expiresAt: true,
  releasedAt: true,
  releasedReason: true,
  createdAt: true,
  product: {
    select: {
      id: true,
      sku: true,
      name: true,
      size: true,
      kind: true,
      unit: true,
      isActive: true,
      level: { select: { onHand: true, reserved: true } },
    },
  },
} as const;

/**
 * One `select` for every read path, so the row type is derived from the query
 * rather than restated by hand. A hand-written type that drifts from the select
 * is the classic "the cast lied" bug.
 */
type ReservationRow = Prisma.ReservationGetPayload<{ select: typeof reservationSelect }>;

function toReservationDto(row: ReservationRow, bookingId: string): ReservationDto {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    productSku: row.product.sku,
    bookingId,
    qty: row.qty,
    status: toStatus(row.status),
    expiresAt: row.expiresAt.toISOString(),
    releasedAt: row.releasedAt ? row.releasedAt.toISOString() : null,
    releasedReason: row.releasedReason,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Hook: CONFIRMED ──────────────────────────────────────────────────────────

/**
 * `PENDING → CONFIRMED`: check availability, then hold the parts.
 *
 * Returns `null` — not an error — when there is genuinely nothing to do: the
 * booking does not exist, it is not `CONFIRMED`, or it has no bill of materials.
 * Absence of a BOM is normal, not a failure. Most services in this shop have no
 * parts list at all.
 *
 * Idempotent in two layers. Here: if every derived line is already held at or
 * above its required quantity with an unexpired hold, the engine is not called
 * at all. Below that, A2's `reserve()` tops up a partial hold rather than
 * stacking a second one, and `Reservation` is unique per
 * `(productId, bookingId)`. A replayed webhook, a retried status change and a
 * double-tapped button all land on the first branch.
 */
export async function onBookingConfirmed(
  bookingId: string,
  options: ConfirmHookOptions = {},
): Promise<ReserveResult | null> {
  const now = options.now ?? new Date();

  // ── Pass 1: read. Status gate, BOM, existing coverage. ─────────────────────
  const prepared = await withSerializableRetry(async (tx) => {
    const booking = await readBookingStatus(tx, bookingId);
    // Only a CONFIRMED booking may hold a promise. A replayed confirm for a
    // PENDING booking is not our moment, and one for a COMPLETED booking must
    // never resurrect a hold on parts that already left the shelf.
    if (!booking || booking.status !== "CONFIRMED") return null;

    const bom = await loadBom(tx, bookingId);
    if (bom.lines.length === 0) return null;

    const held = await tx.reservation.findMany({
      where: { bookingId, status: "HELD", expiresAt: { gt: now } },
      select: reservationSelect,
      orderBy: { productId: "asc" },
    });
    const heldQty = new Map(held.map((r) => [r.productId, r.qty]));
    const uncovered = bom.lines.filter((l) => (heldQty.get(l.productId) ?? 0) < l.qtyNeeded);

    return { booking, bom, held, uncovered };
  }, { requestId: options.requestId });

  if (prepared === null) return null;
    // `booking` is returned by the read pass for the caller's benefit but is not
    // needed here: the decision this function makes is purely about coverage.
    const { bom, held, uncovered } = prepared;

  // ── Fast path: everything already held. No write at all. ──────────────────
  if (uncovered.length === 0) {
    const expiresAt = held.reduce<Date>((latest, r) => (r.expiresAt > latest ? r.expiresAt : latest), now);
    logger.info(
      "inventory.booking_holds_replayed",
      {
        requestId: options.requestId,
        scope: "inventory/booking-hooks",
        bookingId,
        mode: "replayed",
        lines: bom.lines.length,
        units: bom.lines.reduce((sum, l) => sum + l.qtyNeeded, 0),
      },
      { requestId: options.requestId },
    );
    return {
      bookingId,
      reservations: held.map((r) => toReservationDto(r, bookingId)),
      shortfalls: [],
      blocked: false,
      expiresAt: expiresAt.toISOString(),
    };
  }

  // ── Advisory availability probe. Never load-bearing. ───────────────────────
  // A separate read has a window in which somebody else takes the last filter,
  // so this cannot decide whether the booking is blocked. It exists so the staff
  // panel and the owner can see WHICH service is short, per service, and so a
  // divergence between the probe and the authoritative hold is visible instead
  // of silent.
  const probe = await getBookingPartsAvailability(bookingId).catch((err: unknown) => {
    logger.warn(
      "inventory.availability_probe_failed",
      {
        requestId: options.requestId,
        scope: "inventory/booking-hooks",
        bookingId,
        err: err instanceof Error ? err.name : typeof err,
      },
      { requestId: options.requestId },
    );
    return null;
  });

  // ── Pass 2: the write. `fromServices: true` is load-bearing ────────────────
  // An explicit `items` list tells A2 "staff named these on purpose", which
  // marks every line blocking. Deriving here keeps each requirement's own
  // `isBlocking`, so a short wiper blade cannot block a brake job.
  const reserved = await reserve(
    {
      bookingId,
      fromServices: true,
      ...(options.ttlMinutes !== undefined ? { ttlMinutes: options.ttlMinutes } : {}),
    },
    toCtx(options),
  );

  const blockingProductIds = new Set(uncovered.filter((l) => l.isBlocking).map((l) => l.productId));
  const split = reserved.shortfalls.reduce(
    (acc, shortfall) => {
      if (blockingProductIds.has(shortfall.productId)) acc.blocking += 1;
      else acc.soft += 1;
      return acc;
    },
    { blocking: 0, soft: 0 },
  );

  const fields = {
    requestId: options.requestId,
    scope: "inventory/booking-hooks",
    bookingId,
    lines: uncovered.length,
    units: uncovered.reduce((sum, l) => sum + l.qtyNeeded, 0),
    blockingShortfalls: split.blocking,
    softShortfalls: split.soft,
    blocked: reserved.blocked,
  };
  // `warn` only when a BLOCKING part is short. A soft shortage happens
  // sometimes and must not page anybody; it goes on the panel and nowhere else.
  if (split.blocking > 0) {
    logger.warn("inventory.booking_holds_incomplete", fields, { requestId: options.requestId });
  } else if (split.soft > 0) {
    logger.info("inventory.booking_holds_soft_short", fields, { requestId: options.requestId });
  } else {
    logger.info("inventory.booking_holds_set", fields, { requestId: options.requestId });
  }
  if (bom.hasUnservicedItems) {
    // A package booking carries no parts list. Normal, but one line here means a
    // "why did nothing reserve?" question in six weeks has an answer.
    logger.info(
      "inventory.booking_package_no_bom",
      { requestId: options.requestId, scope: "inventory/booking-hooks", bookingId },
      { requestId: options.requestId },
    );
  }
  if (bom.defects.length > 0) {
    // A bad BOM row is a data bug, not a stock event, so it gets its own line.
    logger.error(
      "inventory.booking_bom_defects",
      { ...fields, defects: bom.defects.length },
      { requestId: options.requestId },
    );
  }
  if (probe !== null && !probe.canFulfil) {
    logger.info(
      "inventory.booking_blockers_detail",
      {
        requestId: options.requestId,
        scope: "inventory/booking-hooks",
        bookingId,
        blockers: probe.blockers.map((b) => ({ productId: b.productId, short: b.short })),
      },
      { requestId: options.requestId },
    );
  }
  if (probe !== null && probe.canFulfil === reserved.blocked) {
    // Advisory and authoritative agreeing is the normal case and costs nothing
    // to observe. `canFulfil` covers every part; `blocked` covers blocking parts
    // only, so equality here also means no soft-only shortage was escalated.
    logger.debug(
      "inventory.availability_probe_agreed",
      { requestId: options.requestId, scope: "inventory/booking-hooks", bookingId },
      { requestId: options.requestId },
    );
  } else if (probe !== null) {
    // Disagreement means the window between the probe and the hold actually
    // opened, or a non-blocking shortage flipped the aggregate. Worth seeing.
    logger.info(
      "inventory.availability_probe_diverged",
      { ...fields, probedCanFulfil: probe.canFulfil },
      { requestId: options.requestId },
    );
  }

  return reserved;
}

// ── Hook: release ────────────────────────────────────────────────────────────

/**
 * Releases every `HELD` hold on a booking and returns how many were released.
 *
 * Idempotent: the second call finds nothing `HELD` and returns 0. Safe to wire
 * to `CANCELLED`, to `NO_SHOW`, and to the `RESCHEDULED → PENDING` path — a
 * rescheduled booking must not carry the old job's parts into a new slot.
 */
export async function releaseBookingParts(
  bookingId: string,
  reason: string | null | undefined,
  options: BookingHookOptions = {},
): Promise<number> {
  const { reason: why, substituted } = normaliseReason(
    reason,
    "Booking cancelled — parts returned to available stock",
  );
  if (substituted) {
    logger.warn(
      "inventory.release_reason_substituted",
      { requestId: options.requestId, scope: "inventory/booking-hooks", bookingId },
      { requestId: options.requestId },
    );
  }

  // A2's `releaseForBooking` throws NOT_FOUND for an unknown booking. This hook
  // is fired from a lifecycle binding that must never turn a bad id into a 500,
  // so the existence check turns it into a plain `0` instead.
  const exists = await withSerializableRetry(
    async (tx) => (await readBookingStatus(tx, bookingId)) !== null,
    { requestId: options.requestId },
  );
  if (!exists) return 0;

  const result = await releaseForBooking(bookingId, why, toCtx(options));

  if (result.affected > 0) {
    logger.info(
      "inventory.booking_holds_released",
      { requestId: options.requestId, scope: "inventory/booking-hooks", bookingId, released: result.affected },
      { requestId: options.requestId },
    );
  } else {
    logger.debug(
      "inventory.booking_holds_release_noop",
      { requestId: options.requestId, scope: "inventory/booking-hooks", bookingId },
      { requestId: options.requestId },
    );
  }
  return result.affected;
}

/**
 * `* → CANCELLED`: the parts are still on the shelf, so the hold must go back.
 * A hold that is not released is a silent leak that starves the next customer.
 */
export async function onBookingCancelled(
  bookingId: string,
  reason: string,
  options: BookingHookOptions = {},
): Promise<number> {
  return releaseBookingParts(bookingId, reason, options);
}

// ── Hook: COMPLETED ──────────────────────────────────────────────────────────

export type ConsumeSkipReason =
  | "QTY_NOT_POSITIVE"
  | "PRODUCT_INACTIVE"
  | "NO_RESERVATION"
  | "REFUSED_BY_ENGINE";

export interface ConsumeSkip {
  productId: string;
  name: string;
  reason: ConsumeSkipReason;
  /** Human-readable, for the staff panel. Never shown to a customer. */
  detail: string;
}

export interface ConsumedPartRow {
  productId: string;
  sku: string;
  name: string;
  unit: UnitValue;
  qty: number;
  /** `onHand` immediately after the ledger row, so a variance is readable. */
  onHandAfter: number | null;
  movementId: string | null;
  consumedAt: string | null;
  actorName: string | null;
}

export interface ConsumeSummary {
  bookingId: string;
  /** Reservations converted in THIS call. 0 on an idempotent replay. */
  reservationsConsumed: number;
  linesConsumed: number;
  unitsConsumed: number;
  /** True when a `CONSUMED` reservation already existed — nothing re-written. */
  alreadyConsumed: boolean;
  /** Products we refused to consume, or the engine refused for us. */
  skipped: ConsumeSkip[];
  lines: ConsumedPartRow[];
  warnings: string[];
}

/**
 * `IN_PROGRESS → READY` / `COMPLETED`: the parts physically left the shelf, so
 * each hold becomes a `CONSUME` ledger row against the booking.
 *
 * THE QUANTITY: recomputed fresh from `ServicePartRequirement.qtyPerService ×
 * BookingItem.quantity`, so a BOM edited since the hold cannot silently change
 * the job. Where no bill-of-materials line exists for a held product we fall
 * back to the quantity on the reservation itself — that is what was promised,
 * not a guess. If neither yields a positive whole number we consume NOTHING for
 * that line and report it. A wrong consumption is a stock discrepancy nobody can
 * explain in six weeks; a reported skip is a five-second fix.
 *
 * A booking whose services have no bill of materials consumes nothing, logs
 * nothing, and succeeds.
 */
export async function onBookingCompleted(
  bookingId: string,
  actorId?: string,
  options: BookingHookOptions = {},
): Promise<ConsumeSummary> {
  const who = options.actorId ?? actorId ?? null;
  const actorName = options.actorName ?? null;
  // The ledger reason is mandatory. It names the job and, where known, the
  // staff member who closed it — the first thing anybody asks when a
  // consumption and a bay do not line up.
  const { reason } = normaliseReason(
    who === null ? null : `Parts used on job (staff ${who})`,
    "Parts used on job",
  );

  // ── Pass 1: read. Gate, idempotency, quantity. ────────────────────────────
  const prepared = await withSerializableRetry(async (tx) => {
    const booking = await readBookingStatus(tx, bookingId);
    if (!booking) {
      return { kind: "missing" as const };
    }

      // A dead booking must never consume. In CANCELLED and NO_SHOW the parts
      // are still on the shelf and the shop is owed them back. Consuming here
      // would be stock leaving for a job that never happened.
      //
      // A DEAD list rather than an allowed list, on purpose: a new terminal status
      // must be classified deliberately here, not admitted by default.
      if (BOOKING_DEAD_STATES.has(booking.status)) {
        return { kind: "dead" as const, bookingStatus: booking.status };
      }

    const reservations = await tx.reservation.findMany({
      where: { bookingId },
      select: reservationSelect,
      orderBy: { productId: "asc" },
    });

    // THE IDEMPOTENCY GATE. A `CONSUMED` row means the ledger already has the
    // entry. Report it and stop — a replayed webhook must not double-consume.
    const consumedRows = reservations.filter((r) => r.status === "CONSUMED");
    if (consumedRows.length > 0) {
      return { kind: "already" as const, consumedRows };
    }

    const held = reservations.filter((r) => r.status === "HELD");
    const bom = await loadBom(tx, bookingId);
    const bomByProduct = new Map(bom.lines.map((l) => [l.productId, l]));

    const items: Array<{ productId: string; qty: number }> = [];
    const skipped: ConsumeSkip[] = [];
    const byProduct = new Map<string, ReservationRow>();

    for (const reservation of held) {
      byProduct.set(reservation.productId, reservation);
      const bomLine = bomByProduct.get(reservation.productId);
      const qty = bomLine ? bomLine.qtyNeeded : reservation.qty;

      if (!positiveWhole(qty)) {
        skipped.push({
          productId: reservation.productId,
          name: reservation.product.name,
          reason: "QTY_NOT_POSITIVE",
          detail:
            bomLine !== undefined
              ? `The bill of materials asks for ${qty} ${bomLine.unit.toLowerCase()} of this part, which is not a whole number above zero. Nothing was consumed.`
              : `The held quantity is ${qty}, which is not a whole number above zero. Nothing was consumed.`,
        });
        continue;
      }
      if (!reservation.product.isActive) {
        skipped.push({
          productId: reservation.productId,
          name: reservation.product.name,
          reason: "PRODUCT_INACTIVE",
          detail:
            "This product is marked inactive, so the ledger was not written. Re-activate it, or post the usage as an adjustment with a reason.",
        });
        continue;
      }
      items.push({ productId: reservation.productId, qty });
    }

    // Nothing was ever held. Either this job has no parts list (normal) or it
    // was confirmed before the stock engine was switched on (not normal, and
    // worth saying out loud). Either way we consume nothing.
    const neverHeld =
      bom.lines.length > 0
        ? bom.lines
            .filter((l) => !byProduct.has(l.productId))
            .map((l) => ({
              productId: l.productId,
              name: l.name,
              reason: "NO_RESERVATION" as const,
              detail: `This job needs ${l.qtyNeeded} ${l.unit.toLowerCase()} of this part, but nothing was ever held. Consume it manually from the stock screen.`,
            }))
        : [];

    return { kind: "go" as const, consumedRows: [], bom, items, skipped, neverHeld, byProduct };
  }, { requestId: options.requestId });

  // ── Report-only branches. Nothing is written. ─────────────────────────────
  if (prepared.kind === "missing") {
    logger.error(
      "inventory.booking_missing_on_completion",
      { requestId: options.requestId, scope: "inventory/booking-hooks", bookingId },
      { requestId: options.requestId },
    );
    return emptySummary(bookingId, ["This booking no longer exists, so no parts were consumed."]);
  }

    if (prepared.kind === "dead") {
      logger.warn(
        "inventory.booking_dead_on_completion",
        {
          requestId: options.requestId,
          scope: "inventory/booking-hooks",
          bookingId,
          bookingStatus: prepared.bookingStatus,
        },
        { requestId: options.requestId },
      );
      return emptySummary(bookingId, [
        "This booking is " +
          prepared.bookingStatus +
          ", so its parts were left on the shelf rather than consumed. The hold will be released.",
      ]);
    }

  if (prepared.kind === "already") {
    const movements = await readConsumeMovements(bookingId);
    const summary: ConsumeSummary = {
      ...emptySummary(bookingId, []),
      alreadyConsumed: true,
      lines: prepared.consumedRows.map((r) => consumedRow(r, movements.get(r.productId))),
    };
    logger.info(
      "inventory.booking_parts_consumed",
      {
        requestId: options.requestId,
        scope: "inventory/booking-hooks",
        bookingId,
        reservations: 0,
        units: 0,
        skipped: 0,
        replayed: true,
      },
      { requestId: options.requestId },
    );
    return summary;
  }

  const { bom, items, skipped, neverHeld, byProduct } = prepared;

  if (items.length === 0) {
    const allSkips = [...skipped, ...neverHeld];
    const warnings =
      bom.lines.length === 0
        ? bom.hasUnservicedItems
          ? ["This booking was made from a package, which carries no parts list, so nothing was consumed automatically."]
          : []
        : [`Nothing was consumed for this booking. ${allSkips.length} line(s) need a manual decision.`];
    if (warnings.length === 0) {
      // No bill of materials at all. Consume nothing, log nothing, succeed.
      logger.debug(
        "inventory.booking_no_bom_completed",
        { requestId: options.requestId, scope: "inventory/booking-hooks", bookingId },
        { requestId: options.requestId },
      );
    }
    return { ...emptySummary(bookingId, warnings), skipped: allSkips };
  }

  // ── Pass 2: the write. One SERIALIZABLE transaction inside `consume`. ─────
  const result = await consume({ bookingId, items, reason }, toCtx({ ...options, actorId: who, actorName }));

  // Anything the engine refused (a bay asked for a part that is not there) is
  // reported, never swallowed. Refusing is the correct behaviour.
  const refused: ConsumeSkip[] = result.refusals.map((r) => ({
    productId: r.productId,
    name: r.name,
    reason: "REFUSED_BY_ENGINE" as const,
    detail: r.message,
  }));

  const movements = await readConsumeMovements(bookingId);
  const lines = items.flatMap((item) => {
    const reservation = byProduct.get(item.productId);
    // The lookup cannot miss: `byProduct` was built from the same held rows
    // these items were built from. An unresolved line is dropped rather than
    // faked — invented zeros on a stock panel are worse than a short list.
    return reservation === undefined ? [] : [consumedRow(reservation, movements.get(item.productId), item.qty)];
  });

  const allSkips = [...skipped, ...neverHeld, ...refused];
  const summary: ConsumeSummary = {
    bookingId,
    reservationsConsumed: result.affected,
    linesConsumed: lines.length,
    unitsConsumed: lines.reduce((sum, l) => sum + l.qty, 0),
    alreadyConsumed: false,
    skipped: allSkips,
    lines,
    warnings:
      allSkips.length > 0
        ? [`${allSkips.length} line(s) were not consumed and need a manual decision.`]
        : bom.hasUnservicedItems
          ? ["This booking came from a package, so only the individually-booked services had a parts list."]
          : [],
  };

  logger.info(
    "inventory.booking_parts_consumed",
    {
      requestId: options.requestId,
      scope: "inventory/booking-hooks",
      bookingId,
      reservations: summary.reservationsConsumed,
      units: summary.unitsConsumed,
      skipped: summary.skipped.length,
      replayed: false,
    },
    { requestId: options.requestId },
  );

  return summary;
}

// ── Hook: expiry ─────────────────────────────────────────────────────────────

/**
 * Cron sweep: a hold that never expires becomes a permanent phantom shortage.
 *
 * Idempotent by construction — A2 claims each due hold with a conditional
 * `status: "HELD"` transition before releasing it, so a retried run, a manual
 * run and a scheduled run firing together cannot double-release and cannot
 * drive `reserved` negative.
 *
 * `now` is accepted for call-site symmetry with the rest of this module. A2's
 * `expireHolds()` currently reads the wall clock itself, so a test that injects
 * a clock will not yet be able to drive the sweep deterministically — see the
 * A2 request in the report.
 */
export async function releaseExpiredReservations(
  now: Date = new Date(),
  options: Pick<BookingHookOptions, "requestId" | "actorName"> = {},
): Promise<number> {
  const startedAt = now.getTime();
  const result = await expireHolds();

  if (result.expired > 0 || result.failures.length > 0) {
    logger.info(
      "inventory.expired_holds_released",
      {
        requestId: options.requestId,
        scope: "inventory/booking-hooks",
        expired: result.expired,
        releasedUnits: result.releasedUnits,
        bookingsTouched: result.bookingsTouched,
        // A per-booking failure means one booking's holds are still stuck. It
        // must be visible, not swallowed into a count.
        failures: result.failures.length,
        elapsedMs: Date.now() - startedAt,
      },
      { requestId: options.requestId },
    );
  }
  if (result.failures.length > 0) {
    logger.error(
      "inventory.expired_holds_partial",
      {
        requestId: options.requestId,
        scope: "inventory/booking-hooks",
        failedBookings: result.failures.map((f) => f.bookingId),
      },
      { requestId: options.requestId },
    );
  }
  return result.expired;
}

// ── Staff read model (the panel's data contract) ────────────────────────────

/** What the front desk does about a shortage. */
export type ShortfallAction = "ORDER" | "SUBSTITUTE";

export interface BookingShortfallRow {
  productId: string;
  sku: string;
  name: string;
  size: string | null;
  unit: UnitValue;
  qtyNeeded: number;
  qtyHeld: number;
  /** Free stock right now, after every hold. THE number a promise is made against. */
  available: number;
  shortBy: number;
  isBlocking: boolean;
  /** True only when this shortage may stop the job. Never true for a soft part. */
  blocksBooking: boolean;
  action: ShortfallAction;
  /** Staff copy. Contains no cost, margin or supplier detail. */
  actionLabel: string;
  detail: string;
  usedBy: string[];
}

export interface BookingPartRow {
  reservationId: string;
  productId: string;
  sku: string;
  name: string;
  size: string | null;
  kind: ProductKindValue;
  unit: UnitValue;
  qty: number;
  status: ReservationStatusValue;
  isBlocking: boolean;
  onHand: number;
  reserved: number;
  available: number;
  expiresAt: string | null;
  releasedAt: string | null;
  releasedReason: string | null;
  usedBy: string[];
}

export interface BookingPartsSnapshot {
  bookingId: string;
  bookingReference: string | null;
  bookingStatus: string | null;
  /** False when the booking's services carry no parts list at all. */
  hasBom: boolean;
  held: BookingPartRow[];
  consumed: ConsumedPartRow[];
  released: BookingPartRow[];
  shortfalls: BookingShortfallRow[];
  /** "Reserve now" is offered. */
  canReserve: boolean;
  /** "Release" is offered. */
  canRelease: boolean;
  warnings: string[];
  generatedAt: string;
}

/**
 * Everything the staff panel needs for one booking.
 *
 * WHAT IS DELIBERATELY ABSENT: `costPrice`, `marginPct`, `estimatedCost`,
 * `supplierId` and `supplierName`. This payload is the panel's contract and the
 * panel is mounted on an admin surface. Keeping the money out of the payload —
 * rather than out of the markup — means a leak is impossible even if somebody
 * mounts this on the wrong page. Staff see cost and margin on the product
 * screens, which is where margin decisions are actually made.
 *
 * Read-only. Returns `null` for a booking that does not exist, so a caller can
 * render its own not-found state rather than an empty panel.
 */
export async function getBookingPartsSnapshot(
  bookingId: string,
  options: BookingHookOptions = {},
): Promise<BookingPartsSnapshot | null> {
  const now = options.now ?? new Date();

  return withSerializableRetry(
    async (tx) => {
      const booking = await readBookingStatus(tx, bookingId);
      if (!booking) return null;

      const [bom, reservations] = await Promise.all([
        loadBom(tx, bookingId),
        tx.reservation.findMany({
          where: { bookingId },
          select: reservationSelect,
          orderBy: [{ status: "asc" }, { productId: "asc" }],
        }),
      ]);
      const bomByProduct = new Map(bom.lines.map((l) => [l.productId, l]));
      const movements = await readConsumeMovements(bookingId);

      const toRow = (r: ReservationRow): BookingPartRow => {
        const level = r.product.level;
        const onHand = level?.onHand ?? 0;
        const reserved = level?.reserved ?? 0;
        return {
          reservationId: r.id,
          productId: r.productId,
          sku: r.product.sku,
          name: r.product.name,
          size: r.product.size,
          kind: toKind(r.product.kind),
          unit: toUnit(r.product.unit),
          qty: r.qty,
          status: toStatus(r.status),
          isBlocking: bomByProduct.get(r.productId)?.isBlocking ?? true,
          onHand,
          reserved,
          available: onHand - reserved,
          expiresAt: r.status === "HELD" ? r.expiresAt.toISOString() : null,
          releasedAt: r.releasedAt ? r.releasedAt.toISOString() : null,
          releasedReason: r.releasedReason,
          usedBy: bomByProduct.get(r.productId)?.usedBy ?? [],
        };
      };

      const held = reservations.filter((r) => r.status === "HELD").map(toRow);
      const consumed = reservations
        .filter((r) => r.status === "CONSUMED")
        .map((r) => consumedRow(r, movements.get(r.productId)));
      const released = reservations.filter((r) => r.status === "RELEASED" || r.status === "EXPIRED").map(toRow);

      const heldQty = new Map(held.map((h) => [h.productId, h.qty]));
      const levelByProduct = new Map(
        reservations.map((r) => [
          r.productId,
          r.product.level ? r.product.level.onHand - r.product.level.reserved : 0,
        ]),
      );
      const statusByProduct = new Map(reservations.map((r) => [r.productId, r.status as string]));

      const shortfalls: BookingShortfallRow[] = [];
      for (const line of bom.lines) {
        const qtyHeld = heldQty.get(line.productId) ?? 0;
        const shortBy = Math.max(0, line.qtyNeeded - qtyHeld);
        if (shortBy === 0) continue;
        // A line that has already been consumed or released is history, not a
        // shortfall the front desk still has to act on.
        const status = statusByProduct.get(line.productId);
        if (status === "CONSUMED" || status === "RELEASED") continue;

        const available = Math.max(0, levelByProduct.get(line.productId) ?? 0);
        shortfalls.push({
          productId: line.productId,
          sku: line.sku,
          name: line.name,
          size: line.size,
          unit: line.unit,
          qtyNeeded: line.qtyNeeded,
          qtyHeld,
          available,
          shortBy,
          isBlocking: line.isBlocking,
          blocksBooking: line.isBlocking,
          action: available <= 0 ? "ORDER" : "SUBSTITUTE",
          actionLabel:
            available <= 0
              ? line.isBlocking
                ? "Order from the supplier before the job"
                : "Order in the background — the job still goes ahead"
              : "Use what is on the shelf, or substitute an equivalent part",
          detail: line.isBlocking
            ? `Blocking part. This job cannot be promised until ${unitWord(line.unit, shortBy)} is on the shelf.`
            : "Non-blocking part. The job still goes ahead without it — just note it so nobody is surprised at the counter.",
          usedBy: line.usedBy,
        });
      }

      const warnings: string[] = [];
      if (bom.lines.length === 0) {
        warnings.push(
          bom.hasUnservicedItems
            ? "This booking was made from a package, which carries no parts list, so nothing can be held or consumed automatically."
            : "No parts list is recorded for this booking's services, so there is nothing to hold or consume. That is normal for services without stock items.",
        );
      }
      if (bom.defects.length > 0) {
        warnings.push(
          `${bom.defects.length} bill-of-materials line(s) were skipped because their per-service quantity is not a whole number above zero. Fix the parts list before the job.`,
        );
      }
      if (held.length === 0 && consumed.length === 0 && bom.lines.length > 0) {
        warnings.push("Nothing has ever been held for this booking. Use “Reserve now” once stock has arrived.");
      }
      const oversold = [...held, ...released].filter((r) => r.available < 0);
      if (oversold.length > 0) {
        warnings.push(
          `${oversold.length} line(s) show negative available stock. The shelf and the system disagree — run a stock count before trusting these numbers.`,
        );
      }

      const isFinished = booking.status === "COMPLETED";
      const isDead = booking.status === "CANCELLED" || booking.status === "NO_SHOW";

      return {
        bookingId: booking.id,
        bookingReference: booking.reference,
        bookingStatus: booking.status,
        hasBom: bom.lines.length > 0,
        held,
        consumed,
        released,
        shortfalls,
        canReserve: !isFinished && !isDead && bom.lines.length > 0,
        canRelease: !isFinished && held.length > 0,
        warnings,
        generatedAt: now.toISOString(),
      };
    },
    { requestId: options.requestId },
  );
}

// ── Small shared helpers ─────────────────────────────────────────────────────

interface ConsumeMovementRow {
  id: string;
  productId: string;
  onHandAfter: number;
  actorName: string | null;
  createdAt: Date;
}

/**
 * The `CONSUME` ledger rows written against a booking, newest first per product.
 * Read-only here — the ledger is append-only, and A2's `consume()` is its only
 * writer.
 */
async function readConsumeMovements(bookingId: string): Promise<Map<string, ConsumeMovementRow>> {
  const rows = await prisma.stockMovement.findMany({
    where: { bookingId, kind: "CONSUME" },
    select: { id: true, productId: true, onHandAfter: true, actorName: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const latest = new Map<string, ConsumeMovementRow>();
  for (const row of rows) {
    if (!latest.has(row.productId)) latest.set(row.productId, row);
  }
  return latest;
}

function consumedRow(
  reservation: ReservationRow,
  movement: ConsumeMovementRow | undefined,
  qtyOverride?: number,
): ConsumedPartRow {
  return {
    productId: reservation.productId,
    sku: reservation.product.sku,
    name: reservation.product.name,
    unit: toUnit(reservation.product.unit),
    qty: qtyOverride ?? reservation.qty,
    onHandAfter: movement?.onHandAfter ?? null,
    movementId: movement?.id ?? null,
    consumedAt: movement ? movement.createdAt.toISOString() : null,
    actorName: movement?.actorName ?? null,
  };
}

function emptySummary(bookingId: string, warnings: string[]): ConsumeSummary {
  return {
    bookingId,
    reservationsConsumed: 0,
    linesConsumed: 0,
    unitsConsumed: 0,
    alreadyConsumed: false,
    skipped: [],
    lines: [],
    warnings,
  };
}

/** "1 filter" / "2 filters" without shipping a pluraliser. */
function unitWord(unit: UnitValue, qty: number): string {
  const noun =
    unit === "LITRE"
      ? "litre"
      : unit === "KG"
        ? "kg"
        : unit === "M"
          ? "m"
          : unit === "SET"
            ? "set"
            : unit === "PAIR"
              ? "pair"
              : "piece";
  return `${qty} ${noun}${qty === 1 ? "" : "s"}`;
}