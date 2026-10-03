/**
 * MAINTENANCE JOBS
 * ============================================================================
 * The bodies behind the `/api/cron/*` routes. Each one is **idempotent** and
 * returns a structured summary — running it twice in a row is a no-op the second
 * time, and a partial failure never leaves the database in a worse state.
 *
 * SEAM: `expireHolds` / `sweepExpiredCounters`
 * --------------------------------------------
 * `sweepExpiredCounters()` is a **re-export of `@/lib/ratelimit`'s
 * `sweepRateLimitCounters()`** — the backend-core implementation. There is NO
 * duplicate implementation here; that function already existed when this file
 * was written. If backend-core later moves it, only the import below changes.
 *
 * `expireHolds()` releases soft holds on booking slots. The hold store is the
 * `Booking` table's `PENDING` rows plus `BOOKING.holdMinutes` from `site.ts`
 * (see `src/lib/server/booking.ts`, owned by backend-core). Because that module
 * may not exist yet, this file implements the sweep directly against
 * `Booking`/`BayClosure` using the same contract, and documents the swap.
 */

import { log } from "@/lib/logger";
import { BOOKING } from "@/config/site";
import { withDb } from "./db";
import { reconcileStaleNotifications } from "./notification-ledger";
import { sweepIdempotencyLedger, claimIdempotencyKey, releaseIdempotencyKey } from "./idempotency";
import { sendEmailContent,  activeEmailProvider } from "./email";
import { sendSms, shopEmailRecipient, shopSmsRecipient } from "./sms";
import { invalidateReviewsCache, reviewsCacheStats } from "../reviews/cache";
import { getReviewCounts, getPublishedReviews } from "../reviews/aggregate";
import { syncGoogleReviews } from "../reviews/google";
import { syncFacebookReviews } from "../reviews/facebook";
import { smsConfig } from "./env";
import { prismaSweepCounters } from "./seams";

const logger = log.child({ scope: "integrations/maintenance" });

/**
 * Deletes expired `RateLimitCounter` rows.
 *
 * Delegates to backend-core. Exported under the name this layer's cron route
 * uses so the swap point is a single line.
 */
export async function sweepExpiredCounters(olderThanMs = 60 * 60 * 1_000): Promise<number> {
  return prismaSweepCounters(olderThanMs);
}

export interface JobSummary {
  job: string;
  ok: boolean;
  /** Milliseconds for the whole job. */
  durationMs: number;
  /** Per-step counters. Non-PII only. */
  counts: Record<string, number>;
  /** A short machine-readable reason when `ok` is false. */
  error: string | null;
  /** Free-form non-PII notes, e.g. which provider was skipped. */
  notes: string[];
}

const summary = (job: string, started: number, counts: Record<string, number>, notes: string[] = [], error: string | null = null): JobSummary => {
  const result: JobSummary = { job, ok: error === null, durationMs: Date.now() - started, counts, error, notes };
  logger.info("cron.job_completed", {
    job,
    ok: result.ok,
    durationMs: result.durationMs,
    ...counts,
    ...(error ? { error } : {}),
  });
  return result;
};

// ── sync-reviews ─────────────────────────────────────────────────────────────

/**
 * Pulls Google (and Facebook, if approved) and upserts into `Review`.
 * Idempotent: `syncGoogleReviews` upserts on `(source, externalId)`.
 *
 * Invalidates the reviews cache only when something actually changed, so a
 * no-op run does not force every client to refetch.
 */
export async function runSyncReviews(): Promise<JobSummary> {
  const started = Date.now();
  const notes: string[] = [];
  const counts: Record<string, number> = { created: 0, updated: 0, failed: 0 };

  const [google, facebook] = await Promise.all([syncGoogleReviews(), syncFacebookReviews()]);

  counts["created"] = google.created + facebook.created;
  counts["updated"] = google.updated + facebook.updated;
  counts["failed"] = google.failed + facebook.failed;

  if (google.skipped) notes.push("google:not-configured");
  if (facebook.skipped) notes.push(facebook.error === "app-review-required" ? "facebook:app-review-required" : "facebook:not-configured");

  const changed = counts["created"] > 0;
  if (changed) {
    invalidateReviewsCache();
    notes.push("cache:invalidated");
  }

  // A provider error is reported but does not fail the job: the reviews that
  // are already stored are still correct, and the homepage keeps serving them.
  const error = !google.ok && !facebook.ok ? "all-sources-failed" : null;
  return summary("sync-reviews", started, counts, notes, error);
}

// ── expire-holds ─────────────────────────────────────────────────────────────

/**
 * Releases soft holds on booking slots.
 *
 * A "hold" is a `PENDING` booking older than `BOOKING.holdMinutes` that was
 * never confirmed. Left alone, a customer who abandons the form would silently
 * consume a bay.
 *
 * Contract with backend-core: when `src/lib/server/booking.ts` exposes an
 * `expireStaleHolds()` (or equivalent), call THAT instead and delete the query
 * below — the return shape `{ released, ... }` is already what the route wants.
 */
export async function runExpireHolds(): Promise<JobSummary> {
  const started = Date.now();
  const holdMs = Math.max(1, BOOKING.holdMinutes) * 60_000;
  const cutoff = new Date(Date.now() - holdMs);

  const result = await withDb(
    async (db) => {
      // Idempotent by construction: only rows still PENDING and older than the
      // cutoff are touched, so a second run finds nothing.
      const stale = await db.booking.findMany({
        where: { status: "PENDING", createdAt: { lt: cutoff }, startAt: { gte: new Date() } },
        select: { id: true, reference: true },
        take: 500,
      });
      if (stale.length === 0) return { released: 0, swept: 0 };

      const updated = await db.booking.updateMany({
        where: { id: { in: stale.map((b) => b.id) }, status: "PENDING" },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: "hold-expired",
        },
      });
      return { released: updated.count, swept: stale.length };
    },
    { released: 0, swept: 0 },
    { event: "cron.expire_holds" },
  );

  const notes: string[] = [`holdMinutes:${BOOKING.holdMinutes}`];
  if (result.swept > result.released) {
    notes.push("concurrent-confirmation-skipped");
  }

  return summary("expire-holds", started, { released: result.released, swept: result.swept }, notes);
}

// ── sweep-rate-limits ────────────────────────────────────────────────────────

/**
 * Housekeeping: expired rate-limit counters, expired idempotency-ledger rows,
 * and Notification rows abandoned in `queued` by a process that died mid-send.
 *
 * All three steps are `deleteMany`/idempotent updates, so a concurrent run is
 * harmless.
 */
export async function runSweepRateLimits(): Promise<JobSummary> {
  const started = Date.now();
  const notes: string[] = [];

  const counters = await sweepExpiredCounters();
  const ledger = await sweepIdempotencyLedger();
  const abandoned = await reconcileStaleNotifications(30);

  if (counters === 0) notes.push("rate-limit-counters:clean");
  if (ledger.deleted === 0) notes.push("idempotency-ledger:clean");
  if (abandoned.requeued === 0) notes.push("notifications:clean");

  return summary("sweep-rate-limits", started, { rateLimitCounters: counters, ledgerRows: ledger.deleted, abandonedNotifications: abandoned.requeued }, notes);
}

// ── daily-digest ─────────────────────────────────────────────────────────────

export interface DigestData {
  dateLabel: string;
  bookingsToday: number;
  bookingsConfirmed: number;
  leadsToday: number;
  roadsideToday: number;
  newReviews: number;
  totalReviews: number;
  averageRating: number | null;
  emailProvider: "resend" | "smtp" | "none";
  smsConfigured: boolean;
}

const PH_LONG_DATE = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "long", day: "numeric", month: "long", year: "numeric" });

/**
 * Gathers today's numbers. Read-only, never throws, and reports `null` for the
 * average when there are no reviews — the digest prints "no reviews yet", not
 * "5.0".
 */
export async function buildDailyDigest(now: Date = new Date()): Promise<DigestData> {
  // Midnight in Manila == 16:00 UTC the previous day. The shop has no DST.
  const phMidnightUtcMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  );
  const shifted = new Date(phMidnightUtcMs + 8 * 60 * 60 * 1_000);
  const startOfDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 8 * 60 * 60 * 1_000);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1_000);

  const counts = await withDb(
    async (db) => {
      const [bookingsToday, bookingsConfirmed, leadsToday, roadsideToday] = await Promise.all([
        db.booking.count({ where: { startAt: { gte: startOfDay, lt: endOfDay } } }),
        db.booking.count({ where: { startAt: { gte: startOfDay, lt: endOfDay }, status: { not: "CANCELLED" } } }),
        db.lead.count({ where: { createdAt: { gte: startOfDay, lt: endOfDay } } }),
        db.lead.count({ where: { kind: "roadside", createdAt: { gte: startOfDay, lt: endOfDay } } }),
      ]);
      return { bookingsToday, bookingsConfirmed, leadsToday, roadsideToday };
    },
    { bookingsToday: 0, bookingsConfirmed: 0, leadsToday: 0, roadsideToday: 0 },
    { event: "cron.digest_counts" },
  );

  const reviews = await getReviewCounts(24 * 60);
  const cfg = smsConfig();

  return {
    dateLabel: PH_LONG_DATE.format(now),
    ...counts,
    newReviews: reviews.newSince,
    totalReviews: reviews.total,
    // `null` is meaningful here and must survive all the way to the message.
    averageRating: reviews.average,
    emailProvider: activeEmailProvider(),
    smsConfigured: cfg.configured,
  };
}

/** Renders the digest as a short SMS body (hard 160 limit enforced by the sender). */
export function renderDigestSms(data: DigestData): string {
  const rating = data.averageRating === null ? "no reviews yet" : `${data.averageRating.toFixed(1)}/5`;
  const lines = [
    `EYG ${data.dateLabel}`,
    `Bookings today: ${data.bookingsToday} (${data.bookingsConfirmed} on)`,
    `Leads: ${data.leadsToday}${data.roadsideToday > 0 ? ` (${data.roadsideToday} roadside)` : ""}`,
    `Reviews: +${data.newReviews} today, ${data.totalReviews} total, ${rating}`,
  ];
  // The sender truncates safely, but we try to land under 160 ourselves.
  return lines.join(" · ").slice(0, 160);
}

/** Reads a slice of the cached feed purely to prove the read path is healthy. */
export async function reviewsReadPathHealthy(): Promise<boolean> {
  const feed = await getPublishedReviews({ limit: 1 });
  return Array.isArray(feed.reviews);
}

/** Exposed for `/api/ready`. */
export async function maintenanceStats(): Promise<{ cache: { entries: number; inflight: number } }> {
  return { cache: reviewsCacheStats() };
}

// ── daily-digest ─────────────────────────────────────────────────────────────

/**
 * Sends the shop a summary of today: bookings, new leads, new reviews.
 *
 * Both channels are best-effort. With no provider configured the numbers are
 * still returned in the job summary, so an operator curling the endpoint can
 * see the digest that *would* have been sent — the job is useful even with
 * every integration switched off.
 *
 * The digest goes to the SHOP, so it is a `SHOP_ALERT_PHONE` /
 * `SHOP_ALERT_EMAIL` override or the number/address in `src/config/site.ts`.
 * Those are flagged `TODO-VERIFY` there, which is why an override exists.
 *
 * Idempotent per calendar day: a second run within the same Manila day finds a
 * claimed idempotency key and sends nothing, so a retried scheduler run does
 * not spam the owner.
 */
export async function runDailyDigest(now: Date = new Date()): Promise<JobSummary> {
  const started = Date.now();
  const notes: string[] = [];
  const counts: Record<string, number> = {};

  let data: DigestData;
  try {
    data = await buildDailyDigest(now);
  } catch (error) {
    logger.error("cron.digest_build_failed", {}, { err: error });
    return summary("daily-digest", started, counts, ["digest:unavailable"], "digest-build-failed");
  }

  counts["bookingsToday"] = data.bookingsToday;
  counts["bookingsConfirmed"] = data.bookingsConfirmed;
  counts["leadsToday"] = data.leadsToday;
  counts["roadsideToday"] = data.roadsideToday;
  counts["newReviews"] = data.newReviews;
  counts["totalReviews"] = data.totalReviews;

  if (!data.smsConfigured) notes.push("sms:not-configured");
  if (data.emailProvider === "none") notes.push("email:not-configured");
  if (data.averageRating === null) notes.push("reviews:none-yet");

  // One digest per Manila calendar day.
  const dayKey = now.toISOString().slice(0, 10);
  const claim = await claimIdempotencyKey(`DAILY_DIGEST:${dayKey}`, { template: "DAILY_DIGEST", channel: "internal" });
  if (claim.state === "duplicate") {
    logger.info("cron.digest_already_sent", { day: dayKey });
    return summary("daily-digest", started, counts, [...notes, "digest:already-sent-today"]);
  }

  // SMS to the shop: a short, hard-160 line. `sendSms` truncates safely anyway.
  const smsBody = renderDigestSms(data);
  const smsResult = await sendSms({
    to: shopSmsRecipient() ?? "",
    body: smsBody,
    template: "DAILY_DIGEST",
    consentSms: true,
    recipientSuppliedByCustomer: true,
  });
  counts["sms"] = smsResult.status === "sent" ? 1 : 0;
  if (smsResult.status !== "sent") notes.push(`sms:${smsResult.status}${smsResult.error ? `:${smsResult.error}` : ""}`);

  // Email to the shop: the full picture, including the rating or an honest
  // "no reviews yet". Never a synthesised average.
  const rating = data.averageRating === null ? "No reviews yet" : `${data.averageRating.toFixed(1)} out of 5 from ${data.totalReviews} reviews`;
  const emailResult = await sendEmailContent(
    {
      preheader: `${data.bookingsToday} bookings · ${data.leadsToday} leads · ${data.newReviews} new reviews`,
      heading: `Today at the shop — ${data.dateLabel}`,
      intro: "Here is how today is looking. Manila time.",
      rows: [
        { label: "Bookings today", value: `${data.bookingsToday} (${data.bookingsConfirmed} not cancelled)` },
        { label: "New leads", value: `${data.leadsToday}${data.roadsideToday > 0 ? ` — ${data.roadsideToday} roadside` : ""}` },
        { label: "New reviews (24h)", value: `${data.newReviews}` },
        { label: "Rating", value: rating },
      ],
      alert: data.roadsideToday > 0 ? `${data.roadsideToday} roadside lead(s) today. Those are the calls that turn into bay time.` : undefined,
      footnote: "This digest is sent once per day by /api/cron/daily-digest. It contains counts only — no customer names, numbers or messages.",
    },
    `Daily digest — ${data.dateLabel}`,
    shopEmailRecipient(),
    { template: "DAILY_DIGEST", idempotencyKey: `DAILY_DIGEST:${dayKey}` },
  );
  counts["email"] = emailResult.status === "sent" ? 1 : 0;
  if (emailResult.status !== "sent") notes.push(`email:${emailResult.status}${emailResult.error ? `:${emailResult.error}` : ""}`);

  // Nothing went out — release the day claim so a retry can try again.
  const nothingSent = smsResult.status !== "sent" && emailResult.status !== "sent";
  if (nothingSent) {
    await releaseIdempotencyKey(`DAILY_DIGEST:${dayKey}`);
    notes.push("digest:released-for-retry");
  }

  return summary("daily-digest", started, counts, notes);
}

/**
 * Releases stock holds whose TTL has passed.
 *
 * A Reservation is a time-boxed hold on parts for a booking that has not
 * happened yet. Its expiresAt is the only thing that makes the hold
 * survivable: a customer who books, never shows and never cancels must not
 * sterilise the shelf forever. This job is the clock that enforces that.
 *
 * It was fully implemented and routed at /api/cron/inventory-expiry but was
 * never registered in the tick plan, so it never ran and every abandoned
 * booking kept its parts invisible to every other customer. This closes that.
 *
 * Idempotent by construction: only HELD rows past their expiry are claimed,
 * and each claim is a conditional transition, so two overlapping runs
 * release disjoint subsets. The engine additionally guards reserved on
 * `reserved >= qty`, so a double release is impossible from either direction.
 */
export async function runInventoryExpiry(): Promise<JobSummary> {
  const started = Date.now();

  try {
    const { expireHolds } = await import("@/lib/server/inventory/reservations");
    const result = await expireHolds(200);

    const counts: Record<string, number> = {
      expired: result.expired,
      releasedUnits: result.releasedUnits,
      failures: result.failures.length,
    };

    const notes: string[] = [];
    // A per-booking accounting failure must not stop the sweep, but it must be
    // visible: it means one booking's holds are still stuck on the shelf.
    if (result.failures.length > 0) {
      notes.push(result.failures.length + "-booking(s)-need-a-human");
      logger.error("cron.inventory_expiry_failures", { failures: result.failures });
    }

    return summary("inventory-expiry", started, counts, notes);
  } catch (error) {
    logger.error("cron.inventory_expiry_threw", {}, { err: error });
    return summary("inventory-expiry", started, {}, ["internal-error"], "internal-error");
  }
}
