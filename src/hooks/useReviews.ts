"use client";

/**
 * REVIEWS — stale-while-revalidate against `GET /api/reviews`
 * ============================================================================
 * ENDPOINT CONTRACT (expected from backend-integrations)
 * ---------------------------------------------------------------------------
 *   GET /api/reviews?limit=12&cursor=<publishedAt|reviewId>
 *   200 → ApiResult<ReviewFeedDto>
 *   429 → ApiFailure with `meta.retryAfter`
 *   5xx / offline → anything else; we degrade honestly.
 *
 *   export interface ReviewDto {
 *     id: string;
 *     authorName: string;          // exactly as published by the customer
 *     rating: number;              // 1–5
 *     title: string | null;
 *     body: string;
 *     serviceTag: string | null;
 *     publishedAt: string | null;  // ISO with +08:00
 *     source: "GOOGLE" | "FACEBOOK" | "MANUAL";
 *     authorAvatarUrl: string | null;
 *   }
 *   export interface ReviewFeedDto {
 *     average: number | null;      // null when there is nothing to average
 *     count: number;
 *     distribution: { star: 1|2|3|4|5; count: number }[];
 *     reviews: ReviewDto[];
 *     hasMore: boolean;
 *     nextCursor: string | null;
 *     sourceLabel: string | null;  // e.g. "Google reviews"
 *     fetchedAt: string;
 *   }
 *
 * If the deployed shape differs, the tolerant normaliser below still renders
 * whatever it can — and NEVER invents a number to fill a gap.
 * ============================================================================
 *
 * CACHE BEHAVIOUR
 *  - `ETag` from the last good response is replayed as `If-None-Match`.
 *  - A `304` or a network failure reuses the cached payload and marks the
 *    result `stale`, so the page still shows real reviews offline.
 *  - Cache lives in module memory for the tab lifetime; nothing is persisted,
 *    because a review body is customer data.
 * ============================================================================
 */
import { useCallback, useEffect, useState } from "react";
import { apiFetchWithMeta } from "@/components/widgets/internal/api";

export type ReviewSource = "GOOGLE" | "FACEBOOK" | "MANUAL";

export interface ReviewDto {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  serviceTag: string | null;
  publishedAt: string | null;
  source: ReviewSource;
  authorAvatarUrl: string | null;
}

export interface ReviewDistributionRow {
  star: 1 | 2 | 3 | 4 | 5;
  count: number;
}

export interface ReviewFeedDto {
  /** `null` when there are no reviews — never coerced to 0 or 5. */
  average: number | null;
  count: number;
  distribution: ReviewDistributionRow[];
  reviews: ReviewDto[];
  hasMore: boolean;
  nextCursor: string | null;
  sourceLabel: string | null;
  fetchedAt: string;
}

export type ReviewsStatus = "idle" | "loading" | "success" | "empty" | "error";

export interface ReviewsState {
  status: ReviewsStatus;
  feed: ReviewFeedDto | null;
  error: string | null;
  /** True when the data came from cache and the revalidate call failed. */
  isStale: boolean;
  /** True once a live fetch has completed at least one attempt. */
  isSettled: boolean;
  retry: () => void;
}

// ── Module-level stale cache, scoped to the tab ──────────────────────────────
let cache: { etag: string | null; feed: ReviewFeedDto } | null = null;
const inflight = new Map<string, Promise<ReviewFeedDto | null>>();

export function primeReviewsCache(feed: ReviewFeedDto, etag?: string | null): void {
  cache = { etag: etag ?? null, feed };
}
export function clearReviewsCache(): void {
  cache = null;
}
export function getCachedReviews(): ReviewFeedDto | null {
  return cache?.feed ?? null;
}

// ── Tolerant normalisation ───────────────────────────────────────────────────

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function clampRating(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(0, Math.round(n)));
}

function readDistribution(input: unknown): ReviewDistributionRow[] {
  const out: ReviewDistributionRow[] = [];
  if (input && typeof input === "object") {
    const rec = input as Record<string, unknown>;
    for (let star = 5; star >= 1; star -= 1) {
      const raw = rec[star] ?? rec[`${star}star`] ?? rec[`${star}Star`] ?? rec[String(star)];
      const count = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
      out.push({ star: star as 1 | 2 | 3 | 4 | 5, count });
    }
  }
  return out;
}

function normaliseReview(raw: unknown, index: number): ReviewDto | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const body = asString(r.body) || asString(r.text) || asString(r.comment);
  const rating = clampRating(r.rating ?? r.stars);
  if (body.trim() === "" && rating === 0) return null;
  const sourceRaw = asString(r.source).toUpperCase();
  const source: ReviewSource =
    sourceRaw === "GOOGLE" || sourceRaw === "FACEBOOK" || sourceRaw === "MANUAL" ? sourceRaw : "MANUAL";
  return {
    id: asString(r.id) || `${source}-${index}-${body.slice(0, 12)}`,
    authorName: asString(r.authorName) || asString(r.author) || "Customer",
    rating,
    title: typeof r.title === "string" && r.title.trim() !== "" ? r.title : null,
    body,
    serviceTag: typeof r.serviceTag === "string" && r.serviceTag.trim() !== "" ? r.serviceTag : null,
    publishedAt: typeof r.publishedAt === "string" ? r.publishedAt : null,
    source,
    authorAvatarUrl: typeof r.authorAvatarUrl === "string" && r.authorAvatarUrl.trim() !== "" ? r.authorAvatarUrl : null,
  };
}

/** Accepts either the documented envelope or a bare array. Never throws. */
export function normaliseFeed(data: unknown, fallbackCount?: number): ReviewFeedDto | null {
  if (Array.isArray(data)) {
    const reviews = data.map(normaliseReview).filter((r): r is ReviewDto => r !== null);
    return reviews.length === 0 ? null : buildFeed(reviews, null, [], false, null);
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const rawReviews = Array.isArray(d.reviews)
    ? d.reviews
    : Array.isArray(d.items)
      ? d.items
      : Array.isArray(d.data)
        ? d.data
        : [];
  const reviews = rawReviews.map(normaliseReview).filter((r): r is ReviewDto => r !== null);
  const count =
    typeof d.count === "number" && Number.isFinite(d.count)
      ? Math.max(0, Math.round(d.count))
      : typeof d.total === "number" && Number.isFinite(d.total)
        ? Math.max(0, Math.round(d.total))
        : (fallbackCount ?? reviews.length);
  const average =
    typeof d.average === "number" && Number.isFinite(d.average)
      ? Math.min(5, Math.max(0, d.average))
      : typeof d.averageRating === "number" && Number.isFinite(d.averageRating)
        ? Math.min(5, Math.max(0, d.averageRating))
        : null;

  if (reviews.length === 0 && count === 0 && average === null) return null;

  const distribution = readDistribution(d.distribution ?? d.histogram ?? d.starCounts);
  return buildFeed(
    reviews,
    average,
    distribution.length > 0 ? distribution : null,
    d.hasMore === true,
    typeof d.nextCursor === "string" ? d.nextCursor : null,
    typeof d.sourceLabel === "string" ? d.sourceLabel : null,
  );
}

function buildFeed(
  reviews: ReviewDto[],
  average: number | null,
  distribution: ReviewDistributionRow[] | null,
  hasMore: boolean,
  nextCursor: string | null,
  sourceLabel?: string | null,
): ReviewFeedDto {
  const computedDistribution: ReviewDistributionRow[] = distribution ?? [5, 4, 3, 2, 1].map((star) => ({
    star: star as 1 | 2 | 3 | 4 | 5,
    count: reviews.filter((r) => Math.round(r.rating) === star).length,
  }));
  const resolvedAverage =
    average !== null
      ? average
      : reviews.length > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
        : null;
  return {
    average: resolvedAverage,
    count: reviews.length > 0 ? reviews.length : 0,
    distribution: computedDistribution,
    reviews,
    hasMore,
    nextCursor,
    sourceLabel: sourceLabel ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

// ── Fetch ───────────────────────────────────────────────────────────────────

async function fetchFeed(limit: number): Promise<{ feed: ReviewFeedDto | null; etag: string | null }> {
  const key = `reviews:${limit}`;
  const existing = inflight.get(key);
  if (existing) {
    const feed = await existing;
    return { feed, etag: cache?.etag ?? null };
  }

  const run = (async (): Promise<ReviewFeedDto | null> => {
    const headers: Record<string, string> = {};
    if (cache?.etag) headers["If-None-Match"] = cache.etag;
    const { result, etag } = await apiFetchWithMeta<unknown>(`/api/reviews?limit=${limit}`, {
      headers,
      timeoutMs: 8000,
    });
    if (!result.ok) {
      if (result.error.code === "NOT_FOUND") return null;
      // A network failure should still show the last real reviews.
      return cache?.feed ?? null;
    }
    const feed = normaliseFeed(result.data);
    if (feed) cache = { etag, feed };
    return feed ?? cache?.feed ?? null;
  })();

  inflight.set(key, run);
  try {
    const feed = await run;
    return { feed, etag: cache?.etag ?? null };
  } finally {
    inflight.delete(key);
  }
}

export interface UseReviewsOptions {
  limit?: number;
  /** Skip fetching entirely (e.g. a statically exported page). */
  enabled?: boolean;
}

export function useReviews(options: UseReviewsOptions = {}): ReviewsState {
  const limit = options.limit ?? 8;
  const enabled = options.enabled ?? true;

  const [state, setState] = useState<ReviewsState>(() => {
    const cached = getCachedReviews();
    return {
      status: cached ? (cached.reviews.length > 0 ? "success" : "empty") : "idle",
      feed: cached,
      error: null,
      isStale: false,
      isSettled: cached !== null,
      retry: () => {},
    };
  });
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const controller = new AbortController();
    let cancelled = false;

    // Always show skeletons first: a widget that flickers real content into
    // place reads as fake. Cache only primes the *error* path.
    setState((prev) => ({ ...prev, status: "loading", error: null, isStale: false }));

    void (async () => {
      const cachedBefore = getCachedReviews();
      const { feed } = await fetchFeed(limit);
      if (cancelled || controller.signal.aborted) return;

      if (!feed) {
        setState((prev) => ({
          ...prev,
          status: "error",
          feed: cachedBefore,
          isStale: cachedBefore !== null,
          error:
            "We could not load customer reviews right now. Our Facebook page has the latest ones in the customer's own words.",
          isSettled: true,
          retry,
        }));
        return;
      }

      const live = cachedBefore !== feed;
      setState({
        status: feed.reviews.length > 0 ? "success" : "empty",
        feed,
        error: null,
        isStale: !live,
        isSettled: true,
        retry,
      });
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, limit, nonce, retry]);

  return state;
}

/**
 * "12 reviews" / "1 review" / "No reviews yet".
 * NEVER renders "0 reviews (5.0)" — an empty feed gets its own empty state.
 */
export function formatReviewCount(count: number): string {
  if (count <= 0) return "No reviews yet";
  return `${count} ${count === 1 ? "review" : "reviews"}`;
}

/** One-decimal average, or `null`. Never a fake 5.0. */
export function formatAverage(average: number | null): string | null {
  if (average === null || !Number.isFinite(average)) return null;
  return average.toFixed(1);
}