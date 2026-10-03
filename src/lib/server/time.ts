/**
 * TIME — timezone-explicit date math for Asia/Manila (UTC+08:00, no DST).
 * ============================================================================
 * WHY THIS FILE EXISTS
 *
 * The shop is in Balanga City, Philippines: a fixed `+08:00` offset with **no
 * daylight saving, ever**. That single fact makes all our time maths *pure
 * arithmetic* — no `Intl`, no zone database, no DST edge cases.
 *
 * The two rules that follow, and that this module enforces:
 *
 *  1. **We never use the server's local timezone.** A Vercel function in
 *     `America/New_York` that calls `date.getHours()` will silently produce
 *     Balanga times that are wrong by 12 hours. Every local↔UTC conversion here
 *     goes through `localMinutesToUtc` / `utcToLocalMinutes`, which add or
 *     subtract a constant `+08:00` and read the UTC fields.
 *  2. **A local wall-clock date is not a UTC date.** `new Date("2026-03-01")`
 *     is UTC midnight, which in Manila is 08:00 the *same* day — but
 *     `new Date("2026-02-28T17:00:00Z")` is already 01:00 on **March 1** in
 *     Manila. `dateKeyOf()` is the only sanctioned way to turn an instant into
 *     a local calendar date.
 *
 * Every function here is pure so `tests/availability.test.ts` (QA) can test the
 * arithmetic without a database, a clock, or a network.
 *
 * NOTE: this module deliberately does NOT `import "server-only"`. It holds no
 * secrets, touches no database and is safe to import from anywhere — and the
 * `server-only` guard resolves to a throwing stub outside the Next.js compiler,
 * which would make the module untestable under plain `vitest`/`tsx`.
 */
import { TIMEZONE } from "@/config/site";

/** Philippines has observed no DST since 1978; the offset is a constant. */
export const PH_OFFSET_MINUTES = 8 * 60;
export const PH_OFFSET_LABEL = "+08:00";
export const SHOP_TIMEZONE = TIMEZONE; // "Asia/Manila"

export const MINUTES_PER_DAY = 1440;

export type LocalDateKey = string; // "YYYY-MM-DD"
export type IsoLocal = string; // "YYYY-MM-DDTHH:mm:ss+08:00"

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** 0 = Sunday … 6 = Saturday. Matches `Date#getDay()` and the Prisma schema. */
export function dayOfWeekOfKey(dateKey: LocalDateKey): number {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  // `Date.UTC` with the date parts — no local timezone involvement.
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** Today's local calendar date in the shop's timezone. */
export function todayKey(now: Date = new Date()): LocalDateKey {
  return dateKeyOf(now);
}

/** The instant's local calendar date (`YYYY-MM-DD`) in Manila. */
export function dateKeyOf(instant: Date): LocalDateKey {
  const shifted = new Date(instant.getTime() + PH_OFFSET_MINUTES * 60_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** Minutes since local midnight in Manila. */
export function minutesSinceLocalMidnight(instant: Date): number {
  const shifted = new Date(instant.getTime() + PH_OFFSET_MINUTES * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/**
 * Local `YYYY-MM-DD` + minutes-from-midnight → a real UTC `Date`.
 * Pure arithmetic; no `Intl`, no server timezone.
 */
export function localMinutesToUtc(dateKey: LocalDateKey, minutes: number): Date {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const utcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) + (minutes - PH_OFFSET_MINUTES) * 60_000;
  return new Date(utcMs);
}

/** Local wall-clock ISO string with the real `+08:00` offset. */
export function toIsoLocal(dateKey: LocalDateKey, minutes: number): IsoLocal {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${dateKey}T${pad(hours)}:${pad(mins)}:00${PH_OFFSET_LABEL}`;
}

export function addDaysToKey(dateKey: LocalDateKey, days: number): LocalDateKey {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** Whole-day difference `a - b` in the local calendar. */
export function diffDays(a: LocalDateKey, b: LocalDateKey): number {
  const [ay, am, ad] = a.split("-").map(Number) as [number, number, number];
  const [by, bm, bd] = b.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

/** "09:30" for a minutes-from-midnight value. */
export function minutesToHhmm(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Parses "08:00" → 480. Returns `null` when unparseable. */
export function parseHhmm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const mins = Number(m[2]);
  if (hours > 24 || mins > 59) return null;
  return hours * 60 + mins;
}

/** Localized 12-hour label for the slot chips, e.g. "9:00 AM". */
export function formatSlotLabel(dateKey: LocalDateKey, minutes: number): string {
  // Formatted by hand rather than through `Intl` so the output is byte-identical
  // on every runtime regardless of the server's ICU data (QA can assert on it).
  const hours24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${pad(mins)} ${suffix}`;
}

/**
 * Interpret a client-supplied ISO instant as a Manila wall-clock instant.
 *
 * We deliberately **do not** trust the client's offset. A browser in Berlin
 * sending `2026-03-01T09:00:00+01:00` means "I want the 9 a.m. slot", and the
 * scheduler's contract is a *local* slot. So we take the client's local
 * wall-clock fields, drop the offset, and re-interpret them at `+08:00`.
 *
 * Returns `null` when the string is not a usable ISO instant.
 */
export function isoToManilaInstant(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?$/i.exec(iso.trim());
  if (!m) return null;
  const key = `${m[1]}-${m[2]}-${m[3]}`;
  if (!isValidDateKey(key)) return null;
  const hours = Number(m[4]);
  const mins = Number(m[5]);
  const secs = m[6] === undefined ? 0 : Number(m[6]);
  if (hours > 23 || mins > 59 || secs > 59) return null;
  const [y, mo, d] = key.split("-").map(Number) as [number, number, number];
  const utcMs = Date.UTC(y, mo - 1, d, 0, 0, 0, 0) + (hours * 3600 + mins * 60 + secs) * 1000 - PH_OFFSET_MINUTES * 60_000;
  return new Date(utcMs);
}

/** Serialise a `Date` as an ISO string with the `+08:00` offset. */
export function isoWithOffset(instant: Date): string {
  const shifted = new Date(instant.getTime() + PH_OFFSET_MINUTES * 60_000);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}${PH_OFFSET_LABEL}`
  );
}
