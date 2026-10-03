/**
 * INVENTORY API CONTRACT
 * ============================================================================
 * The orchestrator owns this file. Every inventory agent implements or consumes
 * these shapes exactly. If you need a field that is not here, do not add it —
 * report the request in your final message.
 *
 * THE INVARIANT
 * -------------
 * `available = onHand - reserved` and it is NEVER negative. Every endpoint that
 * could break that must refuse rather than clamp. Clamping is how you get a
 * silent discrepancy that nobody can explain six weeks later.
 * ============================================================================
 */

// ── Domain types ───────────────────────────────────────────────────────────

export const PRODUCT_KINDS = [
  "TYRE",
  "OIL",
  "FILTER",
  "BRAKE",
  "SUSPENSION",
  "BATTERY",
  "WIPER",
  "ELECTRICAL",
  "CONSUMABLE",
  "TYRE_ACCESSORY",
  "TOOL",
  "OTHER",
] as const;
export type ProductKindValue = (typeof PRODUCT_KINDS)[number];

export const UNITS = ["EA", "PAIR", "SET", "LITRE", "KG", "M"] as const;
export type UnitValue = (typeof UNITS)[number];

export const MOVEMENT_KINDS = [
  "OPENING",
  "RECEIVE",
  "CONSUME",
  "RESERVE",
  "RELEASE",
  "ADJUST_UP",
  "ADJUST_DOWN",
  "SHRINK",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "RETURN_TO_SUPPLIER",
] as const;
export type MovementKindValue = (typeof MOVEMENT_KINDS)[number];

export const RESERVATION_STATUSES = ["HELD", "CONSUMED", "RELEASED", "EXPIRED"] as const;
export type ReservationStatusValue = (typeof RESERVATION_STATUSES)[number];

export const STOCK_COUNT_STATUSES = ["DRAFT", "COUNTING", "REVIEW", "POSTED", "CANCELLED"] as const;
export type StockCountStatusValue = (typeof STOCK_COUNT_STATUSES)[number];

// ── Read models ────────────────────────────────────────────────────────────

export interface StockLevelDto {
  /** Physically in the shop. */
  onHand: number;
  /** Physically present but promised to a booking. */
  reserved: number;
  /** onHand - reserved. THE number a promise is made against. Never negative. */
  available: number;
  /** available <= reorderPoint. Drives the reorder list and the dashboard badge. */
  isLow: boolean;
  /** Below zero *should* never be true; surfaced loudly if it ever is. */
  isOversold: boolean;
}

export interface ProductDto {
  id: string;
  sku: string;
  name: string;
  kind: ProductKindValue;
  unit: UnitValue;
  brand: string | null;
  supplierId: string | null;
  supplierName?: string | null;
  barcode: string | null;

  size: string | null;
  aspectRatio: number | null;
  rimSizeIn: number | null;
  loadIndex: string | null;
  speedRating: string | null;
  pattern: string | null;
  dotCode: string | null;

  /** PHP. Server-side only — never send `costPrice` to a public surface. */
  sellPrice: number;
  reorderPoint: number;
  reorderQty: number;
  shelfLifeDays: number | null;

  /**
   * When this SKU was LAST received, derived from the ledger's most recent
   * RECEIVE or TRANSFER_IN.
   *
   * DISPLAY ONLY. This is NOT the shelf-life basis and must never be used as one.
   * A shelf holds many lots — 20 tyres from March, 10 from August — and this
   * single figure is only ever true of the newest of them, so anything derived
   * from it (age, expiry) is wrong for the older stock, which is precisely the
   * stock a clearance targets. The honest date is `StockLot.receivedAt`, per lot.
   *
   * Useful for one question only: "when did we last get this?"
   */
  lastReceivedAt?: string | null;
  cycleCountDays: number;
  isActive: boolean;
  /**
   * Internal notes. Staff-only, and stripped by the serializer exactly like
   * `costPrice` — a `String?` a staff member typed is the easiest place for a
   * supplier name, a negotiated price, or a customer's plate to end up.
   */
  notes: string | null;

  stock: StockLevelDto;
  /** Set when the operator is allowed to see margin (staff only). */
  costPrice?: number;
  marginPct?: number | null;

  createdAt: string;
  updatedAt: string;
}

export interface MovementDto {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  kind: MovementKindValue;
  qty: number;
  onHandAfter: number;
  reason: string | null;
  reference: string | null;
  bookingId: string | null;
  bookingReference?: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface ReservationDto {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  /** Null for a walk-in hold. */
  bookingId: string | null;
  bookingReference?: string | null;
  /** Who a walk-in hold is for. Null when the hold is against a booking. */
  heldFor?: string | null;
  qty: number;
  status: ReservationStatusValue;
  expiresAt: string;
  releasedAt: string | null;
  releasedReason: string | null;
  createdAt: string;
}

// ── Mutations ──────────────────────────────────────────────────────────────

export interface CreateProductInput {
  sku: string;
  name: string;
  kind: ProductKindValue;
  unit: UnitValue;
  brand?: string;
  supplierId?: string;
  barcode?: string;
  size?: string;
  aspectRatio?: number;
  rimSizeIn?: number;
  loadIndex?: string;
  speedRating?: string;
  pattern?: string;
  dotCode?: string;
  costPrice?: number;
  sellPrice?: number;
  reorderPoint?: number;
  reorderQty?: number;
  shelfLifeDays?: number;
  cycleCountDays?: number;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string;
}

/**
 * The single write path for every stock change. One endpoint, one ledger entry,
 * one reason — so "why is the number wrong" always has an answer.
 *
 * `kind` decides the sign convention:
 *   RECEIVE / ADJUST_UP / TRANSFER_IN  -> adds to onHand
 *   CONSUME / ADJUST_DOWN / SHRINK / TRANSFER_OUT / RETURN_TO_SUPPLIER -> removes
 *   OPENING -> sets the baseline (fails if the product already has stock)
 *
 * `REJECT` is returned when the move would push `available` below zero.
 */
export interface PostMovementInput {
  productId: string;
  kind: MovementKindValue;
  qty: number;
  /** REQUIRED for anything a human initiated. "Because" is not a reason. */
  reason: string;
  /** Supplier invoice, PO number, ticket number — anything to reconcile against. */
  reference?: string;
  bookingId?: string;
  /**
   * De-duplicates a retried submit. Two taps on "consume" must not double-spend.
   * The server returns the ORIGINAL result for a repeat rather than erroring.
   */
  idempotencyKey?: string;
}

/** A move that the server refused. Never silently clamped. */
export type MovementRefusalReason =
  | "INSUFFICIENT_STOCK"
  | "NEGATIVE_QUANTITY"
  | "ZERO_QUANTITY"
  | "PRODUCT_INACTIVE"
  | "OPENING_ALREADY_SET"
  | "INSUFFICIENT_AVAILABLE"; // for RESERVE

export interface PostMovementResult {
  movement: MovementDto;
  stock: StockLevelDto;
  /** True when the request was a replay of an idempotencyKey. */
  replayed: boolean;
}

export interface PostMovementRejection {
  ok: false;
  reason: MovementRefusalReason;
  /** What was actually available, so the UI can say "3 left" not "failed". */
  available: number;
  requested: number;
  message: string;
}

// ── Reservations ───────────────────────────────────────────────────────────

export interface ReserveInput {
  /**
   * The booking to hold against, or OMIT it for a walk-in.
   *
   * A tyre shop constantly needs to set a part aside for someone who has not
   * booked — "hold two 205/55R16, this customer is back at four". Forcing every
   * hold onto a booking pushes the mechanic back onto paper, which is the thing
   * this system exists to replace. A walk-in hold has the same TTL and is
   * released by the same sweep.
   *
   * When omitted, `heldFor` is REQUIRED.
   */
  bookingId?: string;
  /** Who the walk-in hold is for. A name, a plate, anything recognisable. */
  heldFor?: string;
  /** Explicit product list. Mutually exclusive with `fromServices`. */
  items?: Array<{ productId: string; qty: number }>;
  /**
   * Derive the parts from the booking's services via `ServicePartRequirement`
   * and reserve them all. This is how the booking flow promises stock without
   * the counter having to know what a PMS physically consumes.
   */
  fromServices?: boolean;
  /** Default 24h. A hold that never expires becomes a permanent leak. */
  ttlMinutes?: number;
}

export interface ReserveResult {
  /** Null for a walk-in hold. See `ReserveInput.bookingId`. */
  bookingId: string | null;
  /** Who a walk-in hold is for. Null when the hold is against a booking. */
  heldFor?: string | null;
  reservations: ReservationDto[];
  /** Products that could not be fully covered. */
  shortfalls: Array<{ productId: string; name: string; requested: number; available: number }>;
  /** True when a blocking part is short — the booking must not be promised. */
  blocked: boolean;
  expiresAt: string;
  /**
   * When the shortfall is expected to resolve, from a real PurchaseOrder.
   * `null` when nothing is on order or no ETA is known.
   *
   * WHY THIS IS IN THE CONTRACT: without it the strongest honest line a tyre
   * shop can say to a customer with a blocked booking — "we can do this on the
   * {date}" — is unshippable, because every ETA would be invented. An invented
   * ETA is worse than no ETA. Only ever populate this from a real PO line.
   */
  expectedAt?: string | null;
}

export interface ReleaseReservationsInput {
  bookingId: string;
  reason: string;
  /** Release only HELD rows. Consumed ones are already gone from the shelf. */
  statuses?: ReservationStatusValue[];
}

// ── Availability (the promise the booking flow makes) ──────────────────────

export interface AvailabilityQuery {
  serviceIds: string[];
}

export interface PartAvailabilityDto {
  productId: string;
  sku: string;
  name: string;
  size: string | null;
  kind: ProductKindValue;
  unit: UnitValue;
  qtyPerService: number;
  qtyNeeded: number;
  available: number;
  isBlocking: boolean;
  /** available < qtyNeeded. */
  isShort: boolean;
  sellPrice: number;
}

export interface ServiceAvailabilityDto {
  serviceId: string;
  serviceSlug: string;
  name: string;
  /** Every part is covered. Only a true value may be promised to a customer. */
  canFulfil: boolean;
  parts: PartAvailabilityDto[];
  /** Shortfalls on blocking parts only. */
  blockers: Array<{ productId: string; name: string; short: number }>;
}

// ── Cycle count ────────────────────────────────────────────────────────────

export interface CreateCountInput {
  /** "all" | a ProductKind | a single productId. */
  scope?: string;
  note?: string;
}

export interface CountLineDto {
  id: string;
  productId: string;
  sku: string;
  name: string;
  unit: UnitValue;
  /** System belief, snapshotted at creation. */
  expected: number;
  counted: number | null;
  /** counted - expected. Null until counted. */
  variance: number | null;
  /** Variance worth a human's attention, in units or percent. */
  isSignificant: boolean;
  note: string | null;
  countedAt: string | null;
  /**
   * Unit cost, staff-only, snapshotted with the line.
   *
   * Without it the count review cannot put a peso value on a variance and has
   * to re-read every counted product individually — a fan-out of up to 25
   * requests on one screen. `varianceValue` is then derived, not re-fetched.
   */
  costPrice?: number;
  /** `(counted - expected) * costPrice`. Signed. Null until counted. */
  varianceValue?: number | null;
}

export interface StockCountDto {
  id: string;
  reference: string;
  status: StockCountStatusValue;
  scope: string;
  note: string | null;
  createdAt: string;
  postedAt: string | null;
  lines: CountLineDto[];
  summary: {
    total: number;
    counted: number;
    outstanding: number;
    variances: number;
    /** Net unit variance across the whole count. */
    netVariance: number;
    /**
     * Absolute peso value of the variances at cost. STAFF-ONLY and OPTIONAL,
     * because it is a cost figure: it is attached only on a staff read. Making
     * it required would force a fabricated 0 onto a customer-facing payload,
     * which is worse than omitting it entirely.
     */
    varianceValue?: number;
  };
}

export interface RecordCountInput {
  countId: string;
  productId: string;
  counted: number;
  note?: string;
}

// ── Reporting ──────────────────────────────────────────────────────────────

export interface ReorderRowDto {
  productId: string;
  sku: string;
  name: string;
  size: string | null;
  kind: ProductKindValue;
  unit: UnitValue;
  available: number;
  reorderPoint: number;
  reorderQty: number;
  suggestedQty: number;
  supplierId: string | null;
  supplierName: string | null;
  costPrice?: number;
  estimatedCost?: number;
  /**
   * True when this line needs ordering now: `available <= reorderPoint`,
   * including at zero.
   *
   * One meaning only. An earlier draft gave the false branch a second,
   * different meaning — a state the invariant makes unreachable, since
   * `available` is never negative. A boolean that means one thing when true and
   * another when false is a boolean the reorder list will get wrong.
   */
  isStockout: boolean;
}

export interface ValuationDto {
  products: number;
  totalUnits: number;
  /** At cost. Staff-only. */
  costValue?: number;
  /** At sell price. */
  retailValue: number;
  byKind: Array<{ kind: ProductKindValue; products: number; units: number; retailValue: number }>;
}

export interface MovementQuery {
  productId?: string;
  bookingId?: string;
  kind?: MovementKindValue;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Availability a single product can still be promised for — the check the
 * booking wizard makes before it shows a slot.
 */
export interface ProductAvailabilityDto {
  productId: string;
  sku: string;
  name: string;
  available: number;
  /**
   * UNITS OF THIS PRODUCT THE SHOP MAY STILL PROMISE, after reservation.
   * Equals `available` today. It is separated from `available` because it is
   * what a customer-facing claim is checked against, so a claim can shrink
   * without the underlying stock number changing.
   *
   * NEVER compare this across different units — a tyre set is 5 EA, an oil
   * change is 4 LITRE. The question a UI must ask is "may I show a number at
   * all", not "is the number large".
   */
  canPromise: number;
  isLow: boolean;
  reorderPoint: number;
  /**
   * AGE ELAPSED, in days — not days remaining.
   *
   * Named clearly because the alternative reading is genuinely ambiguous and the
   * error is silent: a campaign that clears "aged" stock would fire on brand-new
   * stock instead. For a tyre this is derived from `dotCode` (`WWYY` = week +
   * year); for anything with `shelfLifeDays` it is days since receipt.
   * `null` when the product has neither a DOT code nor a shelf life.
   */
  ageDays?: number | null;
  /** True when a shelf-life product is within 30 days of expiry. */
  isNearExpiry?: boolean;
}