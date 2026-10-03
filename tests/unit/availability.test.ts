// @vitest-environment node
/**
 * QA & SECURITY AGENT — AVAILABILITY ENGINE.
 * ============================================================================
 * Contract under test: `computeAvailability` in `src/lib/server/slot-math.ts`
 * (pure — no clock, no database, injectable `now`).
 *
 * Rules from `src/config/site.ts` → `BUSINESS_HOURS` + `BOOKING`:
 *   slotMinutes 60 · horizonDays 60 · minLeadMinutes 90 · capacityPerSlot 3
 *   breakWindows [{720,780}] (12:00–13:00 not offered) · Asia/Manila, no DST
 *
 * WHY THIS SUITE IS TZ-POLICE
 * ---------------------------
 * The machine running these tests is not in Manila. A generator that does
 * `new Date(y, m, d, hour)` builds a slot in the *host's* zone: on a CI box in
 * `America/New_York` that is four hours out; on a laptop in `Pacific/Kiritimati`
 * (UTC+14) it is six hours *behind* Manila. The same code would then return a
 * different slot grid on different machines. The timezone-independence block at
 * the bottom re-runs the whole grid under four `process.env.TZ` values and
 * demands byte-identical output.
 *
 * The single most important invariant in the whole project lives here:
 *   **a slot with `capacityLeft <= 0` is NEVER emitted.**
 * A rendered-but-unbookable button is a silent booking failure at the counter.
 * ============================================================================
 */
import { describe, expect, it } from "vitest";

import { BOOKING, BUSINESS_HOURS, TIMEZONE } from "@/config/site";
import { computeAvailability, type DayRule, type FactBase, type SlotRules,  DEFAULT_SLOT_RULES } from "@/lib/server/slot-math";
import type { SlotAvailabilityDto } from "@/lib/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Wednesday 2026-03-11, Manila. Open 08:00–17:00. */
const OPEN_DAY = "2026-03-11";
/** Sunday 2026-03-15, Manila. `closed: true`. */
const CLOSED_DAY = "2026-03-15";

const manila = (iso: string): Date => new Date(iso);

const _WED = BUSINESS_HOURS.find((h) => h.day === 3) as DayRule;
const SUN = BUSINESS_HOURS.find((h) => h.day === 0) as DayRule;

const EMPTY_FACTS: FactBase = { booked: [], closures: [], holiday: null };

const RULES: SlotRules = { ...DEFAULT_SLOT_RULES };

/** The full Wednesday grid as `+08:00` ISO strings. */
const GRID = [
  `${OPEN_DAY}T08:00:00+08:00`,
  `${OPEN_DAY}T09:00:00+08:00`,
  `${OPEN_DAY}T10:00:00+08:00`,
  `${OPEN_DAY}T11:00:00+08:00`,
  `${OPEN_DAY}T13:00:00+08:00`,
  `${OPEN_DAY}T14:00:00+08:00`,
  `${OPEN_DAY}T15:00:00+08:00`,
  `${OPEN_DAY}T16:00:00+08:00`,
];

function board(options: {
  date?: string;
  now: Date;
  facts?: Partial<FactBase>;
  hours?: readonly DayRule[];
  rules?: Partial<SlotRules>;
  capacityPerSlot?: number;
}): SlotAvailabilityDto {
  return computeAvailability({
    dateKey: options.date ?? OPEN_DAY,
    facts: { ...EMPTY_FACTS, ...options.facts },
    hours: options.hours ?? BUSINESS_HOURS,
    rules: { ...RULES, ...options.rules },
    now: options.now,
    ...(options.capacityPerSlot === undefined ? {} : { capacityPerSlot: options.capacityPerSlot }),
  });
}

/** Start instants of a board, as epoch ms, ascending. */
const starts = (result: SlotAvailabilityDto): number[] =>
  result.slots.map((s) => Date.parse(s.startAt));

// ─────────────────────────────────────────────────────────────────────────────

describe("availability — DTO shape", () => {
  it("returns exactly the SlotAvailabilityDto fields", () => {
    const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
    expect(Object.keys(result).sort()).toEqual(
      ["date", "isClosed", "slots", "timezone", "totalCapacity"].sort(),
    );
    expect(result.date).toBe(OPEN_DAY);
    expect(result.timezone).toBe(TIMEZONE);
    expect(result.isClosed).toBe(false);
    expect(result.totalCapacity).toBe(BOOKING.capacityPerSlot);
  });

  it("every SlotDto carries exactly the five contract fields", () => {
    const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
    expect(result.slots.length).toBeGreaterThan(0);
    for (const slot of result.slots) {
      expect(Object.keys(slot).sort()).toEqual(
        ["capacityLeft", "endAt", "isBest", "label", "startAt"].sort(),
      );
    }
  });

  it("a closed day returns slots: [] and isClosed: true — never an error", () => {
    const result = board({ date: CLOSED_DAY, now: manila(`${OPEN_DAY}T00:00:00+08:00`), hours: [SUN] });
    expect(result.isClosed).toBe(true);
    expect(result.slots).toEqual([]);
    expect(result.closedReason ?? "").not.toBe("");
  });
});

describe("availability — exactly one isBest", () => {
  it("marks exactly one slot, the earliest offered one", () => {
    const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
    const best = result.slots.filter((s) => s.isBest);
    expect(best).toHaveLength(1);
    expect(best[0]!.startAt).toBe(result.slots[0]!.startAt);
  });

  it("re-marks the next slot when the earliest is fully booked (no scarcity theatre)", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { booked: [{ startMinute: 8 * 60, count: BOOKING.capacityPerSlot }] },
    });
    const best = result.slots.filter((s) => s.isBest);
    expect(best).toHaveLength(1);
    expect(best[0]!.startAt).toBe(`${OPEN_DAY}T09:00:00+08:00`);
  });

  it("marks zero slots when the day has none", () => {
    const result = board({ date: CLOSED_DAY, now: manila(`${OPEN_DAY}T00:00:00+08:00`), hours: [SUN] });
    expect(result.slots.filter((s) => s.isBest)).toHaveLength(0);
  });

  it("marks exactly one slot in EVERY non-empty state", () => {
    const states: Array<{ now: string; facts?: Partial<FactBase> }> = [
      { now: `${OPEN_DAY}T00:00:00+08:00` },
      { now: `${OPEN_DAY}T06:00:00+08:00` },
      { now: `${OPEN_DAY}T09:00:00+08:00` },
      { now: `${OPEN_DAY}T13:37:12+08:00` },
      { now: `${OPEN_DAY}T23:59:59+08:00` },
      { now: `${OPEN_DAY}T00:00:00+08:00`, facts: { booked: [{ startMinute: 480, count: 3 }, { startMinute: 540, count: 3 }] } },
      { now: `${OPEN_DAY}T00:00:00+08:00`, facts: { closures: [{ title: "Tyre delivery", startMinute: 780, endMinute: 840 }] } },
    ];
    for (const state of states) {
      const result = board({ now: manila(state.now), facts: state.facts });
      if (result.slots.length === 0) {
        expect(result.slots.filter((s) => s.isBest)).toHaveLength(0);
        continue;
      }
      expect(result.slots.filter((s) => s.isBest), `at ${state.now}`).toHaveLength(1);
    }
  });
});

describe("availability — closed days and holidays", () => {
  it("Sunday is closed", () => {
    const result = board({ date: CLOSED_DAY, now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
    expect(result.isClosed).toBe(true);
    expect(result.slots).toHaveLength(0);
    expect(result.closedReason ?? "").toMatch(/sunday/i);
  });

  it("a closed holiday closes the day and names it", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { holiday: { name: "Christmas Day", isClosed: true, note: null } },
    });
    expect(result.isClosed).toBe(true);
    expect(result.slots).toHaveLength(0);
    expect(result.closedReason ?? "").toMatch(/christmas day/i);
  });

  it("a holiday note wins as the closed reason when present", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { holiday: { name: "Christmas Day", isClosed: true, note: "Closed for the holidays." } },
    });
    expect(result.closedReason).toBe("Closed for the holidays.");
  });

  it("a holiday marked isClosed: false does not close the day", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { holiday: { name: "Imported 2027 calendar", isClosed: false, note: null } },
    });
    expect(result.isClosed).toBe(false);
    expect(result.slots.length).toBeGreaterThan(0);
  });

  it("a day with no matching hours row is closed, not a crash", () => {
    const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`), hours: [] });
    expect(result.isClosed).toBe(true);
    expect(result.slots).toHaveLength(0);
  });
});

describe("availability — break windows", () => {
  it("excludes the 12:00 lunch break from an otherwise full day", () => {
    const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
    expect(result.slots.map((s) => s.startAt)).toEqual(GRID);
    expect(result.slots.some((s) => s.startAt === `${OPEN_DAY}T12:00:00+08:00`)).toBe(false);
  });

  it("no slot overlaps ANY configured breakWindow", () => {
    for (const window of BOOKING.breakWindows) {
      const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
      for (const slot of result.slots) {
        const slotStart = Date.parse(slot.startAt);
        const slotEnd = Date.parse(slot.endAt);
        const breakStart = Date.parse(`${OPEN_DAY}T00:00:00+08:00`) + window.start * 60_000;
        const breakEnd = Date.parse(`${OPEN_DAY}T00:00:00+08:00`) + window.end * 60_000;
        expect(slotStart < breakEnd && slotEnd > breakStart, `${slot.startAt} overlaps the break`).toBe(false);
      }
    }
  });

  it("a slot may abut a break exactly (11:00 ends at 12:00 and is offered)", () => {
    const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
    expect(result.slots.some((s) => s.startAt === `${OPEN_DAY}T11:00:00+08:00`)).toBe(true);
  });

  it("a different breakWindow moves the hole", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      rules: { breakWindows: [{ start: 9 * 60, end: 10 * 60 }] },
    });
    expect(result.slots.some((s) => s.startAt === `${OPEN_DAY}T09:00:00+08:00`)).toBe(false);
    expect(result.slots.some((s) => s.startAt === `${OPEN_DAY}T12:00:00+08:00`)).toBe(true);
  });
});

describe("availability — minimum lead time", () => {
  it("withholds every slot starting before now + minLeadMinutes", () => {
    const now = manila(`${OPEN_DAY}T09:00:00+08:00`);
    const result = board({ now });
    const earliest = now.getTime() + BOOKING.minLeadMinutes * 60_000;
    for (const slot of result.slots) {
      expect(Date.parse(slot.startAt), `${slot.startAt} violates minLeadMinutes`).toBeGreaterThanOrEqual(earliest);
    }
    // 09:00 + 90 min = 10:30 → the first 60-minute grid slot is 11:00.
    expect(result.slots[0]?.startAt).toBe(`${OPEN_DAY}T11:00:00+08:00`);
  });

  it("is INCLUSIVE at the exact boundary (start === now + minLeadMinutes is offered)", () => {
    // 09:30 + 90 min lands exactly on 11:00.
    const result = board({ now: manila(`${OPEN_DAY}T09:30:00+08:00`) });
    expect(result.slots[0]?.startAt).toBe(`${OPEN_DAY}T11:00:00+08:00`);
  });

  it("one minute before the boundary is still inside the lead window", () => {
    // 09:29 + 90 min = 10:59, so the 11:00 grid slot is 1 minute away and MUST
    // still be offered. The lead time is a floor on the TARGET, not a ceiling
    // that skips the next slot.
    const result = board({ now: manila(`${OPEN_DAY}T09:29:00+08:00`) });
    expect(result.slots[0]?.startAt).toBe(`${OPEN_DAY}T11:00:00+08:00`);
  });

  it("offers the whole grid once the lead window has passed", () => {
    const result = board({ now: manila(`${OPEN_DAY}T06:00:00+08:00`) });
    expect(result.slots.map((s) => s.startAt)).toEqual(GRID);
  });

  it("does NOT apply lead time to a future date", () => {
    // Tomorrow at 06:00 local: the board must still show the full grid.
    const result = board({ date: "2026-03-12", now: manila(`${OPEN_DAY}T06:00:00+08:00`) });
    expect(result.slots.length).toBe(GRID.length);
  });

  it("closes the day once closing time is inside the lead window", () => {
    // 16:00 + 90 min = 17:30, past the 17:00 close → nothing left today.
    const result = board({ now: manila(`${OPEN_DAY}T16:00:00+08:00`) });
    expect(result.slots).toHaveLength(0);
    expect(result.isClosed).toBe(true);
    expect(result.closedReason ?? "").toMatch(/too late|another date/i);
  });
});

describe("availability — booking horizon", () => {
  // 2026-03-11 is a Wednesday. 59 days later is Saturday 2026-05-09; 66 days
  // later is Saturday 2026-05-16. Saturday is used so the horizon is what closes
  // the day, not the Sunday rule.
  const SAT_59 = "2026-05-09";
  const SAT_66 = "2026-05-16";

  it("refuses a date more than horizonDays out", () => {
    const now = manila(`${OPEN_DAY}T06:00:00+08:00`);
    const result = board({ date: SAT_66, now, rules: { horizonDays: 59 } });
    expect(result.isClosed, "66 days out with horizonDays 59 must be refused").toBe(true);
    expect(result.closedReason ?? "").toMatch(/59\s*days/i);
  });

  it("allows a date exactly horizonDays out", () => {
    const now = manila(`${OPEN_DAY}T06:00:00+08:00`);
    const result = board({ date: SAT_59, now, rules: { horizonDays: 59 } });
    expect(result.isClosed).toBe(false);
    expect(result.slots.length).toBeGreaterThan(0);
  });

  it("the closedReason names the configured horizon in days", () => {
    const now = manila(`${OPEN_DAY}T06:00:00+08:00`);
    const result = board({ date: "2026-06-30", now });
    expect(result.closedReason ?? "").toContain(String(BOOKING.horizonDays));
    expect(result.closedReason ?? "").toMatch(/day/i);
  });

  it("refuses a date in the past", () => {
    const result = board({ date: "2026-01-05", now: manila(`${OPEN_DAY}T06:00:00+08:00`) });
    expect(result.isClosed).toBe(true);
    expect(result.slots).toHaveLength(0);
    expect(result.closedReason ?? "").toMatch(/passed/i);
  });

  it("treats 'today' in Manila, not in the host timezone", () => {
    // 2026-03-10T20:00Z is already 2026-03-11 04:00 in Manila.
    const result = board({ date: OPEN_DAY, now: new Date("2026-03-10T20:00:00Z") });
    expect(result.date).toBe(OPEN_DAY);
    expect(result.slots.length, "Manila 04:00 + 90 min clears the 08:00 open").toBe(GRID.length);
  });
});

describe("availability — capacity", () => {
  it("OMITS a fully-booked slot rather than returning capacityLeft 0", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { booked: [{ startMinute: 9 * 60, count: BOOKING.capacityPerSlot }] },
    });
    expect(result.slots.some((s) => s.startAt === `${OPEN_DAY}T09:00:00+08:00`)).toBe(false);
    expect(result.slots.some((s) => s.capacityLeft <= 0)).toBe(false);
  });

  it("reports the true remainder for a partly-booked slot", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { booked: [{ startMinute: 9 * 60, count: BOOKING.capacityPerSlot - 1 }] },
    });
    const nine = result.slots.find((s) => s.startAt === `${OPEN_DAY}T09:00:00+08:00`);
    expect(nine).toBeDefined();
    expect(nine!.capacityLeft).toBe(1);
  });

  it("sums multiple booking rows for the same slot", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { booked: [{ startMinute: 14 * 60, count: 2 }, { startMinute: 14 * 60, count: 2 }] },
    });
    expect(result.slots.some((s) => s.startAt === `${OPEN_DAY}T14:00:00+08:00`)).toBe(false);
  });

  it("never reports capacityLeft above the configured capacity", () => {
    for (const capacity of [1, 3, 8]) {
      const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`), capacityPerSlot: capacity });
      expect(result.totalCapacity).toBe(capacity);
      for (const slot of result.slots) {
        expect(slot.capacityLeft).toBeGreaterThan(0);
        expect(slot.capacityLeft).toBeLessThanOrEqual(capacity);
      }
    }
  });

  it("over-booking still hides the slot and never goes negative", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { booked: [{ startMinute: 15 * 60, count: BOOKING.capacityPerSlot + 5 }] },
    });
    expect(result.slots.some((s) => s.startAt === `${OPEN_DAY}T15:00:00+08:00`)).toBe(false);
    expect(result.slots.some((s) => s.capacityLeft < 0)).toBe(false);
  });

  it("a capacity of 0 closes the whole day instead of offering dead slots", () => {
    const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`), capacityPerSlot: 0 });
    expect(result.slots).toHaveLength(0);
    expect(result.isClosed).toBe(true);
  });

  it("fills the last free bay and then hides the slot", () => {
    // Start from 3 taken, then add 2 more → 5 > 3 → hidden.
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { booked: [{ startMinute: 10 * 60, count: 3 }, { startMinute: 10 * 60, count: 2 }] },
    });
    expect(result.slots.some((s) => s.startAt === `${OPEN_DAY}T10:00:00+08:00`)).toBe(false);
  });
});

describe("availability — bay closures", () => {
  it("removes every slot that overlaps a bay closure", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { closures: [{ title: "Tyre delivery", startMinute: 13 * 60, endMinute: 14 * 60 }] },
    });
    expect(result.slots.some((s) => s.startAt === `${OPEN_DAY}T13:00:00+08:00`)).toBe(false);
    expect(result.slots.some((s) => s.startAt === `${OPEN_DAY}T14:00:00+08:00`)).toBe(true);
  });

  it("an all-day closure (null bounds) closes the day and titles the reason", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { closures: [{ title: "Flooded bay — no service", startMinute: null, endMinute: null }] },
    });
    expect(result.slots).toHaveLength(0);
    expect(result.isClosed).toBe(true);
    expect(result.closedReason).toBe("Flooded bay — no service");
  });

  it("a closure that swallows opening hours closes the day", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { closures: [{ title: "Bay 2 repaint", startMinute: 0, endMinute: 12 * 60 }] },
    });
    expect(result.slots.map((s) => s.startAt)).toEqual(GRID.filter((s) => s.slice(11, 16) >= "13:00"));
  });
});

describe("availability — day boundary", () => {
  it("never emits a slot that starts at or after closing time", () => {
    const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
    const close = Date.parse(`${OPEN_DAY}T17:00:00+08:00`);
    for (const slot of result.slots) {
      expect(Date.parse(slot.startAt)).toBeLessThan(close);
    }
    expect(result.slots.at(-1)?.startAt).toBe(`${OPEN_DAY}T16:00:00+08:00`);
  });

  it("never emits a slot that ends after closing time", () => {
    for (const hours of [
      { day: 3, label: "18:00 close", opens: 480, closes: 1080 },
      { day: 3, label: "17:00 close", opens: 480, closes: 1020 },
      { day: 3, label: "16:30 close", opens: 480, closes: 990 },
      { day: 3, label: "12:00 close", opens: 480, closes: 720 },
    ]) {
      const result = board({
        now: manila(`${OPEN_DAY}T00:00:00+08:00`),
        hours: [hours as DayRule],
        facts: { holiday: null },
      });
      const close = Date.parse(`${OPEN_DAY}T00:00:00+08:00`) + hours.closes * 60_000;
      for (const slot of result.slots) {
        expect(Date.parse(slot.endAt), `${slot.startAt}-${slot.endAt} past ${hours.label}`).toBeLessThanOrEqual(close);
      }
    }
  });

  it("the last offered slot always ends at or before closing, for EVERY close and step", () => {
    // This is the real day-boundary property, and it is table-driven because the
    // classic bug is the loop `for (t = opens; t <= closes; t += step)`, which
    // offers a slot that runs past closing. Long services make it worse: a
    // 90-minute service at 16:00 ends 17:30.
    const cases: ReadonlyArray<{ opens: number; closes: number; slotMinutes: number }> = [
      { opens: 480, closes: 1020, slotMinutes: 60 },
      { opens: 480, closes: 1020, slotMinutes: 90 },
      { opens: 480, closes: 1020, slotMinutes: 120 },
      { opens: 480, closes: 1080, slotMinutes: 90 },
      { opens: 480, closes: 990, slotMinutes: 60 },
      { opens: 480, closes: 990, slotMinutes: 30 },
      { opens: 480, closes: 1050, slotMinutes: 30 },
      { opens: 480, closes: 720, slotMinutes: 60 },
      { opens: 480, closes: 600, slotMinutes: 60 },
    ];
    for (const c of cases) {
      const result = board({
        now: manila(`${OPEN_DAY}T00:00:00+08:00`),
        hours: [{ day: 3, label: `${c.opens}-${c.closes}`, opens: c.opens, closes: c.closes }],
        rules: { slotMinutes: c.slotMinutes, breakWindows: [] },
      });
      const close = Date.parse(`${OPEN_DAY}T00:00:00+08:00`) + c.closes * 60_000;
      for (const slot of result.slots) {
        expect(
          Date.parse(slot.endAt),
          `${c.opens}-${c.closes}/${c.slotMinutes}: ${slot.startAt}–${slot.endAt} runs past closing`,
        ).toBeLessThanOrEqual(close);
      }
      const last = result.slots.at(-1);
      if (last) {
        // The NEXT grid slot must have been rejected — i.e. the boundary is
        // exactly tight, not arbitrarily loose.
        const nextStart = Date.parse(last.endAt);
        expect(nextStart, "a slot was offered after the last valid grid position").toBeLessThanOrEqual(close);
        expect(nextStart + c.slotMinutes * 60_000).toBeGreaterThan(close);
      }
    }
  });

  it("a 90-minute service at 16:00 is offered when the shop closes at 18:00", () => {
    // 30-minute grid so 16:00 is on the grid: 16:00 + 90 = 17:30 <= 18:00.
    const grid = (closes: number) =>
      board({
        now: manila(`${OPEN_DAY}T00:00:00+08:00`),
        hours: [{ day: 3, label: "probe", opens: 480, closes }],
        rules: { slotMinutes: 30, breakWindows: [] },
      });
    const at18 = grid(1080);
    const at17 = grid(1020);
    const s1600 = `${OPEN_DAY}T16:00:00+08:00`;
    const s1630 = `${OPEN_DAY}T16:30:00+08:00`;
    // A 30-minute slot at 16:30 ends 17:00: fine for an 18:00 close, and fine
    // for a 17:00 close too (exactly). The next one, 17:00–17:30, is the one an
    // 18:00 close allows and a 17:00 close must refuse.
    expect(at18.slots.some((s) => s.startAt === s1600)).toBe(true);
    expect(at17.slots.some((s) => s.startAt === s1600)).toBe(true);
    expect(at18.slots.some((s) => s.startAt === s1630)).toBe(true);
    expect(at18.slots.some((s) => s.startAt === `${OPEN_DAY}T17:00:00+08:00`)).toBe(true);
    expect(at17.slots.some((s) => s.startAt === `${OPEN_DAY}T17:00:00+08:00`)).toBe(false);
  });

  it("a 90-minute grid never offers a 16:00 start — 15:30 is the last 90-minute block", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      rules: { slotMinutes: 90, breakWindows: [] },
    });
    expect(result.slots.at(-1)?.startAt).toBe(`${OPEN_DAY}T15:30:00+08:00`);
    expect(result.slots.some((s) => s.startAt === `${OPEN_DAY}T16:00:00+08:00`)).toBe(false);
  });

  it("a close earlier than one slot leaves the day empty rather than negative", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      hours: [{ day: 3, label: "Closed", opens: 480, closes: 480 }],
    });
    expect(result.slots).toHaveLength(0);
    expect(result.isClosed).toBe(true);
  });
});

describe("availability — labels, offsets and ordering", () => {
  it("labels each slot with its Manila wall clock, 12-hour", () => {
    const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
    expect(result.slots.map((s) => s.label)).toEqual([
      "8:00 AM",
      "9:00 AM",
      "10:00 AM",
      "11:00 AM",
      "1:00 PM",
      "2:00 PM",
      "3:00 PM",
      "4:00 PM",
    ]);
  });

  it("every timestamp carries an explicit +08:00 offset and the right calendar day", () => {
    for (const day of [OPEN_DAY, "2026-03-12", "2026-03-13"]) {
      const result = board({ date: day, now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
      for (const slot of result.slots) {
        expect(slot.startAt).toMatch(/[+-]08:00$/);
        expect(slot.endAt).toMatch(/[+-]08:00$/);
        expect(slot.startAt.slice(0, 10)).toBe(day);
      }
    }
  });

  it("slots are strictly increasing and never overlap", () => {
    for (const day of [OPEN_DAY, "2026-03-12", "2026-03-14"]) {
      const list = starts(board({ date: day, now: manila(`${OPEN_DAY}T00:00:00+08:00`) }));
      for (let i = 1; i < list.length; i += 1) {
        expect(list[i]!).toBeGreaterThan(list[i - 1]!);
      }
    }
    const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
    for (let i = 1; i < result.slots.length; i += 1) {
      expect(Date.parse(result.slots[i]!.startAt)).toBeGreaterThanOrEqual(Date.parse(result.slots[i - 1]!.endAt));
    }
  });

  it("every slot is exactly slotMinutes long", () => {
    const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
    for (const slot of result.slots) {
      expect(Date.parse(slot.endAt) - Date.parse(slot.startAt)).toBe(BOOKING.slotMinutes * 60_000);
    }
  });

  it("caps the board at maxSlots so the response stays small", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      hours: [{ day: 3, label: "24h", opens: 0, closes: 1440 }],
      rules: { breakWindows: [], slotMinutes: 15, maxSlots: 6 },
    });
    expect(result.slots).toHaveLength(6);
  });
});

describe("availability — timezone independence", () => {
  const ZONES = ["Pacific/Kiritimati", "Pacific/Niue", "UTC", "America/New_York"] as const;

  it("produces an identical board under four host timezones", () => {
    const original = process.env.TZ;
    const snapshots: Record<string, string> = {};
    try {
      for (const zone of ZONES) {
        process.env.TZ = zone;
        snapshots[zone] = JSON.stringify(
          board({
            now: manila(`${OPEN_DAY}T09:00:00+08:00`),
            facts: { booked: [{ startMinute: 10 * 60, count: 1 }] },
          }),
        );
      }
    } finally {
      process.env.TZ = original;
    }
    const reference = snapshots["UTC"]!;
    for (const zone of ZONES) {
      expect(snapshots[zone], `board differs under TZ=${zone}`).toBe(reference);
    }
  });

  it("anchors the grid to Asia/Manila on a UTC+14 host", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Kiritimati";
      const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
      expect(result.slots[0]?.startAt).toBe(`${OPEN_DAY}T08:00:00+08:00`);
      expect(result.timezone).toBe(TIMEZONE);
    } finally {
      process.env.TZ = original;
    }
  });

  it("anchors the grid to Asia/Manila on a UTC-11 host", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Niue";
      const result = board({ now: manila(`${OPEN_DAY}T00:00:00+08:00`) });
      expect(result.slots[0]?.startAt).toBe(`${OPEN_DAY}T08:00:00+08:00`);
    } finally {
      process.env.TZ = original;
    }
  });

  it("the same `now` epoch produces the same board regardless of host zone", () => {
    const original = process.env.TZ;
    const epoch = Date.parse(`${OPEN_DAY}T13:37:12+08:00`);
    let first = "";
    let second = "";
    try {
      process.env.TZ = "UTC";
      first = JSON.stringify(board({ now: new Date(epoch) }));
      process.env.TZ = "America/New_York";
      second = JSON.stringify(board({ now: new Date(epoch) }));
    } finally {
      process.env.TZ = original;
    }
    expect(second).toBe(first);
  });
});

describe("availability — input hardening", () => {
  it("ignores booking rows for minutes that are not offered slots", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { booked: [{ startMinute: 12 * 60, count: 3 }] }, // inside the break
    });
    expect(result.slots.map((s) => s.startAt)).toEqual(GRID);
  });

  it("a nonsense slotMinutes cannot produce an infinite loop", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      rules: { slotMinutes: 0 },
    });
    expect(Array.isArray(result.slots)).toBe(true);
  });

  it("a huge slotMinutes leaves the day empty rather than offering an over-long slot", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      rules: { slotMinutes: 10_000 },
    });
    expect(result.slots).toHaveLength(0);
    expect(result.isClosed).toBe(true);
  });

  it("is deterministic: the same input twice yields the same board", () => {
    const a = board({ now: manila(`${OPEN_DAY}T09:00:00+08:00`) });
    const b = board({ now: manila(`${OPEN_DAY}T09:00:00+08:00`) });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("returns no field that could leak another customer's identity", () => {
    const result = board({
      now: manila(`${OPEN_DAY}T00:00:00+08:00`),
      facts: { booked: [{ startMinute: 9 * 60, count: 2 }] },
    });
    const serialised = JSON.stringify(result);
    expect(serialised).not.toMatch(/customerName|customerPhone|reference|plate|notes/i);
  });
});