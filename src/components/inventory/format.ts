/**
 * INVENTORY UI — FORMAT, DECODE AND VALIDATE HELPERS
 * ============================================================================
 * A3 owns this file. Pure functions only: no React, no hooks, no fetch. That
 * means they are safe to import from a Server Component, a Client Component or
 * a test, and they are trivially reviewable — which matters, because two of the
 * rules in this project live here:
 *
 *   1. EVERY NUMBER CARRIES ITS UNIT. "4 EA", "1.4 L", "5 EA". A set of five
 *      tyres is not "5".
 *   2. NEVER INVENT AN AGE OR AN EXPIRY DATE. A DOT code is a production WEEK,
 *      not a day, so its age is a range and is presented as one. A shelf-life
 *      expiry needs a receipt date that the contract does not carry, so it is
 *      derived from `createdAt` and labelled as such rather than presented as
 *      fact.
 *
 * Nothing here reaches for a colour, a hex or a date library.
 * ============================================================================
 */

import {
  PRODUCT_KINDS,
  type MovementKindValue,
  type ProductDto,
  type ProductKindValue,
  type StockLevelDto,
  type UnitValue,
} from "@/lib/inventory-types";

// ── Numbers ──────────────────────────────────────────────────────────────────

const integerFormat = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });
/** Litres, kilograms and metres are decantable, so they keep up to 2 decimals. */
const decimalFormat = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return integerFormat.format(value);
}

/** Units that are sold by measure rather than by piece. */
const FRACTIONAL_UNITS: ReadonlySet<UnitValue> = new Set<UnitValue>(["LITRE", "KG", "M"]);

export function isFractionalUnit(unit: UnitValue): boolean {
  return FRACTIONAL_UNITS.has(unit);
}

/** `EA` → `EA`, `LITRE` → `L`. Spoken form goes to `unitSpoken`. */
const UNIT_SHORT: Record<UnitValue, string> = {
  EA: "EA",
  PAIR: "PAIR",
  SET: "SET",
  LITRE: "L",
  KG: "KG",
  M: "M",
};

const UNIT_SPOKEN: Record<UnitValue, string> = {
  EA: "each",
  PAIR: "pair",
  SET: "set",
  LITRE: "litre",
  KG: "kilogram",
  M: "metre",
};

export function unitShort(unit: UnitValue): string {
  return UNIT_SHORT[unit];
}

export function unitSpoken(unit: UnitValue): string {
  return UNIT_SPOKEN[unit];
}

function unitNumber(value: number, unit: UnitValue): string {
  const safe = Number.isFinite(value) ? value : 0;
  return isFractionalUnit(unit) ? decimalFormat.format(safe) : integerFormat.format(safe);
}

/**
 * The canonical way a quantity is written in this app: number, space, unit.
 * `qty(4, "EA") === "4 EA"`, `qty(1.4, "LITRE") === "1.4 L"`.
 */
export function qty(value: number, unit: UnitValue): string {
  return `${unitNumber(value, unit)} ${unitShort(unit)}`;
}

/** Signed, for the movement ledger. `StockMovement.qty` is signed by contract. */
export function signedQty(value: number, unit: UnitValue): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${unitNumber(value, unit)} ${unitShort(unit)}`;
}

/** Screen-reader form: "4 each", "1.4 litres". */
export function qtySpoken(value: number, unit: UnitValue): string {
  return `${unitNumber(value, unit)} ${unitSpoken(unit)}`;
}

/** "1 line" / "4 lines". Used for result counts so the badge is informative. */
export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const KIND_LABEL: Record<ProductKindValue, string> = {
  TYRE: "Tyre",
  OIL: "Oil",
  FILTER: "Filter",
  BRAKE: "Brake",
  SUSPENSION: "Suspension",
  BATTERY: "Battery",
  WIPER: "Wiper",
  ELECTRICAL: "Electrical",
  CONSUMABLE: "Consumable",
  TYRE_ACCESSORY: "Tyre accessory",
  TOOL: "Tool",
  OTHER: "Other",
};

export function kindLabel(kind: ProductKindValue): string {
  return KIND_LABEL[kind];
}

/** Every kind, in the contract's own order, for the filter select. */
export const KIND_OPTIONS: ReadonlyArray<{ value: ProductKindValue; label: string }> = PRODUCT_KINDS.map(
  (kind) => ({ value: kind, label: KIND_LABEL[kind] }),
);

const MOVEMENT_LABEL: Record<MovementKindValue, string> = {
  OPENING: "Opening balance",
  RECEIVE: "Received",
  CONSUME: "Consumed",
  RESERVE: "Reserved",
  RELEASE: "Released",
  ADJUST_UP: "Adjusted up",
  ADJUST_DOWN: "Adjusted down",
  SHRINK: "Shrunk",
  TRANSFER_IN: "Transferred in",
  TRANSFER_OUT: "Transferred out",
  RETURN_TO_SUPPLIER: "Returned to supplier",
};

export function movementLabel(kind: MovementKindValue): string {
  return MOVEMENT_LABEL[kind];
}

/**
 * Which ledger kinds add to `onHand`. Derived from the contract's sign
 * convention rather than duplicated per call site.
 */
export function movementAddsStock(kind: MovementKindValue): boolean {
  return kind === "RECEIVE" || kind === "ADJUST_UP" || kind === "TRANSFER_IN";
}

// ── Stock state ──────────────────────────────────────────────────────────────

/**
 * Ordered worst-first. `oversold` is checked before everything else and is
 * meant to be LOUD: the contract says `available` is never negative, so a true
 * `isOversold` is a server bug being surfaced rather than smoothed over.
 */
export type StockState = "oversold" | "out" | "low" | "ok";

export function stockState(stock: StockLevelDto, reorderPoint: number): StockState {
  if (stock.isOversold || stock.available < 0) return "oversold";
  if (stock.available <= 0) return "out";
  if (stock.isLow || stock.available <= reorderPoint) return "low";
  return "ok";
}

/** A word, never a colour alone. Paired with a shape in every list cell. */
export const STOCK_STATE_LABEL: Record<StockState, string> = {
  oversold: "Oversold",
  out: "None left",
  low: "Low",
  ok: "In stock",
};

/** One plain sentence a mechanic can act on. Never "failed". */
export function stockStateSentence(stock: StockLevelDto, reorderPoint: number, unit: UnitValue): string {
  switch (stockState(stock, reorderPoint)) {
    case "oversold":
      return `More is promised than the shelf holds — the ledger shows ${qty(
        stock.reserved,
        unit,
      )} reserved against ${qty(stock.onHand, unit)} on hand. Do not sell this until it is reconciled.`;
    case "out":
      return stock.reserved > 0
        ? `Nothing available. All ${qty(stock.reserved, unit)} on the shelf are promised to a booking.`
        : `Nothing available to sell. Receive stock or find a substitute before you promise this to a customer.`;
    case "low":
      return `${qty(stock.available, unit)} available — at or below the reorder point of ${qty(
        reorderPoint,
        unit,
      )}.`;
    default:
      return `${qty(stock.available, unit)} available to sell.`;
  }
}

// ── Money ────────────────────────────────────────────────────────────────────

export interface MoneyFacts {
  /** `null` when the server withheld the cost or the cost is recorded as 0. */
  cost: number | null;
  sell: number;
  /** `null` when it cannot be computed without a known cost. */
  marginPct: number | null;
  costKnown: boolean;
  /** `sell <= cost`. Selling at or below cost is the warning that matters. */
  atOrBelowCost: boolean;
  marginNote: string;
}

/**
 * The schema documents `costPrice: 0 = unknown`, so 0 is NOT free stock. Treating
 * it as a real cost produces a 100% margin and a lie on the owner's screen.
 */
export function moneyFacts(product: ProductDto): MoneyFacts {
  const rawCost = typeof product.costPrice === "number" ? product.costPrice : null;
  const cost = rawCost !== null && rawCost > 0 ? rawCost : null;
  const sell = product.sellPrice;

  if (cost === null) {
    return {
      cost: null,
      sell,
      marginPct: null,
      costKnown: false,
      atOrBelowCost: false,
      marginNote: "Cost is not on file for this item, so margin cannot be shown. Enter the cost before quoting it.",
    };
  }

  const computed =
    typeof product.marginPct === "number" ? product.marginPct : sell > 0 ? ((sell - cost) / sell) * 100 : 0;
  const atOrBelowCost = sell <= cost;

  return {
    cost,
    sell,
    marginPct: computed,
    costKnown: true,
    atOrBelowCost,
    marginNote: atOrBelowCost
      ? `Selling price is at or below cost — every sale of this item loses money.`
      : "",
  };
}

// ── Dates ────────────────────────────────────────────────────────────────────

const dateFormat = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  timeZone: "Asia/Manila",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Manila",
});

const isoDateFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

export function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return dateFormat.format(new Date(ms));
}

export function formatDateTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return dateTimeFormat.format(new Date(ms));
}

/** `YYYY-MM-DD` in UTC — the value an `<input type="date">` expects. */
export function toDateInputValue(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return isoDateFormat.format(new Date(ms));
}

const DAY_MS = 86_400_000;

/** Whole days between two instants, positive when `to` is after `from`. */
export function wholeDaysBetween(fromMs: number, toMs: number): number {
  return Math.floor((toMs - fromMs) / DAY_MS);
}

/** "3 days left", "due today", "expired 12 days ago". */
export function daysRemainingLabel(daysRemaining: number): string {
  if (daysRemaining < 0) return `expired ${formatCount(Math.abs(daysRemaining))} ${plural(Math.abs(daysRemaining), "day", "days")} ago`;
  if (daysRemaining === 0) return "due today";
  return `${formatCount(daysRemaining)} ${plural(daysRemaining, "day", "days")} left`;
}

// ── DOT codes ────────────────────────────────────────────────────────────────

const WEEK_MS = 604_800_000;
const WEEKS_PER_YEAR = 52.1775;

export interface DotDecodedOk {
  ok: true;
  raw: string;
  week: number;
  year: number;
  /** ISO `YYYY-MM-DD` — Monday of the production week. The EARLIEST it can be. */
  earliest: string;
  /** ISO `YYYY-MM-DD` — Sunday of the production week. The LATEST it can be. */
  latest: string;
  weeksOldMin: number;
  weeksOldMax: number;
  ageLabel: string;
}

export interface DotDecodedBad {
  ok: false;
  raw: string;
  reason: string;
}

export type DotDecoded = DotDecodedOk | DotDecodedBad;

/**
 * Monday of ISO week 1 of `year`, in UTC.
 *
 * ISO-8601 defines week 1 as the week containing 4 January, so the Monday of
 * week 1 is always 31 Dec − 6 days .. 4 Jan. Computing it this way avoids a
 * date library and, more importantly, avoids the local-timezone bug where a
 * production week silently shifts by a day depending on where the server runs.
 */
function isoWeekMondayUtc(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const week1MondayMs = jan4.getTime() - (jan4Day - 1) * DAY_MS;
  return new Date(week1MondayMs + (week - 1) * 7 * DAY_MS);
}

function pivotTwoDigitYear(yy: number): number {
  // DOT codes only appear on tyres made this century. A 2-digit year below 70 is
  // 20xx; 70 and above would be 19xx, which is a typo rather than a real tyre.
  return yy >= 70 ? 1900 + yy : 2000 + yy;
}

function yearsLabel(minWeeks: number, maxWeeks: number): string {
  const yMin = minWeeks / WEEKS_PER_YEAR;
  const yMax = maxWeeks / WEEKS_PER_YEAR;
  const fmt = (n: number) => (n < 10 ? n.toFixed(1) : Math.round(n).toString());
  const a = fmt(yMin);
  const b = fmt(yMax);
  return a === b ? `${a} years old` : `${a}–${b} years old`;
}

/**
 * Decodes a DOT code into a PRODUCTION WEEK, then into an age RANGE.
 *
 * A DOT code is `WWYY` (or `WWYYYY`): the week of the year and the year. It is
 * NOT a date. The tyre was made somewhere inside that seven-day window, so this
 * returns an age range and never a single day — a single day would be a
 * fabricated precision, and fabricated precision on a shelf label is how a shop
 * ends up selling a tyre it has misrepresented.
 *
 * Deliberately NOT returned: any "safe until" or legal-limit claim. Those vary
 * by manufacturer and by market and the contract carries no field for them.
 */
export function decodeDotCode(raw: string, nowMs: number = Date.now()): DotDecoded {
  const trimmed = raw.trim();
  const short = /^(\d{2})(\d{2})$/.exec(trimmed);
  const long = /^(\d{2})(\d{4})$/.exec(trimmed);

  const week = short ? Number.parseInt(short[1] as string, 10) : long ? Number.parseInt(long[1] as string, 10) : Number.NaN;
  const year = short
    ? pivotTwoDigitYear(Number.parseInt(short[2] as string, 10))
    : long
      ? Number.parseInt(long[2] as string, 10)
      : Number.NaN;

  if (!Number.isInteger(week) || week < 1 || week > 53) {
    return { ok: false, raw: trimmed, reason: "Not a usable DOT code — four digits, week first: 1824 is week 18 of 2024." };
  }
  if (!Number.isInteger(year) || year < 1970 || year > 2100) {
    return { ok: false, raw: trimmed, reason: "Not a usable DOT code — the year is not readable." };
  }

  const monday = isoWeekMondayUtc(year, week);
  if (Number.isNaN(monday.getTime())) {
    return { ok: false, raw: trimmed, reason: "Not a usable DOT code — that week does not exist in that year." };
  }
  const sundayMs = monday.getTime() + 6 * DAY_MS;

  const weeksOldMax = Math.max(0, Math.floor((nowMs - monday.getTime()) / WEEK_MS));
  const weeksOldMin = Math.max(0, Math.floor((nowMs - sundayMs) / WEEK_MS));

  const ageLabel =
    weeksOldMax < 1
      ? "made this week"
      : weeksOldMax < WEEKS_PER_YEAR
        ? `about ${formatCount(weeksOldMin)}–${formatCount(weeksOldMax)} weeks old`
        : `about ${yearsLabel(weeksOldMin, weeksOldMax)}`;

  return {
    ok: true,
    raw: trimmed,
    week,
    year,
    earliest: isoDateFormat.format(new Date(monday.getTime())),
    latest: isoDateFormat.format(new Date(sundayMs)),
    weeksOldMin,
    weeksOldMax,
    ageLabel,
  };
}

/** "Week 18 of 2024" — rendered from a `WWYY` code, week read first. */
export function dotWeekLabel(decoded: DotDecodedOk): string {
  return `week ${decoded.week} of ${decoded.year}`;
}

/**
 * Shelf-life expiry.
 *
 * `ProductDto` has `shelfLifeDays` but NO receipt date — `createdAt` is when the
 * product was added to the catalogue, which is not the same thing. Rather than
 * pretend otherwise, the basis is returned alongside the number and the UI says
 * which one it is. See the report: `ProductDto` should carry `receivedAt`.
 */
export interface ShelfLifeFacts {
  shelfLifeDays: number;
  expiresOn: string;
  daysRemaining: number;
  expired: boolean;
  nearExpiry: boolean;
  basisNote: string;
}

export const SHELF_LIFE_BASIS_NOTE =
  "Counted from the date this product was added to the catalogue, not from the date it landed on the shelf. A stock count does not change it.";

export function shelfLifeFacts(product: ProductDto, nowMs: number = Date.now()): ShelfLifeFacts | null {
  if (product.shelfLifeDays === null || product.shelfLifeDays === undefined) return null;
  const createdMs = Date.parse(product.createdAt);
  if (Number.isNaN(createdMs)) return null;

  const expiresMs = createdMs + product.shelfLifeDays * DAY_MS;
  const daysRemaining = wholeDaysBetween(nowMs, expiresMs);

  return {
    shelfLifeDays: product.shelfLifeDays,
    expiresOn: isoDateFormat.format(new Date(expiresMs)),
    daysRemaining,
    expired: daysRemaining < 0,
    nearExpiry: daysRemaining <= 30,
    basisNote: SHELF_LIFE_BASIS_NOTE,
  };
}

// ── Count variance ───────────────────────────────────────────────────────────

/**
 * The UI's own significant-variance rule: more than one unit, or more than
 * 10% of the expected figure. The server's `CountLineDto.isSignificant` always
 * wins — this is what the operator sees BEFORE the line is saved, so a big
 * discrepancy is flagged while the number is still being keyed rather than
 * after.
 */
export function varianceIsSignificant(variance: number, expected: number): boolean {
  if (variance === 0) return false;
  const magnitude = Math.abs(variance);
  if (magnitude > 1) return true;
  if (expected === 0) return true;
  return magnitude / Math.abs(expected) > 0.1;
}

export function varianceLabel(variance: number, unit: UnitValue): string {
  if (variance === 0) return `no difference (${qty(0, unit)})`;
  const sign = variance > 0 ? "+" : "";
  return `${sign}${unitNumber(variance, unit)} ${unitShort(unit)}`;
}

// ── Quantity input validation ────────────────────────────────────────────────

export interface QtyCheck {
  ok: boolean;
  /** Parsed value, or `null` when unusable. */
  value: number | null;
  /** Operator-facing reason. Never "invalid". */
  message: string;
}

export const QTY_ZERO_MESSAGE = "Enter how many. A movement of zero is not a movement.";
export const QTY_NOT_A_NUMBER_MESSAGE =
  "Type digits only — a quantity is a count, not a calculation. Use the Adjust action if the number itself is wrong.";
export const QTY_TOO_SMALL_MESSAGE = "Round this unit up to a whole item before saving.";
export const QTY_TOO_LARGE_MESSAGE = "That is more than this shop could plausibly hold. Check the digits.";

/**
 * Characters that may appear in a quantity field. A leading `-` is NOT in the
 * set, so the UI can refuse it at the keystroke rather than accepting a
 * negative and then complaining about it on submit. The invariant is
 * `available = onHand - reserved`, never negative; a quantity field that will
 * take `-3` is the first step towards breaking it.
 *
 * One optional decimal point and digits only — `1.4` yes, `1.2.3` no.
 */
export const QTY_ALLOWED_PATTERN = /^(?:\d+)?(?:\.\d+)?$/;

export function checkQty(raw: string, unit: UnitValue): QtyCheck {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, value: null, message: QTY_ZERO_MESSAGE };
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === ".") {
    return { ok: false, value: null, message: QTY_NOT_A_NUMBER_MESSAGE };
  }

  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value)) return { ok: false, value: null, message: QTY_NOT_A_NUMBER_MESSAGE };
  if (value <= 0) return { ok: false, value: null, message: QTY_ZERO_MESSAGE };
  if (!isFractionalUnit(unit) && !Number.isInteger(value)) {
    return { ok: false, value: null, message: QTY_TOO_SMALL_MESSAGE };
  }
  if (value > 1_000_000) return { ok: false, value: null, message: QTY_TOO_LARGE_MESSAGE };

  return { ok: true, value, message: "" };
}

/** Reasons a reason string is rejected. "Because" must not pass. */
export const REASON_REJECTED = [
  "because",
  "just",
  "test",
  "testing",
  "asdf",
  "xxx",
  "n/a",
  "none",
  "na",
  "tbd",
  "todo",
  "misc",
  "update",
  "fix",
  "ok",
  "okay",
];

export const REASON_EMPTY_MESSAGE =
  "Pick a reason. The ledger has to be able to answer “why is the number different” six weeks from now.";
export const REASON_WEAK_MESSAGE =
  "That is not a reason a shelf label could be defended with. Pick the closest real cause, and add detail below.";

export function reasonIsTooThin(reason: string): boolean {
  const normalised = reason.trim().toLowerCase();
  if (normalised.length < 3) return true;
  if (REASON_REJECTED.includes(normalised)) return true;
  return false;
}

/** The reason string written to the ledger: the cause, then the detail. */
export function composeReason(cause: string, note: string): string {
  const trimmedNote = note.trim();
  return trimmedNote === "" ? cause.trim() : `${cause.trim()} — ${trimmedNote}`;
}