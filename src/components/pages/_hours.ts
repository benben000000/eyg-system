/**
 * EYG — BUSINESS HOURS IN ASIA/MANILA
 * ============================================================================
 * ⚠️  WHY THIS FILE EXISTS
 *
 * `BUSINESS_HOURS` in `src/config/site.ts` is expressed in **shop local time**
 * (Asia/Manila, UTC+8, no daylight saving). A server running in UTC, or in any
 * other zone, must never read its own `getHours()`/`getDay()` and compare it to
 * those numbers — that is how a shop ends up showing "Closed" at 10 AM on a
 * Tuesday.
 *
 * Everything below therefore goes through `Intl.DateTimeFormat` with an explicit
 * `timeZone: TIMEZONE`, and we read the *formatted parts* rather than the
 * instant's own getters. This is correct for a server on UTC, on any host, in
 * any container, all year.
 * ============================================================================
 */

import { BUSINESS_HOURS, TIMEZONE } from "@/config/site";

/** One row of `BUSINESS_HOURS`, with the parts we need to reason about. */
export interface HoursDay {
  day: number;
  label: string;
  opens: number;
  closes: number;
  closed: boolean;
}

const HOURS: readonly HoursDay[] = BUSINESS_HOURS.map((d) => ({
  day: d.day,
  label: d.label,
  opens: d.opens,
  closes: d.closes,
  closed: d.closed === true,
}));

/** `Asia/Manila` wall-clock breakdown of an instant. */
export interface ManilaNow {
  /** YYYY-MM-DD in Manila local time. */
  isoDate: string;
  year: number;
  month: number;
  day: number;
  /** 0 = Sunday … 6 = Saturday, Manila local. */
  dayOfWeek: number;
  /** Minutes since Manila midnight. */
  minutes: number;
  /** UTC offset label, e.g. "UTC+8". */
  offset: string;
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const _OFFSET_INDEX: Readonly<Record<string, number>> = {
  GMT: 0,
  UT: 0,
  UTC: 0,
};

function parseOffset(label: string): number {
  // "GMT+8" → 480. "GMT" → 0.
  const m = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(label);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hours = Number(m[2] ?? "0");
  const mins = Number(m[3] ?? "0");
  return sign * (hours * 60 + mins);
}

/**
 * Converts an instant to the shop's wall clock.
 *
 * `Intl.DateTimeFormat` is asked for every field explicitly so the result never
 * depends on the host locale, and `hourCycle: "h23"` prevents the 12-hour clock
 * from handing back midnight as hour 24.
 */
export function getManilaNow(now: Date = new Date()): ManilaNow {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  });

  const parts = fmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): string | undefined =>
    parts.find((p) => p.type === type)?.value;

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const weekday = WEEKDAY_INDEX[get("weekday") ?? "Sun"] ?? 0;
  const tzName = get("timeZoneName") ?? "GMT";
  const offsetMinutes = parseOffset(tzName.startsWith("UTC") ? `GMT${tzName.slice(3)}` : tzName);

  if ([year, month, day, hour, minute].some((n) => !Number.isFinite(n))) {
    // Should be impossible, but a bad state here would print "NaN" to a customer.
    throw new Error("getManilaNow: Intl.DateTimeFormat returned an unusable result");
  }

  return {
    isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    year,
    month,
    day,
    dayOfWeek: weekday,
    minutes: hour * 60 + minute,
    offset: `UTC+${Math.round(offsetMinutes / 60)}`,
  };
}

/** 0 → "12:00 AM", 480 → "8:00 AM", 750 → "12:30 PM". PH shop hours style. */
export function formatMinutes(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** 95 → "1 hr 35 min". Used for "closing in …". */
export function humanDuration(minutes: number): string {
  const total = Math.max(1, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function hoursFor(dayOfWeek: number): HoursDay | null {
  return HOURS.find((h) => h.day === dayOfWeek) ?? null;
}

/** The next day (wrapping) that is not closed. */
function nextOpenDay(fromDayOfWeek: number): HoursDay {
  for (let step = 1; step <= 7; step += 1) {
    const candidate = HOURS.find((h) => h.day === (fromDayOfWeek + step) % 7);
    if (candidate && !candidate.closed) return candidate;
  }
  // Every day closed would be a data error in `site.ts`; fall back to row 0.
  return HOURS[0] ?? { day: 0, label: "Sunday", opens: 0, closes: 0, closed: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHOP STATUS
// ─────────────────────────────────────────────────────────────────────────────

export type ShopStatusTone = "open" | "closing-soon" | "opens-soon" | "closed";

export interface ShopStatus {
  tone: ShopStatusTone;
  /** The headline. Always states the fact in words, never colour alone. */
  label: string;
  /** Supporting sentence. */
  detail: string;
  isOpenNow: boolean;
  /** Minutes until the next change of state. */
  minutesUntilChange: number;
  /** "today" | "tomorrow" | the day label. */
  changeDay: "today" | "tomorrow" | string;
}

/** `CLOSING_SOON_MINUTES` — the window where the hazard band is appropriate. */
const CLOSING_SOON_MINUTES = 60;

export function getShopStatus(now: Date = new Date()): ShopStatus {
  const manila = getManilaNow(now);
  const today = hoursFor(manila.dayOfWeek);

  if (today && !today.closed) {
    if (manila.minutes < today.opens) {
      return {
        tone: "opens-soon",
        label: `Closed for now — opens today at ${formatMinutes(today.opens)}`,
        detail: `${humanDuration(today.opens - manila.minutes)} until we open. Book a slot and it will be waiting.`,
        isOpenNow: false,
        minutesUntilChange: today.opens - manila.minutes,
        changeDay: "today",
      };
    }
    if (manila.minutes < today.closes) {
      const left = today.closes - manila.minutes;
      if (left <= CLOSING_SOON_MINUTES) {
        return {
          tone: "closing-soon",
          label: `Closing in ${humanDuration(left)} — today ${formatMinutes(today.opens)} – ${formatMinutes(today.closes)}`,
          detail: "If you are on your way, call first so we can keep a bay for you.",
          isOpenNow: true,
          minutesUntilChange: left,
          changeDay: "today",
        };
      }
      return {
        tone: "open",
        label: `Open today ${formatMinutes(today.opens)} – ${formatMinutes(today.closes)}`,
        detail: `Right now it is ${formatMinutes(manila.minutes)} in Manila. Closes in ${humanDuration(left)}.`,
        isOpenNow: true,
        minutesUntilChange: left,
        changeDay: "today",
      };
    }
    // Past closing time.
  }

  const next = nextOpenDay(manila.dayOfWeek);
  const tomorrowLabel = manila.dayOfWeek === 6 ? "Sunday" : next.label;
  const isTomorrow = next.day === (manila.dayOfWeek + 1) % 7;

  if (today && today.closed) {
    return {
      tone: "closed",
      label: `Closed today — ${isTomorrow ? "opens" : "next opening is"} ${next.label} at ${formatMinutes(next.opens)}`,
      detail: `We are closed on ${today.label}s. Walk-ins are fine any other day between ${formatMinutes(next.opens)} and ${formatMinutes(next.closes)}.`,
      isOpenNow: false,
      minutesUntilChange: 0,
      changeDay: isTomorrow ? "tomorrow" : tomorrowLabel,
    };
  }

  const minutesToMidnight = 1440 - manila.minutes;
  return {
    tone: "closed",
    label: `Closed — ${isTomorrow ? "opens" : "next opening is"} ${next.label} at ${formatMinutes(next.opens)}`,
    detail: `Closed for the day. ${isTomorrow ? "Opens" : "Next open"} ${next.label}, ${formatMinutes(next.opens)} – ${formatMinutes(next.closes)}.`,
    isOpenNow: false,
    minutesUntilChange: minutesToMidnight + next.opens,
    changeDay: isTomorrow ? "tomorrow" : tomorrowLabel,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NEXT 7 DAYS
// ─────────────────────────────────────────────────────────────────────────────

export type DayStatus = "today" | "upcoming";

export interface HoursRow {
  key: string;
  dayLabel: string;
  /** Short label for the strip: "Mon". */
  shortLabel: string;
  opensText: string;
  closesText: string;
  closed: boolean;
  status: DayStatus;
  /** YYYY-MM-DD in Manila local time. */
  isoDate: string;
}

const SHORT_DAY: Readonly<Record<string, string>> = {
  Sunday: "Sun",
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
};

/** Calendar-day arithmetic on `YYYY-MM-DD`, in pure string space (no Date drift). */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map((n) => Number(n));
  if (!y || !m || !d) return isoDate;
  // Date.UTC is safe here: we only want calendar arithmetic, and using UTC for
  // both sides keeps the result free of host-timezone drift.
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
}

function dayOfWeekForIso(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map((n) => Number(n));
  if (!y || !m || !d) return 0;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The next seven days, starting today (Manila local). */
export function getHoursWeek(now: Date = new Date()): HoursRow[] {
  const manila = getManilaNow(now);
  const rows: HoursRow[] = [];

  for (let i = 0; i < 7; i += 1) {
    const isoDate = addDays(manila.isoDate, i);
    const day = hoursFor(dayOfWeekForIso(isoDate));
    if (!day) continue;
    rows.push({
      key: isoDate,
      isoDate,
      dayLabel: day.label,
      shortLabel: SHORT_DAY[day.label] ?? day.label,
      opensText: formatMinutes(day.opens),
      closesText: formatMinutes(day.closes),
      closed: day.closed,
      status: i === 0 ? "today" : "upcoming",
    });
  }
  return rows;
}

/** True when the shop does not take bookings on the given Manila-local date. */
export function isClosedIsoDate(isoDate: string): boolean {
  const day = hoursFor(dayOfWeekForIso(isoDate));
  return day ? day.closed : false;
}

/** `YYYY-MM-DD` for today in Manila local time — the `/book` date-strip origin. */
export function todayIsoManila(now: Date = new Date()): string {
  return getManilaNow(now).isoDate;
}

/** `YYYY-MM-DD` advanced by `days`, with no host-timezone drift. */
export function shiftIsoDate(isoDate: string, days: number): string {
  return addDays(isoDate, days);
}

const MONTH_SHORT: readonly string[] = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface DateStripDay {
  isoDate: string;
  /** "Fri" */
  weekdayLabel: string;
  /** "2" */
  dayOfMonth: number;
  /** "Oct" */
  monthLabel: string;
  /** Full readable date, used as the accessible name. */
  fullLabel: string;
  /** From `BUSINESS_HOURS` — closed days cannot be booked. */
  closed: boolean;
  isToday: boolean;
}

/**
 * The next `days` bookable-day candidates, starting today (Manila local).
 * Used by the `/book` date strip. Closed days are included but flagged, so the
 * customer can see *why* a date is unavailable rather than finding it missing.
 */
export function getDateStrip(days = 14, now: Date = new Date()): DateStripDay[] {
  const manila = getManilaNow(now);
  const out: DateStripDay[] = [];
  for (let i = 0; i < days; i += 1) {
    const isoDate = addDays(manila.isoDate, i);
    const parts = isoDate.split("-");
    const month = Number(parts[1]);
    const dom = Number(parts[2]);
    const day = hoursFor(dayOfWeekForIso(isoDate));
    out.push({
      isoDate,
      weekdayLabel: SHORT_DAY[day?.label ?? ""] ?? "",
      dayOfMonth: dom,
      monthLabel: MONTH_SHORT[month - 1] ?? "",
      fullLabel: `${day?.label ?? ""} ${dom} ${MONTH_SHORT[month - 1] ?? ""}`.trim(),
      closed: day ? day.closed : true,
      isToday: i === 0,
    });
  }
  return out;
}
