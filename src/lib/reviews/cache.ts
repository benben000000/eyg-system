/**
 * REVIEWS CACHE — in-process, stale-while-revalidate
 * ============================================================================
 * Why a cache at all: the homepage must not depend on Google being up, and a
 * Places API call per page view is a bill and a rate-limit risk. The cache has
 * three jobs:
 *
 *   1. **TTL** (default 30 min) so a page view costs no network call.
 *   2. **Stale-while-revalidate** so a Google outage *never blanks the homepage*.
 *      A stale value is served instantly and a refresh runs in the background.
 *      Only if there is no value at all do we wait on the loader — and even then
 *      a loader failure returns an empty feed, never a throw.
 *   3. **Single-flight.** Ten concurrent requests for a cold key make ONE
 *      database/API call, not ten.
 *
 * Scope: per Node process. On a multi-instance deploy each instance keeps its
 * own cache, which is fine (it is a 30-minute read cache) and is called out in
 * the report as the one thing that would need Redis if the shop ever runs an
 * active/active fleet.
 *
 * `invalidateReviewsCache()` is called by the `sync-reviews` cron job the moment
 * new rows land, so staff never wait 30 minutes to see a fresh review.
 */

import { log } from "@/lib/logger";
import { envNum } from "../integrations/env";
import type { ReviewFeedDto } from "./aggregate";

const logger = log.child({ scope: "reviews/cache" });

/** Fresh window. Overridable with `REVIEWS_CACHE_TTL_MS`. */
export const DEFAULT_TTL_MS = 30 * 60 * 1_000;

/** How long past the TTL a value may still be served while a refresh runs. */
export const DEFAULT_STALE_MS = 24 * 60 * 60 * 1_000;

export function reviewsTtlMs(): number {
  return Math.max(5_000, envNum("REVIEWS_CACHE_TTL_MS", DEFAULT_TTL_MS));
}

interface Entry<T> {
  value: T;
  freshUntil: number;
  staleUntil: number;
  storedAt: number;
}

const entries = new Map<string, Entry<unknown>>();
/** In-flight loads, keyed the same way. Guarantees one loader run per key. */
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 64;

function ttlMs(): number {
  return reviewsTtlMs();
}

function staleMs(): number {
  return Math.max(ttlMs(), envNum("REVIEWS_CACHE_STALE_MS", DEFAULT_STALE_MS));
}

function evictIfNeeded(): void {
  if (entries.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of entries) {
    if (v.staleUntil <= now) entries.delete(k);
  }
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
}

export type CacheState = "fresh" | "stale" | "miss" | "error";

export interface CachedResult<T> {
  value: T;
  state: CacheState;
  /** Age of the value actually served, in ms. */
  ageMs: number;
}

/** Seeds or replaces a value directly. Used by tests and by the sync job. */
export function setReviewsCache<T>(key: string, value: T, customTtlMs?: number): void {
  const now = Date.now();
  const t = customTtlMs ?? ttlMs();
  entries.set(key, { value, freshUntil: now + t, staleUntil: now + staleMs(), storedAt: now });
  evictIfNeeded();
}

/** Reads without triggering a load. `null` when absent. */
export function peekReviewsCache<T>(key: string): CachedResult<T> | null {
  const entry = entries.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (entry.staleUntil <= now) {
    entries.delete(key);
    return null;
  }
  return {
    value: entry.value as T,
    state: entry.freshUntil > now ? "fresh" : "stale",
    ageMs: now - entry.storedAt,
  };
}

/** Drops everything. The sync job calls this after a successful upsert. */
export function invalidateReviewsCache(): void {
  const size = entries.size;
  entries.clear();
  if (size > 0) logger.info("reviews.cache_invalidated", { entries: size });
}

function refreshInBackground<T>(key: string, loader: () => Promise<T>): void {
  if (inflight.has(key)) return;
  const run = (async () => {
    try {
      setReviewsCache(key, await loader());
    } catch (error) {
      // A failed refresh keeps the stale value in place. That is the whole
      // point: a Google outage must not blank the homepage.
      logger.warn("reviews.background_refresh_failed", { key, effect: "stale value retained" }, { err: error });
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, run as Promise<unknown>);
}

/**
 * The single entry point.
 *
 * - fresh  -> return immediately, no I/O
 * - stale  -> return the stale value, kick off a background refresh
 * - miss   -> await the loader (deduped); on failure return `fallback`
 */
export async function withReviewsCache<T>(
  key: string,
  loader: () => Promise<T>,
  fallback: T,
): Promise<CachedResult<T>> {
  const cached = peekReviewsCache<T>(key);
  if (cached?.state === "fresh") return cached;

  if (cached?.state === "stale") {
    refreshInBackground(key, loader);
    return { value: cached.value, state: "stale", ageMs: cached.ageMs };
  }

  // Cold key. Dedupe concurrent misses.
  const existing = inflight.get(key) as Promise<T> | undefined;
  const started = Date.now();
  try {
    if (existing) {
      const value = await existing;
      return { value, state: "fresh", ageMs: Date.now() - started };
    }
    const run = (async () => {
      const value = await loader();
      setReviewsCache(key, value);
      return value;
    })();
    inflight.set(key, run as Promise<unknown>);
    try {
      const value = await run;
      return { value, state: "fresh", ageMs: Date.now() - started };
    } finally {
      inflight.delete(key);
    }
  } catch (error) {
    logger.error("reviews.load_failed", { key, effect: "serving the documented fallback" }, { err: error });
    return { value: fallback, state: "error", ageMs: 0 };
  }
}

// ── Cache key builder ────────────────────────────────────────────────────────

/**
 * One cache key per distinct query shape. `includeSummary` is separate because
 * the summary is the expensive part (it scans the whole matching set).
 */
export function reviewsCacheKey(options: { limit: number; serviceTag?: string | null; minRating?: number | null; cursor?: string | null; includeSummary?: boolean }): string {
  const parts = [
    "reviews",
    `l${Math.max(1, Math.min(50, Math.floor(options.limit)))}`,
    options.serviceTag ? `t${options.serviceTag.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30)}` : "t-",
    typeof options.minRating === "number" && Number.isFinite(options.minRating) ? `r${Math.round(options.minRating)}` : "r-",
    options.cursor ? `c${options.cursor.slice(0, 24)}` : "c-",
    options.includeSummary === false ? "nosum" : "sum",
  ];
  return parts.join(":");
}

/** The empty feed returned when the database is unavailable. Not a placeholder. */
export function emptyReviewFeed(): ReviewFeedDto {
  return {
    reviews: [],
    summary: { average: null, count: 0, distribution: [5, 4, 3, 2, 1].map((star) => ({ star: star as 1 | 2 | 3 | 4 | 5, count: 0 })) },
    hasMore: false,
    nextCursor: null,
    sourceLabel: null,
    fetchedAt: new Date().toISOString(),
  };
}

/** Test hook — clears values and in-flight bookkeeping. */
export function resetReviewsCache(): void {
  entries.clear();
  inflight.clear();
}

/** Diagnostics for `/api/ready`. */
export function reviewsCacheStats(): { entries: number; inflight: number } {
  return { entries: entries.size, inflight: inflight.size };
}
