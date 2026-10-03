/**
 * POST|GET /api/cron/sync-reviews
 * ============================================================================
 * Pulls Google (and Facebook, if the app has been approved) and upserts into
 * the `Review` table, then invalidates the reviews cache so the homepage shows
 * the new review immediately rather than up to 30 minutes later.
 *
 * Shares `runSyncReviews()` with the `/api/cron?job=sync-reviews` dispatcher —
 * one implementation, two entry points.
 *
 * Auth: `CRON_SECRET` as `Authorization: Bearer …`, `x-cron-secret` or
 * `x-probe-secret`, compared in constant time. 503 in production when no secret
 * is configured (the job then runs nothing).
 *
 * Idempotent: upserts on `(source, externalId)`. Running it ten times changes
 * nothing after the first.
 *
 * Suggested schedule: hourly. `0 * * * *`
 *
 * @see docs/ops/INTEGRATIONS.md § Cron — sync-reviews
 */

import { ApiError } from "@/lib/errors";
import { checkCronAuth, contextFrom, failWith } from "@/lib/integrations/api";
import { runSyncReviews } from "@/lib/integrations/maintenance";
import { log } from "@/lib/logger";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/cron/sync-reviews" });

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
    const summary = await runSyncReviews();
    return ok({ job: "sync-reviews", summary }, ctx.meta, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // The job is written not to throw; this is the outer net so a broken job
    // is a logged 200 rather than a scheduler that retries forever.
    logger.error("cron.sync_reviews_threw", {}, { err: error });
    return ok(
      { job: "sync-reviews", summary: { job: "sync-reviews", ok: false, durationMs: 0, counts: {}, error: "internal-error", notes: [] } },
      ctx.meta,
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = POST;
