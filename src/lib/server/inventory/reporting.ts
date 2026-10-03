/**
 * REPORTING — reorder, valuation, ageing.
 * ============================================================================
 * Three reports, one rule: **every figure is derived from `available = onHand −
 * reserved`, never from `onHand`.** A reorder list built on `onHand` orders stock
 * the shop has already promised to somebody, and a valuation built on `onHand`
 * overstates what can actually be sold today.
 *
 * ── COST ────────────────────────────────────────────────────────────────────
 * `ReorderRowDto.costPrice` / `estimatedCost` and `ValuationDto.costValue` are
 * staff-only. They are attached only when `includeCost` is true, which routes
 * pass `true` exclusively behind a `MANAGER`/`OWNER` role check. A public
 * surface cannot reach these functions at all.
 *
 * ── AGEING INFORMS, IT DOES NOT GATE ───────────────────────────────────────
 * The ageing report exists so the owner can sell old stock honestly and stop
 * buying what is already slow. It is never consulted by `canFulfil`, never
 * removes a product from sale, and never blocks a booking. Refusing a customer
 * whose car is on the lift because a tyre is 3 years old would be worse than
 * selling it and telling the truth about its age.
 * ============================================================================
 */
import "server-only";

import { Prisma } from "@prisma/client";

import { ApiError } from "@/lib/errors";
import type {
  ProductAvailabilityDto,
  ProductKindValue,
  ReorderRowDto,
  ValuationDto,
} from "@/lib/inventory-types";
import { PRODUCT_KINDS } from "@/lib/inventory-types";
import { prisma } from "@/lib/server/db";

import {
  NEAR_EXPIRY_DAYS,
  TYRE_STALE_DAYS,
  daysBetween,
  daysUntil,
  parseDotCode,
  shelfLifeExpiry,
} from "./stock-engine.test-support";
import { lastReceivedMap } from "./products";
import { productInclude, type ProductWithLevel } from "./stock-engine";

const MAX_REPORT_ROWS = 500;

/** Ceiling on a reorder/ageing report. */
export const REPORT_LIMIT_MAX = 500;

// ── Reorder ─────────────────────────────────────────────────────────────────

export interface ReorderQuery {
  kind?: ProductKindValue | undefined;
  supplierId?: string | undefined;
  includeInactive?: boolean | undefined;
  limit?: number | undefined;
}

/**
 * What to order.
 *
 * The trigger is `available <= reorderPoint`, which is why the shortlist is a raw
 * SQL query: Prisma's builder will not compare two columns from two different
 * tables. Everything after that is a plain bounded `findMany`.
 *
 * `suggestedQty` is deliberately dumb and explainable at the counter: the owner's
 * configured order quantity, or — when they have not set one — just enough to
 * lift `available` back to the reorder point. A cleverer forecast needs sales
 * history this shop does not have yet.
 */
export async function reorderSuggestions(
  query: ReorderQuery,
  options: { includeCost: boolean },
): Promise<{ rows: ReorderRowDto[]; total: number; estimatedCost: number | null }> {
  const ids = await lowStockIds(query);
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: productInclude,
    take: MAX_REPORT_ROWS,
    orderBy: { name: "asc" },
  });

  const out: ReorderRowDto[] = [];
  let estimatedTotal = 0;
  for (const row of rows) {
    const available = availableOf(row);
    const suggestedQty = suggestedQuantity(row.reorderQty, row.reorderPoint, available);
    if (suggestedQty <= 0 && available > 0) continue;

    const base: ReorderRowDto = {
      productId: row.id,
      sku: row.sku,
      name: row.name,
      size: row.size,
      kind: row.kind,
      unit: row.unit,
      available,
      reorderPoint: row.reorderPoint,
      reorderQty: row.reorderQty,
      suggestedQty,
      supplierId: row.supplierId,
      supplierName: row.supplier?.name ?? null,
      isStockout: available <= 0,
    };
    if (options.includeCost) {
      base.costPrice = row.costPrice;
      base.estimatedCost = suggestedQty * row.costPrice;
      estimatedTotal += base.estimatedCost;
    }
    out.push(base);
  }

  // Most urgent first: out of stock before merely low, then the deepest hole.
  out.sort((a, b) => {
    if (a.isStockout !== b.isStockout) return a.isStockout ? -1 : 1;
    const depthA = a.reorderPoint - a.available;
    const depthB = b.reorderPoint - b.available;
    if (depthA !== depthB) return depthB - depthA;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  const limited = query.limit !== undefined
    ? out.slice(0, Math.min(REPORT_LIMIT_MAX, Math.max(1, query.limit)))
    : out;
  return { rows: limited, total: out.length, estimatedCost: options.includeCost ? estimatedTotal : null };
}

/**
 * The owner's order quantity, or just enough to get back to the reorder point.
 *
 * A product with `reorderPoint = 0` and `available = 0` is a genuinely empty
 * shelf, so at least one unit is always suggested — an order of zero is never
 * useful.
 */
export function suggestedQuantity(reorderQty: number, reorderPoint: number, available: number): number {
  const shortfall = Math.max(0, reorderPoint - available);
  return Math.max(reorderQty, shortfall, available <= 0 ? 1 : 0);
}

async function lowStockIds(query: ReorderQuery): Promise<string[]> {
  const kind = query.kind && (PRODUCT_KINDS as readonly string[]).includes(query.kind) ? (query.kind as ProductKindValue) : null;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT p."id"
      FROM "Product" p
      JOIN "StockLevel" l ON l."productId" = p."id"
     WHERE (l."onHand" - l."reserved") <= p."reorderPoint"
       ${kind === null ? Prisma.empty : Prisma.sql`AND p."kind" = ${kind}::"ProductKind"`}
       ${query.supplierId === undefined ? Prisma.empty : Prisma.sql`AND p."supplierId" = ${query.supplierId}`}
       ${query.includeInactive === true ? Prisma.empty : Prisma.sql`AND p."isActive" = true`}
     ORDER BY (l."onHand" - l."reserved") ASC, p."name" ASC
     LIMIT ${MAX_REPORT_ROWS}
  `);
  return rows.map((r) => r.id);
}

// ── Valuation ───────────────────────────────────────────────────────────────

/**
 * What is on the shelves, and what it is worth.
 *
 * `units` is the physical count (`onHand`), because valuation is a statement
 * about what the shop owns — but the *value* of stock that is promised to a
 * booking is still owned, so `retailValue` uses `onHand` too. The report that
 * matters operationally (the reorder list) uses `available`; the report that
 * matters financially (what do I own) uses `onHand`. Both are correct for their
 * own question, and both are labelled.
 */
export async function valuation(
  query: { kind?: ProductKindValue | undefined; includeInactive?: boolean | undefined },
  options: { includeCost: boolean },
): Promise<ValuationDto> {
  const where: Prisma.ProductWhereInput = {
    ...(query.includeInactive === true ? {} : { isActive: true }),
    ...(query.kind ? { kind: query.kind } : {}),
  };

  const rows = await prisma.product.findMany({ where, include: productInclude, take: MAX_REPORT_ROWS * 4 });

  const byKind = new Map<ProductKindValue, { products: number; units: number; retailValue: number; costValue: number }>();
  let products = 0;
  let totalUnits = 0;
  let retailValue = 0;
  let costValue = 0;

  for (const row of rows) {
    const onHand = row.level?.onHand ?? 0;
    const bucket = byKind.get(row.kind) ?? { products: 0, units: 0, retailValue: 0, costValue: 0 };
    bucket.products += 1;
    bucket.units += onHand;
    bucket.retailValue += onHand * row.sellPrice;
    bucket.costValue += onHand * row.costPrice;
    byKind.set(row.kind, bucket);
    products += 1;
    totalUnits += onHand;
    retailValue += onHand * row.sellPrice;
    costValue += onHand * row.costPrice;
  }

  const result: ValuationDto = {
    products,
    totalUnits,
    retailValue,
    byKind: [...byKind.entries()]
      .map(([kind, b]) => ({ kind, products: b.products, units: b.units, retailValue: b.retailValue }))
      .sort((a, b) => b.retailValue - a.retailValue),
  };
  if (options.includeCost) result.costValue = costValue;
  return result;
}

// ── Ageing ──────────────────────────────────────────────────────────────────

/**
 * One row per LOT that carries a date we can age.
 *
 * ── WHY A ROW PER LOT, NOT PER PRODUCT ─────────────────────────────────────
 * `Product.dotCode` is ONE value per product and a shelf is many deliveries:
 * twenty tyres from March and ten from August are the same SKU. With one DOT
 * code the shop cannot answer "which tyres are over two years old", so FIFO is
 * impossible (it would consume new rubber first and age the shelf) and a
 * DOT-driven clearance campaign fires on the WRONG tyres. Rubber age is a safety
 * claim, not a discount.
 *
 * So the report is per lot. `productId` is still on every row so the operator
 * screen can group them, and `available` is the PRODUCT's availability repeated
 * on each row — the per-lot quantity on the shelf is derived from the ledger and
 * is deliberately not presented as a promise, because the promise is per product.
 */
export interface AgeingRow extends ProductAvailabilityDto {
  kind: ProductKindValue;
  /** `DOT` | `SHELF_LIFE` | `UNKNOWN` — what the age was derived from. */
  ageSource: "DOT" | "SHELF_LIFE" | "UNKNOWN";
  /** Which delivery this row is about. */
  lotId: string | null;
  /** The lot's own tyre DOT code (`WWYY`). */
  dotCode: string | null;
  /** When the lot physically arrived. Shelf life runs from here. */
  receivedAt: string | null;
  /** Absolute expiry when the lot is dated. */
  expiresAt: string | null;
  /** Negative once the item is past its shelf life. Null when not tracked. */
  daysToExpiry: number | null;
  /** Sell price at which this stock would clear. Never `costPrice`. */
  sellPrice: number;
}

export interface AgeingReport {
  rows: AgeingRow[];
  /** Oldest-first DOT-aged tyre lots still on the shelf. */
  staleTyres: AgeingRow[];
  /** Shelf-life lots within `NEAR_EXPIRY_DAYS` of expiry. */
  nearExpiry: AgeingRow[];
  /** Retail value of the stale tyres — the clearance decision, in pesos. */
  staleRetailValue: number;
  generatedAt: string;
}

export async function ageing(
  query: { kind?: ProductKindValue | undefined; inStockOnly?: boolean | undefined; limit?: number | undefined },
): Promise<AgeingReport> {
  const now = new Date();
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(query.kind ? { kind: query.kind } : {}),
    // Anything without a date cannot be aged, so it is excluded up front rather
    // than returned as a meaningless row. A tyre qualifies on EITHER a lot DOT
    // code or the catalogue fallback.
    OR: [
      { kind: "TYRE", dotCode: { not: null } },
      { kind: "TYRE", lots: { some: { dotCode: { not: null } } } },
      { shelfLifeDays: { not: null } },
    ],
  };

  const products = await prisma.product.findMany({
    where,
    include: {
      ...productInclude,
      // One bounded read of every open lot for the products in scope.
      lots: {
        where: { isDepleted: false },
        orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
        select: { id: true, dotCode: true, receivedAt: true, expiresAt: true },
        take: MAX_REPORT_ROWS,
      },
    },
    take: MAX_REPORT_ROWS,
  });
  const received = await lastReceivedMap(products.map((p) => p.id));
  const rows: AgeingRow[] = [];

  for (const product of products) {
    const onHand = product.level?.onHand ?? 0;
    const reserved = product.level?.reserved ?? 0;
    if (query.inStockOnly !== false && onHand <= 0) continue;

    const available = onHand - reserved;

    // ── Lot-level rows ─────────────────────────────────────────────────────
    // One row per open delivery. This is the only level at which a tyre's age is
    // knowable, and the only level at which FIFO can be audited.
    const lots = product.lots;
    if (lots.length > 0) {
      for (const lot of lots) {
        const age = describeAge(
          {
            kind: product.kind,
            // The LOT's DOT wins; the catalogue value is only a fallback for a
            // lot that arrived uncoded.
            dotCode: lot.dotCode ?? (product.kind === "TYRE" ? product.dotCode : null),
            shelfLifeDays: product.shelfLifeDays,
            createdAt: product.createdAt,
            lastReceivedAt: lot.receivedAt,
          },
          now,
        );
        if (age.ageSource === "UNKNOWN") continue;
        rows.push(ageingRowFor(product, available, age, lot.id, lot.dotCode, lot.receivedAt, lot.expiresAt));
      }
      continue;
    }

    // ── Catalogue fallback ─────────────────────────────────────────────────
    // Stock received before lots existed still has to be reported, or it would
    // vanish from the ageing view entirely — and a product silently disappearing
    // from an ageing report is how old stock gets forgotten.
    const age = describeAge(
      {
        kind: product.kind,
        dotCode: product.dotCode,
        shelfLifeDays: product.shelfLifeDays,
        createdAt: product.createdAt,
        lastReceivedAt: received.get(product.id) ?? null,
      },
      now,
    );
    if (age.ageSource === "UNKNOWN") continue;
    rows.push(ageingRowFor(product, available, age, null, product.dotCode, received.get(product.id) ?? null, null));
  }

  const limit = Math.min(REPORT_LIMIT_MAX, Math.max(1, Math.trunc(query.limit ?? 100)));

  // Oldest first is the only useful order for an ageing report: the shop's
  // question is "what has been sitting here the longest?".
  rows.sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));

  // A stale lot is a LOT, not a product: twenty tyres from March and ten from
  // August are the same SKU, and only the March ones are the clearance
  // candidate. Counting the product's whole availability against the old lot
  // would put ten fresh tyres on the clearance list.
  const staleTyres = rows.filter((r) => r.kind === "TYRE" && (r.ageDays ?? 0) >= TYRE_STALE_DAYS);
  const nearExpiry = rows.filter((r) => r.ageSource === "SHELF_LIFE" && r.isNearExpiry);

  return {
    rows: rows.slice(0, limit),
    staleTyres: staleTyres.slice(0, limit),
    nearExpiry: nearExpiry.slice(0, limit),
    staleRetailValue: staleTyres.reduce((sum, r) => sum + Math.max(0, r.available) * r.sellPrice, 0),
    generatedAt: now.toISOString(),
  };
}

interface DescribedAge {
  ageSource: "DOT" | "SHELF_LIFE" | "UNKNOWN";
  /** Days since production (DOT) or days of life consumed (shelf life). */
  ageDays: number | null;
  daysToExpiry: number | null;
  isNearExpiry: boolean;
}

/**
 * Pure-ish ageing rule, exported so it can be tested without a database.
 *
 * `ageDays` is ALWAYS ELAPSED time — days since production for a tyre, days
 * since receipt for everything else — never days remaining. The contract calls
 * this out because the opposite reading fails silently: a clearance campaign
 * would fire on brand-new stock.
 *
 * For a tyre, `isNearExpiry` means "aged past the shop's stale threshold"
 * (`TYRE_STALE_DAYS` — a shop policy the owner must confirm, NOT researched).
 * For a shelf-life item it means "within `NEAR_EXPIRY_DAYS` of expiry", which
 * includes already-expired, because an expired drum in the corner is exactly
 * what the owner needs to see.
 */
export function describeAge(
  product: {
    kind: ProductKindValue;
    dotCode: string | null;
    shelfLifeDays: number | null;
    createdAt: Date;
    lastReceivedAt?: Date | null;
  },
  now: Date,
): DescribedAge {
  if (product.kind === "TYRE") {
    const produced = parseDotCode(product.dotCode);
    if (!produced) return { ageSource: "UNKNOWN", ageDays: null, daysToExpiry: null, isNearExpiry: false };
    const ageDays = daysBetween(produced, now);
    return {
      ageSource: "DOT",
      ageDays,
      daysToExpiry: TYRE_STALE_DAYS - ageDays,
      isNearExpiry: ageDays >= TYRE_STALE_DAYS,
    };
  }

  // Shelf life runs from RECEIPT, not from the catalogue entry — see
  // `lastReceivedMap`. `createdAt` is the labelled fallback.
  const since = product.lastReceivedAt ?? product.createdAt;
  const expiry = shelfLifeExpiry(since, product.shelfLifeDays);
  if (!expiry) return { ageSource: "UNKNOWN", ageDays: null, daysToExpiry: null, isNearExpiry: false };
  const remaining = daysUntil(expiry, now);
  if (remaining === null) return { ageSource: "UNKNOWN", ageDays: null, daysToExpiry: null, isNearExpiry: false };
  return {
    ageSource: "SHELF_LIFE",
    ageDays: daysBetween(since, now),
    daysToExpiry: remaining,
    isNearExpiry: remaining <= NEAR_EXPIRY_DAYS,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds one ageing row. Extracted so the lot path and the catalogue fallback
 * cannot drift apart on the promise fields — `available`/`canPromise` are always
 * the PRODUCT's figure, because the promise is made per product, never per lot.
 */
function ageingRowFor(
  product: ProductWithLevel,
  available: number,
  age: DescribedAge,
  lotId: string | null,
  dotCode: string | null,
  receivedAt: Date | null,
  expiresAt: Date | null,
): AgeingRow {
  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    available,
    canPromise: available,
    isLow: available <= product.reorderPoint,
    reorderPoint: product.reorderPoint,
    ageDays: age.ageDays,
    isNearExpiry: age.isNearExpiry,
    kind: product.kind,
    ageSource: age.ageSource,
    lotId,
    dotCode,
    receivedAt: receivedAt ? receivedAt.toISOString() : null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    daysToExpiry: age.daysToExpiry,
    sellPrice: product.sellPrice,
  };
}

function availableOf(row: ProductWithLevel): number {
  return (row.level?.onHand ?? 0) - (row.level?.reserved ?? 0);
}

/** Exposed for the reorder digest / dashboard: how many SKUs need attention. */
export async function lowStockSummary(): Promise<{ count: number; stockouts: number }> {
  const ids = await lowStockIds({});
  if (ids.length === 0) return { count: 0, stockouts: 0 };
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: productInclude,
    take: MAX_REPORT_ROWS,
  });
  return { count: rows.length, stockouts: rows.filter((r) => availableOf(r) <= 0).length };
}

/** Small helper the reports route uses to reject a nonsense `kind`. */
export function assertKnownKind(kind: string | undefined): asserts kind is ProductKindValue | undefined {
  if (kind !== undefined && !(PRODUCT_KINDS as readonly string[]).includes(kind)) {
    throw new ApiError("VALIDATION_ERROR", "That product category is not recognised.", {
      fields: { kind: ["Pick from the current list."] },
    });
  }
}
