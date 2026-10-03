/**
 * CYCLE COUNTING — count the shelf without closing the bay.
 * ============================================================================
 * The lifecycle is `DRAFT → COUNTING → REVIEW → POSTED` (or `CANCELLED`).
 *
 *  - **Create** snapshots `expected` from the LIVE `StockLevel.onHand` for every
 *    line in scope. The snapshot is frozen on the line, so a sale that lands
 *    mid-count cannot silently rewrite what the counter saw when they started.
 *  - **Record** writes `counted` per line; the variance is derived, never typed.
 *  - **Report** is available before posting, because the first question after a
 *    count is always "is this worth chasing?" and a manager should not have to
 *    post an adjustment to find out.
 *  - **Post** writes ONE ledger row per non-zero variance, as `ADJUST_UP` /
 *    `ADJUST_DOWN`, with a reason that names the count reference and both
 *    numbers. That is the row an auditor reads in six weeks' time.
 *
 * ── WHY POSTING IS STRICT ───────────────────────────────────────────────────
 * A downward variance cannot be applied when the found quantity is less than what
 * is reserved for live bookings — the guard refuses, which is correct. Rather
 * than clamping the adjustment or silently dropping the line, the whole post is
 * rolled back and the response names the product and the held quantity. The
 * counter then releases the hold (or counts again after the job). "The count
 * said 3 and the system said 5 and the difference was quietly ignored" is
 * precisely the failure this system exists to prevent.
 *
 * ── WHY POSTING IS IDEMPOTENT ──────────────────────────────────────────────
 * The `POSTED` transition is a conditional `updateMany` INSIDE the same
 * transaction as the adjustments, so two clicks (or a retry after a dropped
 * response) cannot double-adjust: the loser sees `count === 0` and returns the
 * already-posted count. A double adjustment is the one bug a cycle-count feature
 * can commit that is genuinely irreversible.
 * ============================================================================
 */
import "server-only";

import { ApiError, conflict, notFound } from "@/lib/errors";
import type {
  CountLineDto,
  CreateCountInput,
  MovementDto,
  ProductKindValue,
  RecordCountInput,
  StockCountDto,
  StockCountStatusValue,
} from "@/lib/inventory-types";
import { logger } from "@/lib/logger";
import { makeReference } from "@/lib/utils";

import { prisma, withSerializableRetry } from "@/lib/server/db";
import type { Prisma } from "@prisma/client";

import {
  isMovementRefusal,
  postMovementInTx,
  type PostMovementContext,
} from "./stock-engine";
import { isSignificantVariance, normaliseReason, parseCountScope } from "./stock-engine.test-support";

const countInclude = {
  lines: {
    include: { product: { select: { sku: true, name: true, unit: true, costPrice: true } } },
    orderBy: { product: { sku: "asc" } },
  },
} as const;

type CountRow = Prisma.StockCountGetPayload<{ include: typeof countInclude }>;

/**
 * Ceiling on the lines one count may create. A shop of this size counts a
 * category at a time, so a `scope: "all"` count that wants thousands of lines is
 * a mistake; capping it here keeps one request from materialising the whole
 * catalogue's expected balances.
 */
export const MAX_COUNT_SCOPE = 2_000;

// ── DTO ─────────────────────────────────────────────────────────────────────

/** The contract summary. `varianceValue` is already optional there. */
type CountSummary = StockCountDto["summary"];

/**
 * `@param includeCost` attaches each line's `costPrice` and signed
 * `varianceValue`, so the count review can put a peso figure on every variance
 * from ONE response instead of re-reading each product individually.
 *
 * It also gates `summary.varianceValue`. The contract makes that key OPTIONAL,
 * and optional is the honest choice: a required cost figure would force a
 * fabricated `0` onto a payload that happened not to include cost, and a zero
 * margin is a different claim from an unknown one. Every endpoint that returns a
 * `StockCountDto` is staff-gated today and passes `true`, so the operator screen
 * always gets the figure; a future public read simply omits the key.
 */
export function toCountDto(row: CountRow, includeCost: boolean): StockCountDto {
  const lines: CountLineDto[] = row.lines.map((line) => {
    const variance = line.counted === null ? null : line.counted - line.expected;
    const base: CountLineDto = {
      id: line.id,
      productId: line.productId,
      sku: line.product.sku,
      name: line.product.name,
      unit: line.product.unit,
      expected: line.expected,
      counted: line.counted,
      variance,
      isSignificant: variance === null ? false : isSignificantVariance(line.expected, variance),
      note: line.note,
      countedAt: line.countedAt ? line.countedAt.toISOString() : null,
    };
    if (!includeCost) return base;
    // Signed: found more than the system believed is money owed to us, found
    // less is money we have to explain.
    return { ...base, costPrice: line.product.costPrice, varianceValue: variance === null ? null : variance * line.product.costPrice };
  });

  const variances = lines.filter((l) => l.counted !== null && l.variance !== 0);
  const summary: CountSummary = {
    total: lines.length,
    counted: lines.filter((l) => l.counted !== null).length,
    outstanding: lines.filter((l) => l.counted === null).length,
    variances: variances.length,
    netVariance: variances.reduce((sum, l) => sum + (l.variance ?? 0), 0),
  };
  if (includeCost) {
    // The SIGNED peso value, so a count that found two extra filters and lost one
    // expensive brake pad is not reported as a wash.
    summary.varianceValue = variances.reduce((sum, l) => sum + (l.varianceValue ?? 0), 0);
  }

  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    scope: row.scope,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    postedAt: row.postedAt ? row.postedAt.toISOString() : null,
    lines,
    summary,
  };
}

// ── Create ──────────────────────────────────────────────────────────────────

/**
 * `COUNT-YYYYMMDD-XXXXXX` — sortable by date and short enough to read aloud
 * across a shop. The random tail uses the same confusion-free alphabet as a
 * booking reference, because this code gets copied onto a paper count sheet and
 * read over a phone.
 */
function newCountReference(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `COUNT-${y}${m}${d}-${makeReference("", 4)}`;
}

/**
 * Opens a count over a scope: `all`, a `ProductKind`, or a single productId.
 *
 * Lines are created from the CURRENT `StockLevel.onHand` — the system belief as
 * it stands at the moment counting starts. Snapshotting here (rather than
 * recomputing at post time) is what makes "we counted 3 and the system said 5"
 * a statement about a moment rather than a moving target.
 */
export async function createCount(input: CreateCountInput, ctx: PostMovementContext): Promise<StockCountDto> {
  const scope = parseCountScope(input.scope);

  const products = await prisma.product.findMany({
    where: buildScopeWhere(scope),
    select: { id: true },
    orderBy: { sku: "asc" },
    take: MAX_COUNT_SCOPE,
  });
  if (products.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "Nothing to count for that scope.", {
      fields: { scope: ["Pick 'all', a category, or a single item."] },
    });
  }

  const levels = await prisma.stockLevel.findMany({
    where: { productId: { in: products.map((p) => p.id) } },
    select: { productId: true, onHand: true },
    take: MAX_COUNT_SCOPE,
  });
  const onHandByProduct = new Map(levels.map((l) => [l.productId, l.onHand]));

  const row = await prisma.stockCount.create({
    data: {
      reference: newCountReference(new Date()),
      status: "DRAFT",
      scope: input.scope?.trim() || "all",
      note: input.note ? normaliseReason(input.note) || null : null,
      startedBy: ctx.actorName,
      lines: {
        create: products.map((p) => ({
          productId: p.id,
          // Frozen snapshot of what the system believed when counting began.
          expected: onHandByProduct.get(p.id) ?? 0,
        })),
      },
    },
    include: countInclude,
  });

  logger.info("inventory.count_created", {
    scope: "inventory",
    countId: row.id,
    reference: row.reference,
    lines: row.lines.length,
  });
  return toCountDto(row, true);
}

type ScopeWhere = { isActive?: boolean; kind?: ProductKindValue; id?: string };

function buildScopeWhere(scope: ReturnType<typeof parseCountScope>): ScopeWhere {
  switch (scope.kind) {
    case "all":
      return { isActive: true };
    case "productKind":
      return { kind: scope.productKind, isActive: true };
    case "product":
      return { id: scope.productId };
  }
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function getCount(id: string, options: { includeCost: boolean }): Promise<StockCountDto> {
  const row = await prisma.stockCount.findUnique({ where: { id }, include: countInclude });
  if (!row) throw notFound("Stock count not found.");
  return toCountDto(row, options.includeCost);
}

export interface CountListResult {
  rows: StockCountDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** Ceiling on a stock-count page. */
export const COUNT_PAGE_MAX = 100;

export async function listCounts(
  query: { status?: StockCountStatusValue | undefined; page?: number | undefined; pageSize?: number | undefined },
  options: { includeCost: boolean },
): Promise<CountListResult> {
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const pageSize = Math.min(COUNT_PAGE_MAX, Math.max(1, Math.trunc(query.pageSize ?? 25)));
  const where: Prisma.StockCountWhereInput = query.status ? { status: query.status } : {};

  const [rows, total] = await Promise.all([
    prisma.stockCount.findMany({
      where,
      // The summary is cheap enough to include on the list; the variance report
      // that matters is on the detail endpoint.
      include: countInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockCount.count({ where }),
  ]);

  return { rows: rows.map((r) => toCountDto(r, options.includeCost)), total, page, pageSize };
}

// ── Record a line ───────────────────────────────────────────────────────────

/**
 * Writes one counted quantity.
 *
 * Re-counting a line overwrites `counted` (the counter changed their mind) but
 * never touches `expected` — the snapshot is the record of what the system
 * believed when the count began, and rewriting it would make the variance a
 * self-fulfilling prophecy.
 *
 * Status advances automatically: the first line moves `DRAFT → COUNTING`, and
 * the last outstanding line moves `→ REVIEW` so the count is ready for a
 * decision.
 */
export async function recordCountLine(input: RecordCountInput, ctx: PostMovementContext): Promise<StockCountDto> {
  const row = await withSerializableRetry(async (tx) => {
    const count = await tx.stockCount.findUnique({
      where: { id: input.countId },
      select: { id: true, status: true },
    });
    if (!count) throw notFound("Stock count not found.");
    if (count.status === "POSTED") {
      throw conflict("This count has already been posted to the ledger.", {
        fields: { counted: ["Open a new count to record more."] },
      });
    }
    if (count.status === "CANCELLED") {
      throw conflict("This count was cancelled.", { fields: { counted: ["Start a new count."] } });
    }

    const line = await tx.stockCountLine.findUnique({
      where: { countId_productId: { countId: input.countId, productId: input.productId } },
      select: { id: true, productId: true },
    });
    if (!line) {
      throw new ApiError("VALIDATION_ERROR", "That item is not part of this count.", {
        fields: { productId: ["Not on the count sheet."] },
      });
    }

    await tx.stockCountLine.update({
      where: { id: line.id },
      data: {
        counted: input.counted,
        countedBy: ctx.actorName,
        countedAt: new Date(),
        note: input.note ? normaliseReason(input.note) || null : null,
      },
    });

    const outstanding = await tx.stockCountLine.count({
      where: { countId: input.countId, counted: null },
    });
    const nextStatus: StockCountStatusValue =
      count.status === "DRAFT" ? "COUNTING" : outstanding === 0 ? "REVIEW" : "COUNTING";
    if (nextStatus !== count.status) {
      await tx.stockCount.update({ where: { id: input.countId }, data: { status: nextStatus } });
    }

    return tx.stockCount.findUniqueOrThrow({ where: { id: input.countId }, include: countInclude });
  });

  return toCountDto(row, true);
}

// ── Post ────────────────────────────────────────────────────────────────────

export interface PostCountResult {
  count: StockCountDto;
  /** One ledger row per non-zero variance. Empty when everything matched. */
  movements: MovementDto[];
  /** Lines whose variance could not be applied. Non-empty ⇒ the post rolled back. */
  blocked: Array<{ sku: string; name: string; counted: number; expected: number; reason: string }>;
  /** True when the count had already been posted and nothing was re-applied. */
  replayed: boolean;
}

/** Internal signal: some variance was refused, so the whole post rolls back. */
class CountPostBlocked extends Error {
  constructor(readonly blocked: PostCountResult["blocked"]) {
    super("cycle count blocked by a reservation");
    this.name = "CountPostBlocked";
  }
}

/**
 * Writes the variances to the ledger. Idempotent AND atomic by construction.
 *
 * ONE `SERIALIZABLE` transaction contains:
 *   1. the conditional `DRAFT|COUNTING|REVIEW → POSTED` claim, so two clicks (or
 *      a retry after a dropped response) cannot apply the variances twice;
 *   2. one `postMovementInTx` call per non-zero variance, which is the same
 *      guarded UPDATE the rest of the system uses.
 *
 * If any variance is refused — a downward variance on stock that is promised to a
 * live booking — the whole transaction rolls back: no adjustments, no status
 * change, no half-applied count. The response names the products so the counter
 * can release the hold and post again. "The count said 3, the system said 5, and
 * the difference was quietly ignored" is exactly the failure this system exists
 * to prevent.
 */
export async function postCount(id: string, ctx: PostMovementContext): Promise<PostCountResult> {
  const existing = await prisma.stockCount.findUnique({ where: { id }, include: countInclude });
  if (!existing) throw notFound("Stock count not found.");
  if (existing.status === "POSTED") {
    // Idempotent no-op. Nothing is applied a second time.
    return { count: toCountDto(existing, true), movements: [], blocked: [], replayed: true };
  }
  if (existing.status === "CANCELLED") {
    throw conflict("This count was cancelled.");
  }

  const variances = existing.lines
    .map((line) => ({ line, variance: line.counted === null ? null : line.counted - line.expected }))
    .filter((v) => v.variance !== null && v.variance !== 0);

  // Collected OUTSIDE the transaction so the detail survives the rollback.
  const collected: { movements: MovementDto[]; blocked: PostCountResult["blocked"] } = {
    movements: [],
    blocked: [],
  };

  try {
    await withSerializableRetry(async (tx) => {
      // ── 1. CLAIM ────────────────────────────────────────────────────────
      const claimed = await tx.stockCount.updateMany({
        where: { id, status: { in: ["DRAFT", "COUNTING", "REVIEW"] } },
        data: { status: "POSTED", postedBy: ctx.actorName, postedAt: new Date() },
      });
      if (claimed.count !== 1) {
        // Somebody else is posting it, or it is already posted. Either way this
        // call applies nothing.
        return;
      }

      collected.movements = [];
      collected.blocked = [];

      // ── 2. APPLY, through the single write path ──────────────────────────
      for (const { line, variance } of variances) {
        const delta = variance ?? 0;
        const outcome = await postMovementInTx(
          tx,
          {
            productId: line.productId,
            kind: delta > 0 ? "ADJUST_UP" : "ADJUST_DOWN",
            qty: Math.abs(delta),
            // The reason names the count AND both numbers, so a ledger row is
            // self-explanatory six weeks later.
            reason: `Cycle count ${existing.reference}: counted ${line.counted ?? 0}, system believed ${line.expected}`,
            // One key per (count, line). Because the whole post is one
            // transaction, the key is released again if the transaction rolls
            // back — so a retried post after a block still applies for real.
            idempotencyKey: `count:${id}:${line.productId}`.slice(0, 120),
          },
          ctx,
        );

        if (isMovementRefusal(outcome)) {
          collected.blocked.push({
            sku: line.product.sku,
            name: line.product.name,
            counted: line.counted ?? 0,
            expected: line.expected,
            reason: outcome.message,
          });
          continue;
        }
        collected.movements.push(outcome.movement);
      }

      if (collected.blocked.length > 0) {
        // Throwing rolls back the claim AND every adjustment already made.
        throw new CountPostBlocked(collected.blocked);
      }
    });
  } catch (err) {
    if (err instanceof CountPostBlocked) {
      logger.warn("inventory.count_post_blocked", {
        scope: "inventory",
        countId: id,
        reference: existing.reference,
        blocked: err.blocked.length,
      });
      throw conflict("This count cannot be posted yet — part of it is promised to a live booking.", {
        details: {
          blocked: err.blocked.map((b) => ({ sku: b.sku, counted: b.counted, expected: b.expected, reason: b.reason })),
        },
        fields: { post: ["Release the hold on those items, then post the count again."] },
      });
    }
    throw err;
  }

  const posted = await getCount(id, { includeCost: true });
  logger.info("inventory.count_posted", {
    scope: "inventory",
    countId: id,
    reference: posted.reference,
    variances: collected.movements.length,
  });
  return { count: posted, movements: collected.movements, blocked: [], replayed: false };
}

// ── Cancel ──────────────────────────────────────────────────────────────────

/** Abandons a count. Only possible before it is posted. */
export async function cancelCount(id: string): Promise<StockCountDto> {
  const claimed = await prisma.stockCount.updateMany({
    where: { id, status: { in: ["DRAFT", "COUNTING", "REVIEW"] } },
    data: { status: "CANCELLED" },
  });
  if (claimed.count !== 1) {
    throw conflict("This count has already been posted and cannot be cancelled.");
  }
  return getCount(id, { includeCost: true });
}
