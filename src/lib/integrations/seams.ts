/**
 * SEAMS — the single place where this layer touches another agent's module.
 * ============================================================================
 * Every cross-agent import in this file is wrapped, so a renamed or moved
 * module degrades to a documented default instead of taking a route down at
 * module-evaluation time.
 *
 * WHAT IS ACTUALLY WIRED
 * ----------------------
 * 1. `prismaSweepCounters` → `sweepRateLimitCounters()` from
 *    `@/lib/ratelimit` (backend-core). That function already existed when this
 *    file was written, so `maintenance.ts` RE-EXPORTS it via
 *    `sweepExpiredCounters()` and there is **no duplicate implementation**. The
 *    one-line swap point is below.
 *
 * 2. The Prisma client is `@/lib/server/db`'s `prisma` singleton, loaded lazily
 *    in `src/lib/integrations/db.ts` so the site keeps **one** connection pool.
 *    A local client is constructed only if that module cannot be loaded.
 *
 * WHAT THE NOTIFICATION LAYER EXPECTS FROM `src/lib/server/booking.ts`
 * --------------------------------------------------------------------
 * Those exports exist (`toBookingDto`, `lookupBooking`, `createBooking`,
 * `changeBookingStatus`, `cancelBooking`, `bookingCounts`). The notification
 * layer deliberately imports **none of them**, so a change there cannot break
 * a send. The intended wiring at each call site is:
 *
 *     // in the booking route, after `createBooking` / `changeBookingStatus`
 *     import { notifyBookingConfirmed, fromBookingDto } from "@/lib/integrations/notify";
 *     await notifyBookingConfirmed(
 *       fromBookingDto(result.booking, {
 *         consentSms: result.booking.consentSms,       // or your own flag
 *         consentMarketing: result.booking.consentMarketing,
 *       }),
 *     );
 *
 * `fromBookingDto()` takes the `BookingDto` shape from `src/lib/types.ts`,
 * which is exactly what `toBookingDto()` returns — so the adapter is a no-op
 * cast plus a consent argument, with no database round trip.
 *
 * `resolveNotifyBooking(id)` in `notify.ts` is the fallback for any call site
 * that only has an id. Delete it once every call site passes a DTO.
 *
 * THE ONE THING STILL IMPLEMENTED INLINE
 * --------------------------------------
 * `runExpireHolds()` in `maintenance.ts` runs its own `PENDING`-booking sweep,
 * because when it was written `src/lib/server/booking.ts` did not yet exist.
 * `bookingCounts()` exists but counts by status, not by age, so it is not a
 * substitute. When backend-core exposes an `expireStaleHolds()` returning
 * `{ released: number }`, call it from `runExpireHolds()` and delete the inline
 * query. Until then the sweep is correct and idempotent on its own.
 *
 * @see docs/ops/INTEGRATIONS.md § Seams
 */

import { log } from "@/lib/logger";

const logger = log.child({ scope: "integrations/seams" });

/**
 * Deletes expired `RateLimitCounter` rows via backend-core's implementation.
 * Returns `0` (and logs) if the module cannot be loaded, so the cron job still
 * completes its other two steps.
 */
export async function prismaSweepCounters(olderThanMs = 60 * 60 * 1_000): Promise<number> {
  try {
    const mod = (await import("@/lib/ratelimit")) as { sweepRateLimitCounters?: (ms: number) => Promise<number> };
    if (typeof mod.sweepRateLimitCounters !== "function") {
      logger.warn("seams.sweep_missing", { note: "sweepRateLimitCounters is not exported by @/lib/ratelimit" });
      return 0;
    }
    return await mod.sweepRateLimitCounters(olderThanMs);
  } catch (error) {
    logger.error("seams.sweep_unavailable", { action: "rate-limit sweep skipped" }, { err: error });
    return 0;
  }
}
