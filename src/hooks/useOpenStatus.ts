"use client";

/**
 * LIVE OPEN / CLOSED STATUS — computed against `BUSINESS_HOURS` in Asia/Manila.
 * ============================================================================
 * TIMEZONE HANDLING (the part that is easy to get wrong)
 * ---------------------------------------------------------------------------
 *  - The server clock is UTC. The shop wall clock is UTC+8, fixed, no DST.
 *    Every conversion goes through `toShopParts()`, which adds exactly 8 hours
 *    to the epoch and reads the result with `getUTC*`. There is no reliance on
 *    the host timezone, so a Vercel region in UTC and a browser in Los Angeles
 *    both produce the same "Open now".
 *  - `hour` boundaries are INCLUSIVE at the open edge and EXCLUSIVE at the
 *    close edge, in shop wall-clock minutes:
 *        open  when  opens <= minutes < closes
 *        closed when minutes < opens or minutes >= closes
 *    So 08:00 is open and 16:59 is open; 07:59 and 17:00 are closed. The
 *    "closing soon" band is the last 60 minutes before `closes`.
 *  - The status is computed server-side for the first paint, then re-hydrated
 *    on the client and recomputed on a timer + on tab visibility, so a page
 *    left open across closing time does not go stale.
 * ============================================================================
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { BUSINESS_HOURS, TIMEZONE } from "@/config/site";
import {
  MS_PER_DAY,
  MS_PER_MINUTE,
  WEEKDAY_LABELS,
  addDaysYmd,
  formatHoursRange,
  formatMinutes,
  todayYmd,
  toShopParts,
  weekdayShort,
  ymdToEpoch,
  ymdWeekday,
  type Weekday,
} from "@/components/widgets/internal/time-ph";

export interface HoursDay {
  day: number;
  label: string;
  /** Minutes from Manila midnight. `null` on a closed day. */
  opens: number;
  closes: number;
  closed: boolean;
}

/** `BUSINESS_HOURS` normalised once. Read-only for consumers. */
export const SHOP_HOURS: readonly HoursDay[] = Object.freeze(
  BUSINESS_HOURS.map((h) => ({
    day: h.day,
    label: h.label,
    opens: h.opens,
    closes: h.closes,
    closed: Boolean(h.closed),
  })),
);

export function hoursFor(day: number): HoursDay | null {
  return SHOP_HOURS.find((h) => h.day === day) ?? null;
}

export interface OpenStatus {
  isOpen: boolean;
  /**
   * A design/label string that always includes the clock time, e.g.
   * "Open now · closes 5:00 PM" or "Closed · opens Monday 8:00 AM".
   */
  label: string;
  /** Spoken form for `aria-label` / screen readers. */
  spoken: string;
  /** Ms until the status flips. 0 when open with no upper bound. */
  msUntilChange: number;
  /** Ms until closing, when open. 0 when closed. */
  msUntilClose: number;
  /** True inside the final hour before closing. */
  isClosingSoon: boolean;
  /** Manila wall-clock today, for tests and debug overlays. */
  todayYmd: string;
  currentMinutes: number;
  currentDay: Weekday;
  /** Manila time as a "not hydrated yet" placeholder when `isHydrated` is false. */
  isHydrated: boolean;
  timezone: string;
}

/** Recompute cadence. One second is unnecessary; a minute boundary is enough
 *  for honest copy, and the closing-soon band resolves on a 30s tick. */
const TICK_MS = 15_000;

export type ComputedOpenStatus = Omit<OpenStatus, "isHydrated">;

/**
 * Computes the status for a given instant. Exported so the server component and
 * the client island are guaranteed to agree, and so it can be unit-tested at
 * the awkward moments (11:59 PM, 08:00 sharp).
 */
export function computeOpenStatus(atMs: number): ComputedOpenStatus {
  const shop = toShopParts(atMs);
  const today = hoursFor(shop.day);
  const timezone = TIMEZONE;

  if (!today) {
    return {
      isOpen: false,
      label: "Hours not published — please call",
      spoken: "Opening hours are not published. Please call the shop.",
      msUntilChange: 0,
      msUntilClose: 0,
      isClosingSoon: false,
      todayYmd: shop.ymd,
      currentMinutes: shop.minutes,
      currentDay: shop.day,
      timezone,
    };
  }

  const openNow = !today.closed && shop.minutes >= today.opens && shop.minutes < today.closes;
  const minutesToClose = today.closes - shop.minutes;

  if (openNow) {
    const msUntilClose = Math.max(0, minutesToClose) * MS_PER_MINUTE;
    const isClosingSoon = minutesToClose <= 60;
    const label = isClosingSoon
      ? `Closing in ${minutesToClose} min · closes ${formatMinutes(today.closes)}`
      : `Open now · closes ${formatMinutes(today.closes)}`;
    return {
      isOpen: true,
      label,
      spoken: isClosingSoon
        ? `Open now, closing in ${minutesToClose} minutes at ${formatMinutes(today.closes)}.`
        : `Open now until ${formatMinutes(today.closes)}.`,
      msUntilChange: msUntilClose,
      msUntilClose,
      isClosingSoon,
      todayYmd: shop.ymd,
      currentMinutes: shop.minutes,
      currentDay: shop.day,
      timezone,
    };
  }

  // Closed. Either we are past close today, or we are before open today.
  const pastClose = !today.closed && shop.minutes >= today.closes;
  const nextYmd = pastClose ? addDaysYmd(shop.ymd, 1) : shop.ymd;
  const nextDay = ymdWeekday(nextYmd) ?? shop.day;
  const next = hoursFor(nextDay);
  const isTomorrow = nextYmd !== shop.ymd;

  if (!next || next.closed) {
    // Today (or tomorrow) is a closed day — walk forward to the next open one.
    const found = nextOpenDay(shop.ymd, atMs, 8);
    return {
      isOpen: false,
      label: `Closed · ${found.message}`,
      spoken: `Closed. ${found.message}.`,
      msUntilChange: found.msUntilChange,
      msUntilClose: 0,
      isClosingSoon: false,
      todayYmd: shop.ymd,
      currentMinutes: shop.minutes,
      currentDay: shop.day,
      timezone,
    };
  }

  const targetOpenMs = ymdMidnightUtc(nextYmd) + next.opens * MS_PER_MINUTE;
  const msUntilOpen = Math.max(0, targetOpenMs - atMs);
  const opensAt = formatMinutes(next.opens);
  const dayWord = isTomorrow
    ? "tomorrow"
    : nextDay === shop.day
      ? "today"
      : `${WEEKDAY_LABELS[nextDay] ?? ""}`;
  const opensSoon = msUntilOpen <= 2 * 60 * MS_PER_MINUTE;
  const hours = Math.round(msUntilOpen / (60 * MS_PER_MINUTE));

  return {
    isOpen: false,
    label: opensSoon
      ? `Opens in ${hours <= 0 ? "less than an hour" : `${hours} hour${hours === 1 ? "" : "s"}`}`
      : `Closed · opens ${dayWord === "today" ? "today" : dayWord} at ${opensAt}`,
    spoken: opensSoon
      ? `Closed. Opens in ${hours <= 0 ? "less than an hour" : `${hours} hour${hours === 1 ? "" : "s"}`}.`
      : `Closed. Opens ${dayWord === "today" ? "today" : `on ${dayWord}`} at ${opensAt}.`,
    msUntilChange: msUntilOpen,
    msUntilClose: 0,
    isClosingSoon: false,
    todayYmd: shop.ymd,
    currentMinutes: shop.minutes,
    currentDay: shop.day,
    timezone,
  };
}

/** Manila midnight for a `YYYY-MM-DD`, as epoch ms. */
function ymdMidnightUtc(ymd: string): number {
  return ymdToEpoch(ymd);
}

function nextOpenDay(
  fromYmd: string,
  atMs: number,
  maxDays: number,
): { message: string; msUntilChange: number } {
  for (let offset = 1; offset <= maxDays; offset += 1) {
    const ymd = addDaysYmd(fromYmd, offset);
    const day = ymdWeekday(ymd);
    if (day === null) continue;
    const h = hoursFor(day);
    if (!h || h.closed) continue;
    const label = WEEKDAY_LABELS[day] ?? "the next working day";
    const word = offset === 1 ? "tomorrow" : `on ${label}`;
    const openMs = ymdMidnightUtc(ymd) + h.opens * MS_PER_MINUTE;
    return {
      message: `opens ${word} at ${formatMinutes(h.opens)}`,
      msUntilChange: Math.max(0, openMs - atMs),
    };
  }
  return { message: "hours are not published here — please call", msUntilChange: 0 };
}

export interface UseOpenStatusOptions {
  /**
   * `Date.now()` from the server render. Passed so the first client paint agrees
   * with the server HTML, then replaced by the real client clock after mount.
   */
  serverNowMs?: number | undefined;
  /** Disable the interval (static pages, tests). */
  live?: boolean;
}

export function useOpenStatus(options: UseOpenStatusOptions = {}): OpenStatus {
  const { serverNowMs, live = true } = options;

  // The instant the server rendered at. Frozen for the lifetime of the component
  // so the first client render reproduces the server HTML exactly (no hydration
  // mismatch), then the real device clock takes over after mount.
  const serverMsRef = useRef<number>(
    serverNowMs !== undefined && Number.isFinite(serverNowMs) ? serverNowMs : Date.now(),
  );

  // `null` until after mount, which is what marks the status as not hydrated.
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setNowMs(Date.now());
    if (!live) return;

    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") setNowMs(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live]);

  // Before mount, `nowMs` is null and we fall back to the server's clock so the
  // first client render matches the server HTML exactly (no hydration mismatch).
  // After mount, `nowMs` is the real device clock and the status hydrates.
  const current = useMemo(
    () => computeOpenStatus(nowMs ?? serverMsRef.current),
    [nowMs],
  );

  return useMemo(
    () => ({ ...current, isHydrated: nowMs !== null, timezone: TIMEZONE }),
    [current, nowMs],
  );
}

// ── The seven-day table ─────────────────────────────────────────────────────

export interface OpeningHoursRow {
  day: number;
  label: string;
  shortLabel: string;
  range: string;
  isToday: boolean;
  isClosed: boolean;
  isOpenNow: boolean;
  /** "Opens in 2 hours" / "Closes in 42 minutes" / "Closed today". */
  note: string;
}

/** The next seven days, starting today in Manila. */
export function buildWeek(
  atMs: number = Date.now(),
  nowMs?: number,
): readonly OpeningHoursRow[] {
  const anchor = nowMs ?? atMs;
  const shop = toShopParts(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const ymd = addDaysYmd(shop.ymd, i);
    const day = ymdWeekday(ymd) ?? shop.day;
    const h = hoursFor(day);
    const isToday = i === 0;
    const isClosed = !h || h.closed;
    const isOpenNow =
      isToday && !isClosed && shop.minutes >= h.opens && shop.minutes < h.closes;

    let note: string;
    if (isToday) {
      if (isClosed) note = "Closed today";
      else if (isOpenNow) {
        const mins = h.closes - shop.minutes;
        note = mins <= 60 ? `Closes in ${mins} min` : `Open until ${formatMinutes(h.closes)}`;
      } else {
        const mins = h.opens - shop.minutes;
        note = mins > 0 && mins <= 120 ? `Opens in ${mins} min` : `Opens ${formatMinutes(h.opens)}`;
      }
    } else {
      note = isClosed ? "Closed" : formatHoursRange(h.opens, h.closes);
    }

    return {
      day,
      label: WEEKDAY_LABELS[day] ?? `Day ${day}`,
      shortLabel: weekdayShort(day),
      range: isClosed ? "Closed" : formatHoursRange(h.opens, h.closes),
      isToday,
      isClosed,
      isOpenNow,
      note,
    };
  });
}

/** Convenience wrapper for Server Components. */
export function openStatusServerSide(nowMs: number = Date.now()): ComputedOpenStatus {
  return computeOpenStatus(nowMs);
}

export { todayYmd, MS_PER_DAY };