/**
 * OPEN / CLOSED
 * ============================================================================
 * Pure, dependency-free helpers over `BUSINESS_HOURS`. They run in Manila time
 * regardless of where the server or the browser is, so "Open now" is never
 * wrong because a visitor is in another timezone.
 *
 * Because `getOpenStatus(new Date())` is impure, a Server Component must pass
 * the value it computed to a Client Component as `initial` (see
 * `<OpenStatusPill />`) — never let a client leaf compute it during render or
 * hydration will mismatch.
 */
import { BUSINESS_HOURS, TIMEZONE } from "@/config/site";
import { PH_OFFSET_MINUTES } from "@/lib/server/time";

export interface OpenStatus {
  isOpen: boolean;
  /** Short pill copy. */
  label: "Open now" | "Closed now" | "Closed today";
  /** One line of detail: "Open until 5:00 PM" or "Opens Monday 8:00 AM". */
  detail: string;
  /** The shop's own words for today's hours. */
  today: string;
  /** Full weekly schedule, for tooltips and the contact page. */
  schedule: ReadonlyArray<{ day: string; text: string }>;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface ManilaParts {
  day: number;
  minutes: number;
}

const EMPTY_HOLIDAYS: readonly HolidayEntry[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Overrides
// -----------------------------------------------------------------------------
// `getOpenStatus` takes one optional second argument that is EITHER a holiday
// list OR an hours override. They are told apart by element shape, because the
// `Holiday` row model and the weekly-hours row model are genuinely different
// things and both callers read better than an options bag at a call site.
// ─────────────────────────────────────────────────────────────────────────────

interface HoursEntry {
  day: number;
  label: string;
  /** Minutes from midnight. */
  opens: number;
  /** Minutes from midnight. May exceed 1440 for a window that runs past midnight. */
  closes: number;
  closed?: boolean;
}

export interface HolidayEntry {
  /** `YYYY-MM-DD` in Asia/Manila. */
  date: string;
  isClosed: boolean;
  name: string;
}

export type HolidayInput = readonly HolidayEntry[] | ReadonlySet<string> | readonly string[];
export type HoursInput = readonly HoursEntry[];

const isHolidayList = (v: HolidayInput | HoursInput | undefined): v is HolidayInput => {
  if (!Array.isArray(v) || v.length === 0) return Array.isArray(v);
  const first = v[0] as Record<string, unknown>;
  return "date" in first || typeof first === "string";
};

function resolveHours(override?: HolidayInput | HoursInput): readonly HoursEntry[] {
  if (!override || Array.isArray(override)) {
    if (override && !isHolidayList(override)) return override as readonly HoursEntry[];
  }
  return BUSINESS_HOURS as readonly HoursEntry[];
}

function resolveHolidays(override?: HolidayInput | HoursInput): readonly HolidayEntry[] {
  if (!override || isHolidayList(override)) {
    const list = override;
    if (!list) return EMPTY_HOLIDAYS;
    const items = list instanceof Set ? [...list] : (list as readonly (string | HolidayEntry)[]);
    return items
      .map((item) => (typeof item === "string" ? { date: item, isClosed: true, name: "a holiday" } : item))
      .filter((h): h is HolidayEntry => Boolean(h?.date) && h.isClosed !== false);
  }
  return EMPTY_HOLIDAYS;
}

/** `YYYY-MM-DD` for the given instant, as seen in Asia/Manila. */
function manilaIsoDate(now: Date): string {
  // Shifting by the offset and reading UTC avoids a second Intl pass.
  const shifted = new Date(now.getTime() + PH_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * True when the date `offset` days after `isoDate` (Manila) is a closure.
 * `offset === 0` is today; later offsets are the following days.
 */
function isHolidayOn(isoDate: string, offset: number, holidays: readonly HolidayEntry[]): boolean {
  if (holidays.length === 0) return false;
  const base = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(base)) return false;
  const date = offset === 0 ? isoDate : new Date(base + offset * 86_400_000).toISOString().slice(0, 10);
  return holidays.some((h) => h.date === date && h.isClosed);
}

function manilaParts(now: Date): ManilaParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);

  const read = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number.parseInt(read("hour"), 10);
  // `hour: "2-digit"` with hour12:false can yield "24" for midnight in some
  // ICU versions. Normalise it.
  const normalisedHour = hour === 24 ? 0 : hour;
  const minute = Number.parseInt(read("minute"), 10);
  const day = WEEKDAY_INDEX[read("weekday")] ?? 0;

  return { day, minutes: normalisedHour * 60 + (Number.isFinite(minute) ? minute : 0) };
}

function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function entryForDay(day: number, hours: readonly HoursEntry[] = BUSINESS_HOURS as readonly HoursEntry[]) {
  return hours.find((h) => h.day === day);
}

function hoursText(entry: { opens: number; closes: number } | undefined): string {
  if (!entry) return "Closed";
  return `${formatClock(entry.opens)} – ${formatClock(entry.closes)}`;
}

export function formatSchedule(): ReadonlyArray<{ day: string; text: string }> {
  return BUSINESS_HOURS.map((h) => ({ day: h.label, text: h.closed ? "Closed" : hoursText(h) }));
}

/**
 * Live status. Pass `new Date()` explicitly in server components.
 *
 * @param holidays  ISO `YYYY-MM-DD` dates in Asia/Manila on which the shop is
 *                  closed. Passing them is what stops the site telling a
 *                  customer "Open now" on Christmas Eve (QA DEF-001).
 */
export function getOpenStatus(
  now: Date = new Date(),
  override?: HolidayInput | HoursInput,
): OpenStatus {
  const hours = resolveHours(override);
  const holidays = resolveHolidays(override);

  const { day, minutes } = manilaParts(now);
  const isoDate = manilaIsoDate(now);
  const closedToday = holidays.find((h) => h.date === isoDate && h.isClosed);
  const isHoliday = Boolean(closedToday);
  const today = entryForDay(day, hours);
  const schedule = formatSchedule();

  // DEF-003: a day marked `closed` must render "Closed" in the hours line, not
  // the 8-5 window it nominally carries.
  const todayText = !today || today.closed ? "Closed" : hoursText(today);
  const todayLine = `${today ? today.label : ""}: ${todayText}`;

  /**
   * Is the given day's window open right now?
   *
   * `closes` may exceed 1440 (a 22:00-02:00 window expressed as 1320 -> 1560)
   * OR be less than `opens` (1320 -> 120). Both mean the shift runs past
   * midnight, and both used to evaluate as "closed" for the entire evening
   * (QA DEF-002). "Today" is always the calendar day the window starts on, so
   * the early hours are checked against the *previous* day's entry.
   */
  const windowActive = (entry: HoursEntry | undefined, minuteOfDay: number): boolean => {
    if (!entry || entry.closed) return false;
    const end = entry.closes > entry.opens ? entry.closes : entry.closes + 24 * 60;
    if (minuteOfDay >= entry.opens && minuteOfDay < end) return true;
    // The post-midnight tail of a window that started yesterday: re-anchor the
    // clock by +24h and test again, so `Saturday 22:00 -> 02:00` covers
    // Sunday 00:00-02:00 as well.
    const carried = minuteOfDay + 24 * 60;
    return end > 24 * 60 && carried >= entry.opens && carried < end;
  };

  const previousEntry = entryForDay((day + 6) % 7, hours);
  // An overnight shift means the small hours belong to yesterday's entry.
  const carriedFromYesterday = Boolean(
    previousEntry && !previousEntry.closed && previousEntry.closes > 24 * 60 && minutes < previousEntry.closes - 24 * 60,
  );
  const isOpenOvernight = !isHoliday && carriedFromYesterday && windowActive(previousEntry, minutes);

  const isOpenToday =
    !isHoliday &&
    Boolean(today && !today.closed && windowActive(today, minutes)) &&
    // A window expressed as `closes > 1440` runs past midnight; the post-midnight
    // part belongs to yesterday's entry, not to today's.
    !(today && today.closes > 24 * 60 && minutes >= 24 * 60);

  const isOpen = isOpenToday || isOpenOvernight;

  if (isOpen) {
    const closesAt = isOpenOvernight ? (previousEntry?.closes ?? 0) : (today?.closes ?? 0);
    return {
      isOpen: true,
      label: "Open now",
      detail: `Open until ${formatClock(closesAt % (24 * 60) || 0)}`,
      today: todayLine,
      schedule,
    };
  }

  // Closed for a named holiday today: say so, and name it.
  if (isHoliday && closedToday) {
    return {
      isOpen: false,
      label: "Closed today",
      detail: `Closed today for ${closedToday.name}. Open again on the next working day.`,
      today: todayLine,
      schedule,
    };
  }

  // Not open now — find the next opening window.
  for (let offset = 0; offset < 8; offset += 1) {
    const nextDay = (day + offset) % 7;
    const entry = entryForDay(nextDay, hours);
    if (!entry || entry.closed) continue;

    // A holiday suppresses that specific date only.
    if (isHolidayOn(isoDate, offset, holidays)) continue;

    // Only today qualifies for "opens today"; otherwise the next day is the
    // honest answer (at Wed 23:00 the shop reopens Thursday, not Wednesday).
    if (offset === 0) {
      if (entry.closes <= entry.opens) continue; // overnight-only window, not yet started
      if (minutes < entry.opens) {
        return {
          isOpen: false,
          label: "Closed now",
          detail: `Opens today at ${formatClock(entry.opens)}`,
          today: todayLine,
          schedule,
        };
      }
      continue;
    }

    return {
      isOpen: false,
      label: "Closed now",
      detail: `Opens ${entry.label} at ${formatClock(entry.opens)}`,
      today: todayLine,
      schedule,
    };
  }

  return {
    isOpen: false,
    label: "Closed now",
    detail: "Check the Facebook page for hours",
    today: `${today ? today.label : ""}: ${todayText}`,
    schedule,
  };
}
