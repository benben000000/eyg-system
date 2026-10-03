/**
 * POST|GET /api/cron/daily-digest
 * ============================================================================
 * Sends the shop a summary of the day: bookings, new leads, new reviews, and the
 * current average rating. SMS to `SHOP_ALERT_PHONE` and email to
 * `SHOP_ALERT_EMAIL` (both fall back to the `TODO-VERIFY` contact details in
 * `src/config/site.ts`, which is exactly why the overrides exist).
 *
 * The digest contains COUNTS ONLY. No customer name, no phone number, no
 * message body — it is a summary, and a summary that leaks PII by email is a
 * compliance problem, not a convenience.
 *
 * Auth: `CRON_SECRET` bearer / `x-cron-secret` / `x-probe-secret`, constant time.
 * Idempotent: one digest per Manila calendar day via the idempotency ledger. A
 * retried scheduler run sends nothing; if *neither* channel went out, the claim
 * is released so a retry can try again.
 *
 * Honest numbers: with no reviews the digest says "No reviews yet", never 5.0.
 *
 * Suggested schedule: 20:15 Manila, after the shop closes.
 * `15 12 * * *`  (12:15 UTC = 20:15 PHT)
 *
 * @see docs/ops/INTEGRATIONS.md § Cron — daily-digest
 */

import { ApiError } from "@/lib/errors";
import { checkCronAuth, contextFrom, failWith } from "@/lib/integrations/api";
import { buildDailyDigest, renderDigestSms, runDailyDigest } from "@/lib/integrations/maintenance";
import { log } from "@/lib/logger";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/cron/daily-digest" });

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
    const summary = await runDailyDigest();
    // `?preview=true` also returns the rendered digest without changing anything,
    // so the owner can read exactly what the shop would receive.
    const preview = new URL(req.url).searchParams.get("preview") === "true";
    const data = preview ? { ...summary, preview: renderDigestSms(await buildDailyDigest()) } : summary;
    return ok({ job: "daily-digest", summary: data }, ctx.meta, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("cron.daily_digest_threw", {}, { err: error });
    return ok(
      { job: "daily-digest", summary: { job: "daily-digest", ok: false, durationMs: 0, counts: {}, error: "internal-error", notes: [] } },
      ctx.meta,
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = POST;
