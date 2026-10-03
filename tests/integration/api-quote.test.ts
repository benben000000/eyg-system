// @vitest-environment node
/**
 * QA & SECURITY AGENT — POST /api/quote (the instant estimator lead).
 * ============================================================================
 * DATABASE STRATEGY: typed in-memory Prisma fake, as documented in
 * docs/qa/TEST-STRATEGY.md §3. No network; the clock is pinned.
 *
 * WHAT THIS ENDPOINT ACTUALLY RETURNS
 * ----------------------------------
 * `QuoteRequestDto` — a reference plus the estimate min/max. The full
 * `QuoteEstimateDto` is computed CLIENT-side by
 * `src/components/widgets/internal/quote-engine.ts` so a number is always on
 * screen; this route records the lead and hands back the reference the customer
 * quotes on the phone.
 *
 * The honesty gate (`isApproximate`, `disclaimer`, the 60%-of-midpoint rule)
 * therefore has to be proven on the ENGINE, not on this response — that lives in
 * tests/unit/quote-math.test.ts. What this file proves is that the engine's
 * verdict survives the HTTP boundary: the estimate the shop records is the
 * estimate the customer was shown, and the recorded `isApproximate` matches.
 * ============================================================================
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiFailure, ApiSuccess, QuoteRequestDto } from "@/lib/types";
import { APPROXIMATE_SPREAD_RATIO, QUOTE_TTL_DAYS, estimate } from "@/lib/server/quote";

// ── Fixtures ────────────────────────────────────────────────────────────────

const DAY = "2026-03-11";
const PINNED_NOW = new Date(`${DAY}T06:00:00+08:00`);

function service(over: Record<string, unknown> & { id: string; slug: string; name: string }): Record<string, unknown> {
  return {
    shortName: null,
    summary: "",
    description: "",
    pricing: "FIXED",
    priceMin: 0,
    priceMax: 0,
    priceNote: null,
    durationMin: 60,
    isPopular: false,
    isFeatured: false,
    requiresVehicle: false,
    includes: [],
    excludes: [],
    sortOrder: 0,
    isActive: true,
    categoryId: "cat",
    category: { slug: "general", name: "General", icon: null },
    ...over,
  };
}

const FIXED = service({ id: "svc_pms_a", slug: "pms-a", name: "PMS A (Oil + Filter)", priceMin: 1800, priceMax: 1800 });
const RANGED = service({
  id: "svc_brakes",
  slug: "brake-pad-replacement",
  name: "Brake Pad Replacement",
  pricing: "RANGE",
  priceMin: 2200,
  priceMax: 3400,
});
const VARIABLE = service({
  id: "svc_undercoat",
  slug: "undercoating",
  name: "Undercoating",
  pricing: "CALL_FOR_PRICE",
  priceMin: null,
  priceMax: null,
  priceNote: "Depends on vehicle size and rust condition.",
});

interface Db {
  services: Record<string, unknown>[];
  packages: Record<string, unknown>[];
  promos: Record<string, unknown>[];
  quotes: Record<string, unknown>[];
  customers: Record<string, unknown>[];
  businessHours: Record<string, unknown>[];
  bookings: Record<string, unknown>[];
  closures: Record<string, unknown>[];
  holidays: Record<string, unknown>[];
  settings: Record<string, unknown>[];
}

const db: Db = {
  services: [],
  packages: [],
  promos: [],
  quotes: [],
  customers: [],
  businessHours: [],
  bookings: [],
  closures: [],
  holidays: [],
  settings: [],
};

vi.mock("@/lib/server/db", () => ({
  prisma: {
    service: {
      findMany: async (args: { where?: { id?: { in?: string[] } } }) => {
        const ids = args.where?.id?.in;
        return db.services.filter((s) => (ids ? ids.includes(String(s["id"])) : true));
      },
    },
    package: {
      findFirst: async (args: { where: { id: string } }) =>
        db.packages.find((p) => p["id"] === args.where.id) ?? null,
    },
    promotion: {
      findFirst: async (args: { where: { code: string; isActive: boolean } }) =>
        db.promos.find((p) => p["code"] === args.where.code && p["isActive"] === args.where.isActive) ?? null,
    },
    quoteRequest: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `qt_${db.quotes.length + 1}`, createdAt: new Date(), ...data };
        db.quotes.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { reference: string } }) =>
        db.quotes.find((q) => q["reference"] === where.reference) ?? null,
    },
    customer: {
      findUnique: async ({ where }: { where: { phone: string } }) =>
        db.customers.find((c) => c["phone"] === where.phone) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `cus_${db.customers.length + 1}`, ...data };
        db.customers.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = db.customers.find((c) => c["id"] === where.id);
        if (existing) Object.assign(existing, data);
        return existing ?? { id: where.id, ...data };
      },
    },
    // The availability board, so the "next bookable slot" lookup works.
    businessHours: { findMany: async () => [...db.businessHours] },
    booking: { findMany: async () => [...db.bookings] },
    bayClosure: { findMany: async () => [...db.closures] },
    holiday: { findMany: async () => [...db.holidays] },
    setting: {
      findUnique: async (args: { where: { key: string } }) =>
        db.settings.find((s) => s["key"] === args.where.key) ?? null,
      findMany: async () => [...db.settings],
    },
  },
  withSerializableRetry: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}),
}));

vi.mock("@/lib/captcha", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    captchaProvider: () => "disabled",
    verifyCaptcha: async () => ({ provider: "disabled", spamSignal: false }),
  };
});

vi.mock("@/lib/ratelimit", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    rateLimit: async () => ({ success: true, remaining: 999, limit: 1000, reset: Date.now() + 3_600_000 }),
    rateLimitHeaders: () => ({}),
  };
});

// ── Harness ─────────────────────────────────────────────────────────────────

function req(url: string, body: unknown, headers: Record<string, string> = {}): never {
  const encoded = JSON.stringify(body);
  return {
    nextUrl: new URL(url),
    url,
    method: "POST",
    headers: new Headers({ "content-type": "application/json", ...headers }),
    cookies: { get: () => undefined, getAll: () => [] },
    ip: "203.0.113.91",
    json: async () => JSON.parse(encoded),
    text: async () => encoded,
  } as never;
}

const QUOTE_URL = "http://localhost:3000/api/quote";

async function postQuote(
  body: unknown,
): Promise<{ status: number; json: ApiSuccess<QuoteRequestDto> | ApiFailure; headers: Headers }> {
  vi.resetModules();
  const route = await import("@/app/api/quote/route");
  const response = await route.POST(req(QUOTE_URL, body));
  return {
    status: response.status,
    json: (await response.json()) as ApiSuccess<QuoteRequestDto> | ApiFailure,
    headers: response.headers,
  };
}

beforeEach(() => {
  db.services = [FIXED, RANGED, VARIABLE];
  db.packages = [];
  db.promos = [];
  db.quotes = [];
  db.customers = [];
  db.businessHours = [];
  db.bookings = [];
  db.closures = [];
  db.holidays = [];
  db.settings = [];
  vi.useFakeTimers();
  vi.setSystemTime(PINNED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const VALID = { name: "Maria Santos", phone: "09171234567", consentSms: true, serviceIds: ["svc_pms_a"] };

// ─────────────────────────────────────────────────────────────────────────────

describe("api/quote — the recorded lead", () => {
  it("returns 201 with a QuoteRequestDto", async () => {
    const result = await postQuote(VALID);
    expect(result.status, JSON.stringify(result.json)).toBe(201);
    expect(result.json.ok).toBe(true);
    if (!result.json.ok) return;
    expect(result.json.data.reference).toMatch(/^EYG-Q-[A-Z0-9]{6}$/);
    expect(result.json.data.requestedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.json.data.estimateMin).toBeLessThanOrEqual(result.json.data.estimateMax);
  });

  it("records the estimate the customer was shown — the engine and the response agree", async () => {
    const result = await postQuote(VALID);
    expect(result.json.ok).toBe(true);
    if (!result.json.ok) return;
    const engine = await estimate({ serviceIds: ["svc_pms_a"], now: PINNED_NOW });
    expect(result.json.data.estimateMin).toBe(engine.dto.min);
    expect(result.json.data.estimateMax).toBe(engine.dto.max);
  });

  it("persists the honesty verdict, not just the numbers", async () => {
    await postQuote({ ...VALID, serviceIds: ["svc_undercoat"] });
    expect(db.quotes).toHaveLength(1);
    const selections = db.quotes[0]!["selections"] as Record<string, unknown>;
    expect(selections["isApproximate"]).toBe(true);
  });

  it("persists promoStatus so the shop knows whether the code applied", async () => {
    await postQuote({ ...VALID, promoCode: "NOPE" });
    const selections = db.quotes[0]!["selections"] as Record<string, unknown>;
    expect(selections["promoStatus"]).toBe("NOT_FOUND");
  });

  it("never records a lead for an invalid selection", async () => {
    const result = await postQuote({ ...VALID, serviceIds: ["svc_nope"] });
    expect(result.status).toBe(400);
    expect(db.quotes).toHaveLength(0);
    expect(db.customers).toHaveLength(0);
  });

  it("records the phone once and reuses the customer across requests", async () => {
    await postQuote(VALID);
    await postQuote({ ...VALID, serviceIds: ["svc_brakes"] });
    expect(db.quotes).toHaveLength(2);
    expect(db.customers).toHaveLength(1);
  });

  it("expiresAt is QUOTE_TTL_DAYS out, per the engine contract", async () => {
    const engine = await estimate({ serviceIds: ["svc_pms_a"], now: PINNED_NOW });
    expect(Date.parse(engine.dto.expiresAt)).toBe(PINNED_NOW.getTime() + QUOTE_TTL_DAYS * 86_400_000);
  });

  it("a fixed-price service records a single figure", async () => {
    const result = await postQuote(VALID);
    expect(result.json.ok).toBe(true);
    if (!result.json.ok) return;
    expect(result.json.data.estimateMin).toBe(1800);
    expect(result.json.data.estimateMax).toBe(1800);
  });

  it("a wide band is recorded with isApproximate true", async () => {
    db.services = [
      service({
        id: "svc_wide",
        slug: "full-underbody-repair",
        name: "Full underbody repair",
        pricing: "RANGE",
        priceMin: 500,
        priceMax: 9000,
      }),
    ];
    const result = await postQuote({ ...VALID, serviceIds: ["svc_wide"] });
    expect(result.json.ok).toBe(true);
    if (!result.json.ok) return;
    const midpoint = (result.json.data.estimateMin + result.json.data.estimateMax) / 2;
    const ratio = (result.json.data.estimateMax - result.json.data.estimateMin) / midpoint;
    expect(ratio).toBeGreaterThan(APPROXIMATE_SPREAD_RATIO);
    expect((db.quotes[0]!["selections"] as Record<string, unknown>)["isApproximate"]).toBe(true);
  });

  it("never lets a promo make the recorded estimate negative", async () => {
    db.promos.push({
      slug: "absurd",
      title: "Absurd",
      kind: "PERCENT_OFF",
      code: "ABSURD",
      valuePct: 400,
      valueOff: null,
      isActive: true,
      startsAt: null,
      endsAt: null,
    });
    const result = await postQuote({ ...VALID, promoCode: "ABSURD" });
    expect(result.json.ok).toBe(true);
    if (!result.json.ok) return;
    expect(result.json.data.estimateMin).toBeGreaterThanOrEqual(0);
    expect(result.json.data.estimateMax).toBeGreaterThanOrEqual(0);
  });

  it("the response is never cached", async () => {
    const result = await postQuote(VALID);
    expect(result.headers.get("cache-control")).toContain("no-store");
  });
});

describe("api/quote — validation and abuse", () => {
  it.each([
    ["name missing", { name: undefined }],
    ["name too short", { name: "M" }],
    ["phone is a landline", { phone: "81234567" }],
    ["phone is a foreign number", { phone: "+14155552671" }],
    ["email malformed", { email: "nope" }],
    ["unknown service id", { serviceIds: ["svc_nope"] }],
    ["no services selected", { serviceIds: [] }],
    ["unknown key", { admin: true }],
  ])("rejects %s with 400 and writes nothing", async (_label, patch) => {
    const payload: Record<string, unknown> = { ...VALID, ...patch };
    for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
      if (value === undefined) delete payload[key];
      else payload[key] = value;
    }
    const result = await postQuote(payload);
    expect(result.status, `${_label}: ${JSON.stringify(result.json)}`).toBe(400);
    expect(result.json.ok).toBe(false);
    if (!result.json.ok) expect(result.json.error.code).toBe("VALIDATION_ERROR");
    expect(db.quotes).toHaveLength(0);
  });

  it("cannot be used to enumerate the catalogue by probing ids", async () => {
    const probes = await Promise.all(
      Array.from({ length: 10 }, (_, i) => postQuote({ ...VALID, serviceIds: [`svc_probe_${i}`] })),
    );
    for (const probe of probes) expect(probe.status).toBe(400);
    expect(db.quotes).toHaveLength(0);
  });

  it("never leaks a stack trace, a Prisma code or a connection string", async () => {
    const result = await postQuote({ ...VALID, serviceIds: ["svc_nope"] });
    const serialised = JSON.stringify(result.json);
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(serialised).not.toMatch(/postgres(ql)?:\/\//);
    expect(serialised).not.toMatch(/PrismaClient|at Object\./);
    expect(serialised).not.toMatch(/\.ts:\d+:\d+/);
  });

  it("never makes an outbound request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      await postQuote(VALID);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("a URL smuggled into a vehicle field is stored as text and never fetched", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      await postQuote({ ...VALID, vehicleMake: "http://169.254.169.254/" });
      // The value is nonsense, not dangerous. What matters is that the server
      // never dereferences a user-supplied string.
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("does not store another customer's data in a new lead", async () => {
    await postQuote({ ...VALID, email: "maria@example.ph" });
    await postQuote({ ...VALID, serviceIds: ["svc_brakes"], email: "juan@example.ph" });
    const second = db.quotes[1]!;
    expect(JSON.stringify(second)).not.toContain("maria@example.ph");
  });
});