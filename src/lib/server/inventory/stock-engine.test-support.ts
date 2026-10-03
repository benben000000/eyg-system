/**
 * PURE INVENTORY HELPERS
 * ============================================================================
 * Everything in this file is a total function: no database, no clock reads that
 * the caller cannot inject, no `server-only`. That is deliberate — these are the
 * rules a QA agent must be able to drive *without* a database, because the
 * arithmetic is where the money and the oversells live.
 *
 * The engine (`stock-engine.ts`) imports from here rather than inlining the
 * rules, so "what the engine does" and "what a test asserts" cannot drift.
 * ============================================================================
 */

import { PRODUCT_KINDS, type MovementKindValue, type MovementRefusalReason, type ProductKindValue } from "@/lib/inventory-types";

// ── Movement sign convention ────────────────────────────────────────────────

/**
 * The `StockMovement` enum describes two *different* ledgers, and conflating
 * them is how a reservation ends up looking like a physical movement:
 *
 *  • **on-hand kinds** change the physical count on the shelf. Their `qty` is
 *    the signed delta of `StockLevel.onHand`.
 *  • **promise kinds** (`RESERVE` / `RELEASE`) only move units between
 *    `onHand` and `reserved`. Nothing physically leaves the shelf, so
 *    `onHand` does not change and `onHandAfter` is written unchanged. Their
 *    `qty` is the signed delta of what may still be *promised* — reserving four
 *    filters is a −4 on availability even though the shelf still has four on
 *    it, and the `Reservation` row (not the movement) is the record of who
 *    promised them and until when.
 *
 * `OPENING` is neither: it is an absolute baseline, and is rejected outright if
 * the product already holds stock.
 */
export const ON_HAND_SIGN: Readonly<Record<MovementKindValue, -1 | 0 | 1>> = Object.freeze({
  OPENING: 0,
  RECEIVE: 1,
  CONSUME: -1,
  ADJUST_UP: 1,
  ADJUST_DOWN: -1,
  SHRINK: -1,
  TRANSFER_IN: 1,
  TRANSFER_OUT: -1,
  RETURN_TO_SUPPLIER: -1,
  RESERVE: 0,
  RELEASE: 0,
});

/** Kinds that only move the promise, never the shelf. */
export const PROMISE_KINDS: ReadonlySet<MovementKindValue> = new Set<MovementKindValue>(["RESERVE", "RELEASE"]);

/** True when this kind is rejected outright by the movements route. */
export function isPromiseKind(kind: MovementKindValue): boolean {
  return PROMISE_KINDS.has(kind);
}

/**
 * The signed `qty` written to `StockMovement`.
 *
 * `qty` is always the *magnitude the human asked for*, carrying the sign of
 * the direction it moved. The engine normalises a negative input (see
 * `normaliseQty`) rather than trusting the caller's arithmetic.
 */
export function ledgerQty(kind: MovementKindValue, qty: number): number {
  const magnitude = Math.abs(qty);
  if (kind === "RESERVE") return -magnitude;
  if (kind === "RELEASE") return magnitude;
  return ON_HAND_SIGN[kind] * magnitude;
}

/**
 * `OPENING` is a baseline, so it is refused when the product already holds a
 * real balance. Receiving, transferring in, and *promising* a retired SKU are
 * equally refused — you cannot take delivery of, or promise, something the shop
 * has deliberately stopped selling.
 *
 * Corrections (`ADJUST_UP`, `ADJUST_DOWN`, `SHRINK`, `CONSUME`, `RETURN_TO_SUPPLIER`,
 * `TRANSFER_OUT`) stay allowed on an inactive product, because history still has
 * to be reconcilable after a SKU is retired.
 */
export const REFUSE_WHEN_INACTIVE: ReadonlySet<MovementKindValue> = new Set<MovementKindValue>([
  "OPENING",
  "RECEIVE",
  "TRANSFER_IN",
  "RESERVE",
]);

// ── Quantity + reason hygiene ───────────────────────────────────────────────

/** A single movement larger than this is a keying error, not a delivery. */
export const MAX_MOVEMENT_QTY = 100_000;

/** Free-text cap. "Because" fits in a reason; an essay does not. */
export const MAX_REASON_LENGTH = 300;
export const MAX_REFERENCE_LENGTH = 120;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 120;

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/;

/**
 * Trims and collapses a reason. Returns `""` when nothing usable is left, which
 * the caller must treat as *no reason given* — never as "pass the check".
 */
export function normaliseReason(input: string | null | undefined): string {
  if (typeof input !== "string") return "";
  return input.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
}

/** Collapses a free-text field (notes, names) without inventing content. */
export function normaliseText(input: string | null | undefined): string {
  return normaliseReason(input);
}

export type QuantityCheck =
  | { ok: true; qty: number }
  | { ok: false; reason: Extract<MovementRefusalReason, "NEGATIVE_QUANTITY" | "ZERO_QUANTITY"> };

/**
 * Validates the requested magnitude.
 *
 * A caller may send `-3` meaning "remove three"; that is normalised to `3` and
 * the *kind* decides the direction. A caller who sends `0`, a fractional
 * quantity or an absurd magnitude is refused, because a half oil filter is a
 * data-entry bug and a million litres is a different shop.
 */
export function checkQuantity(raw: unknown): QuantityCheck {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return { ok: false, reason: "ZERO_QUANTITY" };
  if (!Number.isInteger(raw)) return { ok: false, reason: "ZERO_QUANTITY" };
  if (raw === 0) return { ok: false, reason: "ZERO_QUANTITY" };
  if (Math.abs(raw) > MAX_MOVEMENT_QTY) return { ok: false, reason: "NEGATIVE_QUANTITY" };
  return { ok: true, qty: Math.abs(raw) };
}

// ── Refusal copy ────────────────────────────────────────────────────────────

/**
 * The sentence a staff member actually reads.
 *
 * The contract is explicit that a refusal must carry *what was available* so
 * the counter can say "3 left" rather than "failed" — a mechanic holding a
 * customer's car needs the number, not an apology.
 */
export function movementRefusalMessage(
  reason: MovementRefusalReason,
  numbers: { requested: number; available: number },
): string {
  switch (reason) {
    case "ZERO_QUANTITY":
      return "Enter a quantity greater than zero.";
    case "NEGATIVE_QUANTITY":
      return "That quantity is not valid. Stock moves are whole units only.";
    case "PRODUCT_INACTIVE":
      return "This item is no longer active, so it cannot be received or promised. Adjustments are still allowed to correct the record.";
    case "OPENING_ALREADY_SET":
      return "This item already has a stock balance. Use an adjustment instead of an opening entry.";
    case "INSUFFICIENT_AVAILABLE":
      return numbers.available <= 0
        ? `Nothing available to hold. Use a receive or an adjustment first.`
        : `Only ${numbers.available} available to hold, and ${numbers.requested} was requested.`;
    case "INSUFFICIENT_STOCK":
      return numbers.available <= 0
        ? `There is nothing available — all stock is either out or already promised to a booking.`
        : `Only ${numbers.available} available, and ${numbers.requested} was requested.`;
    default:
      return "That stock movement was refused.";
  }
}

// ── Tyre size ───────────────────────────────────────────────────────────────

export interface TyreSizeParts {
  /** Section width in mm, e.g. 205. */
  width: number;
  /** Aspect ratio as a percentage of the width, e.g. 55. */
  aspectRatio: number;
  /** Rim diameter in inches, e.g. 16. */
  rimSizeIn: number;
  /** The canonical string the catalogue stores, e.g. `205/55R16`. */
  canonical: string;
}

/**
 * Accepts every spelling a mechanic or a customer actually types and returns the
 * canonical `205/55R16` form, or `null` when the input is not a tyre size at all.
 *
 * This is the highest-frequency query in the shop: a mechanic reading a tyre
 * sidewall types `205/55R16`, a customer types `205 55 16`, a supplier invoice
 * says `205/55 R16`. All three must land on the same indexed row.
 */
export function parseTyreSize(input: string | null | undefined): TyreSizeParts | null {
  if (typeof input !== "string") return null;
  const raw = input.trim().toUpperCase();
  if (raw.length === 0 || raw.length > 24) return null;
  const match = /^(\d{3})\s*[/\- ]\s*(\d{2})\s*R?\s*(\d{2})$/.exec(raw);
  if (!match) return null;
  const width = Number(match[1]);
  const aspectRatio = Number(match[2]);
  const rimSizeIn = Number(match[3]);
  if (!Number.isInteger(width) || !Number.isInteger(aspectRatio) || !Number.isInteger(rimSizeIn)) return null;
  if (width < 100 || width > 999) return null;
  if (aspectRatio < 10 || aspectRatio > 95) return null;
  if (rimSizeIn < 10 || rimSizeIn > 32) return null;
  return { width, aspectRatio, rimSizeIn, canonical: `${width}/${aspectRatio}R${rimSizeIn}` };
}

/** True when the string is a tyre size in *some* spelling. */
export function looksLikeTyreSize(input: string | null | undefined): boolean {
  return parseTyreSize(input) !== null;
}

// ── Cycle-count variance ────────────────────────────────────────────────────

/**
 * Whether a variance is worth a human's attention.
 *
 * One missing oil filter out of two is the single most consequential thing a
 * count can find, and "1 of 2" must not be filtered out as noise. Two tyres out
 * of fifty is noise. The rule is therefore anchored on the *small* end, not on a
 * flat percentage.
 */
export function isSignificantVariance(expected: number, variance: number): boolean {
  if (variance === 0) return false;
  if (expected <= 2) return true;
  return Math.abs(variance) >= Math.max(2, Math.ceil(expected * 0.1));
}

// ── Ageing: DOT codes and shelf life ────────────────────────────────────────

/**
 * Days after which DOT-coded tyres are treated as aged stock.
 *
 * SHOP POLICY, NOT RESEARCH. Rubber hardens with age and a tyre that has spent
 * three seasons in the sun is a liability in a shop that lives on repeat work.
 * Three years is the number the owner must confirm; it is exported so the value
 * lives in exactly one place and can be changed without hunting.
 */
export const TYRE_STALE_DAYS = 1_095;

/** Days before a shelf-life product's expiry at which it is flagged as "near". */
export const NEAR_EXPIRY_DAYS = 30;

/**
 * `WKYY` → the Monday of that production week, e.g. `2418` = week 18 of 2024.
 *
 * Two-digit years follow the tyre-industry convention: `00`–`49` are 2000s,
 * `50`–`99` are 1900s. A tyre is dated to the *start* of its production week so
 * that two tyres from the same batch always age identically — dating them to the
 * Sunday would make week 49 and week 01 appear closer together than they are.
 *
 * Returns `null` for anything that is not a plausible code, so a blank or
 * typo'd DOT never produces a fabricated age.
 */
export function parseDotCode(dot: string | null | undefined): Date | null {
  if (typeof dot !== "string") return null;
  const raw = dot.trim().replace(/\s+/g, "");
  if (!/^\d{4}$/.test(raw)) return null;
  const week = Number(raw.slice(0, 2));
  const year2 = Number(raw.slice(2, 4));
  if (week < 1 || week > 53) return null;
  const year = year2 <= 49 ? 2000 + year2 : 1900 + year2;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  // ISO weeks start on Monday; getUTCDay() is 0=Sun, so shift to 0=Mon.
  const mondayOffset = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4.getTime() - mondayOffset * 86_400_000);
  const produced = new Date(week1Monday.getTime() + (week - 1) * 7 * 86_400_000);
  // Week 53 of a 52-week year rolls into January of the next year; reject the
  // overflow rather than inventing a 2025-01 date for a 2024 tyre.
  if (produced.getUTCFullYear() !== year) return null;
  return produced;
}

/** Whole days from `from` to `to`. Negative when `to` precedes `from`. */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Shelf-life expiry for a catalogue item, measured from `since`.
 *
 * The contract is explicit that shelf life runs from RECEIPT, not from
 * `Product.createdAt` — which is when the SKU was typed into the catalogue and
 * can be months before the oil arrived. Deriving expiry from `createdAt` labels
 * fresh stock as expired, so `since` is `lastReceivedAt` where the ledger knows
 * it and `createdAt` only as the labelled fallback.
 */
export function shelfLifeExpiry(since: Date, shelfLifeDays: number | null | undefined): Date | null {
  if (typeof shelfLifeDays !== "number" || !Number.isFinite(shelfLifeDays) || shelfLifeDays <= 0) return null;
  return new Date(since.getTime() + shelfLifeDays * 86_400_000);
}

/** Days until `expiry`; negative once it has passed. */
export function daysUntil(expiry: Date | null, now: Date): number | null {
  if (!expiry) return null;
  return daysBetween(now, expiry);
}

// ── Scope parsing for cycle counts ──────────────────────────────────────────

export type CountScope =
  | { kind: "all" }
  | { kind: "product"; productId: string }
  | { kind: "productKind"; productKind: ProductKindValue };

/**
 * `StockCount.scope` is a free-form string in the schema. It is interpreted here
 * and nowhere else, so "what did this count cover?" always has one answer.
 *
 * A `ProductKind` (`TYRE`, `OIL`, …) is SCREAMING_CASE and a cuid is lower-case
 * alphanumeric, so the two can be told apart without an extra lookup.
 */
export function parseCountScope(scope: string | null | undefined): CountScope {
  const raw = (scope ?? "all").trim();
  if (raw.length === 0 || raw.toLowerCase() === "all") return { kind: "all" };
  if ((PRODUCT_KINDS as readonly string[]).includes(raw)) {
    // `PRODUCT_KINDS` is a literal union, so this narrows to `ProductKindValue`.
    return { kind: "productKind", productKind: raw as ProductKindValue };
  }
  return { kind: "product", productId: raw };
}
