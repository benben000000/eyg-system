/**
 * POST|GET /api/cron/sweep-rate-limits
 * ============================================================================
 * Housekeeping. Three idempotent steps, in order of importance:
 *
 *   1. `RateLimitCounter` — delete rows whose window has expired. Delegated to
 *      backend-core's `sweepRateLimitCounters()` via
 *      `maintenance.sweepExpiredCounters()`; no duplicate implementation here.
 *   2. Idempotency ledger — delete `Setting` rows older than the TTL so the
 *      ledger cannot grow without bound.
 *   3. `Notification` — mark rows abandoned in `queued` (a process died
 *      mid-send) as `failed`, so "queued" always means something.
 *
 * Auth: `CRON_SECRET` bearer / `x-cron-secret` / `x-probe-secret`, constant time.
 * Idempotent: every step is a `deleteMany` or a guarded `updateMany`, so a
 * concurrent or repeated run is harmless.
 *
 * Suggested schedule: hourly. `17 * * * *` (off the top of the hour, so it does
 * not collide with every other `0 * * * *` on the platform).
 *
 * @see docs/ops/INTEGRATIONS.md § Cron — sweep-rate-limits
 */

import { ApiError } from "@/lib/errors";
import { checkCronAuth, contextFrom, failWith } from "@/lib/integrations/api";
import { runSweepRateLimits } from "@/lib/integrations/maintenance";
import { log } from "@/lib/logger";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/cron/sweep-rate-limits" });

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
    const summary = await runSweepRateLimits();
    return ok({ job: "sweep-rate-limits", summary }, ctx.meta, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("cron.sweep_threw", {}, { err: error });
    return ok(
      { job: "sweep-rate-limits", summary: { job: "sweep-rate-limits", ok: false, durationMs: 0, counts: {}, error: "internal-error", notes: [] } },
      ctx.meta,
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = POST;
