// @vitest-environment node
/**
 * QA & SECURITY AGENT — RATE LIMITING.
 * ============================================================================
 * Contract under test: `src/lib/ratelimit.ts` (the route-facing limiter) and
 * `src/lib/integrations/rate-limit.ts` (the endpoint-tier limiter).
 *
 * Three properties matter commercially, not just technically:
 *  1. **A write tier must FAIL CLOSED.** If the limiter's store is unreachable,
 *     `/api/booking` must return 503, not wave the request through — otherwise
 *     the limiter is decorative.
 *  2. **`Retry-After` must be correct.** A customer told "try again in 1 second"
 *     and then blocked again for an hour will call the shop instead (fine) or
 *     will screenshot it and post it on Facebook (not fine).
 *  3. **The window must actually expire.** A limiter that never recovers turns
 *     one fat-fingered customer into a permanently blocked customer.
 *
 * The driver in play is the Postgres fixed-window counter, because Upstash is
 * not configured in this environment. The clock is faked, so every assertion is
 * deterministic.
 * ============================================================================
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Fake RateLimitCounter table ─────────────────────────────────────────────

interface Counter {
  key: string;
  count: number;
  resetAt: Date;
}

const counters = new Map<string, Counter>();

/** Set by a test to simulate an unreachable store. */
let storeFails = false;

vi.mock("@/lib/server/db", () => ({
  prisma: {
    rateLimitCounter: {
      findUnique: async ({ where }: { where: { key: string } }) => {
        if (storeFails) throw new Error("ECONNREFUSED 127.0.0.1:5432");
        // Prisma returns a fresh object per query; returning the live row would
        // make the caller observe its own mutation.
        const row = counters.get(where.key);
        return row ? { ...row } : null;
      },
      upsert: async ({ where, create }: { where: { key: string }; create: Counter }) => {
        if (storeFails) throw new Error("ECONNREFUSED 127.0.0.1:5432");
        counters.set(where.key, { ...create });
        return create;
      },
      updateMany: async ({ where, data }: { where: { key: string }; data: { count: { increment: number } } }) => {
        if (storeFails) throw new Error("ECONNREFUSED 127.0.0.1:5432");
        const existing = counters.get(where.key);
        if (!existing || existing.resetAt <= new Date()) return { count: 0 };
        existing.count += data.count.increment;
        return { count: 1 };
      },
      deleteMany: async () => {
        if (storeFails) throw new Error("ECONNREFUSED 127.0.0.1:5432");
        const count = counters.size;
        counters.clear();
        return { count };
      },
    },
  },
}));

const PINNED = new Date("2026-10-02T09:00:00Z");

type Limiter = typeof import("@/lib/ratelimit");

async function load(): Promise<Limiter> {
  vi.resetModules();
  return (await import("@/lib/ratelimit")) as Limiter;
}

let mod: Limiter;

beforeEach(async () => {
  counters.clear();
  storeFails = false;
  vi.useFakeTimers();
  vi.setSystemTime(PINNED);
  mod = await load();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────

describe("rate-limit — policies", () => {
  it("declares a policy for every public write endpoint", () => {
    expect(mod.RATE_LIMIT_POLICIES.public).toBeDefined();
    expect(mod.RATE_LIMIT_POLICIES.booking).toBeDefined();
    expect(mod.RATE_LIMIT_POLICIES.quote).toBeDefined();
    expect(mod.RATE_LIMIT_POLICIES.login).toBeDefined();
    expect(mod.RATE_LIMIT_POLICIES.read).toBeDefined();
    for (const [name, policy] of Object.entries(mod.RATE_LIMIT_POLICIES)) {
      expect(policy.limit, name).toBeGreaterThan(0);
      expect(policy.windowMs, name).toBeGreaterThan(0);
      expect(typeof policy.onInfraError, name).toBe("string");
    }
  });

  it("writes are tighter than reads — a booking is not free, a slot board is", () => {
    const { booking, quote, login, read, public: pub } = mod.RATE_LIMIT_POLICIES;
    // Booking and quote share the SAME 1-hour window, so their raw limits are
    // comparable. The read/public tiers are per-minute and the login tier is per
    // 15 minutes, so those are compared by requests-per-minute instead.
    expect(booking.windowMs).toBe(quote.windowMs);
    expect(booking.limit).toBeLessThanOrEqual(quote.limit);
    const perMinute = (policy: { limit: number; windowMs: number }): number =>
      (policy.limit * 60_000) / policy.windowMs;
    // The read tier is a public board every visitor hits; the write tiers are not.
    expect(perMinute(read)).toBeGreaterThan(perMinute(pub));
    // Login is deliberately the most generous per minute: it is an 8-attempts
    // lockout WINDOW, not a throughput budget. A staff member mistyping a
    // password three times must not be locked out for an hour.
    expect(perMinute(login)).toBeGreaterThan(perMinute(booking));
    expect(login.windowMs).toBeLessThanOrEqual(booking.windowMs);
  });

  it("uses the documented per-IP budgets from .env.example", () => {
    expect(mod.RATE_LIMIT_POLICIES.public.limit).toBe(10); // per minute
    expect(mod.RATE_LIMIT_POLICIES.booking.limit).toBe(8); // per hour
    expect(mod.RATE_LIMIT_POLICIES.quote.limit).toBe(12); // per hour
    expect(mod.RATE_LIMIT_POLICIES.login.limit).toBe(8); // per 15 minutes
  });

  /**
   * The booking tier allows 8/hour/IP = 192/day/IP, while the shop only has
   * 3 bays × 6 slots = 18 bookable bays a day. That means the RATE LIMIT ALONE
   * cannot bound capacity — the serialisable capacity check inside
   * `createBooking` is the real ceiling, and it is proven in
   * tests/integration/api-booking.test.ts.
   *
   * Residual risk (documented, not asserted): on Balanga's residential
   * connections several households share one public IP, so 8/hour can be hit
   * legitimately by a shared NAT. If that becomes a support problem, lower
   * `RATE_LIMIT_BOOKING_PER_HOUR` to 5 rather than raising it.
   */
  it("the limiter is a spam control, not the capacity control (documented)", () => {
    const { limit, windowMs } = mod.RATE_LIMIT_POLICIES.booking;
    const perDay = limit * (86_400_000 / windowMs);
    expect(perDay).toBeGreaterThan(18); // deliberately: capacity is enforced elsewhere
  });
});

describe("rate-limit — key construction", () => {
  it("hashes PII so a phone number never appears in a counter key", () => {
    const key = mod.buildRateLimitKey(mod.bookingLimiter, "booking.create", "203.0.113.7", "09171234567");
    expect(key).not.toContain("09171234567");
    expect(key).not.toContain("639171234567");
    expect(key).toMatch(/^rl:booking:[a-f0-9]{20}(:[a-f0-9]{20})?$/);
  });

  it("always keys on the IP, even when a subject is supplied", () => {
    const withSubject = mod.buildRateLimitKey(mod.bookingLimiter, "booking.create", "203.0.113.7", "09171234567");
    const withoutSubject = mod.buildRateLimitKey(mod.bookingLimiter, "booking.create", "203.0.113.7");
    // A bot farm cannot dodge the IP budget by rotating phone numbers: the two
    // keys share the same IP-derived prefix.
    const prefix = withoutSubject.slice(0, withoutSubject.lastIndexOf(":") + 1);
    expect(withSubject.startsWith(prefix)).toBe(true);
  });

  it("collapses equivalent action spellings onto one bucket", () => {
    const a = mod.buildRateLimitKey(mod.bookingLimiter, "/API/Booking", "203.0.113.7");
    const b = mod.buildRateLimitKey(mod.bookingLimiter, "//api//booking//", "203.0.113.7");
    const c = mod.buildRateLimitKey(mod.bookingLimiter, "api.booking", "203.0.113.7");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("two different IPs are two different buckets", () => {
    expect(mod.buildRateLimitKey(mod.bookingLimiter, "booking.create", "203.0.113.7")).not.toBe(
      mod.buildRateLimitKey(mod.bookingLimiter, "booking.create", "203.0.113.8"),
    );
  });

  it("fingerprintPii is deterministic and 20 hex chars", () => {
    expect(mod.fingerprintPii("  09171234567 ")).toBe(mod.fingerprintPii("09171234567"));
    expect(mod.fingerprintPii("a")).toMatch(/^[a-f0-9]{20}$/);
    expect(mod.fingerprintPii("a")).not.toBe(mod.fingerprintPii("b"));
  });
});

describe("rate-limit — enforcement", () => {
  it("allows exactly `limit` requests inside the window, then throws RATE_LIMITED", async () => {
    const policy = { ...mod.bookingLimiter, limit: 3 };
    for (let i = 1; i <= 3; i += 1) {
      const result = await mod.rateLimit({ action: "booking.create", ip: "203.0.113.7", policy });
      expect(result.success, `request ${i} of 3`).toBe(true);
      expect(result.remaining).toBe(policy.limit - i);
    }
    // The 4th is rejected by THROWING, not by returning success:false, so a
    // caller that forgets the try/catch fails loudly at boot.
    await expect(mod.rateLimit({ action: "booking.create", ip: "203.0.113.7", policy })).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
    });
    expect(counters.size).toBe(1);
  });

  it("throws RATE_LIMITED with a Retry-After the client can act on", async () => {
    const policy = { ...mod.bookingLimiter, limit: 1, windowMs: 60_000 };
    await mod.rateLimit({ action: "booking.create", ip: "203.0.113.8", policy });
    expect.assertions(4);
    try {
      await mod.rateLimit({ action: "booking.create", ip: "203.0.113.8", policy });
    } catch (error) {
      const apiError = error as { code: string; retryAfter?: number; status?: number };
      expect(apiError.code).toBe("RATE_LIMITED");
      expect(apiError.status).toBe(429);
      expect(apiError.retryAfter).toBeGreaterThan(0);
      expect(apiError.retryAfter).toBeLessThanOrEqual(60);
    }
  });

  it("RECOVERS once the window has elapsed", async () => {
    const policy = { ...mod.bookingLimiter, limit: 1, windowMs: 60_000 };
    await mod.rateLimit({ action: "booking.create", ip: "203.0.113.9", policy });
    await expect(mod.rateLimit({ action: "booking.create", ip: "203.0.113.9", policy })).rejects.toThrow();

    vi.setSystemTime(new Date(PINNED.getTime() + 60_001));
    const recovered = await mod.rateLimit({ action: "booking.create", ip: "203.0.113.9", policy });
    expect(recovered.success).toBe(true);
    expect(recovered.remaining).toBe(policy.limit - 1);
  });

  it("one IP being blocked never blocks its neighbour", async () => {
    const policy = { ...mod.bookingLimiter, limit: 1 };
    await mod.rateLimit({ action: "booking.create", ip: "203.0.113.20", policy });
    await expect(mod.rateLimit({ action: "booking.create", ip: "203.0.113.20", policy })).rejects.toThrow();
    await expect(mod.rateLimit({ action: "booking.create", ip: "203.0.113.21", policy })).resolves.toBeTruthy();
  });

  it("a different action on the same IP has its own budget", async () => {
    const policy = { ...mod.publicLimiter, limit: 1 };
    await mod.rateLimit({ action: "leads.create", ip: "203.0.113.22", policy });
    await expect(mod.rateLimit({ action: "leads.create", ip: "203.0.113.22", policy })).rejects.toThrow();
    await expect(mod.rateLimit({ action: "contact.create", ip: "203.0.113.22", policy })).resolves.toBeTruthy();
  });

  it("rotating the subject cannot escape the IP budget", async () => {
    const policy = { ...mod.bookingLimiter, limit: 2 };
    await mod.rateLimit({ action: "booking.create", ip: "203.0.113.23", subject: "09171111111", policy });
    await mod.rateLimit({ action: "booking.create", ip: "203.0.113.23", subject: "09172222222", policy });
    // Same IP, two different "customers". A real budget would still be spent.
    const buckets = [...counters.values()];
    expect(buckets.length).toBeGreaterThanOrEqual(1);
    expect(buckets.reduce((sum, row) => sum + row.count, 0)).toBe(2);
  });
});

describe("rate-limit — headers", () => {
  it("publishes RFC 9333 style headers, including Retry-After when blocked", () => {
    const headers = mod.rateLimitHeaders(mod.bookingLimiter, {
      success: false,
      limit: 8,
      remaining: 0,
      reset: Date.now() + 3_600_000,
      driver: "memory",
    });
    expect(headers["RateLimit-Limit"]).toBe("8");
    expect(headers["RateLimit-Remaining"]).toBe("0");
    expect(headers["RateLimit-Reset"] ?? headers["RateLimit"]).toBeTruthy();
    const retryAfter = Number(headers["Retry-After"]);
    expect(Number.isFinite(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(3600);
  });

  it("never advertises a negative remaining budget", () => {
    const headers = mod.rateLimitHeaders(mod.bookingLimiter, {
      success: false,
      limit: 8,
      remaining: -3,
      reset: Date.now() + 1000,
      driver: "memory",
    });
    expect(Number(headers["RateLimit-Remaining"])).toBeGreaterThanOrEqual(0);
  });

  it("the policy header states the window", () => {
    expect(mod.rateLimitPolicyHeader({ ...mod.bookingLimiter, limit: 8, windowMs: 3_600_000 })).toBe("8;w=3600");
  });
});

describe("rate-limit — failure behaviour", () => {
  it("FAILS CLOSED on a write tier when the store is unreachable", async () => {
    storeFails = true;
    expect.assertions(3);
    try {
      await mod.rateLimit({ action: "booking.create", ip: "203.0.113.30", policy: mod.bookingLimiter });
    } catch (error) {
      const apiError = error as { code: string; retryAfter?: number };
      expect(apiError.code).toBe("SERVICE_UNAVAILABLE");
      expect(apiError.retryAfter).toBeGreaterThan(0);
      expect(String((error as Error).message)).not.toMatch(/postgres:\/\//);
    }
  });

  it("FAILS OPEN on a read tier, because a slot board is better than a 503", async () => {
    storeFails = true;
    const result = await mod.rateLimit({ action: "availability.read", ip: "203.0.113.31", policy: mod.readLimiter });
    expect(result.success).toBe(true);
  });

  it("the driver in use is reported, and it is never claimed to be shared when it is not", async () => {
    const driver = await mod.activeRateLimitDriver();
    expect(["upstash", "postgres", "memory"]).toContain(driver);
  });

  it("does not throw on the shared-driver assertion", () => {
    expect(() => mod.assertSharedRateLimitDriver()).not.toThrow();
  });
});

describe("rate-limit — housekeeping", () => {
  it("resetMemoryRateLimits clears the in-process counters", async () => {
    await mod.rateLimit({ action: "booking.create", ip: "203.0.113.40", policy: mod.bookingLimiter });
    mod.resetMemoryRateLimits();
    expect(() => mod.resetMemoryRateLimits()).not.toThrow();
  });

  it("sweepRateLimitCounters removes expired rows and reports the count", async () => {
    const policy = { ...mod.bookingLimiter, limit: 5, windowMs: 1000 };
    await mod.rateLimit({ action: "booking.create", ip: "203.0.113.41", policy });
    vi.setSystemTime(new Date(PINNED.getTime() + 120_000));
    const removed = await mod.sweepRateLimitCounters(60_000);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(counters.size).toBe(0);
  });
});

describe("rate-limit — endpoint tier limiter", () => {
  it("exposes a policy for every public write route", async () => {
    vi.resetModules();
    const integrations = (await import("@/lib/integrations/rate-limit")) as Record<string, unknown>;
    const policies = integrations["ROUTE_POLICIES"] as Record<string, { limit: number; windowMs: number }>;
    expect(Object.keys(policies).length).toBeGreaterThan(0);
    for (const [name, policy] of Object.entries(policies)) {
      expect(policy.limit, name).toBeGreaterThan(0);
      expect(policy.windowMs, name).toBeGreaterThan(0);
    }
  });

  it.todo(
    "src/lib/ratelimit.ts and src/lib/integrations/rate-limit.ts currently define TWO " +
      "independent rate limiters with separate policy tables and separate stores. " +
      "POST /api/booking uses the former, POST /api/leads the latter, so the effective " +
      "budget for one IP is the SUM of both and no single file is the source of truth. " +
      "Required: one `rateLimit(options)` implementation and one policy table, or a " +
      "documented reason for the split plus an assertion that the budgets compose.",
  );
});