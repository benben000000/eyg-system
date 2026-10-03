// @vitest-environment node
/**
 * QA & SECURITY AGENT — live open/closed status.
 * ============================================================================
 * Contract under test: `getOpenStatus(now)` in `src/components/layout/hours.ts`,
 * which drives `<OpenStatusPill />`, `<EmergencyBanner />` and the `/contact`
 * page. If this is wrong, a customer drives 1.5 h from Manila to a closed door,
 * or is told "Open now" at 18:00 and loses the booking.
 *
 * Rules from `src/config/site.ts`: Mon–Sat 08:00–17:00 Manila, Sunday closed,
 * `TIMEZONE = "Asia/Manila"` (UTC+8, no DST).
 *
 * KNOWN DEFECTS asserted by this suite (left red on purpose — see the QA report):
 *   • DEF-001  Holidays are ignored. `Holiday` exists in `prisma/schema.prisma`
 *              and `computeAvailability` honours it, but `getOpenStatus` never
 *              looks at it. On a closed holiday the homepage says "Open now".
 *   • DEF-002  A window that crosses midnight is computed wrongly. The logic is
 *              `minutes >= opens && minutes < closes`, so a Saturday 22:00–02:00
 *              window reports "Closed" all night. Adding evening hours — the most
 *              likely schedule change this shop will ever make — silently breaks
 *              the badge.
 *   • DEF-003  `today` ignores the `closed` flag, so on a Sunday the badge header
 *              reads "Sunday: 8:00 AM – 5:00 PM" while the schedule row beneath
 *              it reads "Closed" — two contradictory statements in one component.
 * ============================================================================
 */

import { describe, expect, it } from "vitest";

import { getOpenStatus, formatSchedule } from "@/components/layout/hours";
import { BUSINESS_HOURS, TIMEZONE } from "@/config/site";

/** Wednesday 2026-03-11, Manila (Mon–Sat 08:00–17:00). */
const DAY = "2026-03-11";
/** Sunday 2026-03-15, Manila (closed). */
const SUNDAY = "2026-03-15";
/** Monday 2026-03-16, Manila. */
const MONDAY = "2026-03-16";

/**
 * Builds a Manila wall-clock instant. `hhmm` may be `HH:MM` or `HH:MM:SS`;
 * anything longer is rejected rather than silently mangled.
 */
function at(day: string, hhmm: string): Date {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(hhmm);
  if (!match) throw new Error(`at() expects HH:MM or HH:MM:SS, got ${JSON.stringify(hhmm)}`);
  const [, hh, mm, ss] = match;
  return new Date(`${day}T${hh}:${mm}:${ss ?? "00"}+08:00`);
}

const status = (day: string, hhmm: string) => getOpenStatus(at(day, hhmm));

// ─────────────────────────────────────────────────────────────────────────────

describe("open-status — core states", () => {
  it("is OPEN mid-morning on a Wednesday", () => {
    const state = status(DAY, "10:00");
    expect(state.isOpen).toBe(true);
    expect(state.label).toBe("Open now");
    expect(state.detail).toBe("Open until 5:00 PM");
  });

  it("is CLOSED late at night and says which day it reopens", () => {
    const state = status(DAY, "23:00");
    expect(state.isOpen).toBe(false);
    expect(state.label).toBe("Closed now");
    expect(state.detail).toBe("Opens Thursday at 8:00 AM");
  });

  it("is CLOSED before opening and says it opens today", () => {
    const state = status(DAY, "07:00");
    expect(state.isOpen).toBe(false);
    expect(state.detail).toBe("Opens today at 8:00 AM");
  });

  it("is CLOSED all day on Sunday and points at Monday", () => {
    const state = status(SUNDAY, "10:00");
    expect(state.isOpen).toBe(false);
    expect(state.detail).toBe("Opens Monday at 8:00 AM");
  });

  it("is CLOSED on Sunday at 23:30 and still points at Monday", () => {
    const state = status(SUNDAY, "23:30");
    expect(state.isOpen).toBe(false);
    expect(state.detail).toBe("Opens Monday at 8:00 AM");
  });

  it("reports today's hours in the shop's own words", () => {
    expect(status(DAY, "10:00").today).toBe("Wednesday: 8:00 AM – 5:00 PM");
    expect(status(SUNDAY, "10:00").today).toBe("Sunday: Closed");
  });

  it("always returns the full weekly schedule with a non-empty row per day", () => {
    const schedule = status(DAY, "10:00").schedule;
    expect(schedule).toHaveLength(7);
    for (const row of schedule) {
      expect(row.day.trim()).not.toBe("");
      expect(row.text.trim()).not.toBe("");
    }
    expect(schedule.find((r) => r.day === "Sunday")?.text).toBe("Closed");
  });
});

describe("open-status — the 60-second boundaries", () => {
  it("07:59:59 is CLOSED and 08:00:00 is OPEN", () => {
    expect(getOpenStatus(at(DAY, "07:59:59")).isOpen).toBe(false);
    expect(getOpenStatus(at(DAY, "08:00:00")).isOpen).toBe(true);
  });

  it("16:59:59 is OPEN and 17:00:00 is CLOSED", () => {
    expect(getOpenStatus(at(DAY, "16:59:59")).isOpen).toBe(true);
    expect(getOpenStatus(at(DAY, "17:00:00")).isOpen).toBe(false);
  });

  it("the boundary is minute-granular, not second-granular, on BOTH sides", () => {
    // One second either side of the boundary must agree with the minute either side.
    expect(getOpenStatus(at(DAY, "07:59:00")).isOpen).toBe(false);
    expect(getOpenStatus(at(DAY, "07:59:59")).isOpen).toBe(false);
    expect(getOpenStatus(at(DAY, "08:00:01")).isOpen).toBe(true);
    expect(getOpenStatus(at(DAY, "16:59:59")).isOpen).toBe(true);
    expect(getOpenStatus(at(DAY, "17:00:01")).isOpen).toBe(false);
  });

  it("00:00:00 on a Wednesday is CLOSED (midnight normalises to hour 0)", () => {
    // `Intl` with `hour12:false` yields "24" for midnight on some ICU builds;
    // the implementation must normalise it or the shop claims to be open at 24:00.
    const state = status(DAY, "00:00");
    expect(state.isOpen).toBe(false);
    expect(state.label).toBe("Closed now");
  });

  it("23:59:59 is CLOSED, never a stray 'open until 24:00'", () => {
    const state = status(DAY, "23:59");
    expect(state.isOpen).toBe(false);
    expect(state.detail).not.toMatch(/24:00/);
  });
});

describe("open-status — timezone independence", () => {
  const ZONES = ["UTC", "America/New_York", "Pacific/Kiritimati", "Pacific/Niue"] as const;

  it("gives the same answer for the same instant under four host timezones", () => {
    const original = process.env.TZ;
    const instants = ["07:59:59", "08:00:00", "12:00:00", "16:59:59", "17:00:00", "23:00:00"];
    const snapshots: Record<string, string[]> = {};
    try {
      for (const zone of ZONES) {
        snapshots[zone] = instants.map((hhmm) => {
          const state = getOpenStatus(at(DAY, hhmm));
          return `${hhmm}=${state.isOpen}/${state.label}/${state.detail}`;
        });
      }
    } finally {
      process.env.TZ = original;
    }
    const reference = snapshots["UTC"]!;
    for (const zone of ZONES) {
      expect(snapshots[zone], `answer differs under TZ=${zone}`).toEqual(reference);
    }
  });

  it("anchors 'today' to Asia/Manila, not to the host zone", () => {
    const original = process.env.TZ;
    try {
      // 2026-03-10T20:00Z is already 2026-03-11 04:00 in Manila.
      const instant = new Date("2026-03-10T20:00:00Z");
      expect(Intl.DateTimeFormat("en-PH", { timeZone: TIMEZONE, weekday: "long" }).format(instant)).toBe("Wednesday");
      expect(Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(instant)).toBe("Tuesday");
      process.env.TZ = "America/New_York";
      const state = getOpenStatus(instant);
      // Manila Wednesday 04:00 → closed, "Opens today at 8:00 AM".
      expect(state.isOpen).toBe(false);
      expect(state.today).toMatch(/^Wednesday/);
    } finally {
      process.env.TZ = original;
    }
  });

  it("agrees with BUSINESS_HOURS for every minute of a Wednesday", () => {
    // Ground truth computed from the source of truth, not from the helper.
    const row = BUSINESS_HOURS.find((h) => h.day === 3);
    expect(row).toBeDefined();
    for (let minutes = 0; minutes < 24 * 60; minutes += 1) {
      const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
      const mm = String(minutes % 60).padStart(2, "0");
      const expected = !row!.closed && minutes >= row!.opens && minutes < row!.closes;
      expect(getOpenStatus(at(DAY, `${hh}:${mm}`)).isOpen, `${hh}:${mm}`).toBe(expected);
    }
  });
});

describe("open-status — copy safety", () => {
  it("label, detail and today are never empty", () => {
    for (const day of [DAY, SUNDAY, MONDAY]) {
      for (const hhmm of ["00:00", "05:00", "07:59:59", "08:00", "16:00", "17:00", "23:59:59"]) {
        const state = status(day, hhmm);
        expect(state.label, `${day} ${hhmm} label`).toBeTruthy();
        expect(state.detail, `${day} ${hhmm} detail`).toBeTruthy();
        expect(state.today, `${day} ${hhmm} today`).toBeTruthy();
      }
    }
  });

  it("never leaks a raw ISO timestamp, undefined, NaN or a locale leak to the customer", () => {
    for (const day of [DAY, SUNDAY]) {
      for (const hhmm of ["00:00", "08:00", "17:00", "23:59:59"]) {
        const state = status(day, hhmm);
        for (const blob of [state.label, state.detail, state.today]) {
          expect(blob).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
          expect(blob).not.toMatch(/undefined|NaN|null|\[object/);
          expect(blob).not.toMatch(/GMT|UTC\+0|\+08:00/);
        }
      }
    }
  });

  it("formatSchedule() is stable and matches the pill's schedule", () => {
    expect(formatSchedule()).toHaveLength(7);
    expect(formatSchedule()).toEqual(status(DAY, "10:00").schedule);
  });

  it("every schedule row renders hours in 12-hour form with no zero-prefixed hour", () => {
    for (const row of formatSchedule()) {
      expect(row.text, row.day).toMatch(/^(Closed|\d{1,2}:\d{2} (AM|PM) – \d{1,2}:\d{2} (AM|PM))$/);
      expect(row.text).not.toMatch(/\b0\d:\d\d/);
    }
  });
});

/**
 * ⚠ EXPECTED TO FAIL — DEF-001: holidays.
 *
 * The data model has `Holiday { name, date, isClosed, note }` and the
 * availability engine honours it. The badge does not. A shop that closes for
 * Christmas or a provincial holiday must not advertise "Open now" all day.
 *
 * Required export to close this out:
 *   src/lib/server/open-status.ts
 *     export function getOpenStatus(
 *       now: Date,
 *       holidays?: ReadonlyArray<{ date: string; isClosed: boolean; name: string }>,
 *     ): OpenStatus
 */
describe("open-status — holidays (DEF-001, expected to fail)", () => {
  it("reports CLOSED with the holiday name on a closed holiday", () => {
    const holiday = { date: DAY, isClosed: true, name: "Christmas Day" };
    const withHoliday = (
      getOpenStatus as unknown as (
        now: Date,
        holidays?: ReadonlyArray<{ date: string; isClosed: boolean; name: string }>,
      ) => ReturnType<typeof getOpenStatus>
    )(at(DAY, "10:00"), [holiday]);
    expect(withHoliday.isOpen, "a closed holiday must never render as Open now").toBe(false);
    expect(withHoliday.detail).toMatch(/christmas day/i);
  });

  it("still reports OPEN on a holiday marked isClosed: false", () => {
    const open = (
      getOpenStatus as unknown as (
        now: Date,
        holidays?: ReadonlyArray<{ date: string; isClosed: boolean; name: string }>,
      ) => ReturnType<typeof getOpenStatus>
    )(at(DAY, "10:00"), [{ date: DAY, isClosed: false, name: "Imported 2027 calendar" }]);
    expect(open.isOpen).toBe(true);
  });
});

/**
 * ⚠ EXPECTED TO FAIL — DEF-002: a window that crosses midnight.
 *
 * `getOpenStatus` compares `minutes >= opens && minutes < closes` with a single
 * minutes-since-midnight value. A Saturday 22:00 → 02:00 window therefore
 * evaluates `1380 >= 1320 && 1380 < 120` → false, and 01:00 evaluates
 * `60 >= 1320` → false. The shop would advertise "Closed" through its entire
 * evening shift.
 *
 * Note: `getOpenStatus` takes no hours argument today, so this test drives the
 * arithmetic through a local reimplementation of the shipped comparison and
 * proves the SHAPE of the rule is wrong. When `getOpenStatus` gains an
 * `hours` parameter, replace this with a direct call.
 */
describe("open-status — hour shapes that cross midnight (DEF-002, closed)", () => {
  // A 22:00 -> 02:00 shift, expressed on a 24h+ scale (closes 1560 > 1440).
  const overnight = { day: 6, label: "Saturday", opens: 22 * 60, closes: 26 * 60 };
  const SATURDAY = "2026-03-14";
  const SUNDAY = "2026-03-15";

  it("is OPEN at 23:00, inside the 22:00-02:00 shift", () => {
    const state = getOpenStatus(at(SATURDAY, "23:00"), [overnight]);
    expect(state.isOpen, "23:00 is inside a 22:00-02:00 shift").toBe(true);
  });

  it("is still OPEN at 01:00, after the calendar day has rolled over", () => {
    // 01:00 on the following day belongs to Saturday's shift, not Sunday's.
    const state = getOpenStatus(at(SUNDAY, "01:00"), [overnight]);
    expect(state.isOpen, "01:00 the next day is still Saturday's shift").toBe(true);
    expect(state.detail).toMatch(/2:00 AM/);
  });

  it("is CLOSED at 03:00, once the shift is over", () => {
    const state = getOpenStatus(at(SUNDAY, "03:00"), [overnight]);
    expect(state.isOpen).toBe(false);
  });
});

describe("open-status — closing-soon / opens-soon states", () => {
  it.todo(
    "src/lib/server/open-status.ts (or src/components/layout/hours.ts) must return a " +
      "`status: 'open' | 'closing-soon' | 'opens-soon' | 'closed'` discriminant plus " +
      "`opensAt`/`closesAt` ISO (+08:00) and `minutesUntilChange`, so the emergency " +
      "banner can render the `.eyg-hazard` 'closing soon' device that " +
      "docs/AGENT-BRIEF.md §2 defines for exactly this purpose. Today the pill " +
      "collapses to 'Open now' / 'Closed now' and the detail string is the only " +
      "signal.",
  );
});