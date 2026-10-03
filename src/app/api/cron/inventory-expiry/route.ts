/**
 * POST|GET /api/cron/inventory-expiry — release expired stock holds.
 * ============================================================================
 * A `Reservation` is a soft, time-boxed hold. Its `expiresAt` is what makes the
 * hold survivable without anybody having to remember: a customer who books, never
 * shows and never cancels must not sterilise the shelf forever. This job is the
 * clock that enforces that.
 *
 * ── WHY IT IS SAFE TO RUN CONCURRENTLY ───────────────────────────────────────
 * Each hold is CLAIMED first with a conditional `status: "HELD"` transition, and
 * only the caller whose `updateMany` returns `count === 1` touches `reserved`.
 * Two overlapping invocations (a schedule firing, a manual run and a retry) each
 * release a disjoint subset, and `reserved` is additionally guarded on
 * `"reserved" >= qty` — so a double release is impossible from both directions.
 *
 * ── WHY A FAILURE DOES NOT STOP THE SWEEP ───────────────────────────────────
 * A booking whose accounting does not add up is logged loudly and skipped. One
 * corrupt row must not leave every other expired hold on the shelf forever, and
 * `failures[]` in the response says exactly which ones need a human.
 *
 * ── IDEMPOTENCE ─────────────────────────────────────────────────────────────
 * Running it twice in a row releases nothing the second time — there is no
 * `HELD` row left past its expiry.
 *
 * Auth: `CRON_SECRET` via `Authorization: Bearer`, `x-cron-secret` or
 * `x-probe-secret`, compared in constant time. In production with no secret
 * configured this route REFUSES (503) rather than running open.
 *
 * Suggested schedule: every 15 minutes. In crontab notation that is a
 * 15-minute step, minute field "slash 15", then three asterisks — written out
 * here in words because a literal slash-asterisk pair inside a block comment
 * ends the comment.
 *
 * @see docs/ops/INTEGRATIONS.md § Cron
 */
import { ApiError } from "@/lib/errors";
import { ok } from "@/lib/http";
import { checkCronAuth, contextFrom, failWith } from "@/lib/integrations/api";
import { log } from "@/lib/logger";

import { expireHolds } from "@/lib/server/inventory/reservations";
import { parseQuery, inventoryExpiryQuerySchema } from "@/lib/server/inventory/validation.test-support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/cron/inventory-expiry" });

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
    // The query is optional and bounded; a bad one is a 400 from `parseQuery`,
    // which `failWith` renders as a safe `ApiResult`.
    const query = parseQuery(new URL(req.url).searchParams, inventoryExpiryQuerySchema);
    const summary = await expireHolds(query.limit ?? 200);

    logger.info("cron.inventory_expiry_done", {
      expired: summary.expired,
      releasedUnits: summary.releasedUnits,
      failures: summary.failures.length,
    });

    return ok({ job: "inventory-expiry", summary }, ctx.meta, { cacheControl: "no-store" });
  } catch (error) {
    // A `parseQuery` validation error is a caller problem and must surface as a
    // 400; anything else is logged with its requestId and reported opaquely.
    if (ApiError.is(error)) return failWith(error, ctx);
    logger.error("cron.inventory_expiry_threw", {}, { err: error });
    return failWith(new ApiError("INTERNAL_ERROR", "The expiry sweep failed. It will run again next cycle."), ctx);
  }
}

export const GET = POST;
