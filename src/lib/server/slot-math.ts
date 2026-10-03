/**
 * AVAILABILITY — PURE SLOT MATH
 * ============================================================================
 * No database access, no clock reads, no randomness. It takes the shop's
 * configuration plus the facts already read from the database and returns the
 * exact `SlotAvailabilityDto` the API must return.
 *
 * Keeping it pure is a deliberate correctness choice: capacity, breaks,
 * closures, lead time and the "recommended" slot are the parts of a booking
 * system that quietly go wrong, and this way `tests/availability.test.ts` (QA)
 * can prove them with table-driven cases and no database fixture.
 *
 * The entry point other agents should use is `computeAvailability` below; the
 * DB-backed wrapper that feeds it lives in `availability.ts`.
 *
 * NOTE: deliberately NOT `import "server-only"`. This module holds no secrets
 * and touches no database, and the `server-only` guard resolves to a throwing
 * stub outside the Next.js compiler — which would make the pure maths
 * untestable under plain `vitest`/`tsx`. `availability.ts` (the DB wrapper) does
 * carry the guard.
 */
import { BOOKING, BUSINESS_HOURS } from "@/config/site";
import type { SlotAvailabilityDto, SlotDto } from "@/lib/types";
import {
  MINUTES_PER_DAY,
  SHOP_TIMEZONE,
  dateKeyOf,
  dayOfWeekOfKey,
  diffDays,
  formatSlotLabel,
  isoWithOffset,
  localMinutesToUtc,
  minutesSinceLocalMidnight,
  type LocalDateKey,
} from "@/lib/server/time";
/**
 * Booking statuses that still consume a bay.
 * CANCELLED / NO_SHOW / RESCHEDULED release their capacity, so they are absent
 * here by design — a cancelled 3 p.m. slot must reappear on the board.
 */
export const ACTIVE_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "READY",
] as const;
export type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

export interface DayRule {
  day: number;
  label: string;
  opens: number;
  closes: number;
  closed?: boolean;
}

export interface BreakWindow {
  start: number;
  end: number;
}

export interface SlotRules {
  slotMinutes: number;
  capacityPerSlot: number;
  minLeadMinutes: number;
  horizonDays: number;
  breakWindows: readonly BreakWindow[];
  /** Hard cap on emitted slot chips, bounding response size. */
  maxSlots: number;
}

export const DEFAULT_SLOT_RULES: SlotRules = {
  slotMinutes: BOOKING.slotMinutes,
  capacityPerSlot: BOOKING.capacityPerSlot,
  minLeadMinutes: BOOKING.minLeadMinutes,
  horizonDays: BOOKING.horizonDays,
  breakWindows: BOOKING.breakWindows,
  maxSlots: 24,
};

export interface BayClosureFact {
  title: string;
  /** Minutes from local midnight; `null` means the whole day. */
  startMinute: number | null;
  endMinute: number | null;
}

export interface FactBase {
  /** Active bookings for the local date: start minute + how many. */
  booked: ReadonlyArray<{ startMinute: number; count: number }>;
  /** Bay closures that overlap the local date. */
  closures: ReadonlyArray<BayClosureFact>;
  /** Holiday row for the local date, if any. */
  holiday: { name: string; isClosed: boolean; note: string | null } | null;
}

export interface ComputeAvailabilityInput {
  dateKey: LocalDateKey;
  facts: FactBase;
  rules?: SlotRules;
  hours?: readonly DayRule[];
  /** Injectable clock — required for deterministic tests. */
  now?: Date;
  /** Overrides the configured capacity when a real bay count is known. */
  capacityPerSlot?: number;
}

export function hoursForDay(day: number, hours: readonly DayRule[] = BUSINESS_HOURS): DayRule | undefined {
  return hours.find((h) => h.day === day);
}

/** Break window overlapping `[start, end)`. */
function overlapsBreak(start: number, end: number, breaks: readonly BreakWindow[]): boolean {
  return breaks.some((b) => start < b.end && end > b.start);
}

/** Bay closure overlapping `[start, end)`. `null` bounds mean all-day. */
function closureOverlapping(start: number, end: number, closures: readonly BayClosureFact[]): BayClosureFact | null {
  for (const c of closures) {
    if (c.startMinute === null || c.endMinute === null) return c;
    if (start < c.endMinute && end > c.startMinute) return c;
  }
  return null;
}

/**
 * Compute the availability DTO for one local date.
 *
 * Invariants — all load-bearing:
 *  - A slot with `capacityLeft <= 0` is NEVER emitted.
 *  - Exactly one slot carries `isBest: true`, and it is the EARLIEST bookable
 *    slot with capacity. No scarcity theatre.
 *  - Nothing about another customer is exposed — only a count.
 *  - A closed day returns `isClosed: true` with a human-readable reason and an
 *    empty `slots` array, never an error.
 */
export function computeAvailability(input: ComputeAvailabilityInput): SlotAvailabilityDto {
  const rules = input.rules ?? DEFAULT_SLOT_RULES;
  const dayRules: readonly DayRule[] = input.hours ?? (BUSINESS_HOURS as readonly DayRule[]);
  const now = input.now ?? new Date();
  const capacity = Math.max(0, input.capacityPerSlot ?? rules.capacityPerSlot);
  const { dateKey, facts } = input;

  const closed = (reason: string): SlotAvailabilityDto => ({
    date: dateKey,
    timezone: SHOP_TIMEZONE,
    totalCapacity: capacity,
    slots: [],
    isClosed: true,
    closedReason: reason,
  });

  // 1. A holiday with `isClosed` outranks everything else.
  if (facts.holiday?.isClosed) {
    return closed(facts.holiday.note ?? `Closed for ${facts.holiday.name}.`);
  }

  // 2. Day-of-week rule (Sunday is closed in BUSINESS_HOURS).
  const dow = dayOfWeekOfKey(dateKey);
  const rule = hoursForDay(dow, dayRules);
  if (!rule || rule.closed) return closed(`Closed on ${rule?.label ?? "this day"}.`);

  // 3. Horizon — we do not publish a board further out than we take bookings.
  const todayKey = dateKeyOf(now);
  const offsetDays = diffDays(dateKey, todayKey);
  if (offsetDays < 0) return closed("That date has already passed.");
  if (offsetDays > rules.horizonDays) {
    return closed(`We only take bookings up to ${rules.horizonDays} days ahead.`);
  }

  // 4. Candidate grid, minus everything unavailable.
  const nowMinute = minutesSinceLocalMidnight(now);
  const isToday = offsetDays === 0;
  const earliest = isToday ? nowMinute + rules.minLeadMinutes : 0;
  const step = Math.max(5, rules.slotMinutes);

  const candidates: number[] = [];
  for (let start = rule.opens; start + step <= rule.closes; start += step) {
    if (isToday && start + step > rule.closes) break;
    if (start < earliest) continue;
    if (overlapsBreak(start, start + step, rules.breakWindows)) continue;
    if (closureOverlapping(start, start + step, facts.closures)) continue;
    candidates.push(start);
  }

  const slots: SlotDto[] = [];
  let bestMarked = false;

  for (const start of candidates) {
    if (slots.length >= rules.maxSlots) break;
    const taken = facts.booked
      .filter((b) => b.startMinute === start)
      .reduce((sum, b) => sum + b.count, 0);
    const capacityLeft = capacity - taken;
    // NEVER expose a full slot. Silence beats a 409 at submit time.
    if (capacityLeft <= 0) continue;

    const isBest = !bestMarked;
    if (isBest) bestMarked = true;
    slots.push({
      startAt: isoWithOffset(localMinutesToUtc(dateKey, start)),
      endAt: isoWithOffset(localMinutesToUtc(dateKey, start + step)),
      label: formatSlotLabel(dateKey, start),
      capacityLeft,
      isBest,
    });
  }

  if (slots.length > 0) {
    return { date: dateKey, timezone: SHOP_TIMEZONE, totalCapacity: capacity, slots, isClosed: false };
  }

  return closed(
    closedReasonFor({ rule, isToday, nowMinute, rules, facts }),
  );
}

function closedReasonFor(ctx: {
  rule: DayRule;
  isToday: boolean;
  nowMinute: number;
  rules: SlotRules;
  facts: FactBase;
}): string {
  if (ctx.isToday && ctx.nowMinute + ctx.rules.minLeadMinutes >= ctx.rule.opens) {
    return "It is too late today — please pick another date.";
  }
  const allDay = ctx.facts.closures.find((c) => c.startMinute === null || c.endMinute === null);
  if (allDay) return allDay.title;
  return "No slots left for this date. Please try another day.";
}

/** Number of bookable bays for the shop, used by `/api/health`. */
export function configuredCapacity(rules: SlotRules = DEFAULT_SLOT_RULES): number {
  return rules.capacityPerSlot;
}

export { MINUTES_PER_DAY };
