/**
 * TIME IN THE PHILIPPINES — Asia/Manila, UTC+8, no daylight saving.
 * ============================================================================
 * Owned by the *widgets* agent. Lives under `src/components/widgets/internal/`
 * so server helpers and client helpers can share it without touching the
 * orchestrator-owned `src/lib/*` files.
 *
 * WHY NOT `Intl.DateTimeFormat`?
 *  - The server clock is UTC and every browser in the world may be anywhere.
 *    Booking times must read as *shop wall-clock time* regardless of where the
 *    customer's phone thinks it is. PH has had no DST since 1978 and is a fixed
 *    +08:00, so an explicit offset is exact and avoids ICU-tzdata availability
 *    differences between Vercel's runtime and the browser's.
 *  - Slot strings coming back from the API carry `+08:00` already, so parsing
 *    them back to wall-clock time is a pure offset operation.
 *
 * CONVERSION RULE USED EVERYWHERE BELOW
 *    shopWallClockMs = utcMs + 8h          (what the clock on the wall says)
 *    utcMs           = shopWallClockMs - 8h
 * ============================================================================
 */

export const PH_OFFSET_MINUTES = 8 * 60;
export const PH_OFFSET_LABEL = "+08:00";
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ShopParts {
  /** 0 = Sunday … 6 = Saturday. */
  day: Weekday;
  /** Minutes from local midnight. 0–1439. */
  minutes: number;
  year: number;
  month: number; // 1–12
  date: number; // 1–31
}

/** One shop-local day, ready for formatting. */
export interface ShopDay {
  ymd: string; // YYYY-MM-DD
  day: Weekday;
  minutes: number; // minutes since local midnight
  year: number;
  month: number; // 1–12
  date: number; // 1–31
}

/** Minutes → `8:00 AM`. */
export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.min(1439, Math.round(minutes)));
  const h24 = Math.floor(safe / 60);
  const m = safe % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

/** 90 → "1h 30m". Always positive; never negative, never "0m" alone. */
export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "now";
  const totalMinutes = Math.round(ms / MS_PER_MINUTE);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** Long-form, human phrasing used in status copy. */
export function formatDurationLong(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "less than a minute";
  const totalMinutes = Math.max(1, Math.round(ms / MS_PER_MINUTE));
  if (totalMinutes === 1) return "1 minute";
  if (totalMinutes < 60) return `${totalMinutes} minutes`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 1) return minutes === 0 ? "1 hour" : `1 hour ${minutes} min`;
  return minutes === 0 ? `${hours} hours` : `${hours} hours ${minutes} min`;
}

/**
 * Decomposes an absolute instant into Asia/Manila wall-clock fields.
 * `at` may be a `Date`, an epoch-ms number, or an ISO string (with or without
 * an offset). Naive strings are *treated as Manila local time* because that is
 * what a shop wall clock means.
 */
export function toShopParts(at: Date | number | string): ShopDay {
  const ms = typeof at === "string" ? parseInstant(at) : typeof at === "number" ? at : at.getTime();
  const shifted = new Date(ms + PH_OFFSET_MINUTES * MS_PER_MINUTE);
  return {
    ymd: `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`,
    day: shifted.getUTCDay() as Weekday,
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    date: shifted.getUTCDate(),
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Parses an instant to epoch ms. A string with an explicit offset is honoured.
 * A naive string (no `Z`, no `±HH:MM`) is interpreted as Manila wall-clock time.
 */
export function parseInstant(value: string): number {
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const naive = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (naive) {
    const [, y, mo, d, h, mi, s] = naive;
    if (y && mo && d) {
      const asUtc = Date.UTC(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(h ?? "0"),
        Number(mi ?? "0"),
        Number(s ?? "0"),
      );
      return asUtc - PH_OFFSET_MINUTES * MS_PER_MINUTE;
    }
  }
  const parsed = Date.parse(hasOffset ? value : `${value}Z`);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

/** `startAt` from the API → "9:00 AM". Never throws on a bad string. */
export function formatSlotLabel(iso: string, fallback = ""): string {
  const ms = parseInstant(iso);
  if (Number.isNaN(ms)) return fallback;
  return formatMinutes(toShopParts(ms).minutes);
}

/**
 * Full shop-local rendering of an instant:
 * "Mon, 3 Feb 2025 · 9:00 AM" (Asia/Manila).
 */
export function formatShopDateTime(
  at: Date | number | string,
  opts: { withDay?: boolean; withDate?: boolean; withYear?: boolean } = {},
): string {
  const { withDay = true, withDate = true, withYear = true } = opts;
  const ms = typeof at === "string" ? parseInstant(at) : typeof at === "number" ? at : at.getTime();
  if (Number.isNaN(ms)) return "—";
  const shop = new Date(ms + PH_OFFSET_MINUTES * MS_PER_MINUTE);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dayLabel = days[shop.getUTCDay()] ?? "";
  const monthLabel = months[shop.getUTCMonth()] ?? "";
  const bits: string[] = [];
  if (withDay) bits.push(`${dayLabel},`);
  if (withDate) bits.push(`${shop.getUTCDate()} ${monthLabel}${withYear ? ` ${shop.getUTCFullYear()}` : ""}`);
  const datePart = bits.join(" ");
  const timePart = formatMinutes(shop.getUTCHours() * 60 + shop.getUTCMinutes());
  return datePart ? `${datePart} · ${timePart}` : timePart;
}

/** Short weekday chip label: "Mon". */
export function weekdayShort(day: Weekday): string {
  return (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day] ?? "") as string;
}

/** Long weekday label used in the opening-hours table. */
export const WEEKDAY_LABELS: readonly string[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** 0 → "Midnight", 510 → "8:30 AM". */
export function formatMinutesHuman(minutes: number): string {
  if (minutes === 0) return "Midnight";
  return formatMinutes(minutes);
}

/** "8:00 AM – 5:00 PM" from an `opens`/`closes` pair. */
export function formatHoursRange(opens: number, closes: number): string {
  return `${formatMinutes(opens)} – ${formatMinutes(closes)}`;
}

/** `YYYY-MM-DD` for today in Manila. */
export function todayYmd(now: Date | number = Date.now()): string {
  return toShopParts(now).ymd;
}

/** Advances a `YYYY-MM-DD` string by whole days (Manila calendar). */
/**
 * Calendar parts of a `YYYY-MM-DD` string, parsed WITHOUT any timezone
 * interpretation. Date arithmetic happens in this plain calendar space, which
 * is what makes `addDaysYmd` safe: a `YYYY-MM-DD` has no time component, so
 * shifting it in UTC-calendar space is exact and offset-free.
 */
function calendarParts(ymd: string): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = m[1];
  const mo = m[2];
  const d = m[3];
  if (y === undefined || mo === undefined || d === undefined) return null;
  return { y: Number(y), mo: Number(mo) - 1, d: Number(d) };
}

/** Advances a `YYYY-MM-DD` by whole calendar days. */
export function addDaysYmd(ymd: string, days: number): string {
  const parts = calendarParts(ymd);
  if (!parts) return ymd;
  const shifted = new Date(Date.UTC(parts.y, parts.mo, parts.d) + days * MS_PER_DAY);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

/** Epoch ms for the START of Manila local day `YYYY-MM-DD` (i.e. 00:00 +08:00). */
export function ymdToEpoch(ymd: string): number {
  const parts = calendarParts(ymd);
  if (!parts) return Number.NaN;
  return Date.UTC(parts.y, parts.mo, parts.d) - PH_OFFSET_MINUTES * MS_PER_MINUTE;
}

/** Weekday (0 = Sunday) of a `YYYY-MM-DD`, offset-free. */
export function ymdWeekday(ymd: string): Weekday | null {
  const parts = calendarParts(ymd);
  if (!parts) return null;
  return new Date(Date.UTC(parts.y, parts.mo, parts.d)).getUTCDay() as Weekday;
}

/** Whole days from `ymd` to today-in-Manila. Negative = in the past. */
export function daysFromToday(ymd: string, now: Date | number = Date.now()): number {
  const target = ymdToEpoch(ymd);
  if (Number.isNaN(target)) return Number.NaN;
  const today = ymdToEpoch(todayYmd(now));
  if (Number.isNaN(today)) return Number.NaN;
  return Math.round((target - today) / MS_PER_DAY);
}

/** True when the instant is strictly in the past. */
export function isPast(at: Date | number | string, now: Date | number = Date.now()): boolean {
  const ms = typeof at === "string" ? parseInstant(at) : typeof at === "number" ? at : at.getTime();
  if (Number.isNaN(ms)) return false;
  const n = typeof now === "number" ? now : now.getTime();
  return ms <= n;
}