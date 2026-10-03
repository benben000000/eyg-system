/**
 * A7 · CI/CD & QA — the stock algorithm, transcribed from the contract.
 * ============================================================================
 * READ THIS BEFORE TRUSTING A GREEN TICK IN `concurrency.test.ts`
 * -------------------------------------------------------------
 * This file is **not** the production engine. It is the *specification*, written
 * in the only executable language available to a QA agent working in parallel
 * with the backend. A2 owns the real one at
 * `src/lib/server/inventory/stock-engine.ts`.
 *
 * It exists for one reason: the concurrency proof needs an implementation to
 * race. `concurrency.test.ts` runs three variants against the same database and
 * demands they *differ*:
 *
 *   1. `reserveConditional` — the compare-and-swap the brief mandates.
 *   2. `reserveNaive`       — read, then write unconditionally.
 *   3. the same naive pair wrapped in `withSerializableRetry`.
 *
 * If (1) and (2) produced the same outcome the suite would be measuring
 * nothing. They do not, and the difference is asserted explicitly. That is what
 * gives the suite teeth: it identifies the *distinguishing* property, so a
 * future refactor to the naive form is a detectable regression rather than a
 * silent one.
 *
 * WHAT IT IS NOT
 * --------------
 * It does not validate A2. The A2-facing assertions in `concurrency.test.ts`
 * are registered against the real module and skipped until it exists. When they
 * come alive, they run the identical schedules against the identical fake, so
 * "the algorithm is sound" and "the implementation is the algorithm" are two
 * separate claims proved by two separate tests.
 *
 * WHY COMPARE-AND-SWAP AND NOT RAW SQL
 * ------------------------------------
 * The brief specifies `UPDATE … WHERE onHand - reserved >= n RETURNING *`.
 * `onHand - reserved` is not expressible in Prisma's `where`, so the same
 * guarantee is reachable two ways: `$queryRaw`, or a CAS on the concrete
 * columns. Both re-evaluate their predicate against *current committed state*
 * at write time, which is the property that matters. This file implements the
 * CAS because a QA fake cannot parse SQL, and it is the design whose behaviour
 * a fake can model faithfully. Both designs are covered by the same schedules.
 * ============================================================================
 */

import type { FakeDb, FakeStockMovement } from "./fake-prisma";

/** Sign convention, from `PostMovementInput`'s doc comment. */
export const MOVEMENT_SIGN: Readonly<Record<string, 1 | -1 | 0>> = {
  /** Sets the baseline. Neither adds nor removes; it may only be the first. */
  OPENING: 0,
  RECEIVE: 1,
  TRANSFER_IN: 1,
  ADJUST_UP: 1,
  CONSUME: -1,
  ADJUST_DOWN: -1,
  SHRINK: -1,
  TRANSFER_OUT: -1,
  RETURN_TO_SUPPLIER: -1,
  /** `reserved` moves, `onHand` does not. */
  RESERVE: 0,
  RELEASE: 0,
};

export type Refusal =
  | "INSUFFICIENT_STOCK"
  | "INSUFFICIENT_AVAILABLE"
  | "NEGATIVE_QUANTITY"
  | "ZERO_QUANTITY"
  | "PRODUCT_INACTIVE"
  | "OPENING_ALREADY_SET"
  | "CAS_LOST";

export interface ReserveOutcome {
  ok: boolean;
  productId: string;
  bookingId: string;
  qty: number;
  reason?: Refusal;
  available: number;
  requested: number;
}

export interface ConsumeOutcome extends ReserveOutcome {
  onHandAfter: number;
}

// ── The naive implementation — the regression sentinel ─────────────────────

/**
 * The shape a well-meaning refactor produces: read the level, decide, write.
 *
 * Safe only if every caller is inside a SERIALIZABLE transaction that retries.
 * The moment `withSerializableRetry` is replaced by a bare `prisma` call — a
 * very reasonable-looking "simplification" — the guard is gone.
 */
export async function reserveNaive(
  db: FakeDb,
  input: { productId: string; bookingId: string; qty: number; now: Date },
): Promise<ReserveOutcome> {
  const level = await db.stockLevel.findUnique({ where: { productId: input.productId } });
  const onHand = level?.onHand ?? 0;
  const reserved = level?.reserved ?? 0;
  const available = onHand - reserved;

  if (input.qty <= 0) {
    return { ok: false, productId: input.productId, bookingId: input.bookingId, qty: input.qty, reason: input.qty === 0 ? "ZERO_QUANTITY" : "NEGATIVE_QUANTITY", available, requested: input.qty };
  }
  if (available < input.qty) {
    return { ok: false, productId: input.productId, bookingId: input.bookingId, qty: input.qty, reason: "INSUFFICIENT_AVAILABLE", available, requested: input.qty };
  }

  // The unguarded write. `where` selects by primary key only, so the decision
  // above is applied to whatever the row looks like *now*.
  await db.stockLevel.update({
    where: { productId: input.productId },
    data: { reserved: { increment: input.qty }, updatedAt: input.now },
  });
  await db.reservation.upsert({
    where: { productId_bookingId: { productId: input.productId, bookingId: input.bookingId } },
    create: {
      id: `res_${input.productId}_${input.bookingId}`,
      productId: input.productId,
      bookingId: input.bookingId,
      qty: input.qty,
      status: "HELD",
      expiresAt: new Date(input.now.getTime() + 24 * 60 * 60 * 1000),
      releasedAt: null,
      releasedReason: null,
      createdAt: input.now,
      updatedAt: input.now,
    },
    update: { qty: input.qty, status: "HELD", updatedAt: input.now },
  });

  return { ok: true, productId: input.productId, bookingId: input.bookingId, qty: input.qty, available: available - input.qty, requested: input.qty };
}

// ── The conditional write — the invariant-preserving implementation ─────────

/**
 * Compare-and-swap on the concrete columns.
 *
 * `where` carries `onHand` and `reserved` **as read a moment ago**, so the write
 * only lands if nothing changed in between. `count === 0` means somebody else
 * moved first: the decision was stale, so it is discarded and re-taken. There
 * is no window between "decide" and "commit" for a second caller to slip into,
 * because the decision and the write are one statement.
 *
 * The bounded retry is not an optimisation. A CAS can only have one winner per
 * read generation, so without a re-read loop a burst of N concurrent consumes
 * of a *sufficient* quantity would let exactly one through and refuse the rest
 * — safe, but wrong. Re-reading and re-deciding turns "loser" into "next in
 * line" and keeps the refusal meaningful: it means genuinely out of stock.
 *
 * NOTE — the availability check before the CAS is LOAD-BEARING, not a
 * convenience. The guard `{ productId, onHand, reserved }` says "nothing has
 * changed since I looked"; it says nothing about whether what I looked at was
 * *enough*. Reserving 5 against `onHand: 1, reserved: 0` matches that guard
 * perfectly and oversells the shelf. This exact bug was found by this suite's
 * own randomised-burst test, which is the argument for writing the burst at all.
 */
export async function reserveConditional(
  db: FakeDb,
  input: { productId: string; bookingId: string; qty: number; now: Date },
  casAttempts = 5,
): Promise<ReserveOutcome> {
  if (input.qty === 0) {
    const zero = await db.stockLevel.findUnique({ where: { productId: input.productId } });
    const zeroAvailable = (zero?.onHand ?? 0) - (zero?.reserved ?? 0);
    return { ok: false, productId: input.productId, bookingId: input.bookingId, qty: input.qty, reason: "ZERO_QUANTITY", available: zeroAvailable, requested: input.qty };
  }
  if (input.qty < 0) {
    const negative = await db.stockLevel.findUnique({ where: { productId: input.productId } });
    const negativeAvailable = (negative?.onHand ?? 0) - (negative?.reserved ?? 0);
    return { ok: false, productId: input.productId, bookingId: input.bookingId, qty: input.qty, reason: "NEGATIVE_QUANTITY", available: negativeAvailable, requested: input.qty };
  }

  let lastSeenAvailable = 0;
  for (let attempt = 0; attempt < casAttempts; attempt += 1) {
    const level = await db.stockLevel.findUnique({ where: { productId: input.productId } });
    const onHand = level?.onHand ?? 0;
    const reserved = level?.reserved ?? 0;
    const available = onHand - reserved;
    lastSeenAvailable = available;

    // Refuse BEFORE the write. The guard alone does not know what was enough.
    if (available < input.qty) {
      return {
        ok: false,
        productId: input.productId,
        bookingId: input.bookingId,
        qty: input.qty,
        reason: "INSUFFICIENT_AVAILABLE",
        available,
        requested: input.qty,
      };
    }

    const applied = await db.stockLevel.updateMany({
      where: { productId: input.productId, onHand, reserved },
      data: { reserved: { increment: input.qty }, updatedAt: input.now },
    });

    if (applied.count === 0) continue; // stale decision — re-read and re-decide

    // Only now, having won the write, is a hold created. A losing attempt leaves
    // no trace: no ledger row, no reservation, no movement of the shelf.
    await db.reservation.upsert({
      where: { productId_bookingId: { productId: input.productId, bookingId: input.bookingId } },
      create: {
        id: `res_${input.productId}_${input.bookingId}`,
        productId: input.productId,
        bookingId: input.bookingId,
        qty: input.qty,
        status: "HELD",
        expiresAt: new Date(input.now.getTime() + 24 * 60 * 60 * 1000),
        releasedAt: null,
        releasedReason: null,
        createdAt: input.now,
        updatedAt: input.now,
      },
      update: { qty: input.qty, status: "HELD", updatedAt: input.now },
    });

    return { ok: true, productId: input.productId, bookingId: input.bookingId, qty: input.qty, available: available - input.qty, requested: input.qty };
  }

  // Every attempt lost the write. Report the current truth, refuse, clamp never.
  const final = await db.stockLevel.findUnique({ where: { productId: input.productId } });
  const finalAvailable = (final?.onHand ?? 0) - (final?.reserved ?? 0);
  return {
    ok: false,
    productId: input.productId,
    bookingId: input.bookingId,
    qty: input.qty,
    reason: "INSUFFICIENT_AVAILABLE",
    available: finalAvailable,
    requested: input.qty,
  };
}

// ── Consume ─────────────────────────────────────────────────────────────────

/**
 * `CONSUME` removes the part from the shelf **and** clears its hold, so
 * `available = onHand - reserved` is unchanged by a consume. Only a consume that
 * cannot clear its own hold would move `available`, and that is refused.
 */
export async function consumeNaive(
  db: FakeDb,
  input: { productId: string; bookingId: string; qty: number; now: Date },
): Promise<ConsumeOutcome> {
  const level = await db.stockLevel.findUnique({ where: { productId: input.productId } });
  const onHand = level?.onHand ?? 0;
  const available = onHand - (level?.reserved ?? 0);
  if (onHand < input.qty) {
    return { ok: false, productId: input.productId, bookingId: input.bookingId, qty: input.qty, reason: "INSUFFICIENT_STOCK", available, requested: input.qty, onHandAfter: onHand };
  }
  const next = await db.stockLevel.update({
    where: { productId: input.productId },
    data: { onHand: { decrement: input.qty }, updatedAt: input.now },
  });
  return { ok: true, productId: input.productId, bookingId: input.bookingId, qty: input.qty, available, requested: input.qty, onHandAfter: next.onHand };
}

export async function consumeConditional(
  db: FakeDb,
  input: { productId: string; bookingId: string; qty: number; now: Date },
  casAttempts = 8,
): Promise<ConsumeOutcome> {
  for (let attempt = 0; attempt < casAttempts; attempt += 1) {
    const level = await db.stockLevel.findUnique({ where: { productId: input.productId } });
    const onHand = level?.onHand ?? 0;
    const reserved = level?.reserved ?? 0;
    const available = onHand - reserved;
    if (onHand < input.qty) {
      return { ok: false, productId: input.productId, bookingId: input.bookingId, qty: input.qty, reason: "INSUFFICIENT_STOCK", available, requested: input.qty, onHandAfter: onHand };
    }

    const applied = await db.stockLevel.updateMany({
      where: { productId: input.productId, onHand, reserved },
      data: { onHand: { decrement: input.qty }, reserved: { decrement: input.qty }, updatedAt: input.now },
    });
    if (applied.count === 0) continue;

    const fresh = await db.stockLevel.findUnique({ where: { productId: input.productId } });
    const freshOnHand = fresh?.onHand ?? 0;
    return { ok: true, productId: input.productId, bookingId: input.bookingId, qty: input.qty, available, requested: input.qty, onHandAfter: freshOnHand };
  }

  const final = await db.stockLevel.findUnique({ where: { productId: input.productId } });
  const finalOnHand = final?.onHand ?? 0;
  return {
    ok: false,
    productId: input.productId,
    bookingId: input.bookingId,
    qty: input.qty,
    reason: "INSUFFICIENT_STOCK",
    available: finalOnHand - (final?.reserved ?? 0),
    requested: input.qty,
    onHandAfter: finalOnHand,
  };
}

// ── Ledger arithmetic ───────────────────────────────────────────────────────

/**
 * Replays a product's ledger and returns the `onHand` it implies.
 *
 * This is the cross-check that makes the ledger trustworthy: the running total
 * on `StockMovement.onHandAfter` and the held `StockLevel.onHand` are written by
 * two different statements, and six weeks later they are the only two witnesses
 * to whether the shelf agrees with the system. Replaying must reproduce it.
 */
export function replayLedger(db: FakeDb, productId: string): {
  onHand: number;
  reserved: number;
  movements: number;
  lastOnHandAfter: number | null;
} {
  const movements = db
    .snapshot("stockMovement")
    .filter((row: FakeStockMovement) => row.productId === productId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  let onHand = 0;
  let reserved = 0;
  for (const movement of movements) {
    const kind = movement.kind;
    const sign = MOVEMENT_SIGN[kind];
    if (sign === undefined) throw new Error(`ledger contains an unknown movement kind "${kind}"`);

    if (kind === "OPENING") {
      onHand = Math.abs(movement.qty);
    } else if (kind === "RESERVE") {
      reserved += movement.qty;
    } else if (kind === "RELEASE") {
      reserved -= Math.abs(movement.qty);
    } else if (sign === 1) {
      onHand += movement.qty;
    } else if (sign === -1) {
      onHand -= Math.abs(movement.qty);
      // A CONSUME also clears the hold it is consuming, which is exactly why
      // consuming a reserved part leaves `available` unchanged: the part was
      // already promised, so taking it off the shelf does not make it any less
      // spoken for. A ledger that decremented `onHand` without decrementing
      // `reserved` would show the promise evaporating — and that is how a shop
      // ends up selling the same filter twice.
      if (kind === "CONSUME") reserved -= Math.abs(movement.qty);
    }
  }

  const last = movements.length > 0 ? movements[movements.length - 1] : undefined;
  return {
    onHand,
    reserved,
    movements: movements.length,
    lastOnHandAfter: last ? last.onHandAfter : null,
  };
}
