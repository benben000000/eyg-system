/**
 * RATE-LIMIT ADAPTER (integrations layer)
 * ============================================================================
 * The engine lives in `@/lib/ratelimit` (backend-core). It already implements
 * Upstash → Postgres → in-memory with spoof-resistant keys, per-tier fail
 * open/closed policy, and `sweepRateLimitCounters()` for the cron job.
 *
 * This file exists so route handlers in my directories have ONE import to make
 * and one shape to consume, and — critically — so an `ApiError` thrown by the
 * limiter is turned into a normal, non-throwing result that a route can decide
 * what to do with. Duplication is limited to the tier table below, which maps
 * the shared tiers onto the budgets specific to leads / promos / reviews /
 * webhooks / cron.
 *
 * @see docs/ops/INTEGRATIONS.md § Rate limits
 */

import { ApiError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { RATE_LIMIT_POLICIES, rateLimit, type RateLimitPolicy, type RateLimitResult } from "@/lib/ratelimit";

const logger = log.child({ scope: "integrations/rate-limit" });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export type RouteTier = "reads" | "public" | "lead" | "roadside" | "newsletter" | "promoClaim" | "webhook" | "cron";

/**
 * Budgets for the endpoints this agent owns. Read tiers fail OPEN (availability
 * of a cached read beats a 503 for a stranded customer); write tiers fail
 * CLOSED, because what they protect is a message to a third party.
 */
export const ROUTE_POLICIES: Readonly<Record<RouteTier, RateLimitPolicy>> = Object.freeze({
  reads: RATE_LIMIT_POLICIES.read,
  public: RATE_LIMIT_POLICIES.public,
  lead: {
    name: "public",
    limit: 6,
    windowMs: HOUR,
    message: "Too many enquiries from this connection. Please call us instead.",
    onInfraError: "closed",
  },
  roadside: {
    name: "public",
    limit: 4,
    windowMs: HOUR,
    message: "We already have your request. Please call the shop if it is urgent.",
    onInfraError: "closed",
  },
  newsletter: {
    name: "public",
    limit: 3,
    windowMs: HOUR,
    message: "You are already on the list. No need to sign up again.",
    onInfraError: "closed",
  },
  promoClaim: {
    name: "public",
    limit: 5,
    windowMs: HOUR,
    message: "You have claimed a few offers already. Please call the shop for another.",
    onInfraError: "closed",
  },
  webhook: {
    name: "read",
    limit: 1_200,
    windowMs: MINUTE,
    message: "",
    onInfraError: "open",
  },
  cron: {
    name: "login",
    limit: 120,
    windowMs: HOUR,
    message: "",
    onInfraError: "closed",
  },
});

export interface GuardResult {
  allowed: boolean;
  /** Seconds the client should wait, when `allowed` is false. */
  retryAfter: number;
  tier: RouteTier;
  limit: number;
  remaining: number;
  /** True when the limiter backend itself failed and the tier's policy applied. */
  degraded: boolean;
  error: ApiError | null;
}

const ALLOWED = (tier: RouteTier, policy: RateLimitPolicy, result: RateLimitResult): GuardResult => ({
  allowed: true,
  retryAfter: 0,
  tier,
  limit: result.limit,
  remaining: Math.max(0, result.remaining),
  degraded: result.driver === "memory",
  error: null,
});

/**
 * Consumes one unit of the budget. NEVER THROWS — an `ApiError` from the
 * limiter (rate limited, or the store is down on a closed tier) comes back as
 * `allowed: false` with the error attached so the route can render it.
 */
export async function guardRateLimit(tier: RouteTier, action: string, ip: string, subject?: string): Promise<GuardResult> {
  const policy = ROUTE_POLICIES[tier];
  try {
    const result = await rateLimit({ action, ip, ...(subject ? { subject } : {}), policy });
    return ALLOWED(tier, policy, result);
  } catch (error) {
    if (ApiError.is(error)) {
      return {
        allowed: false,
        retryAfter: error.retryAfter ?? Math.max(1, Math.round(policy.windowMs / 1000)),
        tier,
        limit: policy.limit,
        remaining: 0,
        degraded: error.code === "SERVICE_UNAVAILABLE",
        error,
      };
    }
    logger.error("ratelimit.unexpected", { tier, action });
    return {
      allowed: false,
      retryAfter: 60,
      tier,
      limit: policy.limit,
      remaining: 0,
      degraded: true,
      error: new ApiError("SERVICE_UNAVAILABLE", "We are having trouble right now. Please try again in a minute.", {
        retryAfter: 60,
      }),
    };
  }
}

/** RFC 9333-ish headers for the response. */
export function rateLimitHeaders(result: GuardResult): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
  };
  if (!result.allowed && result.retryAfter > 0) headers["Retry-After"] = String(result.retryAfter);
  return headers;
}
