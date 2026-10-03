/**
 * GOOGLE BUSINESS PROFILE REVIEWS
 * ============================================================================
 * Reads public reviews for `GOOGLE_PLACE_ID` through the Places API v1
 * (`places.googleapis.com/v1/places/{placeId}` with a `fieldMask`), normalises
 * them into the `Review` model shape, and upserts on `(source, externalId)`.
 *
 * DEGRADATION CONTRACT
 * --------------------
 * - No `GOOGLE_PLACE_ID` or no `GOOGLE_API_KEY` -> `fetchGoogleReviews()` returns
 *   `{ skipped: true }` with **zero** network calls. The homepage then serves
 *   whatever is already in the `Review` table; if that is empty, the UI shows
 *   its designed empty state.
 * - Any HTTP failure — 403 (key not authorised for the Places API), 429, 5xx,
 *   DNS, timeout — is logged and returns `[]`. The caller serves stale data.
 * - **Never fabricates.** Only rows Google actually returned are written.
 *
 * PII DISCIPLINE
 * --------------
 * `authorAttribution.displayName` is the name the reviewer chose to publish, and
 * it is the only identity we keep. `photoAttributions`, the author
 * `resourceName`, `googleMapsUri` and `publishAt`'s sub-day detail are dropped
 * here rather than at the API edge, so no downstream consumer can leak them by
 * accident.
 *
 * @see docs/ops/INTEGRATIONS.md § Reviews — Google
 */

import { log } from "@/lib/logger";
import { withDb } from "../integrations/db";
import { DEFAULT_TIMEOUT_MS, reviewsConfig } from "../integrations/env";
import { fetchJson } from "../integrations/http";
import type { NormalisedReview, SyncSummary } from "./aggregate";

const logger = log.child({ scope: "reviews/google" });

const PLACES_HOST = "https://places.googleapis.com";

/** Only the fields we actually use. Keeps the response small and the cost low. */
const FIELD_MASK = [
  "id",
  "rating",
  "userRatingCount",
  "reviews",
].join(",");

export interface GooglePlaceResponse {
  id?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: GoogleReview[];
}

export interface GoogleReview {
  name?: string;
  rating?: number;
  text?: { text?: string; language?: string };
  publishTime?: string;
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  googleMapsUri?: string;
}

export interface GoogleFetchResult {
  reviews: NormalisedReview[];
  /** Place-level average Google reports, when available. */
  placeRating: number | null;
  placeRatingCount: number | null;
  skipped: boolean;
  error: string | null;
  latencyMs: number;
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Google's 0–5 rating, clamped. `null` for a review with no rating. */
function readRating(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Math.min(5, Math.max(0, Math.round(raw)));
}

/** Zero-width joiners, bidi overrides, and control characters reviewers sometimes paste in. */
const INVISIBLE_RE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060\uFEFF]/g;

/** Drops invisible/control characters and collapses runs of whitespace. */
export function sanitiseReviewText(raw: string, max = 2_000): string {
  return raw.replace(INVISIBLE_RE, " ").replace(/\s{3,}/g, " ").trim().slice(0, max);
}

/** Maps one Google review into our shape. `null` when it is unusable. */
export function normaliseGoogleReview(raw: GoogleReview): NormalisedReview | null {
  const externalId = typeof raw.name === "string" ? raw.name.trim() : "";
  // A review without a stable id cannot be upserted on `(source, externalId)`.
  if (externalId.length === 0) return null;

  const rating = readRating(raw.rating);
  const body = sanitiseReviewText(raw.text?.text ?? "");
  if (rating === null || body.length === 0) return null;

  const author = sanitiseReviewText(raw.authorAttribution?.displayName ?? "", 80);
  const publishedAt = raw.publishTime && !Number.isNaN(Date.parse(raw.publishTime)) ? new Date(raw.publishTime) : null;

  return {
    source: "GOOGLE",
    externalId,
    // Google always supplies a display name, but never trust it to be non-empty.
    authorName: author.length >= 1 ? author : "Google reviewer",
    // Intentionally dropped: raw.authorAttribution.photoUri / .uri,
    // raw.googleMapsUri. Not PII we need, and not PII we want on the wire.
    authorAvatarUrl: null,
    rating,
    title: null,
    body,
    serviceTag: null,
    publishedAt,
  };
}

/** Is the Google path usable at all? Pure — used by `/api/ready` and cron. */
export function googleConfigured(): boolean {
  const cfg = reviewsConfig();
  return Boolean(cfg.googlePlaceId && cfg.googleApiKey);
}

/**
 * Fetches and normalises. Never throws, never fabricates, never blocks longer
 * than `timeoutMs`.
 */
export async function fetchGoogleReviews(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<GoogleFetchResult> {
  const cfg = reviewsConfig();
  if (!cfg.googlePlaceId || !cfg.googleApiKey) {
    logger.info("google.not_configured", { effect: "no network call; serving cached or empty" });
    return { reviews: [], placeRating: null, placeRatingCount: null, skipped: true, error: null, latencyMs: 0 };
  }

  const result = await fetchJson<GooglePlaceResponse>(
    `${PLACES_HOST}/v1/places/${encodeURIComponent(cfg.googlePlaceId)}`,
    {
      provider: "google-places",
      headers: { "X-Goog-Api-Key": cfg.googleApiKey, "X-Goog-FieldMask": FIELD_MASK },
      timeoutMs,
      retries: 1,
      backoffMs: 500,
    },
  );

  if (!result.ok || result.data === null) {
    logger.warn("google.fetch_failed", { code: result.error, status: result.status, attempts: result.attempts });
    return {
      reviews: [],
      placeRating: null,
      placeRatingCount: null,
      skipped: false,
      error: result.error ?? "fetch-failed",
      latencyMs: result.latencyMs,
    };
  }

  const rawReviews = Array.isArray(result.data.reviews) ? result.data.reviews : [];
  const reviews: NormalisedReview[] = [];
  for (const raw of rawReviews) {
    const rec = asRecord(raw);
    if (!rec) continue;
    const normalised = normaliseGoogleReview(rec as GoogleReview);
    if (normalised) reviews.push(normalised);
  }

  logger.info("google.fetched", { count: reviews.length, latencyMs: result.latencyMs });
  return {
    reviews,
    placeRating: readRating(result.data.rating),
    placeRatingCount: typeof result.data.userRatingCount === "number" ? result.data.userRatingCount : null,
    skipped: false,
    error: null,
    latencyMs: result.latencyMs,
  };
}

/**
 * Upserts fetched reviews into `Review` on `(source, externalId)`.
 *
 * New reviews are `isPublished: true` so they appear immediately. Existing
 * rows keep their `isPublished` and `isFeatured` flags — a staff decision must
 * not be reverted by a sync. `isFeatured` is intentionally never set here.
 *
 * Idempotent: running twice changes nothing the second time.
 */
export async function upsertGoogleReviews(reviews: NormalisedReview[]): Promise<{ created: number; updated: number; skipped: number }> {
  if (reviews.length === 0) return { created: 0, updated: 0, skipped: 0 };

  return withDb(
    async (db) => {
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const review of reviews) {
        if (!review.externalId) {
          skipped += 1;
          continue;
        }
        try {
          const existing = await db.review.findUnique({
            where: { source_externalId: { source: review.source, externalId: review.externalId } },
            select: { id: true },
          });
          const data = {
            authorName: review.authorName,
            authorAvatarUrl: review.authorAvatarUrl,
            rating: review.rating,
            title: review.title,
            body: review.body,
            serviceTag: review.serviceTag,
            publishedAt: review.publishedAt,
            syncedAt: new Date(),
          };
          if (existing) {
            // `isPublished` / `isFeatured` are deliberately omitted.
            await db.review.update({ where: { id: existing.id }, data });
            updated += 1;
          } else {
            await db.review.create({
              data: { ...data, source: review.source, externalId: review.externalId, isPublished: true, isFeatured: false },
            });
            created += 1;
          }
        } catch (error) {
          skipped += 1;
          logger.warn("google.upsert_failed", {}, { err: error });
        }
      }

      logger.info("google.upserted", { created, updated, skipped, received: reviews.length });
      return { created, updated, skipped };
    },
    { created: 0, updated: 0, skipped: reviews.length },
    { event: "reviews.google.upsert" },
  );
}

/** The full sync step used by the cron job. Idempotent. */
export async function syncGoogleReviews(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<SyncSummary> {
  const started = Date.now();
  if (!googleConfigured()) {
    logger.info("google.sync_skipped", { reason: "not-configured" });
    return { source: "GOOGLE", ok: true, skipped: true, created: 0, updated: 0, failed: 0, error: null, latencyMs: 0 };
  }

  const fetched = await fetchGoogleReviews(timeoutMs);
  if (fetched.skipped) {
    return { source: "GOOGLE", ok: true, skipped: true, created: 0, updated: 0, failed: 0, error: null, latencyMs: Date.now() - started };
  }
  if (fetched.error !== null) {
    return { source: "GOOGLE", ok: false, skipped: false, created: 0, updated: 0, failed: fetched.reviews.length, error: fetched.error, latencyMs: Date.now() - started };
  }

  const upserted = await upsertGoogleReviews(fetched.reviews);
  return {
    source: "GOOGLE",
    ok: true,
    skipped: false,
    created: upserted.created,
    updated: upserted.updated,
    failed: upserted.skipped,
    error: null,
    latencyMs: Date.now() - started,
  };
}
