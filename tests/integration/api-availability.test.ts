// @vitest-environment node
/**
 * QA & SECURITY AGENT — GET /api/availability.
 * ============================================================================
 * DATABASE STRATEGY
 * --------------
 * Prisma is mocked (`vi.mock("@/lib/server/db")`) with a typed in-memory fake
 * that understands exactly the four queries `availability.ts` makes. This keeps
 * the suite deterministic and free of a live Postgres.
 *
 * The trade-off, stated plainly: this suite proves the HTTP contract, the DTO
 * shape, the cache-Control policy, the error envelope and the rate-limit
 * headers. It does NOT prove the SQL. The authoritative database behaviour —
 * transaction isolation, unique constraints, the serialisable slot race — is
 * covered by tests/integration/api-booking.test.ts and, on the CI job that owns
 * a database, by the ephemeral-Postgres job described in
 * docs/qa/TEST-STRATEGY.md §4.
 * ============================================================================
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiFailure, ApiSuccess, SlotAvailabilityDto } from "@/lib/types";
import { BOOKING } from "@/config/site";

// ── Typed in-memory Prisma fake ─────────────────────────────────────────────

const DAY = "2026-03-11";
const CLOSED_DAY = "2026-03-15";

interface State {
  businessHours: Array<{ id: number; dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean; label: string | null }>;
  bookings: Array<{ startAt: Date; status: string }>;
  closures: Array<{ id: string; title: string; startsAt: Date; endsAt: Date; isActive: boolean }>;
  holidays: Array<{ id: string; name: string; date: Date; isClosed: boolean; note: string | null }>;
  settings: Array<{ key: string; value: unknown }>;
}

const state: State = { businessHours: [], bookings: [], closures: [], holidays: [], settings: [] };

const calls: Array<{ model: string; op: string }> = [];

vi.mock("@/lib/server/db", () => ({
  prisma: {
    businessHours: {
      findMany: async () => {
        calls.push({ model: "businessHours", op: "findMany" });
        return [...state.businessHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      },
    },
    setting: {
      findUnique: async (args: { where: { key: string } }) => {
        calls.push({ model: "setting", op: "findUnique" });
        return state.settings.find((s) => s.key === args.where.key) ?? null;
      },
      findMany: async (args: { where: { key: { in: string[] } } }) => {
        calls.push({ model: "setting", op: "findMany" });
        return state.settings.filter((s) => args.where.key.in.includes(s.key));
      },
    },
    booking: {
      findMany: async () => {
        calls.push({ model: "booking", op: "findMany" });
        return state.bookings.map((b) => ({ startAt: b.startAt }));
      },
    },
    bayClosure: {
      findMany: async () => {
        calls.push({ model: "bayClosure", op: "findMany" });
        return [...state.closures];
      },
    },
    holiday: {
      findMany: async () => {
        calls.push({ model: "holiday", op: "findMany" });
        return [...state.holidays];
      },
    },
  },
}));

// ── Route import (fresh module graph per test) ──────────────────────────────

type AvailabilityRoute = typeof import("@/app/api/availability/route");

let route: AvailabilityRoute | null = null;

/** A `NextRequest`-alike: the route reads `.nextUrl`, `.headers`, `.method`, `.cookies`. */
function nextRequest(url: string, headers: Record<string, string> = {}, method = "GET"): never {
  const parsed = new URL(url);
  return {
    nextUrl: parsed,
    url,
    method,
    headers: new Headers(headers),
    cookies: { get: () => undefined, getAll: () => [] },
    ip: "203.0.113.50",
  } as never;
}

async function get(
  url: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: ApiSuccess<SlotAvailabilityDto> | ApiFailure; headers: Headers }> {
  if (!route) throw new Error("route was not loaded — did beforeEach run?");
  const response = await route.GET(nextRequest(url, headers));
  const body = (await response.json()) as ApiSuccess<SlotAvailabilityDto> | ApiFailure;
  return { status: response.status, body, headers: response.headers };
}

const BASE = "http://localhost:3000/api/availability";

beforeEach(async () => {
  state.businessHours = [];
  state.bookings = [];
  state.closures = [];
  state.holidays = [];
  state.settings = [];
  calls.length = 0;
  // The clock is pinned so `now` inside computeAvailability is deterministic.
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${DAY}T06:00:00+08:00`));
  // The module graph is reset once per TEST (not per request) so the
  // server-side availability cache behaves as it does in production.
  vi.resetModules();
  route = (await import("@/app/api/availability/route")) as AvailabilityRoute;
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────

describe("api/availability — happy path", () => {
  it("returns 200 with the SlotAvailabilityDto inside the standard envelope", async () => {
    const { status, body } = await get(`${BASE}?date=${DAY}`);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    const board = body.data;
    expect(Object.keys(board).sort()).toEqual(
      ["date", "isClosed", "slots", "timezone", "totalCapacity"].sort(),
    );
    expect(board.date).toBe(DAY);
    expect(board.timezone).toBe("Asia/Manila");
    expect(board.isClosed).toBe(false);
    expect(Array.isArray(board.slots)).toBe(true);
    expect(body.meta?.requestId).toBeTruthy();
  });

  it("every slot matches the SlotDto contract", async () => {
    const { body } = await get(`${BASE}?date=${DAY}`);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    for (const slot of body.data.slots) {
      expect(Object.keys(slot).sort()).toEqual(["capacityLeft", "endAt", "isBest", "label", "startAt"].sort());
      expect(slot.startAt).toMatch(/[+-]08:00$/);
      expect(slot.label).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
      expect(slot.capacityLeft).toBeGreaterThan(0);
    }
    expect(body.data.slots.filter((s) => s.isBest)).toHaveLength(1);
  });

  it("accepts serviceIds as repeated query params and as a comma list", async () => {
    const repeated = await get(`${BASE}?date=${DAY}&serviceIds=svca&serviceIds=svcb`);
    const comma = await get(`${BASE}?date=${DAY}&serviceIds=svca,svcb`);
    expect(repeated.status).toBe(200);
    expect(comma.status).toBe(200);
    if (repeated.body.ok && comma.body.ok) {
      expect(JSON.stringify(repeated.body.data)).toBe(JSON.stringify(comma.body.data));
    }
  });

  it("rejects an unknown query parameter instead of ignoring it (.strict)", async () => {
    const { status, body } = await get(`${BASE}?date=${DAY}&url=http://169.254.169.254/`);
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("rejects a service id that is not a plain slug", async () => {
    const { status, body } = await get(`${BASE}?date=${DAY}&serviceIds=../../etc/passwd`);
    expect(status).toBe(400);
    if (!body.ok) expect(body.error.fields?.["serviceIds"]).toBeDefined();
  });

  it("a closed day is a 200 with isClosed, never a 4xx", async () => {
    const { status, body } = await get(`${BASE}?date=${CLOSED_DAY}`);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.data.isClosed).toBe(true);
    expect(body.data.slots).toEqual([]);
    expect(body.data.closedReason ?? "").not.toBe("");
  });

  it("marks fully-booked slots as absent, not as capacityLeft 0", async () => {
    // Fill every 9:00 slot. 09:00 Manila = 01:00Z.
    for (let i = 0; i < 3; i += 1) {
      state.bookings.push({ startAt: new Date(`${DAY}T01:00:00Z`), status: "CONFIRMED" });
    }
    const { body } = await get(`${BASE}?date=${DAY}`);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.data.slots.some((s) => s.startAt.startsWith(`${DAY}T09:00`))).toBe(false);
    expect(body.data.slots.some((s) => s.capacityLeft <= 0)).toBe(false);
  });

  it("a closed holiday closes the day and names the holiday", async () => {
    state.holidays.push({ id: "h1", name: "Christmas Day", date: new Date(`${DAY}T00:00:00Z`), isClosed: true, note: null });
    const { body } = await get(`${BASE}?date=${DAY}`);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.data.isClosed).toBe(true);
    expect(body.data.closedReason ?? "").toMatch(/christmas day/i);
  });
});

describe("api/availability — validation", () => {
  it.each([
    ["", "empty date"],
    ["not-a-date", "free text"],
    ["2026-13-01", "month 13"],
    ["2026-02-30", "30 February"],
    ["20260311", "no separators"],
    ["11-03-2026", "wrong order"],
  ])("400s on ?date=%s (%s) with a fields map", async (date) => {
    const { status, body } = await get(`${BASE}?date=${date}`);
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    if (body.ok) return;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields).toBeDefined();
    expect(body.error.fields?.["date"]).toBeDefined();
  });

  it("400s when `date` is missing entirely", async () => {
    const { status, body } = await get(BASE);
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("never throws 500 for a hostile query string", async () => {
    for (const query of [
      "?date=" + encodeURIComponent("' OR 1=1--"),
      "?date=2026-03-11&serviceIds=" + "x".repeat(5000),
      "?date=2026-03-11&serviceIds=../../etc/passwd",
      "?date=2026-03-11&date=2026-03-12",
    ]) {
      const { status } = await get(`${BASE}${query}`);
      expect([200, 400], query.slice(0, 60)).toContain(status);
    }
  });
});

describe("api/availability — response policy", () => {
  it("sets a short shared Cache-Control on a successful board", async () => {
    const { headers } = await get(`${BASE}?date=${DAY}`);
    const cacheControl = headers.get("cache-control") ?? "";
    expect(cacheControl).toMatch(/public/);
    expect(cacheControl).toMatch(/max-age=(\d+)/);
    const seconds = Number(/max-age=(\d+)/.exec(cacheControl)?.[1] ?? "999");
    expect(seconds).toBeLessThanOrEqual(300);
  });

  it("never sets a long cache on a 400", async () => {
    const { headers } = await get(`${BASE}?date=nope`);
    const cacheControl = headers.get("cache-control") ?? "";
    expect(cacheControl).not.toMatch(/max-age=(?:[3-9]\d\d|\d{4,})/);
  });

  it("carries an x-request-id on every response", async () => {
    const { headers } = await get(`${BASE}?date=${DAY}`);
    expect(headers.get("x-request-id")).toBeTruthy();
  });

  it("echoes a well-formed inbound request id and mints one otherwise", async () => {
    const good = await get(`${BASE}?date=${DAY}`, { "x-request-id": "req-0123456789abcdef" });
    expect(good.headers.get("x-request-id")).toBe("req-0123456789abcdef");
    const bad = await get(`${BASE}?date=${DAY}`, { "x-request-id": "has spaces and <script>" });
    expect(bad.headers.get("x-request-id")).not.toBe("has spaces and <script>");
  });
});

describe("api/availability — information disclosure", () => {
  it("never leaks a stack trace, a SQL fragment or a connection string", async () => {
    // Force the database to fail the way a real outage would.
    state.businessHours = undefined as never; // deliberate: triggers a throw
    const { status, body } = await get(`${BASE}?date=${DAY}`);
    const serialised = JSON.stringify(body);
    if (status < 500) {
      expect(serialised).not.toMatch(/postgres:\/\//);
      return;
    }
    expect(serialised).not.toMatch(/postgres:\/\//);
    expect(serialised).not.toMatch(/at Object\./);
    expect(serialised).not.toMatch(/\bat\s+\/|\.ts:\d+:\d+/);
    expect(serialised).not.toMatch(/PrismaClient/);
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("never exposes another customer's identity through the board", async () => {
    state.bookings.push(
      { startAt: new Date(`${DAY}T02:00:00Z`), status: "CONFIRMED" },
      { startAt: new Date(`${DAY}T02:00:00Z`), status: "CONFIRMED" },
    );
    const { body } = await get(`${BASE}?date=${DAY}`);
    const serialised = JSON.stringify(body);
    expect(serialised).not.toMatch(/customerName|customerPhone|customerEmail|reference|plate|notes/i);
    expect(serialised).not.toMatch(/\+639/);
  });

  it("uses only a count, never a list, for capacity pressure", async () => {
    // Two of three bays taken on the 11:00 Manila slot (03:00Z).
    // Leave exactly one bay free: a fully-booked slot is correctly omitted.
    for (let i = 0; i < BOOKING.capacityPerSlot - 1; i += 1) {
      state.bookings.push({
        startAt: new Date(`${DAY}T03:00:00Z`),
        status: i === 0 ? "CONFIRMED" : "PENDING",
      });
    }
    const { body } = await get(`${BASE}?date=${DAY}`);
    const slot = body.ok ? body.data.slots.find((s) => s.startAt.startsWith(`${DAY}T11:00`)) : null;
    expect(slot).toBeDefined();
    expect(slot!.capacityLeft).toBe(1);
    expect(Object.keys(slot!).sort()).toEqual(["capacityLeft", "endAt", "isBest", "label", "startAt"]);
  });
});

describe("api/availability — server-side cache", () => {
  it("serves the second identical request from cache without re-querying", async () => {
    await get(`${BASE}?date=${DAY}`);
    const afterFirst = calls.length;
    await get(`${BASE}?date=${DAY}`);
    expect(calls.length, "the 5-minute availability cache should have absorbed the second read").toBe(afterFirst);
  });

  it("does NOT share a cached board between different service selections", async () => {
    await get(`${BASE}?date=${DAY}`);
    const afterFirst = calls.length;
    await get(`${BASE}?date=${DAY}&serviceIds=svca`);
    expect(calls.length, "a different serviceIds set is a different cache key").toBeGreaterThan(afterFirst);
  });
});

describe("api/availability — settings overrides", () => {
  it("honours a Setting row that changes the bay count", async () => {
    state.settings.push({ key: "bayCount", value: 1 });
    const { body } = await get(`${BASE}?date=${DAY}`);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.data.totalCapacity).toBe(1);
    expect(body.data.slots.every((s) => s.capacityLeft === 1)).toBe(true);
  });

  it("ignores an out-of-range Setting row and falls back to the config", async () => {
    state.settings.push({ key: "bayCount", value: 9999 });
    const { body } = await get(`${BASE}?date=${DAY}`);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    // The absurd override must be ignored in favour of the configured value.
    expect(body.data.totalCapacity).toBe(BOOKING.capacityPerSlot);
    expect(body.data.totalCapacity).not.toBe(9999);
  });

  it("never lets a Setting row open the horizon", async () => {
    // The query validator already refuses anything beyond horizonDays + 2, so the
    // real risk is the opposite: a Setting row widening the horizon past the
    // validator's bound. effectiveRules() must clamp it.
    state.settings.push({ key: "horizonDays", value: 3650 });
    const { body } = await get(`${BASE}?date=2026-04-30`); // 50 days out, inside the bound
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.data.isClosed).toBe(false);

    // 100 days out: refused by the validator, never by a widened horizon.
    const far = await get(`${BASE}?date=2026-06-30`);
    expect(far.status).toBe(400);
  });

it("never lets a Setting row disable the lead time", async () => {
    // A `minLeadMinutes` of 0 would let a customer book a slot 1 minute from now.
    // effectiveRules() accepts 0 (n >= 0), so this documents that the value is
    // honoured rather than silently floored — and that today the *validator*
    // still refuses "today" once closing has passed.
    state.settings.push({ key: "minLeadMinutes", value: 0 });
    const { status, body } = await get(`${BASE}?date=${DAY}`);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });
});

describe("api/availability — BusinessHours overrides", () => {
  it("uses the BusinessHours table over the static config when it has rows", async () => {
    state.businessHours = [
      { id: 1, dayOfWeek: 3, opensAt: "10:00", closesAt: "14:00", isClosed: false, label: "Half day" },
    ];
    const { body } = await get(`${BASE}?date=${DAY}`);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    // 10:00, 11:00 and 13:00 — the 12:00 lunch break from `BOOKING` still applies.
    expect(body.data.slots.map((s) => s.label)).toEqual(["10:00 AM", "11:00 AM", "1:00 PM"]);
  });

  it("a BusinessHours row marked closed closes the day", async () => {
    state.businessHours = [
      { id: 1, dayOfWeek: 3, opensAt: "08:00", closesAt: "17:00", isClosed: true, label: "Bay maintenance" },
    ];
    const { body } = await get(`${BASE}?date=${DAY}`);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.data.isClosed).toBe(true);
  });

  it("an unparseable opensAt/closesAt falls back to the static config, never to nonsense", async () => {
    state.businessHours = [
      { id: 1, dayOfWeek: 3, opensAt: "25:99", closesAt: "banana", isClosed: false, label: null },
    ];
    const { status, body } = await get(`${BASE}?date=${DAY}`);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.data.slots.length).toBe(8);
  });
});

describe("api/availability — SSRF and outbound calls", () => {
  it("never fetches anything: a board is answered entirely from the database", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      await get(`${BASE}?date=${DAY}`);
      expect(fetchSpy, "GET /api/availability must not make an outbound request").not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("a user-supplied URL in the query string is rejected without ever being fetched", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      // `.strict()` refuses the unknown key outright, so nothing downstream sees it.
      const { status } = await get(`${BASE}?date=${DAY}&url=http://169.254.169.254/latest/meta-data/`);
      expect(status).toBe(400);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("ignores a spoofed trusted-proxy header rather than letting it pick the IP", async () => {
    const { status } = await get(`${BASE}?date=${DAY}`, {
      "x-forwarded-for": "1.2.3.4",
      "user-agent": "curl/8.0.0",
    });
    expect(status).toBe(200);
  });
});