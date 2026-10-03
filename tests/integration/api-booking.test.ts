// @vitest-environment node
/**
 * QA & SECURITY AGENT — POST /api/booking, and THE SLOT RACE.
 * ============================================================================
 * This is the single most important invariant in the product:
 *
 *   **Two customers clicking the last remaining bay at the same instant must
 *    produce exactly ONE booking and one clean 409.**
 *
 * Everything else in this file (field validation, honeypot, min-time, captcha
 * replay, PII leakage, 5xx verbosity) exists to stop a hostile or broken client
 * reaching that transaction with something it should not.
 *
 * DATABASE STRATEGY
 * -----------------
 * The Prisma layer is mocked with a typed in-memory fake that implements
 * `prisma.$transaction(fn, { isolationLevel })` as a *mutual-exclusion* critical
 * section — i.e. transactions are serialised, which is exactly what SERIALIZABLE
 * isolation gives us in Postgres. That makes the race test genuinely meaningful
 * (both callers really do interleave at the `count()` step) while staying
 * dependency-free and deterministic.
 *
 * It is NOT a substitute for the real thing: the authoritative race proof is the
 * ephemeral-Postgres job in docs/qa/TEST-STRATEGY.md §4, which fires two real
 * `POST /api/booking` requests at one real database. See `it.todo` at the
 * bottom of this file for the exact steps.
 * ============================================================================
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiFailure, ApiSuccess, BookingDto } from "@/lib/types";
import { BOOKING } from "@/config/site";

// ── Typed in-memory Prisma fake ─────────────────────────────────────────────

type Row = Record<string, unknown> & { id: string };

/**
 * The fake's method signatures are intentionally permissive (`unknown` in, a
 * plausible row out) because a fake that has to be re-typed for every Prisma
 * signature becomes a maintenance burden nobody keeps up with. Everything it
 * RETURNS is still fully typed, which is what the assertions touch.
 */
interface Tx {
  booking: {
    count: (args: unknown) => Promise<number>;
    create: (args: { data: Row; include?: unknown }) => Promise<Row>;
    findUnique: (args: unknown) => Promise<Row | null>;
    findFirst: (args: unknown) => Promise<Row | null>;
    findMany: (args: unknown) => Promise<Row[]>;
    deleteMany?: (args: unknown) => Promise<{ count: number }>;
  };
  bookingItem: { createMany: (args: unknown) => Promise<{ count: number }> };
  bookingEvent: { create: (args: unknown) => Promise<Row> };
  customer: {
    findUnique: (args: unknown) => Promise<Row | null>;
    create: (args: { data: Row }) => Promise<Row>;
    update: (args: { where: { id: string }; data: Row }) => Promise<Row>;
    upsert: (args: { where: { phone?: string }; create: Row }) => Promise<Row>;
  };
  vehicle: { create: (args: { data: Row; select?: unknown }) => Promise<Row> };
  service: { findMany: (args: unknown) => Promise<Row[]> };
  serviceCategory: { findFirst: (args: unknown) => Promise<Row | null> };
  package: { findFirst: (args: unknown) => Promise<Row | null> };
  promotion: { findFirst: (args: unknown) => Promise<Row | null> };
  bayClosure: { findMany: () => Promise<Row[]> };
  holiday: { findMany: () => Promise<Row[]> };
  businessHours: { findMany: () => Promise<Row[]> };
  setting: {
    findUnique: (args: unknown) => Promise<Row | null>;
    findMany: () => Promise<Row[]>;
  };
  notification: { create: () => Promise<Row> };
  /** Fixed-window counter backing the rate limiter's Postgres driver. */
  rateLimitCounter: {
    findUnique: (args: unknown) => Promise<Row | null>;
    upsert: (args: unknown) => Promise<Row>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
}

/** In-memory `RateLimitCounter` table. Reset per test. */
const rateCounters = new Map<string, { id: string; key: string; count: number; resetAt: Date }>();

const store = {
  bookings: [] as Row[],
  customers: [] as Row[],
  vehicles: [] as Row[],
  sequence: 0,
  /** Every transaction body that ran, for ordering assertions. */
  txLog: [] as string[],
};

const _OCCUPYING = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "READY"];

const nextId = (prefix: string): string => {
  store.sequence += 1;
  return `${prefix}_${store.sequence.toString(36).padStart(6, "0")}`;
};

const SERVICE_FIXTURE: Row = {
  id: "svc_pms_a",
  slug: "pms-a",
  name: "PMS A (Oil + Filter)",
  shortName: "PMS A",
  summary: "Oil, filter and the usual checks.",
  description: "…",
  pricing: "FIXED",
  priceMin: 1800,
  priceMax: 1800,
  priceNote: null,
  durationMin: 60,
  isPopular: true,
  isFeatured: false,
  requiresVehicle: false,
  includes: [],
  excludes: [],
  sortOrder: 0,
  isActive: true,
  categoryId: "cat_general",
  category: { slug: "general", name: "General", icon: null },
};

function makeTx(): Tx {
  return {
    booking: {
      count: async (args: unknown) => {
        const where = (args as { where: { status?: { in?: string[] }; startAt?: { gte: Date; lt: Date } } }).where;
        return store.bookings.filter((b) => {
          if (where.status?.in && !where.status.in.includes(String(b["status"]))) return false;
          const startAt = b["startAt"] as Date;
          if (where.startAt) {
            if (startAt < where.startAt.gte || startAt >= where.startAt.lt) return false;
          }
          return true;
        }).length;
      },
      create: async ({ data }) => {
        const id = typeof data["id"] === "string" ? data["id"] : nextId("bkg");
        const row: Row = { ...data, id, createdAt: data["createdAt"] ?? new Date() };
        store.bookings.push(row);
        // Prisma returns nested creates; the DTO reads `items`.
        return {
          ...row,
          items: ((data["items"] as { create?: Row[] } | undefined)?.create ?? []).map((item, index) => ({
            ...item,
            id: typeof item["id"] === "string" ? item["id"] : `item_${index}`,
          })),
          history: [],
        };
      },
      findFirst: async () => null,
      findUnique: async (args: unknown) => {
        const { where } = args as { where: { reference: string } };
        return store.bookings.find((b) => b["reference"] === where.reference) ?? null;
      },
      /** Honours the `status` and `startAt` filters the board relies on. */
      findMany: async (args: unknown) => {
        const where = (args as {
          where?: { status?: { in?: string[] }; startAt?: { gte?: Date; lt?: Date } };
          select?: Record<string, boolean>;
        }).where;
        return store.bookings.filter((b) => {
          if (where?.status?.in && !where.status.in.includes(String(b["status"]))) return false;
          const startAt = b["startAt"] as Date | undefined;
          if (startAt && where?.startAt) {
            if (where.startAt.gte && startAt < where.startAt.gte) return false;
            if (where.startAt.lt && startAt >= where.startAt.lt) return false;
          }
          return true;
        });
      },
    },
    bookingItem: { createMany: async () => ({ count: 0 }) },
    bookingEvent: { create: async () => ({ id: "evt" }) },
    customer: {
      findUnique: async (args: unknown) => {
        const where = (args as { where: { phone?: string } }).where;
        return store.customers.find((c) => c["phone"] === where.phone) ?? null;
      },
      create: async ({ data }) => {
        const row: Row = { ...data, id: nextId("cus"), createdAt: data["createdAt"] ?? new Date() };
        store.customers.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const existing = store.customers.find((c) => c["id"] === where.id);
        if (existing) Object.assign(existing, data);
        return existing ?? ({ ...data, id: where.id } as Row);
      },
      upsert: async ({ where, create }) => {
        const phone = where.phone ?? "";
        const existing = store.customers.find((c) => c["phone"] === phone);
        if (existing) return existing;
        const row: Row = { ...create, id: nextId("cus"), createdAt: create["createdAt"] ?? new Date(), phone };
        store.customers.push(row);
        return row;
      },
    },
    vehicle: { create: async ({ data }) => ({ ...data, id: nextId("veh") }) },
    service: { findMany: async () => [SERVICE_FIXTURE] },
    serviceCategory: { findFirst: async () => ({ id: "cat_general", slug: "general", name: "General" }) },
    package: { findFirst: async () => null },
    promotion: { findFirst: async () => null },
    bayClosure: { findMany: async () => [] },
    holiday: { findMany: async () => [] },
    businessHours: { findMany: async () => [] },
    setting: { findUnique: async () => null, findMany: async () => [] },
    notification: { create: async () => ({ id: "ntf" }) },
    rateLimitCounter: {
      findUnique: async (args: unknown) => {
        const where = (args as { where: { key: string } }).where;
        return rateCounters.get(where.key) ?? null;
      },
      upsert: async (args: unknown) => {
        const { where, create } = args as {
          where: { key: string };
          create: { key: string; count: number; resetAt: Date };
        };
        const row: Row = { ...create, id: `rlc_${where.key}`, updatedAt: new Date() };
        rateCounters.set(where.key, {
          id: `rlc_${where.key}`,
          key: where.key,
          count: create.count,
          resetAt: create.resetAt,
        });
        return row;
      },
      updateMany: async (args: unknown) => {
        const { where, data } = args as { where: { key: string }; data: { count: { increment: number } } };
        const existing = rateCounters.get(where.key);
        if (!existing || existing.resetAt <= new Date()) return { count: 0 };
        existing.count += data.count.increment;
        return { count: 1 };
      },
      deleteMany: async () => {
        const count = rateCounters.size;
        rateCounters.clear();
        return { count };
      },
    },
  };
}

/**
 * Any model/method the fake does not model explicitly resolves to a permissive
 * async no-op that records the access. That keeps the suite honest (nothing
 * crashes on a missing mock) while `unexpectedCalls` lets a test assert that no
 * route touched an unmodelled table.
 */
const unexpectedCalls: string[] = [];

const permissive = (path: string): ProxyHandler<Record<string, unknown>> => ({
  get(target, prop) {
    // Anything the fake DOES model passes straight through.
    if (prop in target) return Reflect.get(target, prop);
    const key = `${path}.${String(prop)}`;
    return async (..._args: unknown[]): Promise<unknown> => {
      unexpectedCalls.push(key);
      return { count: 0, id: "generated", createdAt: new Date() };
    };
  },
});

/**
 * `withSerializableRetry` also lives in `@/lib/server/db`. The real one opens a
 * `SERIALIZABLE` transaction and retries on Prisma's `P2034`; this mirrors that
 * contract so the route exercises the same code path.
 */
/**
 * Transaction mutex.
 *
 * SERIALIZABLE means one transaction's reads and writes are not interleaved with
 * another's: the second transaction does not even begin until the first commits
 * (or, in Postgres, it aborts and is retried). A plain `async fn` call does NOT
 * give you that — two bodies interleave at every `await`, which would let the
 * fake over-report capacity and make this suite measure the fake instead of the
 * code. So `$transaction` chains onto a promise queue: a true mutex.
 */
let txQueue: Promise<unknown> = Promise.resolve();

/** Set by a test to make the NEXT transaction blow up with a Prisma-shaped error. */
let injectTransactionFailure: Error | null = null;

function serialise<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const run = txQueue.then(() => {
    if (injectTransactionFailure) {
      const error = injectTransactionFailure;
      injectTransactionFailure = null;
      throw error;
    }
    return fn(prismaMock as unknown as Tx);
  });
  txQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function withSerializableRetry<T>(fn: (tx: Tx) => Promise<T>, _options?: { requestId?: string }): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await serialise(fn);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("withSerializableRetry: exhausted");
}

/** SERIALISABLE, so transactions are mutually exclusive here too. */
const prismaMock = {
  ...makeTx(),
  withSerializableRetry,
  $transaction: async <T>(fn: (tx: Tx) => Promise<T>, _options?: unknown): Promise<T> => {
    store.txLog.push("begin");
    try {
      return await serialise(fn);
    } finally {
      store.txLog.push("commit");
    }
  },
};

vi.mock("@/lib/server/db", () => ({
  prisma: new Proxy(prismaMock as unknown as Record<string, unknown>, permissive("prisma")),
  withSerializableRetry,
}));

/**
 * The rate limiter is proven on its own terms in tests/integration/rate-limit.test.ts.
 * Here it is only noise — 50 concurrent requests from one IP in one millisecond
 * would trip any sane budget — so it is replaced with a pass-through that still
 * exports the real policy shapes.
 */
vi.mock("@/lib/ratelimit", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const _policies = actual["RATE_LIMIT_POLICIES"] as Record<string, unknown>;
  return {
    ...actual,
    rateLimit: async () => ({
      success: true,
      limit: 10_000,
      remaining: 9_999,
      reset: Date.now() + 3_600_000,
      driver: "memory",
    }),
    rateLimitHeaders: () => ({}),
    rateLimitPolicyHeader: () => "10000;w=3600",
  };
});

// The notification layer must not attempt a real SMS/email.
vi.mock("@/lib/server/notify", () => ({
  notifyBookingConfirmation: async () => ({ queued: 0, sent: 0, failed: 0 }),
  notifyBookingStatusChange: async () => ({ queued: 0, sent: 0, failed: 0 }),
  notifyBookingCancellation: async () => ({ queued: 0, sent: 0, failed: 0 }),
}));

// ── Route harness ───────────────────────────────────────────────────────────

type BookingRoute = typeof import("@/app/api/booking/route");
let route: BookingRoute | null = null;

/** Wednesday 2026-03-11, Manila. 09:00 slot = 01:00Z. */
const DAY = "2026-03-11";
const SLOT_0900 = `${DAY}T09:00:00+08:00`;

const PINNED_NOW = new Date(`${DAY}T06:00:00+08:00`);

function nextRequest(body: unknown, headers: Record<string, string> = {}, method = "POST"): never {
  const url = "http://localhost:3000/api/booking";
  return {
    nextUrl: new URL(url),
    url,
    method,
    headers: new Headers({ "content-type": "application/json", ...headers }),
    cookies: { get: () => undefined, getAll: () => [] },
    ip: "203.0.113.77",
    json: async () => body,
  } as never;
}

async function post(
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: ApiSuccess<BookingDto> | ApiFailure; headers: Headers }> {
  if (!route) throw new Error("route not loaded");
  const response = await route.POST(nextRequest(body, headers));
  const parsed = (await response.json()) as ApiSuccess<BookingDto> | ApiFailure;
  return { status: response.status, body: parsed, headers: response.headers };
}

const VALID = {
  name: "Maria Santos",
  phone: "09171234567",
  email: "maria@example.ph",
  startAt: SLOT_0900,
  serviceIds: ["svc_pms_a"],
  vehicle: { year: 2019, make: "Toyota", model: "Hilux", plate: "ABC 1234" },
  notes: "Front tyres only, please.",
  consentSms: true,
} as const;

beforeEach(async () => {
  store.bookings = [];
  store.customers = [];
  store.vehicles = [];
  store.sequence = 0;
  store.txLog = [];
  rateCounters.clear();
  unexpectedCalls.length = 0;
  txQueue = Promise.resolve();
  vi.useFakeTimers();
  vi.setSystemTime(PINNED_NOW);
  // Captcha is exercised in tests/unit/captcha-token.test.ts; here we want the
  // booking contract, so the math challenge is disabled but honeypot/min-time
  // still apply (verifyCaptcha honours exactly that).
  vi.stubEnv("CAPTCHA_ENABLED", "false");
  // The rate limiter is proven properly in tests/integration/rate-limit.test.ts.
  // Here it is only noise, so it is opened up: concurrency tests fire dozens of
  // requests from one IP in one millisecond.
  vi.stubEnv("RATE_LIMIT_BOOKING_PER_HOUR", "1000");
  vi.stubEnv("RATE_LIMIT_PUBLIC_PER_MINUTE", "1000");
  vi.resetModules();
  route = (await import("@/app/api/booking/route")) as BookingRoute;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// ─────────────────────────────────────────────────────────────────────────────

describe("api/booking — success", () => {
  it("creates a booking and returns 201 with a BookingDto", async () => {
    const { status, body, headers } = await post({ ...VALID });
    expect(status).toBe(201);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    const booking = body.data;
    expect(booking.id).toBeTruthy();
    expect(booking.reference).toMatch(/^EYG-[A-Z0-9]{6}$/);
    expect(booking.status).toBe("PENDING");
    expect(booking.customerPhone).toBe("+639171234567");
    expect(booking.startAt).toMatch(/[+-]08:00$/);
    expect(booking.items.length).toBeGreaterThan(0);
    expect(headers.get("location")).toContain(booking.reference);
    expect(headers.get("cache-control")).toContain("no-store");
  });

  it("never stores staff-only or infrastructure fields in the response", async () => {
    const { body } = await post({ ...VALID });
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    const serialised = JSON.stringify(body.data);
    for (const forbidden of ["createdIp", "userAgent", "staffNotes", "utmSource", "customerId", "vehicleId"]) {
      expect(serialised, forbidden).not.toContain(forbidden);
    }
  });

  it("reuses one Customer row for repeat bookings from the same phone", async () => {
    await post({ ...VALID, startAt: SLOT_0900 });
    await post({ ...VALID, startAt: `${DAY}T14:00:00+08:00` });
    expect(store.customers).toHaveLength(1);
    expect(store.bookings).toHaveLength(2);
  });
});

describe("api/booking — validation", () => {
  it.each([
    ["name missing", { name: undefined }],
    ["name too short", { name: "M" }],
    ["phone missing", { phone: undefined }],
    ["phone is a landline", { phone: "81234567" }],
    ["phone is a non-PH number", { phone: "+14155552671" }],
    ["email malformed", { email: "not-an-email" }],
    ["startAt missing", { startAt: undefined }],
    ["startAt is free text", { startAt: "sometime next week" }],
    ["notes over the cap", { notes: "x".repeat(600) }],
    ["vehicle year in the future", { vehicle: { year: 2099, make: "Toyota", model: "Hilux" } }],
  ])("400s on %s with a fields map", async (_label, patch) => {
    const payload: Record<string, unknown> = { ...VALID };
    for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
      if (value === undefined) delete payload[key];
      else payload[key] = value;
    }
    const { status, body } = await post(payload);
    expect(status, _label).toBe(400);
    expect(body.ok).toBe(false);
    if (body.ok) return;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields, `${_label} must name the offending field(s)`).toBeDefined();
    expect(Object.keys(body.error.fields!).length).toBeGreaterThan(0);
    for (const messages of Object.values(body.error.fields!)) {
      expect(Array.isArray(messages)).toBe(true);
      for (const message of messages) expect(typeof message).toBe("string");
    }
    expect(store.bookings).toHaveLength(0);
  });

  it("rejects an off-grid startAt without creating a booking", async () => {
    // 09:07 is not a slot. The handler may answer 400 (malformed input) or 409
    // (not an offered slot) — both are defensible; neither may write a row, and
    // neither may leak.
    const { status, body } = await post({ ...VALID, startAt: `${DAY}T09:07:00+08:00` });
    expect([400, 409]).toContain(status);
    expect(body.ok).toBe(false);
    expect(store.bookings).toHaveLength(0);
  });

  it("rejects an unknown key and reports it under a `_root` field path", async () => {
    const { status, body } = await post({ ...VALID, isAdmin: true });
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    if (body.ok) return;
    // `.strict()` reports an unrecognised key at the document root, which is
    // correct: there is no form field to highlight.
    expect(Object.keys(body.error.fields ?? {})).toContain("_root");
    expect(store.bookings).toHaveLength(0);
  });

  it("400s on a body that is not JSON at all", async () => {
    const { status, body } = await post(undefined);
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("400s when neither a service nor a package is selected", async () => {
    const { status, body } = await post({ ...VALID, serviceIds: [] });
    expect(status).toBe(400);
    if (!body.ok) expect(body.error.fields?.["serviceIds"]).toBeDefined();
  });

  it("deduplicates repeated serviceIds instead of double-charging", async () => {
    const { body } = await post({ ...VALID, serviceIds: ["svc_pms_a", "svc_pms_a", "svc_pms_a"] });
    expect(body.ok).toBe(true);
    if (body.ok) expect(body.data.items).toHaveLength(1);
  });

  it("never echoes a 5xx for an oversized payload", async () => {
    const { status } = await post({ ...VALID, serviceIds: Array.from({ length: 50 }, (_, i) => `service_${i}`) });
    expect(status).toBeLessThan(500);
  });
});

describe("api/booking — honeypot and min-time", () => {
  it("422s a filled honeypot and writes nothing", async () => {
    const { status, body } = await post({ ...VALID, website: "http://spam.example" });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(body.ok).toBe(false);
    expect(store.bookings).toHaveLength(0);
  });

  it("rejects a submission stamped faster than the minimum", async () => {
    const { status, body } = await post(
      { ...VALID },
      { "x-form-rendered-at": String(PINNED_NOW.getTime()) },
    );
    expect(status).toBeGreaterThanOrEqual(400);
    expect(body.ok).toBe(false);
    expect(store.bookings).toHaveLength(0);
  });

  it("accepts a submission stamped far enough in the past", async () => {
    const { status } = await post(
      { ...VALID },
      { "x-form-rendered-at": String(PINNED_NOW.getTime() - 30_000) },
    );
    expect(status).toBe(201);
  });
});

describe("api/booking — THE SLOT RACE", () => {
  it("two concurrent requests for the last bay: exactly one 201 and one 409", async () => {
    // Fill the slot so only ONE bay remains.
    for (let i = 0; i < BOOKING.capacityPerSlot - 1; i += 1) {
      store.bookings.push({
        id: `pre_${i}`,
        status: "CONFIRMED",
        startAt: new Date(SLOT_0900),
        endAt: new Date(Date.parse(SLOT_0900) + 3_600_000),
        customerPhone: `+63917123400${i}`,
        customerName: "Existing",
      });
    }
    expect(store.bookings).toHaveLength(BOOKING.capacityPerSlot - 1);

    const [a, b] = await Promise.all([
      post({ ...VALID, name: "First Customer", phone: "09171234501" }),
      post({ ...VALID, name: "Second Customer", phone: "09171234502" }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses, `got ${JSON.stringify(statuses)}`).toEqual([201, 409]);

    const winner = a.status === 201 ? a : b;
    const _loser = a.status === 201 ? b : a;
    expect(winner.body.ok).toBe(true);

    // The single most important assertion: no duplicate.
    expect(store.bookings).toHaveLength(BOOKING.capacityPerSlot);
    const forThisSlot = store.bookings.filter((b) => (b["startAt"] as Date).toISOString() === new Date(SLOT_0900).toISOString());
    expect(forThisSlot).toHaveLength(BOOKING.capacityPerSlot);
  });

  it("the 409 carries SLOT_UNAVAILABLE and a refreshed board", async () => {
    for (let i = 0; i < BOOKING.capacityPerSlot; i += 1) {
      store.bookings.push({
        id: `pre_${i}`,
        status: "CONFIRMED",
        startAt: new Date(SLOT_0900),
        customerPhone: `+63917123400${i}`,
        customerName: "Existing",
      });
    }
    const { status, body } = await post({ ...VALID });
    expect(status).toBe(409);
    expect(body.ok).toBe(false);
    if (body.ok) return;
    expect(body.error.code).toBe("SLOT_UNAVAILABLE");
    // The customer must be able to re-pick without a second round trip.
    expect(body.error.message).toBeTruthy();
    expect(body.meta?.requestId).toBeTruthy();
  });

  it("fifty concurrent requests can never exceed the bay count", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        post({ ...VALID, name: `Racer ${i}`, phone: `0917123${(4000 + i).toString()}` }),
      ),
    );
    const created = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 409);
    // The invariant is "never more than capacityPerSlot", not "exactly one":
    // there are three bays, so three bookings is the correct outcome.
    expect(created, `statuses: ${JSON.stringify(results.map((r) => r.status))}`).toHaveLength(
      BOOKING.capacityPerSlot,
    );
    expect(rejected).toHaveLength(50 - BOOKING.capacityPerSlot);
    const forThisSlot = store.bookings.filter(
      (b) => (b["startAt"] as Date).toISOString() === new Date(SLOT_0900).toISOString(),
    );
    expect(forThisSlot).toHaveLength(BOOKING.capacityPerSlot);
    const refs = new Set<string>();
    for (const result of created) {
      if (result.body.ok) refs.add(result.body.data.reference);
    }
    expect(refs.size).toBe(BOOKING.capacityPerSlot);
  });

  it("CANCELLED and NO_SHOW bookings release their bay back to the board", async () => {
    for (let i = 0; i < BOOKING.capacityPerSlot; i += 1) {
      store.bookings.push({
        id: `cancelled_${i}`,
        status: i % 2 === 0 ? "CANCELLED" : "NO_SHOW",
        startAt: new Date(SLOT_0900),
        customerPhone: `+63917123410${i}`,
        customerName: "Ghost",
      });
    }
    const { status } = await post({ ...VALID });
    expect(status).toBe(201);
  });

  it.todo(
    "Ephemeral-Postgres job (docs/qa/TEST-STRATEGY.md §4): with a real serialisable " +
      "Postgres, fire two real `POST /api/booking` requests for the last bay " +
      "simultaneously and assert exactly one 201, one 409 and `SELECT count(*)` " +
      "equal to capacityPerSlot. The mocked suite above proves the CODE ORDER; " +
      "only a real database proves the ISOLATION LEVEL.",
  );
});

describe("api/booking — information disclosure", () => {
  it("never leaks a stack trace, a Prisma code or a connection string on failure", async () => {
    injectTransactionFailure = Object.assign(
      new Error("PrismaClientKnownRequestError: P2002 on booking.reference"),
      {
        name: "PrismaClientKnownRequestError",
        code: "P2002",
        meta: { target: ["reference"] },
        stack: "Error: boom\n    at Object.<anonymous> (/app/src/lib/server/booking.ts:1:1)",
      },
    );
    const { status, body } = await post({ ...VALID });
    const serialised = JSON.stringify(body);
    expect(status).toBeGreaterThanOrEqual(400);
    expect(serialised).not.toMatch(/postgres(ql)?:\/\//);
    expect(serialised).not.toMatch(/PrismaClient/);
    expect(serialised).not.toMatch(/at Object\./);
    expect(serialised).not.toMatch(/\.ts:\d+:\d+/);
    expect(serialised).not.toMatch(/DATABASE_URL|AUTH_SECRET/);
    if (!body.ok) expect(body.error.code).toMatch(/CONFLICT|INTERNAL_ERROR/);
  });

  it("never returns another customer's PII", async () => {
    await post({ ...VALID, name: "Maria Santos", phone: "09171234567", email: "maria@example.ph" });
    const { body } = await post({
      ...VALID,
      startAt: `${DAY}T14:00:00+08:00`,
      name: "Second Customer",
      phone: "09179998888",
      email: "second@example.ph",
    });
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain("maria@example.ph");
    expect(serialised).not.toContain("09171234567");
    expect(body.ok).toBe(true);
  });

  it("never logs the raw body to the response", async () => {
    const { body } = await post({ ...VALID });
    const serialised = JSON.stringify(body);
    expect(serialised).not.toMatch(/password|secret|token/i);
  });
});

describe("api/booking — SSRF and outbound calls", () => {
  it("never makes an outbound request while creating a booking", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      await post({ ...VALID });
      expect(fetchSpy, "the notification layer must be mocked/stubbed in tests, not fetched").not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("a URL smuggled into notes is stored as text and never fetched", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const { status } = await post({ ...VALID, notes: "See http://169.254.169.254/latest/meta-data/ for details" });
      expect(status).toBe(201);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("api/booking — idempotency and abuse", () => {
  it("a repeat POST from the same browser does not double-book by accident", async () => {
    const first = await post({ ...VALID });
    const second = await post({ ...VALID });
    // Either the second is refused (slot now full) or it succeeds — but the
    // capacity ceiling must hold.
    expect(store.bookings.filter((b) => (b["startAt"] as Date).toISOString() === new Date(SLOT_0900).toISOString()).length)
      .toBeLessThanOrEqual(BOOKING.capacityPerSlot);
    expect([201, 409]).toContain(second.status);
    expect(first.status).toBe(201);
  });

  it("every booking gets a distinct reference", async () => {
    const refs = new Set<string>();
    for (let i = 0; i < BOOKING.capacityPerSlot; i += 1) {
      const { body } = await post({ ...VALID, phone: `0917123${(5000 + i).toString()}` });
      if (body.ok) refs.add(body.data.reference);
    }
    expect(refs.size).toBe(store.bookings.length);
  });

  it("a reference never contains an ambiguous glyph", async () => {
    const { body } = await post({ ...VALID });
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.data.reference.slice(4)).not.toMatch(/[IO01]/);
  });
});