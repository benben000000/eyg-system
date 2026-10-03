/**
 * CRON JOB REGISTRY
 * ============================================================================
 * Next.js route modules may only export HTTP verbs and the route-segment config.
 * `route.ts` re-exports nothing from here; it imports instead.
 *
 * The map IS the allowlist: `resolveJob` rejects anything not in it, so a typo
 * or an injected job name in a request body can never reach an arbitrary function.
 * ============================================================================
 */
import { ApiError } from "@/lib/errors";
import {
  runSyncReviews,
  runExpireHolds,
  runSweepRateLimits,
  runDailyDigest,
  runInventoryExpiry,
  type JobSummary,
} from "@/lib/integrations/maintenance";
/** The allowlist. Nothing outside this map can be dispatched. */
export const CRON_JOBS = {
  "sync-reviews": runSyncReviews,
  "expire-holds": runExpireHolds,
  "sweep-rate-limits": runSweepRateLimits,
  "daily-digest": runDailyDigest,
// Stock holds carry a TTL. Without this job a leaked hold is permanent:
// the part stays invisible to every other customer, silently.
"inventory-expiry": runInventoryExpiry,
} as const;

export type CronJobName = keyof typeof CRON_JOBS;

export const CRON_JOB_NAMES = Object.keys(CRON_JOBS) as CronJobName[];

export interface CronDispatchResponse {
  job: CronJobName;
  summary: JobSummary;
}

/** Resolves the job name, rejecting anything not in the allowlist. */
export function resolveJob(raw: string | null): CronJobName {
  if (!raw) {
    throw new ApiError("VALIDATION_ERROR", `Missing "job". Known jobs: ${CRON_JOB_NAMES.join(", ")}.`, {
      details: { jobs: CRON_JOB_NAMES },
    });
  }
  const name = raw.trim().toLowerCase();
  if (!(name in CRON_JOBS)) {
    // 400, never 500, and never a hint at anything but the allowlist.
    throw new ApiError("VALIDATION_ERROR", `Unknown job "${name.slice(0, 40)}". Known jobs: ${CRON_JOB_NAMES.join(", ")}.`, {
      details: { jobs: CRON_JOB_NAMES },
    });
  }
  return name as CronJobName;
}
