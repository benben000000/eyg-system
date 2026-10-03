/**
 * A7 · CI/CD & QA — deterministic fixtures for the inventory suite.
 * ============================================================================
 * RULES
 * -----
 *  • **Builders, never singletons.** Every fixture is produced by a function, so
 *    no two tests can share a mutable row. `tests/setup.ts` resets the ambient
 *    fakes; this file goes further and shares nothing at all.
 *  • **Fixed clock.** `PINNED_NOW` is Wednesday 2026-03-11 09:00 Manila
 *    (`+08:00`), matching the date the existing booking suite pins. Nothing
 *    here reads `Date.now()`.
 *  • **Real-shaped data.** A tyre shop in Balanga: oil filters by the piece,
 *    oil by the litre, a spare that makes a set of four, DOT-coded tyres that
 *    age. The unit is not decoration — it is the thing the arithmetic tests
 *    exist to protect.
 *  • **Cost data is present on purpose.** Every product carries a `costPrice`
 *    and a `marginPct`, so a leakage test that fails to fail proves the
 *    assertion is wired to a populated field rather than to an absent one.
 * ============================================================================
 */

import type {
  FakeBooking,
  FakeBookingItem,
  FakeDb,
  FakeProduct,
  FakeReservation,
  FakeService,
  FakeServicePartRequirement,
  FakeStockCountLine,
  FakeStockLevel,
  FakeSupplier,
} from "./fake-prisma";

/** Wednesday 2026-03-11, 09:00 in Manila. */
export const PINNED_NOW = new Date("2026-03-11T09:00:00+08:00");

/** One day later — used for TTL and ageing arithmetic. */
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const FIXTURES = {
  supplier: "sup_bridgestone_ph",
  tyre: "prd_tyre_205_55r16",
  oil: "prd_oil_fully_1l",
  oilFilter: "prd_oil_filter_honda",
  brakePads: "prd_brake_pad_axle_front",
  wiper: "prd_wiper_22",
  /** A SET of five — the spare. `unit: "SET"` is the whole point. */
  tyreSetOfFive: "prd_tyre_set_205_55r16",
  cleaner: "prd_brake_cleaner",
  /** Cheap, non-blocking consumable used for BOM blocking/non-blocking tests. */
  rag: "prd_rag_shop",
  servicePms: "svc_pms_honda",
  serviceBrakes: "svc_brake_front",
  serviceRotation: "svc_tyre_rotation",
  serviceNoBom: "svc_aircon_recharge",
  bookingA: "bkg_race_a",
  bookingB: "bkg_race_b",
} as const;

export const SUPPLIER: FakeSupplier = {
  id: FIXTURES.supplier,
  name: "Metro Tire Supply",
  contactName: null,
  phone: null,
  email: null,
  address: null,
  notes: null,
  isActive: true,
  createdAt: PINNED_NOW,
  updatedAt: PINNED_NOW,
};

export interface ProductSeed {
  onHand: number;
  reserved: number;
}

/**
 * Every fixture product carries `costPrice` and a derived `marginPct`, because
 * the leakage suite asserts on the *absence* of those keys. An absent cost
 * would make `expect(body).not.toContain("costPrice")` pass for the wrong
 * reason — a green that proves nothing.
 */
function baseProduct(
  id: string,
  sku: string,
  name: string,
  kind: string,
  unit: string,
  costPrice: number,
  sellPrice: number,
  extra: Partial<FakeProduct> = {},
): FakeProduct {
  const marginPct = sellPrice === 0 ? null : Math.round(((sellPrice - costPrice) / sellPrice) * 100);
  return {
    id,
    sku,
    name,
    kind,
    unit,
    brand: null,
    supplierId: SUPPLIER.id,
    barcode: null,
    size: null,
    aspectRatio: null,
    rimSizeIn: null,
    loadIndex: null,
    speedRating: null,
    pattern: null,
    dotCode: null,
    costPrice,
    sellPrice,
    marginPct,
    reorderPoint: 4,
    reorderQty: 12,
    shelfLifeDays: null,
    cycleCountDays: 30,
    isActive: true,
    notes: null,
    createdAt: PINNED_NOW,
    updatedAt: PINNED_NOW,
    ...extra,
  };
}

export const PRODUCTS: readonly FakeProduct[] = [
  baseProduct(
    FIXTURES.tyre,
    "TYR-205-55R16-BF-G2",
    "Bridgestone Ecopia EP150 205/55R16",
    "TYRE",
    "EA",
    3_800,
    5_200,
    {
      brand: "BFGoodrich",
      size: "205/55R16",
      aspectRatio: 55,
      rimSizeIn: 16,
      loadIndex: "95",
      speedRating: "V",
      pattern: "Ecopia EP150",
      // Week 6 of 2024 — two-year-old stock, which is what a clearance list is for.
      dotCode: "0624",
      reorderPoint: 4,
      reorderQty: 8,
      cycleCountDays: 60,
    },
  ),
  baseProduct(
    FIXTURES.tyreSetOfFive,
    "TYR-SET5-205-55R16-BF-G2",
    "205/55R16 Ecopia EP150 — set of 5 (with spare)",
    "TYRE",
    "SET",
    18_500,
    25_500,
    {
      brand: "BFGoodrich",
      size: "205/55R16",
      aspectRatio: 55,
      rimSizeIn: 16,
      loadIndex: "95",
      speedRating: "V",
      pattern: "Ecopia EP150",
      dotCode: "0624",
      reorderPoint: 2,
      reorderQty: 4,
    },
  ),
  baseProduct(
    FIXTURES.oil,
    "OIL-fully-1l",
    "Fully Synthetic 5W-40 — 1 litre",
    "OIL",
    "LITRE",
    420,
    620,
    { brand: "Motul", shelfLifeDays: 730, reorderPoint: 8, reorderQty: 24 },
  ),
  baseProduct(
    FIXTURES.oilFilter,
    "FLT-oil-honda-fit",
    "Oil filter — Honda Fit / City",
    "FILTER",
    "EA",
    280,
    450,
    { brand: "Denso", reorderPoint: 6, reorderQty: 24 },
  ),
  baseProduct(
    FIXTURES.brakePads,
    "BRK-pad-axle-front-civic",
    "Brake pads — front axle set (Honda Civic)",
    "BRAKE",
    "PAIR",
    2_400,
    3_400,
    { brand: "Brembo", reorderPoint: 3, reorderQty: 6 },
  ),
  baseProduct(
    FIXTURES.wiper,
    "WIP-22-hybrid",
    "Wiper blade 22\" hybrid",
    "WIPER",
    "EA",
    310,
    520,
    { size: "22\"", reorderPoint: 4, reorderQty: 12 },
  ),
  baseProduct(
    FIXTURES.cleaner,
    "CON-brake-cleaner-500ml",
    "Brake cleaner aerosol 500ml",
    "CONSUMABLE",
    "EA",
    180,
    300,
    { shelfLifeDays: 1_095, reorderPoint: 5, reorderQty: 12 },
  ),
  baseProduct(
    FIXTURES.rag,
    "CON-shop-rag",
    "Shop rag",
    "CONSUMABLE",
    "EA",
    15,
    25,
    { reorderPoint: 10, reorderQty: 50, cycleCountDays: 90 },
  ),
];

export function productById(id: string): FakeProduct {
  const found = PRODUCTS.find((product) => product.id === id);
  if (!found) throw new Error(`fixture product ${id} does not exist`);
  return { ...found };
}

function levelFor(productId: string, seed: ProductSeed): FakeStockLevel {
  return {
    id: `lvl_${productId}`,
    productId,
    onHand: seed.onHand,
    reserved: seed.reserved,
    updatedAt: PINNED_NOW,
  };
}

/**
 * Loads the catalogue and the given stock seeds into a fresh database.
 * Returns the product ids in load order so a test can iterate deterministically.
 */
export function seedCatalogue(db: FakeDb, seeds: Record<string, ProductSeed> = {}): string[] {
  db.insert("supplier", SUPPLIER);
  for (const product of PRODUCTS) {
    db.insert("product", product);
    const seed = seeds[product.id];
    if (seed) db.insert("stockLevel", levelFor(product.id, seed));
  }
  return PRODUCTS.map((product) => product.id);
}

/** A single product with a single stock level — the smallest useful world. */
export function seedOne(
  db: FakeDb,
  productId: string,
  seed: ProductSeed,
  overrides: Partial<FakeProduct> = {},
): FakeProduct {
  db.insert("supplier", SUPPLIER);
  const product = { ...productById(productId), ...overrides };
  db.insert("product", product);
  db.insert("stockLevel", levelFor(productId, seed));
  return product;
}

// ── Services and the bill of materials ──────────────────────────────────────

export interface BomLine {
  productId: string;
  qtyPerService: number;
  isBlocking: boolean;
}

export function seedService(db: FakeDb, service: Partial<FakeService> & Pick<FakeService, "id" | "slug" | "name">): FakeService {
  const row: FakeService = {
    isActive: true,
    ...service,
  };
  db.insert("service", row);
  return row;
}

export function seedBom(db: FakeDb, serviceId: string, lines: readonly BomLine[]): FakeServicePartRequirement[] {
  return lines.map((line, index) => {
    const row: FakeServicePartRequirement = {
      id: `spr_${serviceId}_${index}`,
      serviceId,
      productId: line.productId,
      qtyPerService: line.qtyPerService,
      isBlocking: line.isBlocking,
    };
    db.insert("servicePartRequirement", row);
    return row;
  });
}

/** A PMS: one oil filter (blocking) and one litre of oil (non-blocking). */
export function seedPmsService(db: FakeDb): void {
  seedService(db, {
    id: FIXTURES.servicePms,
    slug: "pms-honda",
    name: "PMS — Honda (oil + filter)",
  });
  seedBom(db, FIXTURES.servicePms, [
    { productId: FIXTURES.oilFilter, qtyPerService: 1, isBlocking: true },
    { productId: FIXTURES.oil, qtyPerService: 1, isBlocking: false },
  ]);
}

/** A brake job: pads are safety-critical, so the shortage MUST block. */
export function seedBrakeService(db: FakeDb): void {
  seedService(db, {
    id: FIXTURES.serviceBrakes,
    slug: "brake-front-axle",
    name: "Brake pads — front axle",
  });
  seedBom(db, FIXTURES.serviceBrakes, [
    { productId: FIXTURES.brakePads, qtyPerService: 1, isBlocking: true },
  ]);
}

// ── Bookings ────────────────────────────────────────────────────────────────

export function seedBooking(
  db: FakeDb,
  id: string,
  overrides: Partial<FakeBooking> = {},
): FakeBooking {
  const row: FakeBooking = {
    id,
    reference: id.replace(/^bkg_/, "EYG-").toUpperCase(),
    status: "CONFIRMED",
    customerName: "Walk-in",
    startAt: PINNED_NOW,
    ...overrides,
  };
  db.insert("booking", row);
  return row;
}

export function seedBookingItem(db: FakeDb, bookingId: string, serviceId: string, qty = 1): FakeBookingItem {
  const row: FakeBookingItem = {
    id: `bgi_${bookingId}_${serviceId}`,
    bookingId,
    serviceId,
    qty,
  };
  db.insert("bookingItem", row);
  return row;
}

export function seedReservation(
  db: FakeDb,
  overrides: Partial<FakeReservation> & Pick<FakeReservation, "id" | "productId" | "bookingId" | "qty">,
): FakeReservation {
  const row: FakeReservation = {
    status: "HELD",
    expiresAt: new Date(PINNED_NOW.getTime() + 24 * 60 * 60 * 1000),
    releasedAt: null,
    releasedReason: null,
    createdAt: PINNED_NOW,
    updatedAt: PINNED_NOW,
    ...overrides,
  };
  db.insert("reservation", row);
  return row;
}

export function seedCountLine(
  db: FakeDb,
  id: string,
  countId: string,
  productId: string,
  expected: number,
  counted: number | null = null,
): FakeStockCountLine {
  const row: FakeStockCountLine = {
    id,
    countId,
    productId,
    expected,
    counted,
    countedBy: counted === null ? null : "usr_manager",
    countedAt: counted === null ? null : PINNED_NOW,
    note: null,
  };
  db.insert("stockCountLine", row);
  return row;
}
