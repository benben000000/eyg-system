/**
 * POST|GET /api/cron/expire-holds
 * ============================================================================
 * Releases soft holds on booking slots: `PENDING` bookings older than
 * `BOOKING.holdMinutes` (10) that were never confirmed. Without this, a
 * customer who abandons the booking form silently consumes a bay and a
 * walk-in is turned away.
 *
 * SEAM
 * ----
 * The rate-limit counter sweep lives in `@/lib/ratelimit` as
 * `sweepRateLimitCounters()` and is re-exported here as
 * `sweepExpiredCounters()` from `@/lib/integrations/maintenance` — there is NO
 * duplicate implementation. The hold release itself is an inline query in
 * `maintenance.ts` because `src/lib/server/booking.ts` may not exist yet; when
 * it does and exposes an `expireStaleHolds()` returning `{ released: number }`,
 * swap that one function and delete the query.
 *
 * Auth: `CRON_SECRET` bearer / `x-cron-secret` / `x-probe-secret`, constant time.
 * Idempotent: only rows still `PENDING` and older than the cutoff are touched.
 *
 * Suggested schedule: every 10 minutes (`*` slash `10` `*` `*` `*` in crontab
 * notation — written out here because `* /10` inside a block comment would end
 * the comment).
 *
 * @see docs/ops/INTEGRATIONS.md § Cron — expire-holds
 */

import { ApiError } from "@/lib/errors";
import { checkCronAuth, contextFrom, failWith } from "@/lib/integrations/api";
import { runExpireHolds, sweepExpiredCounters } from "@/lib/integrations/maintenance";
import { log } from "@/lib/logger";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/cron/expire-holds" });

export async function POST(req: Request): Promise<Response> {
  const ctx = contextFrom(req);

  const auth = checkCronAuth(req);
  if (!auth.ok) {
    return failWith(
      auth.reason === "no-secret-configured"
        ? new ApiError("SERVICE_UNAVAILABLE", "Cron is not configured. Set CRON_SECRET before running jobs.")
        : new ApiError("UNAUTHENTICATED", "Invalid or missing cron credentials."),
      ctx,
    );
  }

  try {
    const summary = await runExpireHolds();
    // Also run the rate-limit counter sweep here: the two are always wanted
    // together, and an operator who schedules only this one still gets a clean
    // `RateLimitCounter` table.
    const counters = await sweepExpiredCounters();
    logger.info("cron.expire_holds_done", { released: summary.counts.released ?? 0, rateLimitCounters: counters });
    return ok({ job: "expire-holds", summary, rateLimitCounters: counters }, ctx.meta, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("cron.expire_holds_threw", {}, { err: error });
    return ok(
      { job: "expire-holds", summary: { job: "expire-holds", ok: false, durationMs: 0, counts: {}, error: "internal-error", notes: [] } },
      ctx.meta,
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = POST;
