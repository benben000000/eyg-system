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
import { parseTyreSize } from "./stock-engine.test-support";

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
 * THE BILL OF MATERIALS — which service physically consumes which part.
 *
 * ============================================================================
 * THIS REPLACED A VERSION THAT SILENTLY DID NOTHING.
 *
 * The previous list named eight product SKUs and service slugs that do not exist:
 * every SKU was from the placeholder catalogue. `applyRequirements()` matched zero
 * rows, reported `requirementsCreated: 0`, and nothing noticed — a seed reporting
 * its own total failure as a number nobody read.
 *
 * Every line below names a SKU and a slug that exist in the researched catalogue
 * and the seeded service list.
 *
 * WHERE THE MAPPING COMES FROM
 *
 * `docs/inventory-research/tyre-and-parts-landscape.md` §1.1, which is an opinion
 * about physical reality rather than a researched claim — so it is treated as one.
 * Four findings from that document are load-bearing:
 *
 *   1. NITROGEN IS NOT INVENTORY. "Nitrogen Tire Inflation" is one of the ten
 *      confirmed services and the single most tempting place to invent a gas SKU.
 *      Nitrogen comes from an on-premises cylinder. No product exists, so no
 *      service below consumes one.
 *
 *   2. BRAKE CLEANING IS A CONSUMABLE JOB, NOT A BRAKE-PARTS JOB. On a shop this
 *      size it is overwhelmingly aerosol brake cleaner and a brake-fluid top-up,
 *      and it is NOT the same booking as a pad change. Keeping them apart is why
 *      `brake-fluid` consumes cleaner and fluid while `brake-pads` consumes pads.
 *
 *   3. UNDERCOATING AND ALIGNMENT CONSUME NOTHING. Alignment is labour and a
 *      machine. No SKU until the owner signs off the service list.
 *
 *   4. MANY SERVICES HAVE NO CONSUMABLE AT ALL, which is normal, not a gap.
 *
 * TWO MODELLING LIMITS, STATED RATHER THAN PAPERED OVER
 *
 *   A. `ServicePartRequirement` is service → product. It CANNOT express "one oil
 *      filter, but WHICH one depends on the vehicle", and the catalogue carries six
 *      vehicle-specific oil filters. Every such line below is therefore
 *      `isBlocking: false`: the QUANTITY is what a booking reserves, and the
 *      mechanic picks the part against the vehicle at handover. Marking them
 *      blocking would refuse a customer's booking over a part the shop may well
 *      have in a different filter — a lost sale, not a safety issue.
 *
 *   B. OIL VOLUME IS ENGINE-DEPENDENT and unresolved (research open question
 *      Q-02). Every line below assumes ONE 4-litre can, which covers most cars in
 *      the local fleet but not all. It is blocking because handing a car back
 *      without oil is worse than losing a booking. When the owner confirms the real
 *      fill volumes, only this number changes.
 *
 * TOOLS ARE DELIBERATELY ABSENT. A wheel balancer is stock in the sense that the
 * shop owns it, but no service "consumes" one, and `reorderPoint` is 0 so it never
 * reaches the order list.
 */
export const SEED_REQUIREMENTS: readonly SeedRequirement[] = Object.freeze([
  // ── PMS A — Change Oil & Filter ──────────────────────────────────────────
  // The two things a PMS indisputably consumes.
  { serviceSlug: "pms-a", productSku: "OIL-PTR-SYN5000-5W30-4L", qtyPerService: 1, isBlocking: true },
  {
    serviceSlug: "pms-a",
    productSku: "FLT-OIL-ACD-YZZE1",
    qtyPerService: 1,
    // Non-blocking: one of six vehicle-specific filters. See note A above.
    isBlocking: false,
  },

  // ── PMS B — Oil, Filter & Full Check ────────────────────────────────────
  // PMS A, plus the consumables a "full check" actually uses.
  { serviceSlug: "pms-b", productSku: "OIL-PTR-SYN5000-5W30-4L", qtyPerService: 1, isBlocking: true },
  { serviceSlug: "pms-b", productSku: "FLT-OIL-ACD-YZZE1", qtyPerService: 1, isBlocking: false },
  { serviceSlug: "pms-b", productSku: "FLT-AIR-ACD-INNOVA", qtyPerService: 1, isBlocking: false },
  { serviceSlug: "pms-b", productSku: "CON-BRKCLN-BDX-500", qtyPerService: 1, isBlocking: false },
  { serviceSlug: "pms-b", productSku: "CON-GRS-MP3-1KG", qtyPerService: 1, isBlocking: false },

  // ── PMS C — Oil, Filter, Brakes & Alignment ──────────────────────────────
  // PMS B, plus a brake-fluid top-up. The alignment itself consumes nothing.
  { serviceSlug: "pms-c", productSku: "OIL-PTR-SYN5000-5W30-4L", qtyPerService: 1, isBlocking: true },
  { serviceSlug: "pms-c", productSku: "FLT-OIL-ACD-YZZE1", qtyPerService: 1, isBlocking: false },
  { serviceSlug: "pms-c", productSku: "FLT-AIR-ACD-INNOVA", qtyPerService: 1, isBlocking: false },
  { serviceSlug: "pms-c", productSku: "BRK-FLUD-DOT4-1L", qtyPerService: 1, isBlocking: false },
  { serviceSlug: "pms-c", productSku: "CON-BRKCLN-BDX-500", qtyPerService: 1, isBlocking: false },

  // ── Brake Cleaning & Maintenance ──────────────────────────────────────────
  // Research finding 2: aerosol cleaner and a fluid top-up, NOT pads.
  { serviceSlug: "brake-fluid", productSku: "CON-BRKCLN-BDX-500", qtyPerService: 1, isBlocking: true },
  { serviceSlug: "brake-fluid", productSku: "BRK-FLUD-DOT4-1L", qtyPerService: 1, isBlocking: false },

  // ── Brake Pad Replacement ────────────────────────────────────────────────
  {
    serviceSlug: "brake-pads",
    productSku: "BRK-PAD-ICR-181898",
    qtyPerService: 1,
    // Vehicle-specific, same reasoning as the oil filter. See note A.
    isBlocking: false,
  },

  // ── Battery Replacement ──────────────────────────────────────────────────
  // Four battery group sizes; which one depends on the vehicle, so the quantity
  // reserves and the mechanic confirms the group at handover.
  { serviceSlug: "battery-replacement", productSku: "BAT-AMR-GO-NS40", qtyPerService: 1, isBlocking: false },

  // ── Tyre Change & Balancing ──────────────────────────────────────────────
  // Research: balancing weights and a valve core. There is no "balancing weight"
  // SKU — the shop reuses the weights it already owns, so that is a tooling
  // consumable rather than purchased stock. A valve-cap bag is tracked.
  { serviceSlug: "tire-change", productSku: "TAR-VALV-CAP-100", qtyPerService: 1, isBlocking: false },

  // ── Puncture Repair ──────────────────────────────────────────────────────
  { serviceSlug: "puncture-repair", productSku: "TAR-SEAL-450ML", qtyPerService: 1, isBlocking: false },

  // ── New Tyre Supply & Mounting ───────────────────────────────────────────
  // Four per car. This one IS blocking: a car handed back on three tyres is a
  // customer at the counter with a problem.
  {
    serviceSlug: "new-tyres",
    productSku: "TYR-MIC-20555R16-XM2P",
    qtyPerService: 4,
    isBlocking: true,
  },
]);

/**
 * Services that physically consume nothing.
 *
 * Listed so the absence is visible and reviewable rather than looking like an
 * oversight. Four of these are labour-only; the rest simply have no SKU in the
 * researched catalogue yet.
 */
export const UNMAPPED_SERVICES: readonly string[] = Object.freeze([
  "wheel-alignment", // labour + a machine (research finding 3)
  "undercoating", // no SKU until the owner signs the service list
  "engine-tune-up",
  "ac-regas",
  "ac-repair",
  "spark-plugs", // no spark-plug SKU in the catalogue
  "battery-test",
  "roadside-assist",
  "mobile-tire-change",
  "tire-rotation",
  "shock-absorber",
]);

  // ── Markdown ingestion (the researched catalogue) ─────────────────────────
  // The research document is the single source of truth for the catalogue, so it
  // is READ rather than pasted in. Updating a price means editing the markdown.

  /**
   * Parse a researched starter-catalogue markdown table into seed rows.
   *
   * HEADER-DRIVEN, NOT POSITIONAL.
   *
   * The research document's column order changed while this function already
   * existed, and a positional reader does not fail loudly when that happens: it
   * reads the brand as a price, gets null from the peso parser, and silently
   * skips every row. That is how 28 generic placeholders shipped in place of a
   * 48-row researched catalogue — two correct implementations, opposite formats,
   * neither able to see the other.
   *
   * So: find the header row, build a name-to-index map, and resolve every field
   * BY NAME. Insert or reorder a column upstream and this keeps working.
   *
   * Strict about the numbers: a row whose cost or sell cannot be read as a whole
   * peso amount is SKIPPED, not guessed. A seed that invents a price is worse
   * than one that misses a row. `{ skipped }` is returned so the caller reports
   * exactly what it did not import — silence reads as "it imported everything".
   */
  export function parseStarterCatalogueMarkdown(markdown: string): {
    rows: SeedProduct[];
    skipped: Array<{ line: number; reason: string }>;
  } {
    const rows: SeedProduct[] = [];
    const skipped: Array<{ line: number; reason: string }> = [];

    /** Normalise a header cell into a comparable key. */
    const key = (cell: string): string =>
      cell
        .toLowerCase()
        // A parenthetical CLARIFIES a column, it does not rename it. "anchor
        // (researched)" is still `anchor`, and "costPrice (asset value)" is still
        // `costPrice` — which is the tools table's header. Dropping the qualifier is
        // what stops a cosmetic edit upstream from silently skipping rows.
        .replace(/\([^)]*\)/g, " ")
        .replace(/[^a-z0-9]/g, "");

    const splitRow = (raw: string): string[] =>
      raw
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());

    const source = markdown.split(/\r?\n/);

    // ── 1. Find the header row, build the name → index map ─────────────
    let columns: Record<string, number> | null = null;

    for (const [index, raw] of source.entries()) {
      const line = raw.trim();
      if (!line.startsWith("|")) continue;

      const head = splitRow(line);
      if (head.length < 4) continue;

      // A header is the row whose first cell is the SKU column.
      if (!/^(sku|item ?code)$/i.test(head[0]?.replace(/[\`*]/g, "") ?? "")) continue;

      const map: Record<string, number> = {};
      head.forEach((cell, i) => {
        const k = key(cell.replace(/[\`*]/g, ""));
        if (k.length > 0 && map[k] === undefined) map[k] = i;
      });
      columns = map;

      // ── 2. Parse every data row beneath this header ─────────────────
      for (let r = index + 1; r < source.length; r += 1) {
        const dataLine = source[r]?.trim() ?? "";
        const lineNumber = r + 1;

        // A table ends at the first non-table line. A heading after it opens a
        // new section, so drop the map and keep looking for the next header.
        if (dataLine.length === 0 || !dataLine.startsWith("|")) {
          if (dataLine.startsWith("###")) columns = null;
          break;
        }

        const data = splitRow(dataLine);
        if (data.length < 4) continue;
        if (data.every((c) => /^-{2,}$/.test(c) || c.length === 0)) continue; // separator

        const cols = columns;
        const cell = (name: string): string => {
          const i = cols[name];
          return i === undefined ? "" : (data[i] ?? "").replace(/[\`*]/g, "").trim();
        };

        const sku = cell("sku").toUpperCase();
        const name = cell("name");
        if (sku.length === 0 || name.length === 0) continue;

        const kind = upperAs<ProductKindValue>(cell("kind"));
        const unit = upperAs<UnitValue>(cell("unit"));
        if (!kind || !unit) {
          skipped.push({
            line: lineNumber,
            reason: 'unrecognised kind/unit: "' + cell("kind") + '" / "' + cell("unit") + '"',
          });
          continue;
        }

        const costPrice = readPeso(cell("costprice"));
        const sellPrice = readPeso(cell("sellprice"));
        if (costPrice === null || sellPrice === null) {
          skipped.push({
            line: lineNumber,
            reason:
              'cost/sell not a whole peso amount: "' +
              cell("costprice") +
              '" / "' +
              cell("sellprice") +
              '"',
          });
          continue;
        }

        // The tyre size drives two separately indexed columns, and it is what a
        // mechanic actually types, so parse it rather than store it opaque.
        const sizeCell = cell("size");
        const size = sizeCell.length > 0 ? sizeCell : undefined;
        const parsed = sizeCell.length > 0 ? parseTyreSize(sizeCell) : null;

        // Load index and speed rating ride in the product title, e.g.
        // "Michelin Energy XM2+ 205/55R16 91V". Capture them so a mechanic does
        // not have to read prose to answer "will this fit, is it fast enough".
        const ratings = /\b(\d{2,3})([A-Z])\b/.exec(name);

        // Use the RESEARCHED reorder figures. The original hardcoded 2 and 4,
        // and the reorder point is the number that decides when the shop orders.
        const reorderPoint = readPeso(cell("reorderpoint")) ?? 2;
        const reorderQty = readPeso(cell("reorderqty")) ?? 4;

        // `null` and `-` both mean "no shelf life", which is not the same as zero.
        const shelfRaw = cell("shelflivedays");
        const shelfLifeDays = /^(null|-|—|n\/a|)$/i.test(shelfRaw) ? undefined : (readPeso(shelfRaw) ?? undefined);

        // Provenance travels with the row. The researched anchor is the only thing
        // that makes an estimated peso defensible, so it is kept rather than
        // discarded along with the rest of the research document.
        const anchor = cell("anchor");
        const note = cell("notes");

        rows.push({
          sku,
          name,
          kind,
          unit,
          brand: cell("brand") || undefined,
          size,
          aspectRatio: parsed?.aspectRatio,
          rimSizeIn: parsed?.rimSizeIn,
          loadIndex: ratings?.[1],
          speedRating: ratings?.[2],
          // A dotCode is deliberately NEVER seeded. One value per product cannot
          // describe a shelf holding many DOT lots, and a wrong one is a safety
          // claim about how old a tyre is. Lots carry it on RECEIVE instead.
          costPrice,
          sellPrice,
          reorderPoint,
          reorderQty,
          shelfLifeDays,
          notes: [
            note.length > 0 ? note : null,
            anchor.length > 0 ? "anchor: " + anchor : null,
            UNCONFIRMED_MARKER,
          ]
            .filter((x): x is string => x !== null)
            .join(" — "),
        });
      }
    }

    if (columns === null) {
      skipped.push({
        line: 0,
        reason: "no catalogue table found: expected a header row beginning | sku |",
      });
    }

    return { rows, skipped };
  }

  function upperAs<T extends string>(value: string | undefined): T | null {
    const raw = (value ?? "").trim().toUpperCase();
    return raw.length > 0 ? (raw as T) : null;
  }

  /** Strips ₱, thousands separators and any trailing decoration. */
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
  /**
   * BOM lines that named a service or product which does not exist.
   *
   * Reported rather than swallowed: an earlier version skipped them and
   * returned 0, which is a total failure that looks like a successful run.
   * An empty array means every line resolved.
   */
  requirementsUnresolved: Array<{ serviceSlug: string; productSku: string; missing: string }>;
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
    let requirementsUnresolved: Array<{ serviceSlug: string; productSku: string; missing: string }> = [];
    if (options.withRequirements === true) {
      const applied = await applyRequirements();
      requirementsCreated = applied.created;
      requirementsUnresolved = applied.unresolved;
    }

    const result: SeedResult = {
      suppliersCreated: supplierIds.size,
      productsCreated,
      productsSkipped,
      requirementsCreated,
      requirementsUnresolved,
    };
  logger.info("inventory.seeded", { scope: "inventory", ...result });
  return result;
}

/**
 * Applies `SEED_REQUIREMENTS` by service **slug** and product **sku**, so it is
 * safe to re-run: both relations are upserted on their unique keys.
 *
 * REPORTS UNRESOLVED LINES INSTEAD OF SKIPPING THEM.
 *
 * This used to `continue` on a missing service or product and return only a
 * count. Every line of the previous BOM named a placeholder SKU that no longer
 * existed, so every line was skipped, the function returned `0`, and the seed
 * printed `requirementsCreated: 0` — a total, successful-looking failure.
 *
 * The bill of materials is the thing that makes this a shop system rather than a
 * spreadsheet, so its absence has to be loud.
 */
export async function applyRequirements(): Promise<{
  created: number;
  unresolved: Array<{ serviceSlug: string; productSku: string; missing: string }>;
}> {
  let created = 0;
  const unresolved: Array<{ serviceSlug: string; productSku: string; missing: string }> = [];

  for (const requirement of SEED_REQUIREMENTS) {
    const [service, product] = await Promise.all([
      prisma.service.findUnique({ where: { slug: requirement.serviceSlug }, select: { id: true } }),
      prisma.product.findUnique({ where: { sku: requirement.productSku.toUpperCase() }, select: { id: true } }),
    ]);

    if (!service || !product) {
      unresolved.push({
        serviceSlug: requirement.serviceSlug,
        productSku: requirement.productSku,
        missing: [
          service ? null : `service "${requirement.serviceSlug}"`,
          product ? null : `product "${requirement.productSku}"`,
        ]
          .filter((x): x is string => x !== null)
          .join(" and "),
      });
      continue;
    }

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

  if (unresolved.length > 0) {
    logger.error("inventory.bom_unresolved", {
      scope: "inventory",
      count: unresolved.length,
      // One entry per unresolved line, so a grep finds exactly which
      // service/product pairing failed to resolve.
      unresolved: unresolved.map((u) => `${u.serviceSlug} -> ${u.productSku} (missing ${u.missing})`),
    });
  }

  return { created, unresolved };
}
