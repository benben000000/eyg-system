/**
 * FACEBOOK PAGE REVIEWS / RECOMMENDATIONS
 * ============================================================================
 * ⚠️  READ THIS BEFORE ENABLING ANYTHING IN THIS FILE
 * =============================================================================
 * Two hard constraints, both legal, both non-negotiable:
 *
 * 1. **Scraping Facebook is a violation of the Facebook Terms of Service and of
 *    the Data Privacy Act of 2012.** There is no version of this file that
 *    fetches an HTML page or calls an undocumented endpoint. If you find
 *    yourself wanting to add one, the answer is no.
 *
 * 2. **Graph API access requires a Meta App Review.** A page access token can
 *    only read a page's recommendations/recommendations if the app has been
 *    approved for the `pages_read_engagement` and (for recommendations)
 *    `page_manage_posts`-adjacent scopes, AND the app is in Live mode, AND the
 *    requesting user is a page admin. Until that review is granted, the API
 *    answers `403` with an `(#10) This method is not supported…` or
 *    `(#200) …` error, which this module reports as a skip — not a crash.
 *
 * CONSEQUENCE FOR THIS MODULE
 * ---------------------------
 * Every failure mode degrades to `{ reviews: [], skipped: true }`:
 *   - no `FACEBOOK_PAGE_ACCESS_TOKEN`      -> skipped, zero network calls
 *   - 403 / `(#10)` / `(#200)` from Graph    -> skipped, logged once
 *   - network error, timeout, 5xx            -> skipped, logged
 *
 * It NEVER fabricates a review, and it NEVER falls back to scraping.
 *
 * WHAT TO DO INSTEAD (and what the shop actually gets)
 * ---------------------------------------------------
 * The shop's real social proof on Facebook is *link posts from customers*. The
 * right product answer is a "send us your review" link (already wired via
 * `notifyReviewRequest`) plus a `MANUAL` row in the `Review` table for anything
 * the mechanic copies across from Messenger at the counter. That path needs no
 * API key at all.
 *
 * @see docs/ops/INTEGRATIONS.md § Reviews — Facebook (App Review checklist)
 */

import { log } from "@/lib/logger";
import { withDb } from "../integrations/db";
import { DEFAULT_TIMEOUT_MS, reviewsConfig } from "../integrations/env";
import { fetchJson } from "../integrations/http";
import type { NormalisedReview, SyncSummary } from "./aggregate";
import { sanitiseReviewText } from "./google";

const logger = log.child({ scope: "reviews/facebook" });

const GRAPH_VERSION = "v21.0";
const GRAPH_HOST = "https://graph.facebook.com";

/** Graph errors that mean "not approved / not permitted", not "broken". */
const PERMISSION_CODES = new Set([1, 10, 190, 200, 803]);

interface GraphRecommendation {
  id?: string;
  recommendation_text?: string;
  title?: string;
  rating?: number | string;
  created_time?: string;
  sender?: { name?: string; id?: string };
  open_graph_story?: { message?: { text?: string } };
}

interface GraphResponse {
  data?: GraphRecommendation[];
  error?: { code?: number; type?: string; message?: string };
}

export interface FacebookFetchResult {
  reviews: NormalisedReview[];
  skipped: boolean;
  error: string | null;
  /** True when the failure is "you have not been granted this scope yet". */
  needsAppReview: boolean;
  latencyMs: number;
}

/** Pure: is the Facebook path usable at all? */
export function facebookConfigured(): boolean {
  return Boolean(reviewsConfig().facebookPageToken);
}

const readRating = (raw: unknown): number | null => {
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : Number.NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(0, Math.round(n)));
};

/**
 * Facebook recommendations have no star rating, so this returns `null` unless a
 * usable one is present. A review with no rating is **dropped**, not defaulted
 * to 5 — a synthesised rating is the one thing this whole module exists to
 * avoid.
 */
export function normaliseFacebookRecommendation(raw: GraphRecommendation): NormalisedReview | null {
  const externalId = typeof raw.id === "string" ? raw.id.trim() : "";
  if (externalId.length === 0) return null;

  const rating = readRating(raw.rating);
  const text =
    sanitiseReviewText(raw.recommendation_text ?? raw.open_graph_story?.message?.text ?? "", 2_000) ||
    sanitiseReviewText(raw.title ?? "", 200);
  if (rating === null || text.length === 0) return null;

  const author = sanitiseReviewText(raw.sender?.name ?? "", 80);
  const publishedAt = raw.created_time && !Number.isNaN(Date.parse(raw.created_time)) ? new Date(raw.created_time) : null;

  return {
    source: "FACEBOOK",
    externalId,
    authorName: author.length >= 1 ? author : "Facebook customer",
    authorAvatarUrl: null,
    rating,
    title: sanitiseReviewText(raw.title ?? "", 140) || null,
    body: text,
    serviceTag: null,
    publishedAt,
  };
}

/**
 * Reads public recommendations/recommendations for the page. Degrades to a
 * skip on every failure. Never scrapes, never throws.
 */
export async function fetchFacebookReviews(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<FacebookFetchResult> {
  const cfg = reviewsConfig();
  if (!cfg.facebookPageToken) {
    logger.info("facebook.not_configured", { effect: "no network call; serving cached or empty" });
    return { reviews: [], skipped: true, error: null, needsAppReview: false, latencyMs: 0 };
  }
  if (!cfg.facebookPageId) {
    // Without a page id there is nothing legal to ask for.
    logger.warn("facebook.no_page_id", { note: "set FACEBOOK_PAGE_ID, or leave this path off" });
    return { reviews: [], skipped: true, error: null, needsAppReview: false, latencyMs: 0 };
  }

  const url =
    `${GRAPH_HOST}/${GRAPH_VERSION}/${encodeURIComponent(cfg.facebookPageId)}` +
    `?fields=recommendations.limit(50){id,title,recommendation_text,rating,created_time,sender.name}` +
    `&access_token=${encodeURIComponent(cfg.facebookPageToken)}`;

  const result = await fetchJson<GraphResponse>(url, { provider: "facebook-graph", timeoutMs, retries: 0 });

  if (!result.ok || result.data === null) {
    logger.warn("facebook.fetch_failed", { code: result.error, status: result.status });
    return { reviews: [], skipped: true, error: result.error ?? "fetch-failed", needsAppReview: false, latencyMs: result.latencyMs };
  }

  const graphError = result.data.error;
  if (graphError) {
    const code = typeof graphError.code === "number" ? graphError.code : 0;
    const needsAppReview = PERMISSION_CODES.has(code);
    logger.warn("facebook.graph_error", {
      code,
      type: (graphError.type ?? "unknown").slice(0, 40),
      needsAppReview,
      note: needsAppReview ? "Meta App Review has not granted this scope — expected until it is approved" : undefined,
    });
    return { reviews: [], skipped: true, error: `graph-${code}`, needsAppReview, latencyMs: result.latencyMs };
  }

  const raw = Array.isArray(result.data.data) ? result.data.data : [];
  const reviews: NormalisedReview[] = [];
  for (const item of raw) {
    const rec = typeof item === "object" && item !== null ? (item as GraphRecommendation) : null;
    if (!rec) continue;
    const normalised = normaliseFacebookRecommendation(rec);
    if (normalised) reviews.push(normalised);
  }

  logger.info("facebook.fetched", { count: reviews.length, latencyMs: result.latencyMs });
  return { reviews, skipped: false, error: null, needsAppReview: false, latencyMs: result.latencyMs };
}

/** Upsert on `(source, externalId)`. Preserves `isPublished`/`isFeatured`. */
export async function upsertFacebookReviews(
  reviews: NormalisedReview[],
): Promise<{ created: number; updated: number; skipped: number }> {
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
          logger.warn("facebook.upsert_failed", {}, { err: error });
        }
      }
      return { created, updated, skipped };
    },
    { created: 0, updated: 0, skipped: reviews.length },
    { event: "reviews.facebook.upsert" },
  );
}

/** The cron step. Idempotent. */
export async function syncFacebookReviews(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<SyncSummary> {
  const started = Date.now();
  if (!facebookConfigured()) {
    logger.info("facebook.sync_skipped", { reason: "not-configured" });
    return { source: "FACEBOOK", ok: true, skipped: true, created: 0, updated: 0, failed: 0, error: null, latencyMs: 0 };
  }

  const fetched = await fetchFacebookReviews(timeoutMs);
  if (fetched.skipped) {
    return {
      source: "FACEBOOK",
      ok: true,
      skipped: true,
      created: 0,
      updated: 0,
      failed: 0,
      error: fetched.needsAppReview ? "app-review-required" : fetched.error,
      latencyMs: Date.now() - started,
    };
  }

  const upserted = await upsertFacebookReviews(fetched.reviews);
  return {
    source: "FACEBOOK",
    ok: true,
    skipped: false,
    created: upserted.created,
    updated: upserted.updated,
    failed: upserted.skipped,
    error: null,
    latencyMs: Date.now() - started,
  };
}
