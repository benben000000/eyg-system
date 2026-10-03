/**
 * RESERVATIONS — the soft, time-boxed hold against a booking.
 * ============================================================================
 * Why a reservation and not a decrement? Because the customer has not arrived
 * yet. If the booking cancels, the hold must come back; if the shop never shows
 * up, the hold must expire on its own. `Reservation.expiresAt` is what makes
 * that possible without anybody having to remember.
 *
 * ── THE ONE RACE THAT MATTERS ──────────────────────────────────────────────
 * Two bays, one filter, both grabbing it at the same moment. The hold is taken
 * by the SAME conditional UPDATE the engine uses for `RESERVE`:
 *
 *     UPDATE StockLevel
 *        SET reserved = reserved + n
 *      WHERE productId = $1 AND onHand - reserved >= n
 *      RETURNING onHand, reserved;
 *
 * Zero rows back means somebody else got there first. There is no read-then-
 * write fallback and no clamp; the item is reported as a **shortfall** with the
 * quantity that is actually available, so the counter can say "3 left" and the
 * booking flow can refuse to promise it.
 *
 * ── THE TRANSACTION ─────────────────────────────────────────────────────────
 * A whole `reserve()` runs in ONE `SERIALIZABLE` transaction:
 *   • items are processed in a deterministic (productId-sorted) order so two
 *     bookings touching the same set of SKUs take their locks in the same order
 *     and cannot deadlock against each other;
 *   • a shortfall on one item does NOT abort the others — a booking with four
 *     of five parts available is more useful than one with nothing;
 *   • `blocked` is true only when a *blocking* part is short. A short wiper
 *     blade is a warning; a short brake pad is a promise we must not make.
 *
 * ── RE-IDEMPOTENCE ──────────────────────────────────────────────────────────
 * `Reservation` has `@@unique([productId, bookingId])`, so re-reserving for the
 * same booking **tops up** the existing hold to the requested quantity rather
 * than stacking a second row on top of it. Without that, confirming a booking
 * twice would double-hold the parts and quietly sterilise the shelf.
 *
 * ── CONSUME IS PER ITEM ────────────────────────────────────────────────────
 * A bay fitting three of four parts must not be blocked by the fourth, so each
 * part is consumed in its own transaction: it either happens completely or not
 * at all. A refusal is reported, never clamped, and the rest of the job still
 * posts its ledger rows.
 * ============================================================================
 */
import "server-only";

import { Prisma } from "@prisma/client";

import { ApiError, conflict, notFound } from "@/lib/errors";
import type {
  MovementDto,
  ReleaseReservationsInput,
  ReservationDto,
  ReservationStatusValue,
  ReserveInput,
  ReserveResult,
} from "@/lib/inventory-types";
import { logger } from "@/lib/logger";
import { prisma, withSerializableRetry } from "@/lib/server/db";

import {
  appendMovement,
  ensureLevel,
  toStockLevelDto,
  type LevelSnapshot,
  type PostMovementContext,
} from "./stock-engine";
import { MAX_MOVEMENT_QTY, movementRefusalMessage, normaliseReason } from "./stock-engine.test-support";
import {
  RESERVE_TTL_DEFAULT_MINUTES,
  RESERVE_TTL_MAX_MINUTES,
  RESERVE_TTL_MIN_MINUTES,
} from "./validation.test-support";

type Tx = Prisma.TransactionClient;

// ── Read ceilings ───────────────────────────────────────────────────────────
//
// Every `findMany` in this module carries an explicit `take`. An unbounded read
// on a catalogue table is the enumeration primitive, and a booking cannot
// plausibly need more than a hundred lines or two hundred holds — so a request
// that claims otherwise is malformed, not legitimate.

/** Booking line items considered when deriving a bill of materials. */
export const MAX_BOOKING_ITEMS = 100;
/** Holds read in one pass. Matches the reservation list page ceiling. */
export const MAX_HOLDS_PER_BOOKING = 200;
/** Distinct products in one explicit `items: [...]` hold. */
export const MAX_RESERVE_ITEMS = 50;

// ── TTL ─────────────────────────────────────────────────────────────────────

/** A hold is never shorter than 5 minutes nor longer than 3 days. */
/**
 * What a hold is held FOR, as it goes in the ledger.
 *
 * A booking hold names the booking reference. A walk-in hold names the person. What
 * it must never do is write "Held for booking undefined" — which is exactly what a
 * template literal does when the bookingId is absent, and it would be permanent
 * history that nobody can act on.
 */
function holdLabel(input: ReserveInput): string {
  if (input.bookingId !== undefined) return `Held for booking ${input.bookingId}`;
  return "Held for a walk-in: " + (input.heldFor ?? "unnamed");
}

export function clampTtlMinutes(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return RESERVE_TTL_DEFAULT_MINUTES;
  return Math.min(RESERVE_TTL_MAX_MINUTES, Math.max(RESERVE_TTL_MIN_MINUTES, Math.trunc(raw)));
}

// ── DTO mapping ─────────────────────────────────────────────────────────────

const reservationInclude = {
  product: { select: { name: true, sku: true } },
  booking: { select: { reference: true } },
} as const;

type ReservationRow = Prisma.ReservationGetPayload<{ include: typeof reservationInclude }>;

export function toReservationDto(row: ReservationRow): ReservationDto {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    productSku: row.product.sku,
    bookingId: row.bookingId,
    bookingReference: row.booking?.reference ?? null,
    // A walk-in hold has no booking reference; it has a name.
    heldFor: row.bookingId === null ? (row.heldFor ?? null) : null,
    qty: row.qty,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    releasedAt: row.releasedAt ? row.releasedAt.toISOString() : null,
    releasedReason: row.releasedReason,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── The atomic statements (shared with the engine) ──────────────────────────

/**
 * THE ATOMIC HOLD. Identical guard to `postMovement({ kind: "RESERVE" })` — one
 * implementation of "take a hold", not two that can drift.
 */
function sqlTakeHold(productId: string, qty: number): Prisma.Sql {
  return Prisma.sql`
    UPDATE "StockLevel"
       SET "reserved" = "reserved" + ${qty},
           "updatedAt" = now()
     WHERE "productId" = ${productId}
       AND "onHand" - "reserved" >= ${qty}
    RETURNING "onHand", "reserved"
  `;
}

/**
 * Give the promise back. Guarded on `"reserved" >= qty` so a double release can
 * never drive `reserved` negative — which would *inflate* `available` and let the
 * shop promise the same unit twice, the mirror image of overselling.
 */
function sqlGiveBack(productId: string, qty: number): Prisma.Sql {
  return Prisma.sql`
    UPDATE "StockLevel"
       SET "reserved" = "reserved" - ${qty},
           "updatedAt" = now()
     WHERE "productId" = ${productId}
       AND "reserved" >= ${qty}
    RETURNING "onHand", "reserved"
  `;
}

/**
 * The oldest lot that has not been depleted, or `null` when there is no lot
 * history. FIFO on purpose: consuming new rubber first is how a shelf silently
 * ages out, and which batch left the shelf is the answer to "was the tyre I
 * fitted from March?".
 */
async function oldestOpenLot(tx: Tx, productId: string): Promise<string | null> {
  const lot = await tx.stockLot.findFirst({
    where: { productId, isDepleted: false },
    orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return lot?.id ?? null;
}

/** Spend the physical unit. Same availability guard as every other decrement. */
function sqlSpend(productId: string, qty: number): Prisma.Sql {
  return Prisma.sql`
    UPDATE "StockLevel"
       SET "onHand"  = "onHand" - ${qty},
           "updatedAt" = now()
     WHERE "productId" = ${productId}
       AND "onHand" - "reserved" >= ${qty}
    RETURNING "onHand", "reserved"
  `;
}

async function firstSnapshot(rows: LevelSnapshot[]): Promise<LevelSnapshot | null> {
  const row = rows[0];
  return row ?? null;
}

/**
 * Runs the atomic hold, repairing a missing `StockLevel` row first. The repair is
 * inside the transaction and its INSERT holds the row, so the re-run is still
 * atomic.
 */
async function takeHold(tx: Tx, productId: string, qty: number): Promise<LevelSnapshot | null> {
  const direct = await firstSnapshot(await tx.$queryRaw<LevelSnapshot[]>(sqlTakeHold(productId, qty)));
  if (direct) return direct;
  await ensureLevel(tx, productId);
  return firstSnapshot(await tx.$queryRaw<LevelSnapshot[]>(sqlTakeHold(productId, qty)));
}

async function availableOf(tx: Tx, productId: string): Promise<number> {
  const level = await tx.stockLevel.findUnique({
    where: { productId },
    select: { onHand: true, reserved: true },
  });
  return level ? level.onHand - level.reserved : 0;
}

// ── BOM derivation ──────────────────────────────────────────────────────────

export interface DerivedRequirement {
  productId: string;
  name: string;
  sku: string;
  /** Total across every occurrence of the service on the booking. */
  qty: number;
  /** True when ANY contributing requirement is blocking. */
  isBlocking: boolean;
}

/**
 * Expands a booking's services through `ServicePartRequirement`.
 *
 * `BookingItem.quantity` multiplies the BOM: a booking for 2 × PMS needs 2 oil
 * filters, not 1. Duplicate products across services are summed — two services
 * that both need a plug must not each reserve a full set independently, because
 * `Reservation` is unique per (product, booking) and a second row could never be
 * stored anyway.
 */
export async function deriveFromBooking(tx: Tx, bookingId: string): Promise<DerivedRequirement[]> {
  const items = await tx.bookingItem.findMany({
    where: { bookingId, serviceId: { not: null } },
    select: { serviceId: true, quantity: true },
    take: MAX_BOOKING_ITEMS,
  });
  const occurrences = new Map<string, number>();
  for (const item of items) {
    if (!item.serviceId) continue;
    occurrences.set(item.serviceId, (occurrences.get(item.serviceId) ?? 0) + Math.max(1, item.quantity));
  }
  if (occurrences.size === 0) return [];

  const requirements = await tx.servicePartRequirement.findMany({
    where: { serviceId: { in: [...occurrences.keys()] }, product: { isActive: true } },
    select: {
      serviceId: true,
      qtyPerService: true,
      isBlocking: true,
      product: { select: { id: true, sku: true, name: true } },
    },
    take: MAX_BOOKING_ITEMS,
  });

  const merged = new Map<string, DerivedRequirement>();
  for (const req of requirements) {
    const multiplier = occurrences.get(req.serviceId) ?? 1;
    const qty = req.qtyPerService * multiplier;
    const existing = merged.get(req.product.id);
    if (existing) {
      existing.qty += qty;
      // Blocking wins: if one service says "you cannot do this job without it",
      // the whole booking is blocked, not just that service's line.
      existing.isBlocking = existing.isBlocking || req.isBlocking;
    } else {
      merged.set(req.product.id, {
        productId: req.product.id,
        sku: req.product.sku,
        name: req.product.name,
        qty,
        isBlocking: req.isBlocking,
      });
    }
  }
  return [...merged.values()].filter((r) => r.qty > 0);
}

// ── Reserve ─────────────────────────────────────────────────────────────────

interface NormalisedItem {
  productId: string;
  qty: number;
  /** An explicitly-listed part is blocking: staff named it on purpose. */
  isBlocking: boolean;
  name: string;
}

/**
 * Holds stock for a booking.
 *
 * Partial success is the point: whatever can be held *is* held, and what could
 * not is reported as a shortfall with the number that is actually available.
 * `blocked` is the single field the booking flow reads to decide whether it may
 * promise a customer.
 */
export async function reserve(input: ReserveInput, ctx: PostMovementContext): Promise<ReserveResult> {
  const ttlMinutes = clampTtlMinutes(input.ttlMinutes);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  const result = await withSerializableRetry(
      async (tx) => {
        const now = new Date();

        // A walk-in hold has no booking row, so there is nothing to look up and
        // nothing to 404 on. Only a booking-scoped release can fail this way.
        if (input.bookingId !== undefined) {
          const booking = await tx.booking.findUnique({
            where: { id: input.bookingId },
            select: { id: true, reference: true },
          });
          if (!booking) throw notFound("Booking not found.");
        } else if (input.heldFor === undefined || input.heldFor.trim() === "") {
          // A hold with neither a booking nor a name cannot be attributed, and an
          // unattributable hold is a mystery when someone asks why a tyre is
          // spoken for.
          throw new ApiError("VALIDATION_ERROR", "Say who this hold is for.", {
            fields: { heldFor: ["A name or a plate number, so we know who it is for."] },
          });
        }

        const items = await resolveItems(tx, input);

        // No parts to hold is a legitimate no-op, not an error: most services have
        // no bill of materials. It is reported as an empty result so a caller
        // never has to distinguish "nothing to hold" from "nothing happened".
        if (items.length === 0) {
          return {
            bookingId: input.bookingId ?? null,
            heldFor: input.bookingId === undefined ? (input.heldFor ?? null) : null,
            reservations: [],
            shortfalls: [],
            blocked: false,
            expiresAt: expiresAt.toISOString(),
          } satisfies ReserveResult;
        }

        // What is already held for this target. Re-holding the same part for the
        // same job would double-count the promise.
        const existing = await tx.reservation.findMany({
          where: {
            bookingId: input.bookingId ?? null,
            ...(input.bookingId === undefined ? { heldFor: input.heldFor ?? null } : {}),
            status: "HELD",
            expiresAt: { gt: now },
          },
          // Only what the coverage map needs. The full DTO is not required to
          // decide whether an additional hold is necessary.
          select: { productId: true, qty: true },
          orderBy: { productId: "asc" },
        });
      const held = new Map(existing.map((r) => [r.productId, r.qty]));

      // Deterministic lock order. Two bookings that share SKUs take the same
      // locks in the same order, which is what stops a deadlock between them.
      const ordered = [...items].sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0));

      const reservations: ReservationDto[] = [];
      const shortfalls: ReserveResult["shortfalls"] = [];
      let blocked = false;

      for (const item of ordered) {
        const have = held.get(item.productId) ?? 0;
        const delta = item.qty - have;

          if (delta <= 0) {
            // Already holding at least what was asked for. Extend the window and
            // report the row; never add a second hold for the same part.
            //
            // Only a booking hold can be extended: the compound unique key is
            // (product, booking), so a walk-in has no key to extend and each
            // walk-in hold is its own promise.
            if (input.bookingId !== undefined) {
              const row = await tx.reservation.update({
                where: {
                  productId_bookingId: {
                    productId: item.productId,
                    bookingId: input.bookingId,
                  },
                },
                data: { expiresAt },
                include: reservationInclude,
              });
              reservations.push(toReservationDto(row));
              continue;
            }
          }
        const snapshot = await takeHold(tx, item.productId, delta);
        if (!snapshot) {
          // REFUSED. Not clamped, not retried as a read-then-write.
          shortfalls.push({
            productId: item.productId,
            name: item.name,
            requested: item.qty,
            available: await availableOf(tx, item.productId),
          });
          if (item.isBlocking) blocked = true;
          continue;
        }

        const created = await tx.reservation.create({
          data: {
            bookingId: input.bookingId ?? null,
            heldFor: input.bookingId === undefined ? (input.heldFor ?? null) : null,
            productId: item.productId,
            qty: delta,
            status: "HELD",
            expiresAt,
          },
          include: reservationInclude,
        });
        reservations.push(toReservationDto(created));

        // `qty` is signed against *availability*: a hold reduces what can be
        // promised even though nothing left the shelf, so `onHandAfter` is the
        // unchanged onHand. The `Reservation` row — not this movement — is the
        // record of who promised them and until when.
        await appendMovement(tx, {
          productId: item.productId,
          kind: "RESERVE",
          qty: -delta,
          onHandAfter: snapshot.onHand,
          reason: holdLabel(input),
          bookingId: input.bookingId ?? null,
          actorId: ctx.actorId,
          actorName: ctx.actorName,
        });
      }

      return {
        bookingId: input.bookingId ?? null,
        reservations,
        shortfalls,
        blocked,
        expiresAt: expiresAt.toISOString(),
      } satisfies ReserveResult;
    },
    { requestId: ctx.requestId },
  );

  logger.info("inventory.reserved", {
    scope: "inventory",
    requestId: ctx.requestId,
    bookingId: result.bookingId,
    // A walk-in hold has no booking, so the log line carries the name instead.
    heldFor: result.bookingId === null ? (input.heldFor ?? null) : null,
    held: result.reservations.length,
    short: result.shortfalls.length,
    blocked: result.blocked,
  });

  return result;
}

async function resolveItems(tx: Tx, input: ReserveInput): Promise<NormalisedItem[]> {
  if (input.fromServices === true) {
    // Deriving from services only makes sense for a real booking; a walk-in has
    // no job, so the caller must pass an explicit item list instead.
    if (input.bookingId === undefined) return [];
    const derived = await deriveFromBooking(tx, input.bookingId);
    return derived.map((d) => ({ productId: d.productId, qty: d.qty, isBlocking: d.isBlocking, name: d.name }));
  }

  const explicit = input.items ?? [];
  if (explicit.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "Nothing to hold.", {
      fields: { items: ["Send an item list, or set fromServices to true."] },
    });
  }

  const ids = [...new Set(explicit.map((i) => i.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, sku: true, name: true },
    take: MAX_RESERVE_ITEMS,
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new ApiError("VALIDATION_ERROR", "One of those items no longer exists.", {
      fields: { items: ["Please re-pick from the current list."] },
    });
  }

  // Summing duplicates keeps the hold within the (product, booking) unique key.
  const totals = new Map<string, number>();
  for (const item of explicit) {
    const next = (totals.get(item.productId) ?? 0) + Math.abs(Math.trunc(item.qty));
    if (next > MAX_MOVEMENT_QTY) {
      throw new ApiError("VALIDATION_ERROR", "That hold is larger than any real order.", {
        fields: { items: ["Reduce the quantity."] },
      });
    }
    totals.set(item.productId, next);
  }

  return [...totals.entries()].map(([productId, qty]) => ({
    productId,
    qty,
    // Staff named this part explicitly, so a shortage must block.
    isBlocking: true,
    name: byId.get(productId)?.name ?? "Unknown item",
  }));
}

// ── Release ─────────────────────────────────────────────────────────────────

export interface ReservationActionResult {
  reservations: ReservationDto[];
  movements: MovementDto[];
  stock: Array<{ productId: string; onHand: number; reserved: number; available: number }>;
  /** Rows this call actually changed. `0` on a no-op replay. */
  affected: number;
  /** Units moved back into availability. */
  units: number;
}

/**
 * Releases holds. **Only `HELD` rows are ever touched.**
 *
 * The caller may pass `statuses`, but it is ignored: "release" must never
 * un-consume a part that a bay already fitted to a car. A consumed row is not a
 * hold, and un-reserving it would inflate `available` and let the shop promise a
 * fitted part a second time.
 */
export async function release(
  input: ReleaseReservationsInput,
  ctx: PostMovementContext,
): Promise<ReservationActionResult> {
  const reason = normaliseReason(input.reason);
  if (reason.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "Please give a reason for releasing the hold.", {
      fields: { reason: ["A reason is required."] },
    });
  }
  return releaseHolds({ bookingId: input.bookingId, reason }, ctx, "RELEASED");
}

/**
 * The single implementation behind both the staff release and the cron expiry
 * sweep, so a hold released by hand and a hold released by the clock go through
 * identical arithmetic.
 */
export async function releaseHolds(
  args: {
    /** The booking to release against, or null for a walk-in hold. */
    bookingId: string | null;
    /**
     * Which walk-in's holds to release. Groups walk-in holds by name so a
     * release is attributable, exactly like a booking reference is.
     *
     * Two different walk-ins may each be waiting on the same product, so a
     * release must name which one — otherwise it would take back a promise that
     * belongs to somebody else.
     */
    heldFor?: string | null;
    reason: string;
  },
  ctx: PostMovementContext,
  targetStatus: "RELEASED" | "EXPIRED",
): Promise<ReservationActionResult> {
  const movements: MovementDto[] = [];
  const stock: ReservationActionResult["stock"] = [];
  let affected = 0;
  let units = 0;

  await withSerializableRetry(
    async (tx) => {
// A walk-in hold has no booking row, so there is nothing to look up and
        // nothing to 404 on. Only a booking-scoped release can fail this way.
        if (args.bookingId !== null) {
          const booking = await tx.booking.findUnique({
            where: { id: args.bookingId },
            select: { id: true, reference: true },
          });
          if (!booking) throw notFound("Booking not found.");
        }

      const rows = await tx.reservation.findMany({
          where: {
            bookingId: args.bookingId,
            // Grouping walk-in holds by name keeps a release attributable: two
            // different walk-ins may each be waiting on the same product, and
            // releasing by product alone would take back a promise that belongs
            // to somebody else.
            ...(args.heldFor !== undefined && args.heldFor !== null ? { heldFor: args.heldFor } : {}),
            status: "HELD",
          },
        include: reservationInclude,
        orderBy: { productId: "asc" },
        take: MAX_HOLDS_PER_BOOKING,
      });

      for (const row of rows) {
        // ── CLAIM FIRST ───────────────────────────────────────────────────
        // A conditional status transition. Two concurrent releasers (a human
        // and the cron sweep) both try this; exactly one sees `count === 1` and
        // only that one touches `reserved`. Without the claim, a double release
        // would drive `reserved` negative and *inflate* availability.
        const claimed = await tx.reservation.updateMany({
          where: { id: row.id, status: "HELD" },
          data: { status: targetStatus, releasedAt: new Date(), releasedReason: args.reason },
        });
        if (claimed.count !== 1) continue;

        const snapshot = await firstSnapshot(await tx.$queryRaw<LevelSnapshot[]>(sqlGiveBack(row.productId, row.qty)));
        if (!snapshot) {
          // `reserved` is smaller than the hold we just claimed. That can only
          // happen if something moved the promise without the row. The
          // transaction rolls back (the claim is undone with it) and the error
          // surfaces loudly rather than being papered over with a clamp.
          throw conflict("A hold on this item does not match the recorded stock.", {
            details: { productId: row.productId, held: row.qty },
          });
        }

        const movement = await appendMovement(tx, {
          productId: row.productId,
          kind: "RELEASE",
          qty: Math.abs(row.qty),
          onHandAfter: snapshot.onHand,
          reason: args.reason,
          bookingId: row.bookingId,
          actorId: ctx.actorId,
          actorName: ctx.actorName,
        });
        movements.push(movement);
        stock.push({ productId: row.productId, ...toStockLevelDto(snapshot, Number.NEGATIVE_INFINITY) });
        affected += 1;
        units += row.qty;
      }
    },
    { requestId: ctx.requestId },
  );

  logger.info("inventory.holds_released", {
    scope: "inventory",
    requestId: ctx.requestId,
    bookingId: args.bookingId,
    targetStatus,
    affected,
    units,
  });

  // A walk-in release has no bookingId to scope by, so it scopes by name —
  // the same grouping the release itself used.
  const reservations = await listReservations(
    args.bookingId !== null
      ? { bookingId: args.bookingId, page: 1, pageSize: 200 }
      : { heldFor: args.heldFor ?? null, page: 1, pageSize: 200 },
  );
  return { reservations: reservations.rows, movements, stock, affected, units };
}

// ── Consume ─────────────────────────────────────────────────────────────────

export interface ConsumeInput {
  bookingId: string;
  /** Optional partial consumption; defaults to the full held quantity. */
  items?: Array<{ productId: string; qty: number }> | undefined;
  reference?: string | undefined;
  reason?: string | undefined;
}

export interface ConsumeRefusal {
  productId: string;
  name: string;
  requested: number;
  available: number;
  message: string;
}

/**
 * A job that got fewer parts than its bill of materials asked for.
 *
 * Recorded alongside the movement rather than instead of it: the held parts
 * really did leave the shelf, so they belong in the ledger, but the car still
 * needs what was missing.
 */
export interface ConsumeShortfall {
  productId: string;
  name: string;
  /** What the bill of materials asked for. */
  requested: number;
  /** What was actually consumed. */
  available: number;
  /** requested - available. Always > 0. */
  short: number;
  /** Plain-English next action for the staff panel. */
  detail: string;
}

export interface ConsumeResult extends ReservationActionResult {
  refusals: ConsumeRefusal[];
  shortfalls: ConsumeShortfall[];
}

/** Internal signal: this item could not be spent. Rolls its transaction back. */
class ConsumeRefused extends Error {
  constructor(readonly refusal: ConsumeRefusal) {
    super(refusal.message);
    this.name = "ConsumeRefused";
  }
}

/**
 * Turns holds into a `CONSUME` ledger entry — the moment a bay actually fits a
 * part to a customer's car.
 *
 * Order matters and is deliberate: `reserved` is decremented FIRST, then
 * `onHand` is decremented under the availability guard. Returning the promise
 * before spending the physical unit is what makes the guard evaluate against the
 * right number; the other order would see `available` already reduced by the
 * hold and refuse a consumption that is legitimate.
 *
 * Each part runs in its OWN transaction, so a refusal on the fourth part does
 * not undo the first three. The refusal is reported, never clamped.
 */
export async function consume(input: ConsumeInput, ctx: PostMovementContext): Promise<ConsumeResult> {
  const movements: MovementDto[] = [];
  const stock: ReservationActionResult["stock"] = [];
  const refusals: ConsumeRefusal[] = [];

  /** Jobs that got fewer parts than the bill of materials asked for. */
  const shortfalls: ConsumeShortfall[] = [];

  const held = await prisma.reservation.findMany({
    where: { bookingId: input.bookingId, status: "HELD" },
    include: reservationInclude,
    orderBy: { productId: "asc" },
    take: MAX_HOLDS_PER_BOOKING,
  });

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, reference: true },
  });
  if (!booking) throw notFound("Booking not found.");

  const wanted = new Map<string, number>();
  for (const item of input.items ?? []) wanted.set(item.productId, Math.abs(Math.trunc(item.qty)));

  for (const row of held) {
    const requested = wanted.get(row.productId) ?? row.qty;
    const qty = Math.min(requested, row.qty);
    if (qty <= 0) continue;

      // The clamp is correct about the LEDGER — only what physically left the
      // shelf may be written — and silent about the JOB. A bill of materials asking
      // for 4 against a hold of 2 means the car still needs 2 filters, and closing
      // the booking as done with a part missing is how a customer is told their car
      // was serviced and it was not.
      const shortBy = requested - qty;
    if (shortBy > 0) {
      shortfalls.push({
        productId: row.productId,
        name: row.product.name,
        requested,
        available: qty,
        short: shortBy,
        detail:
          `This job needs ${requested} but only ${qty} were held, so ${shortBy} ` +
          `${shortBy === 1 ? "was" : "were"} never consumed. Order or substitute before handing the car back.`,
      });
    }

    try {
      const movement = await consumeOne({
        reservationId: row.id,
        bookingId: row.bookingId ?? null,
        bookingReference: row.bookingId === null ? null : booking.reference,
        productId: row.productId,
        name: row.product.name,
        qty,
        reference: input.reference ?? null,
        reason: input.reason ?? null,
        ctx,
      });
      movements.push(movement.dto);
      stock.push({ productId: row.productId, ...toStockLevelDto(movement.snapshot, Number.NEGATIVE_INFINITY) });
    } catch (err) {
      if (err instanceof ConsumeRefused) {
        refusals.push(err.refusal);
        continue;
      }
      throw err;
    }
  }

  logger.info("inventory.consumed", {
    scope: "inventory",
    requestId: ctx.requestId,
    bookingId: input.bookingId,
    consumed: movements.length,
    refused: refusals.length,
  });

  return {
    reservations: (await listReservations({ bookingId: input.bookingId, page: 1, pageSize: 200 })).rows,
    movements,
    stock,
    affected: movements.length,
    units: movements.reduce((sum, m) => sum + Math.abs(m.qty), 0),
    refusals,
    // Parts the job needed but never got. A partial consume is not a clean
    // one, and the caller must be able to say so rather than close the booking
    // believing the car was fully serviced.
    shortfalls,
  };
}

async function consumeOne(args: {
  reservationId: string;
  /** Null for a walk-in hold, which has no job to be consumed against. */
  bookingId: string | null;
  /**
   * Human code (e.g. `EYG-7F3K9A`) or a walk-in name, so the ledger row says
   * what it was for. A consumption nobody can attribute is not a record.
   */
  bookingReference: string | null;
  productId: string;
  name: string;
  qty: number;
  reference: string | null;
  reason: string | null;
  ctx: PostMovementContext;
}): Promise<{ dto: MovementDto; snapshot: LevelSnapshot }> {
  return withSerializableRetry(
    async (tx) => {
      const claimed = await tx.reservation.updateMany({
        where: { id: args.reservationId, status: "HELD" },
        data: { status: "CONSUMED", releasedAt: new Date(), releasedReason: args.reason ?? "Used on the job" },
      });
      if (claimed.count !== 1) {
        throw conflict("That hold is no longer held.", { details: { reservationId: args.reservationId } });
      }

      const givenBack = await firstSnapshot(await tx.$queryRaw<LevelSnapshot[]>(sqlGiveBack(args.productId, args.qty)));
      if (!givenBack) {
        throw conflict("A hold on this item does not match the recorded stock.", {
          details: { productId: args.productId, held: args.qty },
        });
      }

      const spent = await firstSnapshot(await tx.$queryRaw<LevelSnapshot[]>(sqlSpend(args.productId, args.qty)));
      if (!spent) {
        // Rolling back the whole item: the promise stays held and the shelf
        // stays as it was, because neither has moved. Throwing `ConsumeRefused`
        // aborts this transaction only.
        throw new ConsumeRefused({
          productId: args.productId,
          name: args.name,
          requested: args.qty,
          available: await availableOf(tx, args.productId),
          message: movementRefusalMessage("INSUFFICIENT_STOCK", {
            requested: args.qty,
            available: await availableOf(tx, args.productId),
          }),
        });
      }

      const movement = await appendMovement(tx, {
        productId: args.productId,
        kind: "CONSUME",
        qty: -Math.abs(args.qty),
        onHandAfter: spent.onHand,
        // Always a real sentence naming the job a person can go and look at.
        reason: args.reason ?? `Used on booking ${args.bookingReference}`,
        reference: args.reference,
        bookingId: args.bookingId,
        // FIFO: name WHICH batch left the shelf. Without this, a rubber-age
        // question ("what is left, and how old is it?") has no answer once two
        // deliveries of the same size are on the rack.
        lotId: await oldestOpenLot(tx, args.productId),
        actorId: args.ctx.actorId,
        actorName: args.ctx.actorName,
      });
      return { dto: movement, snapshot: spent };
    },
    { requestId: args.ctx.requestId },
  );
}

// ── Expiry sweep ────────────────────────────────────────────────────────────

export interface ExpirySweepResult {
  expired: number;
  releasedUnits: number;
  bookingsTouched: number;
  failures: Array<{ bookingId: string; error: string }>;
}

/**
 * Releases every hold whose TTL has passed. Driven by the cron route.
 *
 * Each hold is CLAIMED first with a conditional `status: "HELD"` transition, so
 * two overlapping cron invocations (a retry, a manual run and a schedule firing
 * at once) cannot double-release and cannot drive `reserved` negative.
 *
 * A booking whose accounting does not add up is logged and skipped rather than
 * being allowed to abort the whole sweep — one corrupt row must not leave every
 * other expired hold on the shelf forever.
 */
export async function expireHolds(limit: number = 200): Promise<ExpirySweepResult> {
  const now = new Date();
  const due = await prisma.reservation.findMany({
    where: { status: "HELD", expiresAt: { lte: now } },
    select: { bookingId: true },
    distinct: ["bookingId"],
    orderBy: { expiresAt: "asc" },
    take: Math.min(1_000, Math.max(1, Math.trunc(limit))),
  });

  const failures: ExpirySweepResult["failures"] = [];
  let expired = 0;
  let releasedUnits = 0;

  for (const { bookingId } of due) {
    try {
      const result = await releaseHolds(
        { bookingId, reason: "Hold expired before the customer arrived" },
        { actorId: null, actorName: "system:hold-expiry", requestId: undefined },
        "EXPIRED",
      );
      expired += result.affected;
      releasedUnits += result.units;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      logger.error("inventory.hold_expiry_failed", { scope: "inventory", bookingId, err: message });
      failures.push({ bookingId: bookingId ?? "unknown", error: message });
    }
  }

  logger.info("inventory.holds_expired", {
    scope: "inventory",
    expired,
    releasedUnits,
    failures: failures.length,
  });
  return { expired, releasedUnits, bookingsTouched: due.length, failures };
}

// ── Reads ───────────────────────────────────────────────────────────────────

export interface ReservationListResult {
  rows: ReservationDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** Ceiling on a reservation page. */
export const RESERVATION_PAGE_MAX = 200;

export async function listReservations(query: {
  bookingId?: string | undefined;
  /**
   * Scope to one walk-in's holds. Two different walk-ins may each be waiting on
   * the same product, so a release or a list for a walk-in has to name WHICH one
   * — scoping by product alone would mix promises that belong to different people.
   */
  heldFor?: string | null | undefined;
  productId?: string | undefined;
  status?: ReservationStatusValue | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}): Promise<ReservationListResult> {
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const pageSize = Math.min(RESERVATION_PAGE_MAX, Math.max(1, Math.trunc(query.pageSize ?? 50)));
  const where: Prisma.ReservationWhereInput = {};
  if (query.bookingId) where.bookingId = query.bookingId;
  if (query.heldFor) where.heldFor = query.heldFor;
  if (query.productId) where.productId = query.productId;
  if (query.status) where.status = query.status;

  const [rows, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: reservationInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.reservation.count({ where }),
  ]);

  return { rows: rows.map(toReservationDto), total, page, pageSize };
}

/**
 * What a single booking is holding, for the booking screen.
 *
 * `reserved` totals come from the LIVE `StockLevel`, so an expired-but-not-yet-
 * swept hold can never make the booking screen disagree with the shelf.
 */
export async function summaryForBooking(bookingId: string): Promise<{
  reservations: ReservationDto[];
  units: number;
  products: number;
  expiredUnits: number;
}> {
  const all = await listReservations({ bookingId, page: 1, pageSize: 200 });
  const held = all.rows.filter((r) => r.status === "HELD");
  const expired = all.rows.filter((r) => r.status === "EXPIRED");
  return {
    reservations: all.rows,
    units: held.reduce((sum, r) => sum + r.qty, 0),
    products: new Set(held.map((r) => r.productId)).size,
    expiredUnits: expired.reduce((sum, r) => sum + r.qty, 0),
  };
}

/** Exposed for A4: release every hold on a booking with an explicit reason. */
export async function releaseForBooking(
  bookingId: string,
  reason: string,
  ctx: PostMovementContext,
): Promise<ReservationActionResult> {
  return release({ bookingId, reason }, ctx);
}
