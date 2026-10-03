/**
 * /api/cron — DISPATCHER
 * ============================================================================
 * One authenticated entry point for every background job. Also available as four
 * individual routes (`/api/cron/sync-reviews`, …) so a scheduler that prefers
 * per-job URLs can point at them directly; both paths run the *same* functions,
 * so there is one implementation and one set of semantics.
 *
 *   GET|POST /api/cron?job=sync-reviews
 *   Authorization: Bearer $CRON_SECRET        (or x-cron-secret / x-probe-secret)
 *
 * SECURITY
 * --------
 * Two independent gates, both required:
 *   1. `CRON_SECRET`, compared in constant time. `GET`, `POST`, `x-cron-secret`
 *      and `x-probe-secret` are all accepted so `curl`, Vercel Cron and
 *      GitHub Actions work without a custom header.
 *      **With no secret configured, production returns 503 and runs nothing.**
 *      Outside production it runs unauthenticated with a loud warning, so local
 *      `curl localhost:3000/api/cron?job=sync-reviews` just works.
 *   2. A hard allowlist of job names. An unknown job is a **400**, never a 500
 *      and never a dispatch attempt — this route cannot be used to reach an
 *      arbitrary module.
 *
 * STATUS CODES
 *   200 job ran (see `ok` in the body for partial failure)
 *   400 unknown job / missing `job` parameter
 *   401 bad or missing secret
 *   503 no secret configured in production
 *
 * @see docs/ops/INTEGRATIONS.md § Cron
 */

import { ApiError } from "@/lib/errors";
import { checkCronAuth, contextFrom, failWith, type RouteContext } from "@/lib/integrations/api";
import { log } from "@/lib/logger";
import { ok } from "@/lib/http";
import type { JobSummary } from "@/lib/integrations/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/cron" });

import { CRON_JOBS, resolveJob, type CronDispatchResponse, type CronJobName } from "@/app/api/cron/jobs";

function jobFromUrl(req: Request): string | null {
  const url = new URL(req.url);
  const param = url.searchParams.get("job");
  if (param !== null) return param;
  // Vercel Cron sends the path; a bare hit on /api/cron lists the jobs.
  return null;
}

function authFailure(reason: "missing-secret" | "no-secret-configured" | "bad-secret", ctx: RouteContext): Response {
  if (reason === "no-secret-configured") {
    return failWith(new ApiError("SERVICE_UNAVAILABLE", "Cron is not configured. Set CRON_SECRET before running jobs."), ctx);
  }
  return failWith(new ApiError("UNAUTHENTICATED", "Invalid or missing cron credentials."), ctx);
}

async function handle(req: Request): Promise<Response> {
  const ctx = contextFrom(req);

  const auth = checkCronAuth(req);
  if (!auth.ok) return authFailure(auth.reason, ctx);

  let job: CronJobName;
  try {
    job = resolveJob(jobFromUrl(req));
  } catch (error) {
    if (ApiError.is(error)) return failWith(error, ctx);
    return failWith(new ApiError("VALIDATION_ERROR", "Unknown job."), ctx);
  }

  logger.info("cron.dispatched", { job, unauthenticated: auth.degraded, requestId: ctx.requestId });

  // The job itself is written never to throw, but belt and braces: a cron route
  // that 500s looks like a broken scheduler rather than a broken job.
  let summary: JobSummary;
  try {
    summary = await CRON_JOBS[job]();
  } catch (error) {
    logger.error("cron.job_threw", { job }, { err: error });
    summary = { job, ok: false, durationMs: 0, counts: {}, error: "internal-error", notes: [] };
  }

  const data: CronDispatchResponse = { job, summary };
  return ok(data, ctx.meta, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}