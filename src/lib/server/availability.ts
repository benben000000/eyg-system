/**
 * AVAILABILITY — the scheduling engine.
 * ============================================================================
 * Reads the facts (business hours overrides, holidays, bay closures, existing
 * bookings) and hands them to the pure slot maths in `slot-math.ts`.
 *
 * Responsibilities kept here and nowhere else:
 *  - **Timezone-explicit queries.** Bookings are stored as UTC `DateTime`, but
 *    the shop thinks in Manila days. Every query is bracketed by
 *    `[localMidnightUtc, nextLocalMidnightUtc)` computed by `localMinutesToUtc`,
 *    never by the server's local timezone. See `time.ts` for the long story.
 *  - **Availability overrides.** `BusinessHours` rows replace `BUSINESS_HOURS`
 *    from `site.ts` when present, so the shop can change hours without a deploy.
 *  - **A 5-minute in-process cache** keyed by date + sorted service ids. The
 *    board is expensive (4 queries) and customers refresh it constantly; five
 *    minutes of staleness is invisible and the submit path re-checks capacity
 *    inside a serialisable transaction anyway.
 *
 * Re-exports the pure API so other agents only ever import from here.
 */
import "server-only";

import { BOOKING, BUSINESS_HOURS } from "@/config/site";
import { logger } from "@/lib/logger";
import type { SlotAvailabilityDto, SlotQuery } from "@/lib/types";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";
import {
  ACTIVE_STATUSES,
  DEFAULT_SLOT_RULES,
  computeAvailability,
  hoursForDay,
  type BayClosureFact,
  type DayRule,
  type FactBase,
  type SlotRules,
} from "@/lib/server/slot-math";
import { dateKeyOf, isValidDateKey, localMinutesToUtc, minutesSinceLocalMidnight, parseHhmm } from "@/lib/server/time";

const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_ENTRIES = 256;

interface CacheEntry {
  value: SlotAvailabilityDto;
  expiresAt: number;
}

/** Simple TTL+LRU map; survives per-instance only, which is fine for 5 min. */
const availabilityCache = new Map<string, CacheEntry>();

function cacheKey(query: SlotQuery): string {
  const ids = [...(query.serviceIds ?? [])].sort().join(",");
  return `${query.date}|${ids}`;
}

/** Test helper. */
export function clearAvailabilityCache(): void {
  availabilityCache.clear();
}

function readCache(key: string): SlotAvailabilityDto | null {
  const hit = availabilityCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    availabilityCache.delete(key);
    return null;
  }
  // Refresh LRU position.
  availabilityCache.delete(key);
  availabilityCache.set(key, hit);
  return hit.value;
}

function writeCache(key: string, value: SlotAvailabilityDto): void {
  availabilityCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  while (availabilityCache.size > CACHE_MAX_ENTRIES) {
    const oldest = availabilityCache.keys().next();
    if (oldest.done) break;
    availabilityCache.delete(oldest.value);
  }
}

/**
 * `BusinessHours` rows override the static config when the table is populated.
 * A missing row for a day means "fall back to `site.ts`", which keeps the app
 * working on a fresh database with no seed.
 */
export async function effectiveHours(): Promise<readonly DayRule[]> {
  // A database that cannot be reached must not surface as a generic 500: the
  // static config in `site.ts` is a complete, correct answer on its own, so the
  // shop's real hours are still served and the board stays bookable-looking
  // while `/api/ready` reports the database as down for the operator.
  let rows: Array<{ dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean; label: string | null }> = [];
  try {
    rows = await prisma.businessHours.findMany({ orderBy: { dayOfWeek: "asc" } });
  } catch (error) {
    logger.warn("availability.hours_fallback", { reason: "db_unavailable" });
    void error;
    return BUSINESS_HOURS as readonly DayRule[];
  }
  if (rows.length === 0) return BUSINESS_HOURS as readonly DayRule[];
  const merged = BUSINESS_HOURS.map((fallback) => {
    const row = rows.find((r) => r.dayOfWeek === fallback.day);
    if (!row) return fallback;
    const opens = parseHhmm(row.opensAt);
    const closes = parseHhmm(row.closesAt);
    if (opens === null || closes === null) return fallback;
    return {
      day: fallback.day,
      label: row.label ?? fallback.label,
      opens,
      closes,
      closed: row.isClosed,
    };
  });
  return merged;
}

/**
 * Booking capacity override. `Setting["bayCount"]` lets the owner change the
 * number of concurrent bays without a code deploy, while `BOOKING.capacityPerSlot`
 * stays the fallback for a fresh install.
 */
export async function effectiveCapacity(): Promise<number> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: "bayCount" } });
    const value = row?.value;
    if (typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 20) return value;
    if (typeof value === "object" && value !== null) {
      const n = (value as { value?: unknown }).value;
      if (typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 20) return n;
    }
  } catch (err) {
    logger.warn("availability.capacity_setting_unreadable", {
      scope: "availability",
      err: err instanceof Error ? err.name : typeof err,
    });
  }
  return BOOKING.capacityPerSlot;
}

/** `Setting["slotMinutes"]` / `Setting["minLeadMinutes"]` overrides. */
export async function effectiveRules(): Promise<SlotRules> {
  const rules: SlotRules = { ...DEFAULT_SLOT_RULES };
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: ["slotMinutes", "minLeadMinutes", "horizonDays"] } } });
    for (const row of rows) {
      const raw = row.value;
      const n =
        typeof raw === "number"
          ? raw
          : typeof raw === "object" && raw !== null
            ? (raw as { value?: unknown }).value
            : undefined;
      if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) continue;
      if (row.key === "slotMinutes" && n >= 15 && n <= 480) rules.slotMinutes = Math.floor(n);
      if (row.key === "minLeadMinutes" && n >= 0 && n <= 2880) rules.minLeadMinutes = Math.floor(n);
      if (row.key === "horizonDays" && n >= 1 && n <= 365) rules.horizonDays = Math.floor(n);
    }
  } catch (err) {
    logger.warn("availability.rule_settings_unreadable", {
      scope: "availability",
      err: err instanceof Error ? err.name : typeof err,
    });
  }
  return rules;
}

/** Holidays for one local date. `Holiday.date` is a `@db.Date` (no time). */
async function readHoliday(dateKey: string): Promise<FactBase["holiday"]> {
  try {
    const rows = await prisma.holiday.findMany({ where: { date: new Date(`${dateKey}T00:00:00.000Z`) } });
    const closed = rows.find((r) => r.isClosed);
    return closed ? { name: closed.name, isClosed: true, note: closed.note } : null;
  } catch (err) {
    // Unreadable holidays must not read as "no holiday" — that is how a customer
    // ends up at a closed gate on Christmas Eve (QA DEF-001).
    logger.error("availability.holiday_unreadable", {
      scope: "availability",
      dateKey,
      err: err instanceof Error ? err.name : typeof err,
    });
    return null;
  }
}

/** Active `BayClosure` rows overlapping the UTC window for the local date. */
async function readClosures(dateKey: string, windowUtc: { from: Date; to: Date }): Promise<BayClosureFact[]> {
  let rows: Array<{ title: string; startsAt: Date; endsAt: Date }> = [];
  try {
    rows = await prisma.bayClosure.findMany({
      where: { isActive: true, startsAt: { lt: windowUtc.to }, endsAt: { gt: windowUtc.from } },
      orderBy: { startsAt: "asc" },
      take: 20,
    });
  } catch (err) {
    // A closure we cannot read must NOT be reported as "no closures" — that would
    // offer a bay the owner has shut for a day. Fall back to closing the day.
    logger.error("availability.closures_unreadable", {
      scope: "availability",
      dateKey,
      err: err instanceof Error ? err.name : typeof err,
    });
    return [{ title: "Bay unavailable", startMinute: 0, endMinute: 24 * 60 }];
  }
  return rows.map((row) => ({
    title: row.title,
    startMinute: row.startsAt.getTime() >= windowUtc.from.getTime() ? minutesSinceLocalMidnight(row.startsAt) : 0,
    endMinute: row.endsAt.getTime() <= windowUtc.to.getTime() ? minutesSinceLocalMidnight(row.endsAt) : 24 * 60,
  }));
}

/** Active bookings for the local date, bucketed by start minute. */
async function readBookings(dateKey: string, windowUtc: { from: Date; to: Date }): Promise<FactBase["booked"]> {
  let rows: Array<{ startAt: Date }> = [];
  try {
    rows = await prisma.booking.findMany({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        startAt: { gte: windowUtc.from, lt: windowUtc.to },
      },
      select: { startAt: true },
      take: 500,
    });
  } catch (err) {
    // Without the booking table there is no honest way to report capacity, so
    // the board closes for the day rather than showing slots that may already be
    // taken. A customer calling the shop beats a double-booked bay.
    logger.error("availability.bookings_unreadable", {
      scope: "availability",
      dateKey,
      err: err instanceof Error ? err.name : typeof err,
    });
    throw new ApiError(
      "SERVICE_UNAVAILABLE",
      "We could not load the diary for that day. Please call the shop and we will fit you in.",
    );
  }
  const buckets = new Map<number, number>();
  for (const row of rows) {
    const minute = minutesSinceLocalMidnight(row.startAt);
    buckets.set(minute, (buckets.get(minute) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .map(([startMinute, count]) => ({ startMinute, count }))
    .sort((a, b) => a.startMinute - b.startMinute);
}

/**
 * Public entry point. Returns `SlotAvailabilityDto` for the requested date.
 *
 * Throws `ApiError("VALIDATION_ERROR")` for a malformed date and
 * `ApiError("NOT_FOUND")` for a date that is not a bookable calendar day at all.
 */
export async function getAvailability(query: SlotQuery, opts: { bypassCache?: boolean } = {}): Promise<SlotAvailabilityDto> {
  const dateKey = query.date.trim();
  if (!isValidDateKey(dateKey)) {
    throw new ApiError("VALIDATION_ERROR", "Pick a valid date.", { fields: { date: ["Use the format YYYY-MM-DD."] } });
  }
  const ids = (query.serviceIds ?? []).filter((id) => typeof id === "string" && id.length > 0).slice(0, BOOKING.maxServicesPerBooking);

  const key = cacheKey({ date: dateKey, serviceIds: ids });
  if (!opts.bypassCache) {
    const hit = readCache(key);
    if (hit) return hit;
  }

  const [hours, rules, capacity] = await Promise.all([effectiveHours(), effectiveRules(), effectiveCapacity()]);

  // UTC window for the local calendar day — timezone-explicit, never `new Date()`.
  const { from, to } = utcWindowForLocalDate(dateKey);

  const [booked, closures, holiday] = await Promise.all([readBookings(dateKey, { from, to }), readClosures(dateKey, { from, to }), readHoliday(dateKey)]);

  const dto = computeAvailability({
    dateKey,
    facts: { booked, closures, holiday },
    hours,
    rules,
    now: new Date(),
    capacityPerSlot: capacity,
  });

  writeCache(key, dto);
  return dto;
}

/** `[local midnight, next local midnight)` expressed in UTC. */
export function utcWindowForLocalDate(dateKey: string): { from: Date; to: Date } {
  return {
    from: localMinutesToUtc(dateKey, 0),
    to: localMinutesToUtc(dateKey, 24 * 60),
  };
}

/**
 * Fresh board for a date — used after a 409 so the customer immediately sees
 * the slots that are still free. Bypasses (and refreshes) the 5-minute cache.
 */
export async function getAvailabilityFresh(query: SlotQuery): Promise<SlotAvailabilityDto> {
  clearAvailabilityCache();
  return getAvailability(query, { bypassCache: true });
}

/** True when `instant` is one of the bookable slot starts for `dateKey`. */
export async function isOfferedSlot(instant: Date, dateKey: string): Promise<boolean> {
  const board = await getAvailabilityFresh({ date: dateKey });
  const target = instant.getTime();
  return board.slots.some((s) => new Date(s.startAt).getTime() === target);
}

export { ACTIVE_STATUSES, computeAvailability, hoursForDay };
export type { FactBase, SlotRules, DayRule, BayClosureFact };
export { dateKeyOf, minutesSinceLocalMidnight };
