/**
 * THE ATOMIC STOCK ENGINE
 * ============================================================================
 * This is the most correctness-critical file in the project. There is exactly
 * one invariant to protect:
 *
 *     available = onHand − reserved        and available is NEVER negative
 *
 * Overselling the last oil filter means a customer arrives, the bay is occupied,
 * and the part is not there. Everything below exists to make that impossible
 * rather than unlikely.
 *
 * ── WHY A CONDITIONAL UPDATE AND NOT A READ-THEN-WRITE ─────────────────────
 *
 * The naive version is:
 *
 *     const level = await tx.stockLevel.findUnique({ where: { productId } });
 *     if (level.onHand - level.reserved < n) return refuse();
 *     await tx.stockLevel.update({ where: { productId }, data: { reserved: { increment: n } } });
 *
 * Two bays, one filter left, two requests arriving in the same millisecond:
 * both read `available = 1`, both pass the check, both write. The shelf now
 * owes two customers one filter. `SERIALIZABLE` alone does not save you here —
 * it would abort one of them, but only if the read and the write are in the
 * same transaction *and* the retry re-reads. Relying on a retry loop for a
 * correctness property is a design smell; relying on the database to evaluate
 * the guard in the same statement that does the write is not.
 *
 * So the guard and the mutation are ONE statement, and the database evaluates
 * the guard against the row version it is about to write:
 *
 *     UPDATE StockLevel
 *        SET reserved = reserved + n
 *      WHERE productId = $1
 *        AND onHand - reserved >= n        -- the guard
 *      RETURNING onHand, reserved;
 *
 * Under PostgreSQL's READ COMMITTED, a concurrent UPDATE of the same row makes
 * the second statement block on the row lock; when the first commits, the second
 * re-evaluates its WHERE against the *new* row version and matches zero rows.
 * (Under SERIALIZABLE — which is what we run in — Postgres may instead abort us
 * with `40001`, which `withSerializableRetry` retries; on the retry the guard
 * sees the committed value and returns zero rows.) Both paths end the same way:
 * **exactly one** of the two callers gets a row back.
 *
 * Zero rows back is a REFUSAL. It is never patched over with a clamp, never
 * retried as a read-then-write, and never reported as a success with a smaller
 * quantity. The caller gets the shortfall so the counter can say "3 left".
 *
 * ── WHY ONE WRITE PATH ─────────────────────────────────────────────────────
 *
 * `postMovement()` is the only function in the codebase that changes stock, for
 * every kind in `MovementKindValue`. One endpoint, one ledger row, one
 * mandatory reason — so "why is this number wrong?" always has an answer that
 * points at a row a human can read.
 *
 * `StockMovement` is append-only. Nothing in this file ever updates or deletes
 * a movement; a mistake is corrected by posting a *new* ADJUST that references
 * the wrong one in its reason.
 *
 * ── WHAT IS NEVER TRUSTED ──────────────────────────────────────────────────
 *
 *  - `qty` is validated (whole units, sane magnitude) and re-signed from the
 *    `kind`, never from the caller's sign.
 *  - `onHandAfter` is computed from `RETURNING`, never accepted as input.
 *  - `available` is never accepted as input, and is never clamped on read.
 *  - `idempotencyKey` de-duplicates a retried submit; a replay returns the
 *    ORIGINAL movement and does not double-apply. The same key used against a
 *    *different* product is a 409, not a silent cross-product replay.
 * ============================================================================
 */
import "server-only";

import type { Prisma } from "@prisma/client";

import { ApiError, conflict, notFound } from "@/lib/errors";
import type {
  MovementDto,
  MovementKindValue,
  MovementQuery,
  MovementRefusalReason,
  PostMovementInput,
  PostMovementRejection,
  PostMovementResult,
  ProductDto,
  StockLevelDto,
} from "@/lib/inventory-types";
import { MOVEMENT_KINDS } from "@/lib/inventory-types";
import { logger } from "@/lib/logger";
import { RATE_LIMIT_POLICIES, type RateLimitPolicy } from "@/lib/ratelimit";
import { Prisma as PrismaNs, prisma, withSerializableRetry } from "@/lib/server/db";

import {
  MAX_REASON_LENGTH,
  REFUSE_WHEN_INACTIVE,
  checkQuantity,
  ledgerQty,
  movementRefusalMessage,
  normaliseReason,
} from "./stock-engine.test-support";

/**
 * Read tier — generous, and fails OPEN like every other read tier. Availability
 * and the stock list must keep working when Redis is unreachable; the cost of
 * being briefly wide open on a cached read is lower than the cost of a 500 to a
 * mechanic standing at a shelf.
 */
export const inventoryReadLimiter: RateLimitPolicy = RATE_LIMIT_POLICIES["inventory.read"];

/**
 * Write tier — fails CLOSED, like every other write tier. A stock write is a
 * change to the shop's books; refusing it for 60 seconds is far cheaper than
 * allowing unbounded writes to them.
 */
export const inventoryWriteLimiter: RateLimitPolicy = RATE_LIMIT_POLICIES["inventory.write"];

/**
 * Count tier — the tightest of the three. A cycle count posts a burst of line
 * updates and then a batch of adjustments; anything beyond 30 lines a minute is
 * a stuck client or a script, not a person counting a shelf.
 */
export const inventoryCountLimiter: RateLimitPolicy = RATE_LIMIT_POLICIES["inventory.count"];

// ── Rows + DTO mapping ──────────────────────────────────────────────────────

/** `RETURNING` row from every conditional UPDATE below. */
export interface LevelSnapshot {
  onHand: number;
  reserved: number;
}

/** The bare `StockLevel` columns. Used for the "what was actually there" read. */
export type LevelRow = { onHand: number; reserved: number };

const movementKindSet: ReadonlySet<string> = new Set<string>(MOVEMENT_KINDS);

/**
 * `available` is the RAW difference, not `Math.max(0, …)`.
 *
 * Clamping the read would make `StockLevelDto.isOversold` permanently false and
 * hide the one condition that means "the books and the shelf have diverged".
 * The invariant makes negative values impossible; if one appears it is a bug in
 * some other code path, and the only useful response is to shout about it.
 */
export function toStockLevelDto(level: LevelRow, reorderPoint: number): StockLevelDto {
  const available = level.onHand - level.reserved;
  if (available < 0) {
    logger.error("stock.oversold_read", {
      scope: "inventory",
      onHand: level.onHand,
      reserved: level.reserved,
      available,
      note: "invariant violated — available must never be negative",
    });
  }
  return {
    onHand: level.onHand,
    reserved: level.reserved,
    available,
    isLow: available <= reorderPoint,
    isOversold: available < 0,
  };
}

const movementInclude = {
  product: { select: { name: true, sku: true } },
  booking: { select: { reference: true } },
} as const;

type MovementRow = PrismaNs.StockMovementGetPayload<{ include: typeof movementInclude }>;

/**
 * Maps a ledger row to the wire shape.
 *
 * `onHandAfter` is copied verbatim from the ledger. It was written inside the
 * same transaction as the `StockLevel` write, so the ledger can always
 * reconstruct the running total — and no caller can hand us a nicer number.
 */
export function toMovementDto(row: MovementRow): MovementDto {  return {
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    productSku: row.product.sku,
    kind: row.kind,
    qty: row.qty,
    onHandAfter: row.onHandAfter,
    reason: row.reason,
    reference: row.reference,
    bookingId: row.bookingId,
    bookingReference: row.booking?.reference ?? null,
    actorName: row.actorName,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── The atomic statements ───────────────────────────────────────────────────

type Tx = Prisma.TransactionClient;

/**
 * Receive / transfer in / adjust up. Cannot fail: adding to `onHand` can never
 * make `available` negative. Returns zero rows only if the `StockLevel` row is
 * missing, which `ensureLevel` repairs.
 */
const sqlIncrementOnHand = (productId: string, qty: number): PrismaNs.Sql => PrismaNs.sql`
  UPDATE "StockLevel"
     SET "onHand"  = "onHand" + ${qty},
         "updatedAt" = now()
   WHERE "productId" = ${productId}
  RETURNING "onHand", "reserved"
`;

/**
 * THE GUARD. Consume / adjust down / shrink / transfer out / return to supplier.
 *
 * `"onHand" - "reserved" >= qty` is evaluated by PostgreSQL against the row
 * version being written. A caller that cannot pay is not updated at all — there
 * is no code path that reduces `onHand` past what may still be promised.
 */
const sqlDecrementOnHand = (productId: string, qty: number): PrismaNs.Sql => PrismaNs.sql`
  UPDATE "StockLevel"
     SET "onHand"  = "onHand" - ${qty},
         "updatedAt" = now()
   WHERE "productId" = ${productId}
     AND "onHand" - "reserved" >= ${qty}
  RETURNING "onHand", "reserved"
`;

/**
 * The opening baseline. Absolute, not additive, and guarded on "no stock yet" so
 * two operators opening the same SKU cannot produce two baselines.
 */
const sqlSetOpening = (productId: string, qty: number): PrismaNs.Sql => PrismaNs.sql`
  UPDATE "StockLevel"
     SET "onHand"  = ${qty},
         "updatedAt" = now()
   WHERE "productId" = ${productId}
     AND "onHand" = 0
     AND "reserved" = 0
  RETURNING "onHand", "reserved"
`;

/** Reserve. See the file header — this is the statement two bays race on. */
const sqlIncrementReserved = (productId: string, qty: number): PrismaNs.Sql => PrismaNs.sql`
  UPDATE "StockLevel"
     SET "reserved" = "reserved" + ${qty},
         "updatedAt" = now()
   WHERE "productId" = ${productId}
     AND "onHand" - "reserved" >= ${qty}
  RETURNING "onHand", "reserved"
`;

/**
 * Release. Guarded on `"reserved" >= qty` so a double release can never drive
 * `reserved` negative — which would *inflate* `available` and let the shop
 * promise the same unit twice, the mirror image of overselling.
 */
const sqlDecrementReserved = (productId: string, qty: number): PrismaNs.Sql => PrismaNs.sql`
  UPDATE "StockLevel"
     SET "reserved" = "reserved" - ${qty},
         "updatedAt" = now()
   WHERE "productId" = ${productId}
     AND "reserved" >= ${qty}
  RETURNING "onHand", "reserved"
`;

/** Reads the current level. ONLY ever called to build a refusal message. */
async function readLevel(tx: Tx, productId: string): Promise<LevelRow> {
  const row = await tx.stockLevel.findUnique({
    where: { productId },
    select: { onHand: true, reserved: true },
  });
  return row ?? { onHand: 0, reserved: 0 };
}

/**
 * Guarantees a `StockLevel` row exists.
 *
 * `createMany({ skipDuplicates })` is used rather than `upsert` because an
 * upsert issues a real UPDATE (taking a row lock) and we only want the row when
 * it is genuinely absent. `skipDuplicates` also means a concurrent creator does
 * not abort our transaction with P2002.
 */
export async function ensureLevel(tx: Tx, productId: string): Promise<void> {
  await tx.stockLevel.createMany({
    data: [{ productId, onHand: 0, reserved: 0 }],
    skipDuplicates: true,
  });
}

// ── Refusals ────────────────────────────────────────────────────────────────

export type PostMovementOutcome = PostMovementResult | PostMovementRejection;

/**
 * `PostMovementResult` has no `ok` field and `PostMovementRejection` has
 * `ok: false`, so this is a total, allocation-free discriminator.
 */
export function isMovementRefusal(outcome: PostMovementOutcome): outcome is PostMovementRejection {
  return "ok" in outcome && outcome.ok === false;
}

function refuse(
  reason: MovementRefusalReason,
  requested: number,
  available: number,
): PostMovementRejection {
  return {
    ok: false,
    reason,
    available,
    requested,
    message: movementRefusalMessage(reason, { requested, available }),
  };
}

// ── Idempotency ─────────────────────────────────────────────────────────────

async function findByIdempotencyKey(key: string): Promise<MovementRow | null> {
  return prisma.stockMovement.findUnique({ where: { idempotencyKey: key }, include: movementInclude });
}

/**
 * The response for a replayed idempotency key.
 *
 * The ORIGINAL movement comes back byte-for-byte: a retry must see the same
 * answer it saw the first time, and it is emphatically not a 409. A
 * double-tapped "Consume" button must not look like a failure, must not apply
 * twice, and must not need explaining to a customer waiting on a bay.
 *
 * The stock level is read LIVE rather than reconstructed from the ledger. The
 * ledger records movements, not promises, so replaying with `reserved: 0` makes
 * `available === onHand`: with 10 on hand and 6 reserved, a retried consume would
 * answer "10 available, not low". That is the same shape as overselling - it
 * reports stock that is already promised to somebody else. One cheap read, on a
 * path that only runs when a submit is retried, is the only honest answer.
 *
 * A key used against a DIFFERENT product is a hard 409: answering a request
 * about product B with product A's movement hands back a number that has nothing
 * to do with what was asked.
 */
async function replayOutcome(existing: MovementRow, requestedProductId: string): Promise<PostMovementResult> {
  if (existing.productId !== requestedProductId) {
    throw conflict("That idempotency key was already used for a different item.", {
      details: { idempotencyKey: "reused" },
    });
  }

  const live = await prisma.stockLevel.findUnique({
    where: { productId: existing.productId },
    select: { onHand: true, reserved: true },
  });
  // The level row can only be absent if the product was deleted between the
  // original move and this replay. Fall back to the ledger's own figure rather
  // than inventing one.
  const level = live ?? { onHand: existing.onHandAfter, reserved: 0 };

  return {
    movement: toMovementDto(existing),
    stock: toStockLevelDto(level, Number.NEGATIVE_INFINITY),
    replayed: true,
  };
}

// ── postMovement ────────────────────────────────────────────────────────────

export interface PostMovementContext {
  /** `User.id`, or `null` for a system action (seed, cron, count posting). */
  actorId: string | null;
  /** Denormalised onto the ledger row so history survives a deleted account. */
  actorName: string | null;
  requestId?: string | undefined;
}

/**
 * Normalise a tyre DOT code to the canonical `WWYY` form — week, then year.
 *
 * Reject rather than coerce. "made 2024" is not a DOT code, and a wrong one
 * that still parses would put the wrong age on a tyre a customer is about to
 * drive on. A missing DOT is recoverable; a wrong one is not, which is why a
 * lot may be uncoded but never miscoded.
 *
 * Format per 49 CFR 574.5. ISO weeks run 01–53, so `00` and `54` are typos. The
 * two-digit-year convention matches `parseDotCode`'s reader (`00`–`49` are
 * 2000s, `50`–`99` are 1900s), so a code that is written can always be read back
 * with the same year.
 */
export function normaliseDotCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.trim().replace(/\s+/g, "");
  if (!/^(?:0[1-9]|[1-4]\d|5[0-3])\d{2}$/.test(digits)) return null;
  const week = Number(digits.slice(0, 2));
  const year2 = Number(digits.slice(2, 4));
  const year = year2 <= 49 ? 2000 + year2 : 1900 + year2;
  return `${String(week).padStart(2, "0")}${String(year).slice(2)}`;
}

/**
 * The price THIS delivery was invoiced at, which may differ from the
 * product's current cost price. Snapshotted onto the lot so a margin computed
 * months later is still the margin that was actually made.
 *
 * `null` when unknown, NEVER 0 — a zero would read as free stock and quietly
 * destroy the margin report. The schema uses the same convention on
 * `Product.costPrice`, and the two must agree.
 */
function normaliseUnitCost(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (!Number.isInteger(raw) || raw < 0) return null;
  return raw;
}

interface CleanMovement {
  productId: string;
  kind: PostMovementInput["kind"];
  qty: number;
  reason: string;
  reference: string | null;
  bookingId: string | null;
  idempotencyKey: string | null;
  /**
   * Batch identity for a RECEIVE, validated here because this is the one place
   * that decides whether a movement is admissible. An unvalidated dot code
   * would make the DOT ageing report quietly wrong, and rubber age is a
   * safety claim rather than a discount. Optional: an uncoded lot is
   * honest; an invented one is not.
   */
  dotCode: string | null;
  unitCost: number | null;
}

export type MovementValidation =
  | { ok: true; value: CleanMovement }
  | { ok: false; refusal: PostMovementRejection };

/**
 * Lot fields a movement may carry.
 *
 * They are NOT in `PostMovementInput` yet - the orchestrator's contract has not
 * grown them - so they are declared here as an ADDITIVE intersection.
 * `postMovement` accepts a `MovementRequest`, which is a `PostMovementInput`
 * plus these, so every existing caller and every existing contract shape still
 * typechecks unchanged. Reported as a contract change request.
 */
export interface MovementLotFields {
  /** This delivery's tyre DOT code (`WWYY`). Only meaningful on a RECEIVE. */
  dotCode?: string;
  /** What THIS delivery was invoiced at. Only meaningful on a RECEIVE. */
  unitCost?: number;
  /**
   * Draw from an EXISTING lot instead of opening one. Set by a caller that wants
   * to pin a consumption to a specific batch; otherwise the oldest open lot is
   * drawn FIFO.
   */
  lotId?: string;
}

export type MovementRequest = PostMovementInput & MovementLotFields;

/**
 * Total validation of a movement request. Pure — exposed so the QA agent can
 * drive it without a database, and so the engine has exactly one place that
 * decides whether a request is admissible.
 */
export function validateMovementInput(raw: MovementRequest): MovementValidation {
  if (!movementKindSet.has(raw.kind)) {
    throw new ApiError("VALIDATION_ERROR", "That stock movement is not recognised.", {
      fields: { kind: ["Unknown movement kind."] },
    });
  }
  const kind = raw.kind as PostMovementInput["kind"];
  const qtyCheck = checkQuantity(raw.qty);
  if (!qtyCheck.ok) return { ok: false, refusal: refuse(qtyCheck.reason, Math.abs(raw.qty) || 0, 0) };

  const reason = normaliseReason(raw.reason);
  if (reason.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "Please give a reason for this stock change.", {
      fields: { reason: ["A reason is required — 'because' is not a reason."] },
    });
  }

  // A malformed DOT code is REJECTED rather than silently dropped. Storing null
  // would make an old tyre look like a fresh one, and a clearance campaign that
  // fires on new rubber is a safety failure, not a cosmetic one.
  const dotCode = raw.dotCode === undefined ? null : normaliseDotCode(raw.dotCode);
  if (raw.dotCode !== undefined && raw.dotCode.trim() !== "" && dotCode === null) {
    throw new ApiError("VALIDATION_ERROR", "That DOT code is not valid.", {
      fields: {
        dotCode: [
          "Week 01-53 first, then a two-digit year — for example 1824 is week 18 of 2024.",
        ],
      },
    });
  }

  return {
    ok: true,
    value: {
      productId: raw.productId,
      kind,
      qty: qtyCheck.qty,
      reason: reason.slice(0, MAX_REASON_LENGTH),
      reference: normaliseReason(raw.reference) || null,
      bookingId: raw.bookingId ?? null,
      idempotencyKey: raw.idempotencyKey ? raw.idempotencyKey.trim() : null,
      dotCode,
      unitCost: normaliseUnitCost(raw.unitCost),
    },
  };
}

/**
 * `postMovement`, but inside a transaction the CALLER owns.
 *
 * This exists so a compound operation (posting a cycle count's variances, for
 * example) is genuinely all-or-nothing while still routing every ledger row
 * through one implementation of the guard. Two entry points, one rule: there is
 * no second SQL statement anywhere in this codebase that can move `onHand` or
 * `reserved`.
 */
export async function postMovementInTx(
  tx: Tx,
  input: MovementRequest,
  ctx: PostMovementContext,
): Promise<PostMovementOutcome> {
  const validated = validateMovementInput(input);
  if (!validated.ok) return validated.refusal;
  const clean = validated.value;

  // Cheap pre-check inside the transaction. It is not the safety mechanism (the
  // unique index is), it just avoids a pointless abort when the key is reused
  // sequentially.
  if (clean.idempotencyKey) {
    const existing = await tx.stockMovement.findUnique({
      where: { idempotencyKey: clean.idempotencyKey },
      include: movementInclude,
    });
    if (existing) return replayOutcome(existing, clean.productId);
  }

  const product = await tx.product.findUnique({
    where: { id: clean.productId },
    select: { id: true, sku: true, name: true, kind: true, isActive: true, reorderPoint: true, shelfLifeDays: true },
  });
  if (!product) throw notFound("Product not found.");

  if (!product.isActive && REFUSE_WHEN_INACTIVE.has(clean.kind)) {
    return refuse("PRODUCT_INACTIVE", clean.qty, await availableOf(tx, clean.productId, product.reorderPoint));
  }

  let snapshot = await runGuardedUpdate(tx, clean);
  if (snapshot === null) {
    // Zero rows. Either the guard refused, or the `StockLevel` row does not
    // exist yet. Repairing the row and re-running the *same* conditional
    // statement is still atomic - we are inside the transaction and our own
    // INSERT holds the row.
    await ensureLevel(tx, clean.productId);
    snapshot = await runGuardedUpdate(tx, clean);
  }
  if (snapshot === null) {
    return refusalFor(tx, clean, product.reorderPoint);
  }

  // ── LOT RESOLUTION ─────────────────────────────────────────────────────────
  // A delivery is a BATCH with its own date and, for a tyre, its own DOT code.
  // One product-level receipt date cannot express "20 tyres from March, 10 from
  // August", and rubber age is a safety claim rather than a discount. So:
  //
  //   RECEIVE / OPENING  opens a lot, in this same transaction. A ledger row with
  //                      no lot would be stock whose age can never be established
  //                      again, and the lot is what makes it establishable.
  //   CONSUME            draws the OLDEST open lot, FIFO. Consuming new rubber
  //                      first is how a shelf silently ages out.
  //
  // Neither changes the invariant: `available` still lives on `StockLevel`.
  let lotId: string | null = null;
  if (clean.kind === "RECEIVE" || clean.kind === "OPENING") {
    const receivedAt = new Date();
    const expiresAt =
      product.shelfLifeDays !== null && product.shelfLifeDays > 0
        ? new Date(receivedAt.getTime() + product.shelfLifeDays * 86_400_000)
        : null;
    const lot = await tx.stockLot.create({
      data: {
        productId: clean.productId,
        // A DOT code supplied on the receipt is recorded; otherwise the lot stays
        // uncoded rather than inheriting a guess from the catalogue entry.
        dotCode: clean.dotCode,
        // Shelf life runs from RECEIPT, never from `Product.createdAt`.
        receivedAt,
        expiresAt,
        qtyInitial: clean.qty,
        unitCost: clean.unitCost,
        reference: clean.reference,
      },
      select: { id: true },
    });
    lotId = lot.id;

    // Keep the catalogue DOT in step for a tyre, so the size finder and the
    // ageing fallback still work on a catalogue with exactly one lot.
    if (clean.kind === "RECEIVE" && product.kind === "TYRE" && clean.dotCode !== null) {
      await tx.product.updateMany({
        where: { id: clean.productId, dotCode: null },
        data: { dotCode: clean.dotCode },
      });
    }
  } else if (clean.kind === "CONSUME") {
    lotId = await oldestOpenLot(tx, clean.productId);
  }

  const movement = await tx.stockMovement.create({
    data: {
      productId: clean.productId,
      kind: clean.kind,
      qty: ledgerQty(clean.kind, clean.qty),
      onHandAfter: snapshot.onHand,
      lotId,
      reason: clean.reason,
      reference: clean.reference,
      bookingId: clean.bookingId,
      idempotencyKey: clean.idempotencyKey,
      actorId: ctx.actorId,
      actorName: ctx.actorName,
    },
    include: movementInclude,
  });

  return {
    movement: toMovementDto(movement),
    stock: toStockLevelDto(snapshot, product.reorderPoint),
    replayed: false,
  };
}

/**
 * The oldest lot that still has stock attributed to it, or `null` when the
 * product has no lot history (stock received before lots existed).
 *
 * FIFO on `receivedAt`, with `createdAt` as the tie-breaker. Reading it is a
 * plain ordered lookup; it is NOT a stock decision, because the balance still
 * lives on `StockLevel` and the availability guard above has already refused
 * anything that would oversell.
 */
async function oldestOpenLot(tx: Tx, productId: string): Promise<string | null> {
  const lot = await tx.stockLot.findFirst({
    where: { productId, isDepleted: false },
    orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return lot?.id ?? null;
}

/**
 * THE SINGLE WRITE PATH. Every change to `StockLevel.onHand` in this codebase
 * goes through here.
 *
 * Order of operations:
 *   1. A lock-free replay check outside the transaction (the ordinary double-tap).
 *   2. `postMovementInTx` inside one `SERIALIZABLE` transaction: the product
 *      checks, the conditional UPDATE that both guards and mutates, and exactly
 *      one `StockMovement` row with `onHandAfter` taken from `RETURNING`.
 *
 * Steps 2's UPDATE and the ledger insert are in the same transaction, so the
 * ledger and the level can never disagree — which is the only defence the shop
 * has when the system and the shelf tell different stories.
 */
export async function postMovement(
  input: MovementRequest,
  ctx: PostMovementContext,
): Promise<PostMovementOutcome> {
  const validated = validateMovementInput(input);
  if (!validated.ok) return validated.refusal;
  const clean = validated.value;

  // Fast path for a genuinely sequential replay (the ordinary double-tap).
  if (clean.idempotencyKey) {
    const existing = await findByIdempotencyKey(clean.idempotencyKey);
    if (existing) return replayOutcome(existing, clean.productId);
  }

  try {
    return await withSerializableRetry((tx) => postMovementInTx(tx, input, ctx), { requestId: ctx.requestId });
  } catch (err) {
    // Two concurrent submits with the SAME idempotencyKey: both miss the
    // pre-check, both write, and the unique index on `idempotencyKey` lets
    // exactly one through. The loser re-reads and returns the original.
    if (isUniqueViolation(err) && clean.idempotencyKey) {
      const existing = await findByIdempotencyKey(clean.idempotencyKey);
      if (existing) return replayOutcome(existing, clean.productId);
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof PrismaNs.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Dispatches to the correct conditional statement for the kind and returns the
 * post-update snapshot, or `null` when the guard matched no row.
 *
 * `RELEASE` is the one kind that is not a `MovementRefusalReason`: a release
 * with no matching hold is a *state* conflict (the hold is already gone), not a
 * stock shortage, so it throws `CONFLICT` rather than inventing a shortage
 * message. Reported to the orchestrator as a missing
 * `MovementRefusalReason` member.
 */
async function runGuardedUpdate(tx: Tx, clean: CleanMovement): Promise<LevelSnapshot | null> {
  switch (clean.kind) {
    case "OPENING":
      return firstOrNull(await tx.$queryRaw<LevelSnapshot[]>(sqlSetOpening(clean.productId, clean.qty)));
    case "RESERVE":
      return firstOrNull(await tx.$queryRaw<LevelSnapshot[]>(sqlIncrementReserved(clean.productId, clean.qty)));
    case "RELEASE": {
      const rows = await tx.$queryRaw<LevelSnapshot[]>(sqlDecrementReserved(clean.productId, clean.qty));
      if (rows.length === 0) {
        throw conflict("There is no hold of that size to release.", {
          details: { productId: clean.productId, qty: clean.qty },
        });
      }
      return rows[0] ?? null;
    }
    case "RECEIVE":
    case "TRANSFER_IN":
    case "ADJUST_UP":
      return firstOrNull(await tx.$queryRaw<LevelSnapshot[]>(sqlIncrementOnHand(clean.productId, clean.qty)));
    default:
      return firstOrNull(await tx.$queryRaw<LevelSnapshot[]>(sqlDecrementOnHand(clean.productId, clean.qty)));
  }
}

function firstOrNull(rows: LevelSnapshot[]): LevelSnapshot | null {
  return rows.length > 0 ? (rows[0] ?? null) : null;
}

async function availableOf(tx: Tx, productId: string, reorderPoint: number): Promise<number> {
  const level = await readLevel(tx, productId);
  return toStockLevelDto(level, reorderPoint).available;
}

/** Builds the refusal for a guarded UPDATE that matched zero rows. */
async function refusalFor(tx: Tx, clean: CleanMovement, reorderPoint: number): Promise<PostMovementOutcome> {
  const level = await readLevel(tx, clean.productId);
  const available = toStockLevelDto(level, reorderPoint).available;
  if (clean.kind === "OPENING") return refuse("OPENING_ALREADY_SET", clean.qty, available);
  if (clean.kind === "RESERVE") return refuse("INSUFFICIENT_AVAILABLE", clean.qty, available);
  return refuse("INSUFFICIENT_STOCK", clean.qty, available);
}

// ── The one ledger insert ───────────────────────────────────────────────────

export interface LedgerRowInput {
  productId: string;
  kind: MovementKindValue;
  /** Signed magnitude. Use `ledgerQty(kind, qty)` unless the sign is known. */
  qty: number;
  /** `onHandAfter` taken from a `RETURNING` clause — never from a client. */
  onHandAfter: number;
  /**
   * The human reason. REQUIRED unless `systemReason` is supplied.
   *
   * `systemReason` is for machine-only rows (a hold being placed, a TTL
   * expiring). It must still be a sentence a person can read six weeks later —
   * "Hold expired before the customer arrived", not "cron".
   */
  reason: string;
  bookingId?: string | null;
  reference?: string | null;
  idempotencyKey?: string | null;
  /**
   * Which lot this row drew from. Set by the reservation paths on a CONSUME so a
   * FIFO audit can name the batch that left the shelf.
   */
  lotId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
}

/**
 * The ONLY place a `StockMovement` row is inserted outside `postMovement`.
 *
 * Reservation holds, releases and consumptions have to be written inside a
 * transaction the caller owns (so the promise and the ledger move together), so
 * they cannot go through `postMovement` — but they must not get a laxer set of
 * rules than it does. Routing all of them through this one function means the
 * reason is normalised, truncated and refused-if-empty in exactly one place, and
 * there is no second, looser writer hiding in another module.
 *
 * `reason` is never invented. An empty reason throws, because "because" is not a
 * reason and an absent reason is worse than an unhelpful one: it makes the ledger
 * look authoritative while proving nothing.
 */
export async function appendMovement(tx: Tx, row: LedgerRowInput): Promise<MovementDto> {
  const reason = normaliseReason(row.reason);
  if (reason.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "A stock movement must carry a reason.", {
      fields: { reason: ["A reason is required."] },
    });
  }
  if (reason.length > MAX_REASON_LENGTH) {
    throw new ApiError("VALIDATION_ERROR", "That reason is too long.", {
      fields: { reason: [`Please keep the reason under ${MAX_REASON_LENGTH} characters.`] },
    });
  }
  if (row.qty === 0) {
    throw new ApiError("VALIDATION_ERROR", "A stock movement of zero changes nothing.", {
      fields: { qty: ["Enter a quantity greater than zero."] },
    });
  }

  const movement = await tx.stockMovement.create({
    data: {
      productId: row.productId,
      kind: row.kind,
      qty: Math.trunc(row.qty),
      onHandAfter: Math.trunc(row.onHandAfter),
      reason,
      reference: row.reference ? normaliseReason(row.reference) || null : null,
      bookingId: row.bookingId ?? null,
      idempotencyKey: row.idempotencyKey ?? null,
      lotId: row.lotId ?? null,
      actorId: row.actorId ?? null,
      actorName: row.actorName ?? null,
    },
    include: movementInclude,
  });
  return toMovementDto(movement);
}

// ── Ledger reads ────────────────────────────────────────────────────────────

export interface MovementListResult {
  rows: MovementDto[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * The ledger, newest first. Read-only by construction — there is no `update` or
 * `delete` anywhere in this module.
 */
export async function listMovements(
  query: MovementQuery,
): Promise<MovementListResult> {
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.trunc(query.pageSize ?? 50)));

  const where: Prisma.StockMovementWhereInput = {};
  if (query.productId) where.productId = query.productId;
  if (query.bookingId) where.bookingId = query.bookingId;
  if (query.kind) where.kind = query.kind;
  if (query.from || query.to) {
    // Both ends are calendar days in UTC. The shop is one timezone and the
    // ledger is read in the same place it is written, so a UTC window is
    // unambiguous and avoids inventing a local-midnight conversion here.
    const from = query.from ? startOfUtcDay(query.from) : null;
    const to = query.to ? startOfUtcDay(query.to) : null;
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: new Date(to.getTime() + 86_400_000) } : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: movementInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { rows: rows.map(toMovementDto), total, page, pageSize };
}

function startOfUtcDay(iso: string): Date {
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError("VALIDATION_ERROR", "That date is not valid.", { fields: { from: ["Use YYYY-MM-DD."] } });
  }
  return parsed;
}

// ── Shared read used by products / availability / reporting ─────────────────

export const stockLevelSelect = { onHand: true, reserved: true } as const;

/** `Product` payload every inventory read uses, with the level joined in. */
export const productInclude = {
  level: { select: stockLevelSelect },
  supplier: { select: { id: true, name: true } },
} as const;

export type ProductWithLevel = PrismaNs.ProductGetPayload<{ include: typeof productInclude }>;

/**
 * The single place a `Product` becomes a `ProductDto`, so the `available`
 * arithmetic and the cost/margin gate cannot differ between list and detail.
 *
 * `includeCost` is the ONLY switch that may add `costPrice` / `marginPct`, and
 * it is `true` only behind an authenticated staff role. A public surface must
 * call this with `false`, which makes those keys physically absent from the
 * object rather than `undefined`.
 *
 * `lastReceivedAt` comes from the ledger (see `lastReceivedMap` in `products.ts`),
 * not from `Product.createdAt` — `createdAt` is when the SKU was typed into the
 * catalogue, which can be months before the oil arrived, and dating fresh stock
 * as expired is worse than admitting we do not know.
 */
export function toProductDto(
  row: ProductWithLevel,
  includeCost: boolean,
  lastReceivedAt: Date | null = null,
): ProductDtoLike {
  const level = row.level ?? { onHand: 0, reserved: 0 };
  const base: ProductDtoLike = {
    id: row.id,
    sku: row.sku,
    name: row.name,
    kind: row.kind,
    unit: row.unit,
    brand: row.brand,
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    barcode: row.barcode,
    size: row.size,
    aspectRatio: row.aspectRatio,
    rimSizeIn: row.rimSizeIn,
    loadIndex: row.loadIndex,
    speedRating: row.speedRating,
    pattern: row.pattern,
    dotCode: row.dotCode,
    sellPrice: row.sellPrice,
    reorderPoint: row.reorderPoint,
    reorderQty: row.reorderQty,
    shelfLifeDays: row.shelfLifeDays,
    cycleCountDays: row.cycleCountDays,
    lastReceivedAt: lastReceivedAt === null ? null : lastReceivedAt.toISOString(),
    isActive: row.isActive,
    notes: row.notes,
    stock: toStockLevelDto(level, row.reorderPoint),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (!includeCost) return base;
  return {
    ...base,
    costPrice: row.costPrice,
    marginPct: row.marginPct,
  };
}

/** `ProductDto` widened so the cost-free variant typechecks without `any`. */
export type ProductDtoLike = Omit<ProductDto, "costPrice" | "marginPct"> &
  Partial<Pick<ProductDto, "costPrice" | "marginPct">>;
