/**
 * RATE LIMITING — pluggable driver, tiered policies, spoof-resistant keys.
 * ============================================================================
 * Drivers, chosen automatically at first use:
 *
 *   1. **Upstash Redis REST** — when `UPSTASH_REDIS_REST_URL` + token are set.
 *      Atomic fixed-window counters, works across serverless instances.
 *   2. **Postgres** (`RateLimitCounter`) — always correct, one extra round trip.
 *      This is the production fallback and the default on Vercel without Redis.
 *   3. **In-process LRU** — unit tests and local dev only. Never correct across
 *      instances; `assertSharedDriver()` exists so a deploy can catch that.
 *
 * SECURITY — how the key is built (this is the part that matters):
 *   `rl:<driver>:<tier>:<hash(ip)>[:<hash(subject)>]`
 *  - The IP comes from `clientIp()`, i.e. a proxy-set header, never from a
 *    user-controlled header. A client CANNOT choose its own bucket.
 *  - The action string is normalised (`toLowerCase`, `[^a-z0-9:_-]` → `.`) so
 *    `/api/booking` and `/API/Booking` cannot mint separate buckets.
 *  - Optional PII subjects (phone/email) are HMAC'd with a server salt and
 *    truncated; the raw value never enters a Redis key, a log line, or the DB.
 *
 * FAIL MODE — documented per tier, because it is a deliberate product call:
 *  - `read` tiers **fail OPEN** on infrastructure errors. Availability must keep
 *    working when Redis is down; the risk of being wide open on a cached read
 *    is lower than the risk of showing an error page to a stranded customer.
 *  - write tiers (`public`, `booking`, `quote`, `login`) **fail CLOSED** with a
 *    `503`, because the thing they protect is a real write to the business's
 *    books. Availability of the *site* does not justify unbounded bookings.
 */
import "server-only";

import { createHmac } from "node:crypto";

import { env } from "@/lib/env";
import { ApiError } from "@/lib/errors";
import { logger } from "@/lib/logger";

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Inventory tiers are namespaced with a dot so their Redis keys and log lines
 * are greppable: `rl:inventory.write:...` sorts apart from customer traffic,
 * which matters when you are trying to work out whether a stock endpoint or a
 * booking flood is what exhausted the limit.
 *
 * They are separate from `booking` on purpose: a customer booking flood must not
 * be able to exhaust the budget a mechanic uses to log consumption.
 */
export type RateLimitTierName =
  | "public"
  | "booking"
  | "quote"
  | "login"
  | "read"
  | "inventory.read"
  | "inventory.write"
  | "inventory.count";

export interface RateLimitPolicy {
  readonly name: RateLimitTierName;
  /** Allowed requests per window. */
  readonly limit: number;
  /** Window length in milliseconds. */
  readonly windowMs: number;
  /** Message shown to the customer. */
  readonly message: string;
  /** `open` = allow on infrastructure failure, `closed` = reject. */
  readonly onInfraError: "open" | "closed";
}

const MINUTE = 60_000;

export const RATE_LIMIT_POLICIES: Record<RateLimitTierName, RateLimitPolicy> = Object.freeze({
  /** Every public POST/PUT/PATCH/DELETE that is not more specifically tiered. */
  public: {
    name: "public",
    limit: env.rateLimit.publicPerMinute,
    windowMs: MINUTE,
    message: "Too many requests. Please wait a minute and try again.",
    onInfraError: "closed",
  },
  /** Booking creation — the highest-value write. Deliberately strict. */
  booking: {
    name: "booking",
    limit: env.rateLimit.bookingPerHour,
    windowMs: 60 * MINUTE,
    message: "You have booked recently. Please call us if you need to change it.",
    onInfraError: "closed",
  },
  /** Instant-quote estimator + quote lead capture. */
  quote: {
    name: "quote",
    limit: env.rateLimit.quotePerHour,
    windowMs: 60 * MINUTE,
    message: "Too many quote requests. Please wait before trying again.",
    onInfraError: "closed",
  },
  /** Admin login. Lockout backs this up; this tier throttles the guessing. */
  login: {
    name: "login",
    limit: env.rateLimit.loginPer15Min,
    windowMs: 15 * MINUTE,
    message: "Too many sign-in attempts. Please wait a few minutes.",
    onInfraError: "closed",
  },
  /** Read endpoints. Generous on purpose; fails open. */
  read: {
    name: "read",
    limit: env.rateLimit.readPerMinute,
    windowMs: MINUTE,
    message: "Slow down a little, please.",
    onInfraError: "open",
  },

  /**
   * Stock reads. Generous, and fails OPEN like every other read tier: the stock
   * list and the availability check must keep working when Redis is unreachable,
   * because a 500 to a mechanic standing at a shelf costs more than a brief burst
   * of unthrottled reads.
   */
  "inventory.read": {
    name: "inventory.read",
    limit: 240,
    windowMs: MINUTE,
    message: "Slow down a little, please.",
    onInfraError: "open",
  },

  /**
   * Stock writes. Fails CLOSED, like every other write tier. A stock write is a
   * change to the shop's books, so refusing it for a minute is far cheaper than
   * allowing unbounded writes to them.
   */
  "inventory.write": {
    name: "inventory.write",
    limit: 60,
    windowMs: MINUTE,
    message: "Too many stock changes in a row. Please wait a moment.",
    onInfraError: "closed",
  },

  /**
   * Cycle counting — the tightest of the three. Posting a count is a burst of line
   * updates followed by a batch of adjustments, so beyond ~30 a minute it is a
   * stuck client or a script rather than a person counting a shelf.
   */
  "inventory.count": {
    name: "inventory.count",
    limit: 30,
    windowMs: MINUTE,
    message: "Too many count entries at once. Please pause for a moment.",
    onInfraError: "closed",
  },
});

/** Named single-export policy handles — what route handlers should import. */
export const publicLimiter = RATE_LIMIT_POLICIES.public;
export const bookingLimiter = RATE_LIMIT_POLICIES.booking;
/** Stock reads; fails open. See `RATE_LIMIT_POLICIES` for the rationale. */
export const inventoryReadLimiter = RATE_LIMIT_POLICIES["inventory.read"];
/** Stock writes; fails closed. */
export const inventoryWriteLimiter = RATE_LIMIT_POLICIES["inventory.write"];
/** Cycle-count entries and posts; fails closed, tightest budget. */
export const inventoryCountLimiter = RATE_LIMIT_POLICIES["inventory.count"];
export const quoteLimiter = RATE_LIMIT_POLICIES.quote;
export const loginLimiter = RATE_LIMIT_POLICIES.login;
export const readLimiter = RATE_LIMIT_POLICIES.read;

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the current window ends. */
  reset: number;
  driver: RateLimitDriverName;
}

export type RateLimitDriverName = "upstash" | "postgres" | "memory";

/** The subset of the Upstash result we rely on. */
interface UpstashResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// ── Key building ────────────────────────────────────────────────────────────

/** HMAC a PII value so it can be safely used as (part of) a counter key. */
export function fingerprintPii(value: string): string {
  return createHmac("sha256", env.authSecret).update(value.trim().toLowerCase()).digest("hex").slice(0, 20);
}

/**
 * Normalise an action path so equivalent spellings share one bucket.
 *
 * `/API/Booking`, `//api//booking//` and `api.booking` must all collapse to the
 * same key — otherwise a caller could mint an unlimited number of buckets for
 * one logical endpoint simply by varying the casing or slashes.
 */
export function normaliseAction(action: string): string {
  const normalised = action
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+/, "")
    .replace(/\.+$/, "")
    .replace(/\.{2,}/g, ".");
  return normalised.slice(0, 60) || "root";
}

export function buildRateLimitKey(policy: RateLimitPolicy, action: string, ip: string, subject?: string): string {
  const base = `rl:${policy.name}:${fingerprintPii(`${normaliseAction(action)}|${ip}`)}`;
  // A subject (hashed phone/email) is *additional* signal, never a replacement
  // for the IP: a bot farm cannot rotate phones to dodge the IP limit.
  return subject ? `${base}:${fingerprintPii(subject)}` : base;
}

/** RFC 9333 style policy header value. */
export function rateLimitPolicyHeader(policy: RateLimitPolicy): string {
  return `${policy.limit};w=${Math.max(1, Math.round(policy.windowMs / 1000))}`;
}

export function rateLimitHeaders(policy: RateLimitPolicy, result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "RateLimit-Reset": String(Math.max(0, result.reset)),
    "RateLimit-Policy": rateLimitPolicyHeader(policy),
  };
  if (!result.success) {
    const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    headers["Retry-After"] = String(retryAfter);
  }
  return headers;
}

// ── Driver: in-process LRU ──────────────────────────────────────────────────

interface MemoryEntry {
  count: number;
  resetAt: number;
  lastSeen: number;
}

const MEMORY_MAX_KEYS = 10_000;
const memory = new Map<string, MemoryEntry>();

function _memoryHit(key: string, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  const existing = memory.get(key);
  // Cheap LRU: re-inserting moves the key to the end of the Map's iteration
  // order, and we evict from the front once over capacity.
  if (existing && existing.resetAt > now) {
    memory.delete(key);
    memory.set(key, { ...existing, count: existing.count + 1, lastSeen: now });
    return {
      success: existing.count + 1 <= policy.limit,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - (existing.count + 1)),
      reset: existing.resetAt,
      driver: "memory",
    };
  }
  const resetAt = now + policy.windowMs;
  memory.set(key, { count: 1, resetAt, lastSeen: now });
  if (memory.size > MEMORY_MAX_KEYS) {
    const oldest = memory.keys().next();
    if (!oldest.done) memory.delete(oldest.value);
  }
  return { success: policy.limit >= 1, limit: policy.limit, remaining: Math.max(0, policy.limit - 1), reset: resetAt, driver: "memory" };
}

/** Test helper: forget every in-process counter. */
export function resetMemoryRateLimits(): void {
  memory.clear();
}

// ── Driver: Postgres ────────────────────────────────────────────────────────

/**
 * Fixed-window counter on `RateLimitCounter`.
 *
 * `upsert` + conditional `updateMany` is two round trips but it is
 * *atomic without a transaction*: the `updateMany` filter re-checks
 * `resetAt <= now`, so a concurrent reset cannot produce a lost update.
 */
async function postgresHit(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const { prisma } = await import("@/lib/server/db");
  const now = Date.now();

  const row = await prisma.rateLimitCounter.findUnique({ where: { key } });
  if (!row || row.resetAt.getTime() <= now) {
    const resetAt = new Date(now + policy.windowMs);
    await prisma.rateLimitCounter.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    return { success: policy.limit >= 1, limit: policy.limit, remaining: Math.max(0, policy.limit - 1), reset: resetAt.getTime(), driver: "postgres" };
  }

  const updated = await prisma.rateLimitCounter.updateMany({
    where: { key, resetAt: { gt: new Date(now) } },
    data: { count: { increment: 1 } },
  });
  const count = row.count + (updated.count > 0 ? 1 : 0);
  return {
    success: count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - count),
    reset: row.resetAt.getTime(),
    driver: "postgres",
  };
}

/**
 * Deletes expired `RateLimitCounter` rows.
 *
 * Exported so `backend-integrations` can call it from `src/app/api/cron/*` —
 * e.g. `await sweepRateLimitCounters()` alongside the other housekeeping jobs.
 * Safe to run concurrently with request traffic.
 */
export async function sweepRateLimitCounters(olderThanMs = 60 * MINUTE): Promise<number> {
  const { prisma } = await import("@/lib/server/db");
  const cutoff = new Date(Date.now() - olderThanMs);
  const { count } = await prisma.rateLimitCounter.deleteMany({ where: { resetAt: { lt: cutoff } } });
  if (count > 0) logger.info("ratelimit.swept", { scope: "ratelimit", removed: count });
  return count;
}

// ── Driver: Upstash ─────────────────────────────────────────────────────────

interface UpstashLimiter {
  limit(key: string): Promise<UpstashResult>;
}

let upstashPromise: Promise<UpstashLimiter | null> | null = null;

/**
 * Lazily builds the Upstash limiter. Returns `null` when Redis is not
 * configured or the client cannot be constructed, so we degrade to Postgres
 * instead of throwing on every request.
 */
async function upstashHit(key: string, policy: RateLimitPolicy): Promise<RateLimitResult | null> {
  if (!env.rateLimit.hasUpstash) return null;
  if (upstashPromise === null) {
    upstashPromise = (async (): Promise<UpstashLimiter | null> => {
      try {
        const [{ Redis }, { Ratelimit }] = await Promise.all([import("@upstash/redis"), import("@upstash/ratelimit")]);
        const redis = new Redis({
          url: env.rateLimit.upstashUrl as string,
          token: env.rateLimit.upstashToken as string,
        });
        const limiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(policy.limit, `${policy.windowMs} ms`),
          analytics: false,
          prefix: `eyg:rl:${policy.name}`,
        });
        return { limit: async (k: string): Promise<UpstashResult> => limiter.limit(k) };
      } catch (err) {
        logger.warn("ratelimit.upstash.init_failed", {
          scope: "ratelimit",
          err: err instanceof Error ? err.name : typeof err,
        });
        return null;
      }
    })();
  }
  const limiter = await upstashPromise;
  if (!limiter) return null;
  const res = await limiter.limit(key);
  return { success: res.success, limit: res.limit, remaining: res.remaining, reset: res.reset, driver: "upstash" };
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface RateLimitOptions {
  /** Normalised logical action, e.g. `"booking.create"`. */
  action: string;
  /** Verified IP from `clientIp()`. Never a client-supplied header. */
  ip: string;
  /** Optional PII (phone/email) — hashed, never stored raw. */
  subject?: string;
  /** Overrides the tier's default, for one-off budgets. */
  policy?: RateLimitPolicy;
  requestId?: string;
}

/**
 * Consume one unit of the budget for `options`.
 *
 * Throws `ApiError("RATE_LIMITED")` (with `Retry-After`) when the budget is
 * exhausted. On infrastructure failure it throws `SERVICE_UNAVAILABLE` for
 * write tiers and returns success for read tiers.
 */
export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const policy = options.policy ?? RATE_LIMIT_POLICIES.public;
  const key = buildRateLimitKey(policy, options.action, options.ip, options.subject);
  const logFields = { requestId: options.requestId, scope: "ratelimit", tier: policy.name, action: options.action };

  try {
    if (env.rateLimit.hasUpstash) {
      const upstash = await upstashHit(key, policy);
      if (upstash) {
        if (!upstash.success) throw blocked(policy, logFields, "upstash");
        return upstash;
      }
    }
    const pg = await postgresHit(key, policy);
    if (!pg.success) throw blocked(policy, logFields, "postgres");
    return pg;
  } catch (err) {
    if (ApiError.is(err)) throw err;
    // ── Infrastructure failure ──────────────────────────────────────────────
    if (policy.onInfraError === "open") {
      logger.warn("ratelimit.fail_open", { ...logFields, err: err instanceof Error ? err.name : typeof err });
      return {
        success: true,
        limit: policy.limit,
        remaining: policy.limit,
        reset: Date.now() + policy.windowMs,
        driver: "memory",
      };
    }
    logger.error("ratelimit.fail_closed", { ...logFields }, { err });
    throw new ApiError("SERVICE_UNAVAILABLE", "We are having trouble right now. Please try again in a minute.", {
      retryAfter: 60,
      cause: err,
    });
  }
}

function blocked(policy: RateLimitPolicy, logFields: Record<string, unknown>, driver: string): ApiError {
  logger.warn("ratelimit.blocked", { ...logFields, driver, limit: policy.limit });
  return new ApiError("RATE_LIMITED", policy.message, {
    retryAfter: Math.max(1, Math.ceil(policy.windowMs / 1000)),
    logMeta: { tier: policy.name, driver },
  });
}

/**
 * Non-throwing variant for handlers that want to hand the outcome to
 * `rateLimitHeaders()` themselves. Returns `null` when the limit is hit.
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  return rateLimit(options);
}

/** Which driver will be used. Logged at boot so a deploy can eyeball it. */
export async function activeRateLimitDriver(): Promise<RateLimitDriverName> {
  if (env.rateLimit.hasUpstash) {
    const probe = await upstashHit("rl:probe", RATE_LIMIT_POLICIES.read);
    if (probe) return "upstash";
  }
  if (env.isTest) return "memory";
  return "postgres";
}

/**
 * Throws if a production deployment has silently fallen back to the in-process
 * driver (which is per-instance and therefore not a real limit).
 */
export function assertSharedRateLimitDriver(): void {
  if (!env.isProduction) return;
  if (!env.rateLimit.hasUpstash) {
    logger.warn("ratelimit.driver", {
      scope: "ratelimit",
      driver: "postgres",
      note: "Upstash not configured; using Postgres counters (correct, slightly slower).",
    });
  }
}
