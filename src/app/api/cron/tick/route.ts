/**
 * /api/cron/tick — SINGLE-SCHEDULE RUNNER
 * ============================================================================
 *   GET|POST /api/cron/tick
 *   Authorization: Bearer $CRON_SECRET        (or x-cron-secret / x-probe-secret)
 *
 * WHY THIS EXISTS
 * ---------------
 * Vercel's Hobby plan allows **2 cron jobs**. The four individual job routes
 * plus a dispatcher is five, so pointing a schedule at each one is not
 * deployable on the tier most small shops start on — and the first deploy
 * failed with `CRON_JOBS_LIMIT`.
 *
 * So: ONE schedule, ONE route, every job. This runs the cheap idempotent jobs
 * on every tick, and the once-a-day digest only inside its own window.
 *
 *   Every tick          expire-holds, inventory-expiry, sweep-rate-limits,
 *                       sync-reviews
 *   10:00-10:29 Manila  daily-digest (guarded so it fires once, not every 10 min)
 *
 * Idempotency: each job is written to be safe to repeat. The digest carries an
 * explicit once-a-day guard in the `Setting` table, because sending the shop
 * three "here is your day" emails would train them to ignore the one that
 * matters.
 *
 * STATUS CODES
 *   200 ran (inspect `results[].ok` for a partial failure)
 *   401 bad or missing secret
 *   503 no secret configured in production
 *
 * @see docs/ops/INTEGRATIONS.md § Cron
 */

import { CRON_JOBS, type CronJobName } from "@/app/api/cron/jobs";
import { ApiError } from "@/lib/errors";
import { checkCronAuth, contextFrom, failWith } from "@/lib/integrations/api";
import { ok } from "@/lib/http";
import { log } from "@/lib/logger";
import type { JobSummary } from "@/lib/integrations/maintenance";
import { PH_OFFSET_MINUTES } from "@/lib/server/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/cron/tick" });

/** Run on every tick. Cheap, idempotent, must never be blocked by a daily guard. */
/**
 * inventory-expiry releases stock holds whose TTL passed. Every tick: a hold
 * that leaks is a part another customer cannot be promised, and the cost of
 * that is silent. It is cheap and idempotent.
 */
const ALWAYS: readonly CronJobName[] = [
  "expire-holds",
  "inventory-expiry",
  "sweep-rate-limits",
  "sync-reviews",
];

/** Run at most once per Manila calendar day. */
const DAILY: readonly CronJobName[] = ["daily-digest"];

const DIGEST_HOUR = 10; // Manila local hour
const DIGEST_WINDOW_END = DIGEST_HOUR + 1; // 10:00-10:59 inclusive of the hour
const DIGEST_GUARD_KEY = "cron.daily-digest.lastRun";

/** Minutes since Manila midnight for the current instant. */
function manilaMinutes(now: Date): number {
  const shifted = new Date(now.getTime() + PH_OFFSET_MINUTES * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** `YYYY-MM-DD` in Manila, used as the once-a-day marker. */
function manilaDate(now: Date): string {
  return new Date(now.getTime() + PH_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

async function shouldRunDigest(now: Date): Promise<boolean> {
  const minutes = manilaMinutes(now);
  if (minutes < DIGEST_HOUR * 60 || minutes >= DIGEST_WINDOW_END * 60) return false;

  const today = manilaDate(now);
  try {
    // `Setting` is the right home for a small runtime marker: it is already
    // there, already writable, and needs no migration for a value nobody reads.
    const { prisma } = await import("@/lib/server/db");
    const row = await prisma.setting.findUnique({ where: { key: DIGEST_GUARD_KEY } });
    const lastRun = (row?.value as { date?: unknown } | undefined)?.date;
    if (lastRun === today) return false;

    await prisma.setting.upsert({
      where: { key: DIGEST_GUARD_KEY },
      create: { key: DIGEST_GUARD_KEY, value: { date: today }, updatedBy: "cron/tick" },
      update: { value: { date: today }, updatedBy: "cron/tick" },
    });
    return true;
  } catch (error) {
    // Without the guard table we cannot prove it has not already run today.
    // Skip rather than risk sending a duplicate, and say so in the log.
    logger.warn("cron.digest_guard_unavailable", { error: error instanceof Error ? error.name : typeof error });
    return false;
  }
}

async function handle(req: Request): Promise<Response> {
  const ctx = contextFrom(req);

  const auth = checkCronAuth(req);
  if (!auth.ok) {
    if (auth.reason === "no-secret-configured") {
      return failWith(
        new ApiError("SERVICE_UNAVAILABLE", "Cron is not configured. Set CRON_SECRET before running jobs."),
        ctx,
      );
    }
    return failWith(new ApiError("UNAUTHENTICATED", "Invalid or missing cron credentials."), ctx);
  }

  const now = new Date();
  const digestDue = DAILY.length > 0 && (await shouldRunDigest(now));
  const plan: CronJobName[] = [...ALWAYS, ...(digestDue ? DAILY : [])];

  logger.info("cron.tick", {
    jobs: plan,
    digestDue,
    manilaDate: manilaDate(now),
    unauthenticated: auth.degraded,
    requestId: ctx.requestId,
  });

  const results: Array<{ job: CronJobName; summary: JobSummary }> = [];

  // Sequential, not parallel: these share a connection pool and the database is
  // the scarce resource. A slow job must not starve the next one.
  for (const job of plan) {
    try {
      results.push({ job, summary: await CRON_JOBS[job]() });
    } catch (error) {
      logger.error("cron.job_threw", { job }, { err: error });
      results.push({
        job,
        summary: { job, ok: false, durationMs: 0, counts: {}, error: "internal-error", notes: [] },
      });
    }
  }

  return ok(
    {
      ranAt: now.toISOString(),
      timezone: "Asia/Manila",
      digestRan: digestDue,
      results,
      // A partial failure is still a 200: the tick itself succeeded.
      allOk: results.every((r) => r.summary.ok),
    },
    ctx.meta,
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}