/**
 * CATALOGUE — products, search, tyre-size lookup.
 * ============================================================================
 * Nothing in this file writes stock. A product is a *description*; the number on
 * the shelf lives in `StockLevel` and is only ever changed by
 * `postMovement()`. That separation is why a PATCH here can never move stock by
 * accident, and it is why `UpdateProductInput` has no quantity field at all.
 *
 * ── SEARCH ──────────────────────────────────────────────────────────────────
 * The highest-frequency query a mechanic makes is a tyre size, so it gets its
 * own fast path: when the query parses as a tyre size it is matched against the
 * indexed `size` column for **equality** on the canonical `205/55R16` form
 * first, before any `OR`/`contains` fan-out. A mechanic reading a sidewall gets
 * one index lookup, not a sequential scan across the catalogue.
 *
 * ── COST ────────────────────────────────────────────────────────────────────
 * `costPrice` and `marginPct` are attached by `toProductDto` ONLY when the
 * caller passes `includeCost: true`, and every call site derives that from an
 * authenticated staff role. Public surfaces pass `false` and therefore cannot
 * emit those keys at all.
 * ============================================================================
 */
import "server-only";

import { Prisma } from "@prisma/client";

import { ApiError, conflict, notFound } from "@/lib/errors";
import type {
  CreateProductInput,
  ProductAvailabilityDto,
  ProductDto,
  ProductKindValue,
  UpdateProductInput,
} from "@/lib/inventory-types";
import { PRODUCT_KINDS } from "@/lib/inventory-types";
import { logger } from "@/lib/logger";
import { prisma, withSerializableRetry } from "@/lib/server/db";

import {
  NEAR_EXPIRY_DAYS,
  TYRE_STALE_DAYS,
  daysBetween,
  daysUntil,
  parseDotCode,
  parseTyreSize,
  shelfLifeExpiry,
} from "./stock-engine.test-support";
import {
  ensureLevel,
  productInclude,
  toProductDto,
  type ProductDtoLike,
  type ProductWithLevel,
} from "./stock-engine";
import type { ProductListQuery } from "./validation.test-support";

/**
 * How many products the low-stock prefilter will consider before handing the
 * shortlist to the query builder. A real shop is nowhere near this; the cap
 * exists so a pathological dataset cannot pull the whole catalogue into memory.
 */
const LOW_STOCK_SCAN_LIMIT = 1_000;

// ── Money ───────────────────────────────────────────────────────────────────

/**
 * Margin as a whole percent of the *sell* price, or `null` when we do not know
 * what we paid (`costPrice === 0` is the schema's "unknown", not "free").
 */
export function computeMarginPct(costPrice: number, sellPrice: number): number | null {
  if (costPrice <= 0 || sellPrice <= 0) return null;
  return Math.round(((sellPrice - costPrice) / sellPrice) * 100);
}

/**
 * Guards a mis-keyed sell price against `minSellPrice` — the schema's "cannot be
 * sold below this" floor. Deliberately a floor and not a cost check: a clearance
 * sale below cost is a decision a human makes (see the tyre-clearance campaign),
 * a sell price below the configured floor is a typo.
 */
function assertSellPriceFloor(productId: string | null, sellPrice: number | undefined, minSellPrice: number | null): void {
  if (sellPrice === undefined || minSellPrice === null) return;
  if (sellPrice >= minSellPrice) return;
  throw new ApiError("VALIDATION_ERROR", "That sell price is below the minimum price for this item.", {
    fields: { sellPrice: [`Must be at least ₱${minSellPrice}.`] },
    logMeta: { productId, minSellPrice },
  });
}

// ── Create / update / soft-delete ───────────────────────────────────────────

/**
 * Create payload.
 *
 * Four fields are widened to `| null` relative to `CreateProductInput`, because
 * `null` is how a caller says "no supplier / no aspect ratio / no shelf life"
 * and the contract's types cannot express it. Reported to the orchestrator as a
 * contract request.
 */
type NullableCreateFields = "supplierId" | "aspectRatio" | "rimSizeIn" | "shelfLifeDays";

export interface ProductCreatePayload extends Omit<CreateProductInput, NullableCreateFields> {
  supplierId?: string | null;
  aspectRatio?: number | null;
  rimSizeIn?: number | null;
  shelfLifeDays?: number | null;
}

/**
 * Creates a product and its zeroed `StockLevel` in one transaction.
 *
 * The level row is created at zero on purpose: it is what the conditional
 * UPDATE in the engine targets, and a product without one would be a product the
 * engine has to repair mid-movement.
 */
export async function createProduct(input: ProductCreatePayload): Promise<ProductDto> {
  const supplier = input.supplierId ? await requireSupplier(input.supplierId) : null;

  const row = await withSerializableRetry(async (tx) => {
    const cost = input.costPrice ?? 0;
    const sell = input.sellPrice ?? 0;
    const product = await tx.product.create({
      data: {
        sku: input.sku.trim().toUpperCase(),
        name: input.name,
        kind: input.kind,
        unit: input.unit,
        brand: input.brand?.trim() || null,
        supplierId: supplier,
        barcode: input.barcode?.trim() || null,
        size: input.size?.trim() || null,
        aspectRatio: input.aspectRatio ?? null,
        rimSizeIn: input.rimSizeIn ?? null,
        loadIndex: input.loadIndex?.trim() || null,
        speedRating: input.speedRating?.trim() || null,
        pattern: input.pattern?.trim() || null,
        dotCode: input.dotCode?.replace(/\s+/g, "") || null,
        costPrice: cost,
        sellPrice: sell,
        marginPct: computeMarginPct(cost, sell),
        reorderPoint: input.reorderPoint ?? 0,
        reorderQty: input.reorderQty ?? 0,
        shelfLifeDays: input.shelfLifeDays ?? null,
        cycleCountDays: input.cycleCountDays ?? 30,
        isActive: input.isActive ?? true,
        notes: input.notes?.trim() || null,
      },
      include: productInclude,
    });
    await ensureLevel(tx, product.id);
    return product;
  });

  logger.info("inventory.product_created", { scope: "inventory", productId: row.id, sku: row.sku });
  return toProductDto(row, true) as ProductDto;
}

async function requireSupplier(supplierId: string): Promise<string> {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
  if (!supplier) {
    throw new ApiError("VALIDATION_ERROR", "That supplier no longer exists.", {
      fields: { supplierId: ["Please pick from the current list."] },
    });
  }
  return supplier.id;
}

/**
 * Update payload. `supplierId: null` CLEARS the supplier; `undefined` leaves it
 * alone. See `ProductCreatePayload` for why the null variants exist.
 */
export interface ProductUpdatePayload extends Omit<UpdateProductInput, NullableCreateFields> {
  supplierId?: string | null;
  aspectRatio?: number | null;
  rimSizeIn?: number | null;
  shelfLifeDays?: number | null;
}

/**
 * PATCH. There is deliberately no way to change `sku` or any stock field here.
 *
 * `sellPrice` is re-checked against `minSellPrice` and `marginPct` is recomputed
 * in the same statement, so a stale margin can never sit next to a fresh price.
 */
export async function updateProduct(input: ProductUpdatePayload): Promise<ProductDto> {
  const existing = await prisma.product.findUnique({
    where: { id: input.id },
    select: { id: true, sku: true, costPrice: true, sellPrice: true, minSellPrice: true },
  });
  if (!existing) throw notFound("Product not found.");
  assertSellPriceFloor(existing.id, input.sellPrice, existing.minSellPrice);

  // `undefined` = "leave alone"; `null` = "clear". Resolved to an explicit patch
  // key so the two are never confused.
  let supplierPatch: { supplierId: string | null } | undefined;
  if (input.supplierId !== undefined) {
    supplierPatch = { supplierId: input.supplierId === null ? null : await requireSupplier(input.supplierId) };
  }
  const nextCost = input.costPrice ?? existing.costPrice;
  const nextSell = input.sellPrice ?? existing.sellPrice;

  const row = await prisma.product.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.brand !== undefined ? { brand: input.brand || null } : {}),
      ...supplierPatch,
      ...(input.barcode !== undefined ? { barcode: input.barcode || null } : {}),
      ...(input.size !== undefined ? { size: input.size || null } : {}),
      ...(input.aspectRatio !== undefined ? { aspectRatio: input.aspectRatio ?? null } : {}),
      ...(input.rimSizeIn !== undefined ? { rimSizeIn: input.rimSizeIn ?? null } : {}),
      ...(input.loadIndex !== undefined ? { loadIndex: input.loadIndex || null } : {}),
      ...(input.speedRating !== undefined ? { speedRating: input.speedRating || null } : {}),
      ...(input.pattern !== undefined ? { pattern: input.pattern || null } : {}),
      ...(input.dotCode !== undefined ? { dotCode: input.dotCode.replace(/\s+/g, "") || null } : {}),
      ...(input.costPrice !== undefined ? { costPrice: input.costPrice } : {}),
      ...(input.sellPrice !== undefined ? { sellPrice: input.sellPrice } : {}),
      marginPct: computeMarginPct(nextCost, nextSell),
      ...(input.reorderPoint !== undefined ? { reorderPoint: input.reorderPoint } : {}),
      ...(input.reorderQty !== undefined ? { reorderQty: input.reorderQty } : {}),
      ...(input.shelfLifeDays !== undefined ? { shelfLifeDays: input.shelfLifeDays ?? null } : {}),
      ...(input.cycleCountDays !== undefined ? { cycleCountDays: input.cycleCountDays } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    },
    include: productInclude,
  });

  return toProductDto(row, true) as ProductDto;
}

/**
 * DELETE is a SOFT delete.
 *
 * A `Product` is referenced by the append-only ledger, by `Reservation` and by
 * `ServicePartRequirement`. Hard-deleting it would either destroy history or
 * silently orphan a bill of materials. Deactivating keeps the shelf label valid,
 * stops the SKU being received or promised, and leaves every past movement
 * readable — which is the whole point of an append-only ledger.
 */
export async function deactivateProduct(id: string): Promise<ProductDto> {
  const held = await prisma.reservation.count({ where: { productId: id, status: "HELD" } });
  if (held > 0) {
    throw conflict("This item is still held for a booking. Release the hold first.", {
      details: { heldReservations: held },
    });
  }
  const row = await prisma.product.update({
    where: { id },
    data: { isActive: false },
    include: productInclude,
  });
  return toProductDto(row, true) as ProductDto;
}

export async function reactivateProduct(id: string): Promise<ProductDto> {
  const row = await prisma.product.update({ where: { id }, data: { isActive: true }, include: productInclude });
  return toProductDto(row, true) as ProductDto;
}

/**
 * The most recent RECEIVE (or TRANSFER_IN) per product, read from the ledger in
 * ONE query.
 *
 * `ProductDto.lastReceivedAt` is the date shelf life must be measured from:
 * `createdAt` is when the SKU was typed into the catalogue, which can be months
 * before the oil actually arrived, and dating fresh stock as expired is worse
 * than admitting we do not know. There is no `lastReceivedAt` COLUMN in the
 * schema, so it is derived from the append-only ledger — which cannot drift from
 * what was received, because the ledger is the record of it. Reported to the
 * orchestrator as a schema request (a denormalised column maintained on RECEIVE
 * would avoid this scan on large catalogues).
 */
export async function lastReceivedMap(productIds: readonly string[]): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  if (productIds.length === 0) return map;
  const rows = await prisma.$queryRaw<Array<{ productId: string; createdAt: Date }>>(Prisma.sql`
    SELECT DISTINCT ON ("productId") "productId", "createdAt"
      FROM "StockMovement"
     WHERE "productId" = ANY(${productIds}::text[])
       AND "kind" IN ('RECEIVE'::"StockMovementKind", 'TRANSFER_IN'::"StockMovementKind")
     ORDER BY "productId", "createdAt" DESC
  `);
  for (const row of rows) map.set(row.productId, row.createdAt);
  return map;
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function getProductById(id: string, options: { includeCost: boolean }): Promise<ProductDto> {
  const row = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!row) throw notFound("Product not found.");
  const received = await lastReceivedMap([row.id]);
  return toProductDto(row, options.includeCost, received.get(row.id) ?? null) as ProductDto;
}

export async function getProductBySku(sku: string, options: { includeCost: boolean }): Promise<ProductDto> {
  const row = await prisma.product.findUnique({
    where: { sku: sku.trim().toUpperCase() },
    include: productInclude,
  });
  if (!row) throw notFound("Product not found.");
  const received = await lastReceivedMap([row.id]);
  return toProductDto(row, options.includeCost, received.get(row.id) ?? null) as ProductDto;
}

export interface ProductListResult {
  rows: ProductDtoLike[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * The catalogue list and the operator's search box.
 *
 * `lowStock` cannot be expressed in Prisma's query builder (it compares two
 * columns of *different* tables, which the builder will not do), so the
 * shortlist is computed with one small raw query and then fed back in as an
 * `id IN (…)` filter. The raw query is parameterised and bounded; it is not a
 * place where string concatenation is allowed in.
 */
/** Ceiling on a catalogue page. */
export const PRODUCT_PAGE_MAX = 100;

export async function listProducts(
  query: ProductListQuery,
  options: { includeCost: boolean },
): Promise<ProductListResult> {
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const pageSize = Math.min(PRODUCT_PAGE_MAX, Math.max(1, Math.trunc(query.pageSize ?? 25)));
  const includeInactive = query.includeInactive === true;

  // ── Fast path: an exact tyre size, matched on the indexed `size` column ──
  if (query.q) {
    const parts = parseTyreSize(query.q);
    if (parts) {
      const exactWhere = await buildWhere(query, includeInactive, { exactSize: parts.canonical, skipText: true });
      const exact = await runProductQuery(exactWhere, page, pageSize, options.includeCost);
      if (exact.total > 0) return exact;
      // Nothing carried that canonical spelling (a legacy row might read
      // `205/55 R16`); fall through to the tolerant search below.
    }
  }

  const where = await buildWhere(query, includeInactive, null);
  return runProductQuery(where, page, pageSize, options.includeCost);
}

async function runProductQuery(
  where: Prisma.ProductWhereInput,
  page: number,
  pageSize: number,
  includeCost: boolean,
): Promise<ProductListResult> {
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: [{ name: "asc" }, { sku: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);
  const received = await lastReceivedMap(rows.map((r) => r.id));
  return {
    rows: rows.map((r) => toProductDto(r, includeCost, received.get(r.id) ?? null)),
    total,
    page,
    pageSize,
  };
}

interface WhereOptions {
  /** Canonical size for an equality match on the indexed column. */
  exactSize?: string;
  /** Suppresses the free-text `OR` block (used by the exact-size fast path). */
  skipText?: boolean;
}

async function buildWhere(
  query: ProductListQuery,
  includeInactive: boolean,
  options: WhereOptions | null,
): Promise<Prisma.ProductWhereInput> {
  const and: Prisma.ProductWhereInput[] = [];
  const text = query.q?.trim() ?? "";

  if (!includeInactive) and.push({ isActive: true });
  if (query.kind && (PRODUCT_KINDS as readonly string[]).includes(query.kind)) {
    and.push({ kind: query.kind as ProductKindValue });
  }
  if (query.supplierId) and.push({ supplierId: query.supplierId });
  if (query.brand) and.push({ brand: { equals: query.brand, mode: "insensitive" } });

  // `lowStock` is a column-to-column comparison, which Prisma's query builder
  // will not express; the shortlist is computed by a bounded raw query.
  if (query.lowStock) and.push({ id: { in: await lowStockProductIds(LOW_STOCK_SCAN_LIMIT) } });

  if (options?.exactSize) {
    and.push({ size: options.exactSize });
  } else if (query.size) {
    const parts = parseTyreSize(query.size);
    and.push(parts ? { size: parts.canonical } : { size: { contains: query.size, mode: "insensitive" } });
  }

  if (text && !options?.skipText) {
    const parts = parseTyreSize(text);
    const like: Prisma.ProductWhereInput[] = [
      { sku: { startsWith: text.toUpperCase(), mode: "insensitive" } },
      { name: { contains: text, mode: "insensitive" } },
      { brand: { contains: text, mode: "insensitive" } },
      { pattern: { contains: text, mode: "insensitive" } },
      { size: { contains: text.replace(/\s+/g, ""), mode: "insensitive" } },
    ];
    if (parts) like.unshift({ size: parts.canonical });
    and.push({ OR: like });
  }

  return and.length > 0 ? { AND: and } : {};
}

/**

/**
 * SKUs whose *available* stock has reached the reorder point.
 *
 * `available` (not `onHand`) is the correct trigger: four filters that are all
 * promised to four bookings are not four filters the shop can sell. The `LIMIT`
 * keeps the shortlist bounded so a pathological dataset cannot pull the whole
 * catalogue into memory.
 */
export async function lowStockProductIds(limit: number = LOW_STOCK_SCAN_LIMIT): Promise<string[]> {  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT p."id"
      FROM "Product" p
      JOIN "StockLevel" l ON l."productId" = p."id"
     WHERE p."isActive" = true
       AND (l."onHand" - l."reserved") <= p."reorderPoint"
     ORDER BY (l."onHand" - l."reserved") ASC, p."name" ASC
     LIMIT ${Math.min(1_000, Math.max(1, Math.trunc(limit)))}
  `;
  return rows.map((r) => r.id);
}

// ── Tyre-size lookup ────────────────────────────────────────────────────────

export interface TyreSizeLookupResult {
  /** The canonical spelling the query resolved to, or `null` if it is not a size. */
  canonical: string | null;
  rows: ProductDtoLike[];
  total: number;
}

/**
 * The tyre-size finder.
 *
 * Accepts every spelling a human types (`205/55R16`, `205/55 R16`, `205 55 16`)
 * and resolves it to the canonical form the catalogue stores. When the query is
 * not a size at all it degrades to a normal text search rather than an error,
 * because the same box is used to find "Michelin" too.
 */
export async function lookupTyreSize(
  rawQuery: string,
  options: { includeCost: boolean; limit?: number; includeInactive?: boolean },
): Promise<TyreSizeLookupResult> {
  const parts = parseTyreSize(rawQuery);
  const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 25)));
  if (parts) {
    const rows = await prisma.product.findMany({
      where: {
        size: parts.canonical,
        ...(options.includeInactive ? {} : { isActive: true }),
      },
      include: productInclude,
      orderBy: { name: "asc" },
      take: limit,
    });
    const received = await lastReceivedMap(rows.map((r) => r.id));
    return {
      canonical: parts.canonical,
      rows: rows.map((r) => toProductDto(r, options.includeCost, received.get(r.id) ?? null)),
      total: rows.length,
    };
  }
  const text = rawQuery.trim();
  const rows = await prisma.product.findMany({
    where: {
      ...(options.includeInactive ? {} : { isActive: true }),
      OR: [
        { name: { contains: text, mode: "insensitive" } },
        { brand: { contains: text, mode: "insensitive" } },
        { pattern: { contains: text, mode: "insensitive" } },
      ],
    },
    include: productInclude,
    orderBy: { name: "asc" },
    take: limit,
  });
  const received = await lastReceivedMap(rows.map((r) => r.id));
  return {
    canonical: null,
    rows: rows.map((r) => toProductDto(r, options.includeCost, received.get(r.id) ?? null)),
    total: rows.length,
  };
}

// ── Single-product availability (the promise check) ─────────────────────────

export interface ProductAvailabilityInput {
  productId?: string | undefined;
  sku?: string | undefined;
}

/**
 * "Can we promise this one?" — the number a booking wizard checks before it
 * offers a slot.
 *
 * `canPromise` EQUALS `available`. The contract keeps them as separate fields
 * because a customer-facing claim may later be reduced by a safety buffer while
 * the underlying stock number stays the same; today they are the same figure and
 * inventing a difference would be a lie.
 *
 * `ageDays` is AGE ELAPSED, never days remaining. Getting that backwards is a
 * silent failure: a clearance campaign that reads `ageDays` as "days to expiry"
 * would fire on brand-new stock instead of old stock.
 *
 * Ageing is *reported* here but never gates anything: an old tyre or a
 * near-expiry oil is information for the counter, not a reason to refuse a
 * customer whose car is already up on the lift.
 */
export async function getProductAvailability(input: ProductAvailabilityInput): Promise<ProductAvailabilityDto> {
  const row: ProductWithLevel | null =
    input.productId !== undefined
      ? await prisma.product.findUnique({ where: { id: input.productId }, include: productInclude })
      : await prisma.product.findUnique({
          where: { sku: (input.sku ?? "").trim().toUpperCase() },
          include: productInclude,
        });
  if (!row) throw notFound("Product not found.");

  const available = (row.level?.onHand ?? 0) - (row.level?.reserved ?? 0);
  const received = await lastReceivedMap([row.id]);
  const age = productAgeDays({ ...row, lastReceivedAt: received.get(row.id) ?? null }, new Date());

  return {
    productId: row.id,
    sku: row.sku,
    name: row.name,
    available,
    canPromise: available,
    isLow: available <= row.reorderPoint,
    reorderPoint: row.reorderPoint,
    ageDays: age.ageDays,
    isNearExpiry: age.isNearExpiry,
  };
}

interface AgeView {
  ageDays: number | null;
  isNearExpiry: boolean;
}

/** The minimum a product needs to be aged. Keeps this callable from any query. */
export interface AgeableProduct {
  kind: ProductKindValue;
  dotCode: string | null;
  shelfLifeDays: number | null;
  createdAt: Date;
  /** From the ledger. `null` when the product has never been received. */
  lastReceivedAt: Date | null;
}

/**
 * Age in days for one product, and whether it is "near" the end of its life.
 *
 * Tyres are dated by their DOT code (`WKYY`). Everything else is dated from
 * RECEIPT (`lastReceivedAt`, derived from the ledger) plus `shelfLifeDays`, with
 * `createdAt` only as a labelled fallback. `ageDays` is always ELAPSED time.
 * Neither figure is used to gate anything — both are for the ageing report and
 * the clearance list.
 */
export function productAgeDays(row: AgeableProduct, now: Date): AgeView {
  if (row.kind === "TYRE") {
    const produced = parseDotCode(row.dotCode);
    if (!produced) return { ageDays: null, isNearExpiry: false };
    const ageDays = daysBetween(produced, now);
    return { ageDays, isNearExpiry: ageDays >= TYRE_STALE_DAYS };
  }
  const since = row.lastReceivedAt ?? row.createdAt;
  const expiry = shelfLifeExpiry(since, row.shelfLifeDays);
  if (!expiry) return { ageDays: null, isNearExpiry: false };
  const remaining = daysUntil(expiry, now);
  return {
    ageDays: daysBetween(since, now),
    isNearExpiry: remaining !== null && remaining <= NEAR_EXPIRY_DAYS,
  };
}

export type { ProductDtoLike, ProductWithLevel };
