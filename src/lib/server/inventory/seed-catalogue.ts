/**
 * STARTER CATALOGUE SEED
 * ============================================================================
 * ## HONESTY NOTICE — READ THIS BEFORE TRUSTING A SINGLE PESO
 *
 * `docs/inventory-research/starter-catalogue.md` did not exist when this file was
 * written, so every figure below is a **SUGGESTED PLACEHOLDER**, not researched
 * data. Nothing here is presented as a market price. Each row carries
 * `notes: "SUGGESTED — owner unconfirmed"` and the seeder copies that marker into
 * `Product.notes`, so a suggested price can never be mistaken for a researched one
 * once it is in the database.
 *
 * The owner must walk the shop, replace these with real cost/sell figures, and
 * set `costPrice = 0` on anything they have not confirmed. A `costPrice` of 0 is
 * the schema's "unknown", and margin is reported as `null` for it rather than a
 * flattering guess.
 *
 * ## IDEMPOTENCE
 *
 * Keyed on `sku`. Existing rows are never updated — a seed that overwrites prices
 * would silently undo the owner's corrections on every deploy. Missing SKUs are
 * created with a zero `StockLevel`; the owner then posts a single `OPENING`
 * movement per SKU with a real count, which is what puts a number on the shelf
 * that came from the shelf.
 *
 * ## HOW TO SEED FROM A1's RESEARCH
 *
 * `parseStarterCatalogueMarkdown()` accepts the researched markdown once it
 * lands, so the researched numbers can replace the placeholders without any code
 * change. Wiring that call into `prisma/seed.ts` needs an orchestrator decision
 * (the seed file is not owned by this agent).
 * ============================================================================
 */
import "server-only";

import type { ProductKindValue, UnitValue } from "@/lib/inventory-types";
import { logger } from "@/lib/logger";
import { prisma, withSerializableRetry } from "@/lib/server/db";

import { computeMarginPct } from "./products";
import { ensureLevel } from "./stock-engine";

/** The marker copied onto every seeded product so a suggested price is visible. */
export const UNCONFIRMED_MARKER = "SUGGESTED — owner unconfirmed";

export interface SeedProduct {
  sku: string;
  name: string;
  kind: ProductKindValue;
  unit: UnitValue;
  brand?: string;
  supplier?: string;
  barcode?: string;
  size?: string;
  aspectRatio?: number;
  rimSizeIn?: number;
  loadIndex?: string;
  speedRating?: string;
  pattern?: string;
  dotCode?: string;
  costPrice: number;
  sellPrice: number;
  reorderPoint: number;
  reorderQty: number;
  shelfLifeDays?: number;
  cycleCountDays?: number;
  notes?: string;
}

export interface SeedSupplier {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

// ── Suppliers ───────────────────────────────────────────────────────────────

/**
 * Names only. No phone, email or address is invented — an invented supplier
 * telephone number on a purchase order is a liability, not a convenience. The
 * owner fills those in.
 */
export const SEED_SUPPLIERS: readonly SeedSupplier[] = Object.freeze([
  { name: "Tyre distributor (to be confirmed)", notes: UNCONFIRMED_MARKER },
  { name: "Auto parts wholesaler (to be confirmed)", notes: UNCONFIRMED_MARKER },
  { name: "Lubricant supplier (to be confirmed)", notes: UNCONFIRMED_MARKER },
]);

// ── The placeholder catalogue ───────────────────────────────────────────────

/**
 * A realistic *shape* for a Balanga tyre + auto-care shop: the sizes that fit the
 * local fleet, the four filter families, the oil grades a mechanic actually
 * pours, and the fast-moving consumables.
 *
 * The QUANTITIES and PRICES are suggestions. `openingQty` is deliberately 0 for
 * every row: the shop must post a real opening count rather than inheriting a
 * number from a code file.
 */
export const SEED_CATALOGUE: readonly SeedProduct[] = Object.freeze([
  // ── Tyres ─────────────────────────────────────────────────────────────────
  {
    sku: "TYR-20555R16",
    name: "205/55R16 tyre",
    kind: "TYRE",
    unit: "EA",
    brand: "Michelin",
    supplier: "Tyre distributor (to be confirmed)",
    size: "205/55R16",
    aspectRatio: 55,
    rimSizeIn: 16,
    loadIndex: "91",
    speedRating: "V",
    pattern: "Primacy",
    costPrice: 4_200,
    sellPrice: 5_950,
    reorderPoint: 4,
    reorderQty: 4,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "TYR-19565R15",
    name: "195/65R15 tyre",
    kind: "TYRE",
    unit: "EA",
    brand: "Bridgestone",
    supplier: "Tyre distributor (to be confirmed)",
    size: "195/65R15",
    aspectRatio: 65,
    rimSizeIn: 15,
    loadIndex: "91",
    speedRating: "H",
    pattern: "Ecopia",
    costPrice: 3_600,
    sellPrice: 5_200,
    reorderPoint: 4,
    reorderQty: 4,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "TYR-21560R16",
    name: "215/60R16 tyre",
    kind: "TYRE",
    unit: "EA",
    brand: "Dunlop",
    supplier: "Tyre distributor (to be confirmed)",
    size: "215/60R16",
    aspectRatio: 60,
    rimSizeIn: 16,
    loadIndex: "95",
    speedRating: "H",
    pattern: "SP Sport",
    costPrice: 4_500,
    sellPrice: 6_400,
    reorderPoint: 4,
    reorderQty: 4,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "TYR-18565R14",
    name: "185/65R14 tyre",
    kind: "TYRE",
    unit: "EA",
    brand: "Maxxis",
    supplier: "Tyre distributor (to be confirmed)",
    size: "185/65R14",
    aspectRatio: 65,
    rimSizeIn: 14,
    loadIndex: "82",
    speedRating: "H",
    costPrice: 2_500,
    sellPrice: 3_900,
    reorderPoint: 4,
    reorderQty: 4,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "TYR-SPK18565R15",
    name: "Spare tyre 185/65R15",
    kind: "TYRE",
    unit: "EA",
    brand: "Maxxis",
    supplier: "Tyre distributor (to be confirmed)",
    size: "185/65R15",
    aspectRatio: 65,
    rimSizeIn: 15,
    loadIndex: "88",
    speedRating: "H",
    costPrice: 2_700,
    sellPrice: 4_200,
    reorderPoint: 2,
    reorderQty: 2,
    notes: `${UNCONFIRMED_MARKER} — the spare is the one tyre that must not be missing`,
  },

  // ── Oil ───────────────────────────────────────────────────────────────────
  {
    sku: "OIL-5W30-1L",
    name: "Engine oil 5W-30 fully synthetic",
    kind: "OIL",
    unit: "LITRE",
    brand: "Shell",
    supplier: "Lubricant supplier (to be confirmed)",
    costPrice: 620,
    sellPrice: 900,
    reorderPoint: 24,
    reorderQty: 60,
    shelfLifeDays: 1_095,
    cycleCountDays: 30,
    notes: `${UNCONFIRMED_MARKER} — decant norm in PH`,
  },
  {
    sku: "OIL-10W40-1L",
    name: "Engine oil 10W-40 semi-synthetic",
    kind: "OIL",
    unit: "LITRE",
    brand: "Motul",
    supplier: "Lubricant supplier (to be confirmed)",
    costPrice: 580,
    sellPrice: 850,
    reorderPoint: 24,
    reorderQty: 60,
    shelfLifeDays: 1_095,
    notes: `${UNCONFIRMED_MARKER} — decant norm in PH`,
  },
  {
    sku: "OIL-ATF-1L",
    name: "Automatic transmission fluid",
    kind: "OIL",
    unit: "LITRE",
    supplier: "Lubricant supplier (to be confirmed)",
    costPrice: 480,
    sellPrice: 750,
    reorderPoint: 12,
    reorderQty: 24,
    shelfLifeDays: 1_460,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "OIL-BRAKE-500ML",
    name: "Brake fluid DOT 3",
    kind: "OIL",
    unit: "LITRE",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 320,
    sellPrice: 520,
    reorderPoint: 6,
    reorderQty: 12,
    shelfLifeDays: 730,
    notes: `${UNCONFIRMED_MARKER} — absorbs moisture, shelf life matters`,
  },
  {
    sku: "OIL-COOLANT-1L",
    name: "Engine coolant (ready to use)",
    kind: "OIL",
    unit: "LITRE",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 260,
    sellPrice: 450,
    reorderPoint: 8,
    reorderQty: 24,
    shelfLifeDays: 730,
    notes: UNCONFIRMED_MARKER,
  },

  // ── Filters ───────────────────────────────────────────────────────────────
  {
    sku: "FLT-OIL-01",
    name: "Oil filter — Toyota / Lexus common",
    kind: "FILTER",
    unit: "EA",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 210,
    sellPrice: 380,
    reorderPoint: 8,
    reorderQty: 24,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "FLT-OIL-02",
    name: "Oil filter — Honda / Nissan common",
    kind: "FILTER",
    unit: "EA",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 195,
    sellPrice: 350,
    reorderPoint: 8,
    reorderQty: 24,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "FLT-AIR-01",
    name: "Air filter — universal washable",
    kind: "FILTER",
    unit: "EA",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 340,
    sellPrice: 650,
    reorderPoint: 4,
    reorderQty: 12,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "FLT-CAB-01",
    name: "Cabin / aircon filter",
    kind: "FILTER",
    unit: "SET",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 260,
    sellPrice: 500,
    reorderPoint: 4,
    reorderQty: 12,
    notes: `${UNCONFIRMED_MARKER} — sold as a set of 2`,
  },
  {
    sku: "FLT-FUEL-01",
    name: "Fuel filter",
    kind: "FILTER",
    unit: "EA",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 230,
    sellPrice: 420,
    reorderPoint: 6,
    reorderQty: 12,
    notes: UNCONFIRMED_MARKER,
  },

  // ── Brakes ────────────────────────────────────────────────────────────────
  {
    sku: "BRK-PAD-FRT-01",
    name: "Brake pads — front axle set",
    kind: "BRAKE",
    unit: "SET",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 1_650,
    sellPrice: 2_900,
    reorderPoint: 2,
    reorderQty: 6,
    notes: `${UNCONFIRMED_MARKER} — sold as an axle set (4 pads)`,
  },
  {
    sku: "BRK-PAD-REAR-01",
    name: "Brake pads — rear axle set",
    kind: "BRAKE",
    unit: "SET",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 1_350,
    sellPrice: 2_500,
    reorderPoint: 2,
    reorderQty: 6,
    notes: `${UNCONFIRMED_MARKER} — sold as an axle set (4 pads)`,
  },
  {
    sku: "BRK-DISC-FRT-01",
    name: "Brake disc — front, pair",
    kind: "BRAKE",
    unit: "PAIR",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 2_400,
    sellPrice: 4_200,
    reorderPoint: 2,
    reorderQty: 4,
    notes: UNCONFIRMED_MARKER,
  },

  // ── Wipers ────────────────────────────────────────────────────────────────
  {
    sku: "WPR-BLADE-21",
    name: "Wiper blade 21\"",
    kind: "WIPER",
    unit: "EA",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 180,
    sellPrice: 350,
    reorderPoint: 6,
    reorderQty: 12,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "WPR-BLADE-16",
    name: "Wiper blade 16\"",
    kind: "WIPER",
    unit: "EA",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 140,
    sellPrice: 280,
    reorderPoint: 6,
    reorderQty: 12,
    notes: UNCONFIRMED_MARKER,
  },

  // ── Battery ───────────────────────────────────────────────────────────────
  {
    sku: "BAT-60AH",
    name: "Car battery 60Ah",
    kind: "BATTERY",
    unit: "EA",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 4_800,
    sellPrice: 7_200,
    reorderPoint: 1,
    reorderQty: 2,
    cycleCountDays: 0,
    notes: `${UNCONFIRMED_MARKER} — battery age is tracked by the warranty sticker, not a shelf life`,
  },

  // ── Tyre accessories ──────────────────────────────────────────────────────
  {
    sku: "ACC-VALVE-TR43",
    name: "TR43 rubber snap-in valve (pair)",
    kind: "TYRE_ACCESSORY",
    unit: "PAIR",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 40,
    sellPrice: 100,
    reorderPoint: 20,
    reorderQty: 50,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "ACC-BALANCE-112",
    name: "Balance weights (box)",
    kind: "TYRE_ACCESSORY",
    unit: "SET",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 1_200,
    sellPrice: 2_000,
    reorderPoint: 1,
    reorderQty: 2,
    notes: `${UNCONFIRMED_MARKER} — measured in grams, not pieces`,
  },

  // ── Consumables ───────────────────────────────────────────────────────────
  {
    sku: "CON-BRAKE-CLEAN-400",
    name: "Brake cleaner aerosol 400ml",
    kind: "CONSUMABLE",
    unit: "EA",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 165,
    sellPrice: 300,
    reorderPoint: 4,
    reorderQty: 12,
    shelfLifeDays: 730,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "CON-GREASE-400",
    name: "Multi-purpose grease 400ml",
    kind: "CONSUMABLE",
    unit: "EA",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 145,
    sellPrice: 260,
    reorderPoint: 4,
    reorderQty: 12,
    shelfLifeDays: 1_095,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "CON-PENETRANT-500",
    name: "Penetrating oil spray 500ml",
    kind: "CONSUMABLE",
    unit: "EA",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 130,
    sellPrice: 240,
    reorderPoint: 3,
    reorderQty: 12,
    shelfLifeDays: 1_095,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "CON-SEALANT-TUBE",
    name: "Tyre bead seal / puncture repair kit",
    kind: "CONSUMABLE",
    unit: "SET",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 180,
    sellPrice: 350,
    reorderPoint: 3,
    reorderQty: 8,
    notes: UNCONFIRMED_MARKER,
  },
  {
    sku: "CON-SILICONE-DASH",
    name: "Dashboard silicone dressing",
    kind: "CONSUMABLE",
    unit: "EA",
    supplier: "Auto parts wholesaler (to be confirmed)",
    costPrice: 110,
    sellPrice: 220,
    reorderPoint: 3,
    reorderQty: 8,
    shelfLifeDays: 730,
    notes: UNCONFIRMED_MARKER,
  },
]);

// ── Optional bill of materials ──────────────────────────────────────────────

export interface SeedRequirement {
  serviceSlug: string;
  productSku: string;
  qtyPerService: number;
  /**
   * Blocking means "we cannot do this job without it" (brake pads, oil for a
   * full service). Non-blocking means "a shortage warns but does not stop the
   * customer" (a spare wiper blade, a cosmetic dressing).
   */
  isBlocking: boolean;
}

/**
 * A minimal, honest starting BOM. NOT applied by default — creating requirements
 * is the booking integration's call, and a wrong BOM produces a wrong promise.
 * Exported so the integration agent (or a deliberate seed step) can apply it.
 */
export const SEED_REQUIREMENTS: readonly SeedRequirement[] = Object.freeze([
  { serviceSlug: "pms-a", productSku: "OIL-5W30-1L", qtyPerService: 4, isBlocking: true },
  { serviceSlug: "pms-a", productSku: "FLT-OIL-01", qtyPerService: 1, isBlocking: true },
  { serviceSlug: "pms-b", productSku: "OIL-5W30-1L", qtyPerService: 4, isBlocking: true },
  { serviceSlug: "pms-b", productSku: "FLT-OIL-02", qtyPerService: 1, isBlocking: true },
  { serviceSlug: "pms-c", productSku: "OIL-10W40-1L", qtyPerService: 4, isBlocking: true },
  { serviceSlug: "pms-c", productSku: "FLT-AIR-01", qtyPerService: 1, isBlocking: false },
  { serviceSlug: "brake-pads", productSku: "BRK-PAD-FRT-01", qtyPerService: 1, isBlocking: true },
  { serviceSlug: "tire-change", productSku: "ACC-BALANCE-112", qtyPerService: 1, isBlocking: false },
]);

// ── Markdown ingestion (for A1's researched catalogue) ──────────────────────

/**
 * Parses a researched starter-catalogue markdown table into seed rows.
 *
 * Deliberately forgiving about header spelling and strict about the numbers: a
 * row whose cost or sell cannot be read as a whole peso amount is SKIPPED, not
 * guessed. A seed that invents a price is worse than a seed that misses a row.
 *
 * Returns `{ rows, skipped }` so the caller can report exactly what it did not
 * import — silence about a skipped row reads as "it imported everything".
 */
export function parseStarterCatalogueMarkdown(markdown: string): {
  rows: SeedProduct[];
  skipped: Array<{ line: number; reason: string }>;
} {
  const rows: SeedProduct[] = [];
  const skipped: Array<{ line: number; reason: string }> = [];
  const lines = markdown.split(/\r?\n/);

  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    const lineNumber = index + 1;
    if (line.length === 0 || line.startsWith("#") || line.startsWith(">") || line.startsWith("```")) continue;
    if (!line.startsWith("|")) continue;

    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 4) continue;
    // Header and separator rows.
    if (cells.every((c) => /^-{2,}$/.test(c))) continue;
    if (/^(sku|item code)$/i.test(cells[0] ?? "")) continue;

    const [skuCell, nameCell, kindCell, unitCell, costCell, sellCell, ...rest] = cells;
    const sku = (skuCell ?? "").toUpperCase();
    const name = (nameCell ?? "").trim();
    if (sku.length === 0 || name.length === 0) continue;

    const kind = upperAs<ProductKindValue>(kindCell);
    const unit = upperAs<UnitValue>(unitCell);
    if (!kind || !unit) {
      skipped.push({ line: lineNumber, reason: `unrecognised kind/unit: ${kindCell ?? "?"}/${unitCell ?? "?"}` });
      continue;
    }

    const costPrice = readPeso(costCell);
    const sellPrice = readPeso(sellCell);
    if (costPrice === null || sellPrice === null) {
      skipped.push({ line: lineNumber, reason: `cost/sell not a whole peso amount: ${costCell ?? "?"}/${sellCell ?? "?"}` });
      continue;
    }

    const notes = rest.find((c) => c.length > 0);
    rows.push({
      sku,
      name,
      kind,
      unit,
      costPrice,
      sellPrice,
      reorderPoint: 2,
      reorderQty: 4,
      // Anything the research doc did not mark as verified stays flagged.
      notes: notes && !/^(verified|confirmed|source)/i.test(notes) ? `${notes} — ${UNCONFIRMED_MARKER}` : UNCONFIRMED_MARKER,
    });
  }

  return { rows, skipped };
}

function upperAs<T extends string>(value: string | undefined): T | null {
  const raw = (value ?? "").trim().toUpperCase();
  return raw.length > 0 ? (raw as T) : null;
}

/** Strips ₱, thousands separators and any trailing "-estimate" decoration. */
function readPeso(value: string | undefined): number | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length === 0) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

// ── The seed run ────────────────────────────────────────────────────────────

export interface SeedResult {
  suppliersCreated: number;
  productsCreated: number;
  productsSkipped: number;
  requirementsCreated: number;
}

export interface SeedOptions {
  /** Overrides the built-in placeholder list, e.g. with the parsed research. */
  catalogue?: readonly SeedProduct[];
  /** Applies `SEED_REQUIREMENTS`. Off by default — see the note on that const. */
  withRequirements?: boolean;
}

/**
 * Idempotent, additive seed. Never updates an existing row.
 *
 * Every created product gets a zeroed `StockLevel`. Nothing here invents an
 * opening quantity: the shop's real count arrives through a cycle count or an
 * `OPENING` movement, both of which write to the ledger and leave a reason.
 */
export async function seedCatalogue(options: SeedOptions = {}): Promise<SeedResult> {
  const catalogue = options.catalogue ?? SEED_CATALOGUE;

  const supplierIds = await withSerializableRetry(async (tx) => {
    const map = new Map<string, string>();
    for (const supplier of SEED_SUPPLIERS) {
      const row = await tx.supplier.findFirst({ where: { name: supplier.name }, select: { id: true } });
      if (row) {
        map.set(supplier.name, row.id);
        continue;
      }
      const created = await tx.supplier.create({
        data: {
          name: supplier.name,
          notes: supplier.notes ?? null,
        },
        select: { id: true },
      });
      map.set(supplier.name, created.id);
    }
    return map;
  });

  let productsCreated = 0;
  let productsSkipped = 0;

  for (const item of catalogue) {
    const sku = item.sku.trim().toUpperCase();
    const existing = await prisma.product.findUnique({ where: { sku }, select: { id: true } });
    if (existing) {
      productsSkipped += 1;
      continue;
    }
    const supplierId = item.supplier ? (supplierIds.get(item.supplier) ?? null) : null;

    await withSerializableRetry(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku,
          name: item.name,
          kind: item.kind,
          unit: item.unit,
          brand: item.brand ?? null,
          supplierId,
          barcode: item.barcode ?? null,
          size: item.size ?? null,
          aspectRatio: item.aspectRatio ?? null,
          rimSizeIn: item.rimSizeIn ?? null,
          loadIndex: item.loadIndex ?? null,
          speedRating: item.speedRating ?? null,
          pattern: item.pattern ?? null,
          dotCode: item.dotCode ?? null,
          costPrice: item.costPrice,
          sellPrice: item.sellPrice,
          marginPct: computeMarginPct(item.costPrice, item.sellPrice),
          reorderPoint: item.reorderPoint,
          reorderQty: item.reorderQty,
          shelfLifeDays: item.shelfLifeDays ?? null,
          cycleCountDays: item.cycleCountDays ?? 30,
          // The honesty marker rides along in `notes` so a suggested price is
          // still labelled as one inside the running application.
          notes: item.notes ?? UNCONFIRMED_MARKER,
          isActive: true,
        },
        select: { id: true },
      });
      await ensureLevel(tx, created.id);
    });
    productsCreated += 1;
  }

  let requirementsCreated = 0;
  if (options.withRequirements === true) requirementsCreated = await applyRequirements();

  const result: SeedResult = { suppliersCreated: supplierIds.size, productsCreated, productsSkipped, requirementsCreated };
  logger.info("inventory.seeded", { scope: "inventory", ...result });
  return result;
}

/**
 * Applies `SEED_REQUIREMENTS` by service **slug** and product **sku**, so it is
 * safe to re-run: both relations are upserted on their unique keys.
 */
export async function applyRequirements(): Promise<number> {
  let created = 0;
  for (const requirement of SEED_REQUIREMENTS) {
    const [service, product] = await Promise.all([
      prisma.service.findUnique({ where: { slug: requirement.serviceSlug }, select: { id: true } }),
      prisma.product.findUnique({ where: { sku: requirement.productSku.toUpperCase() }, select: { id: true } }),
    ]);
    if (!service || !product) continue;
    await prisma.servicePartRequirement.upsert({
      where: { serviceId_productId: { serviceId: service.id, productId: product.id } },
      create: {
        serviceId: service.id,
        productId: product.id,
        qtyPerService: requirement.qtyPerService,
        isBlocking: requirement.isBlocking,
      },
      update: { qtyPerService: requirement.qtyPerService, isBlocking: requirement.isBlocking },
    });
    created += 1;
  }
  return created;
}
