/**
 * REVIEW AGGREGATION
 * ============================================================================
 * The read side of social proof. Owns the public DTO contract consumed by
 * `GET /api/reviews` and by `src/hooks/useReviews.ts` (widgets agent).
 *
 * THE ONE RULE THAT MATTERS
 * -------------------------
 * **Never fabricate a review, and never fabricate a rating.** If the table is
 * empty the API returns `reviews: []`, `count: 0`, `average: null`,
 * `distribution: [{star:5,count:0}, …]`. `average` is `null`, never `0` and
 * never `5`. The UI has a designed empty state for exactly this case; a
 * synthesised number is a lie with a decimal point.
 *
 * ORDERING IS DETERMINISTIC
 * -------------------------
 * `isFeatured DESC, publishedAt DESC, id ASC`. The `id` tiebreak matters: two
 * reviews published in the same millisecond must not swap places between
 * requests, or the ETag changes and the browser refetches forever.
 *
 * @see docs/ops/INTEGRATIONS.md § Reviews
 */

import type { ReviewSource } from "@prisma/client";
import { log } from "@/lib/logger";
import { withDb } from "../integrations/db";
import { decryptPii } from "../integrations/crypto";

const logger = log.child({ scope: "reviews/aggregate" });

// ── Public contract (must match `src/hooks/useReviews.ts`) ───────────────────

export interface ReviewDto {
  id: string;
  /** Exactly as the reviewer chose to publish it. Never normalised or invented. */
  authorName: string;
  /** 1–5, integer. */
  rating: number;
  title: string | null;
  body: string;
  serviceTag: string | null;
  /** ISO 8601 with a `+08:00` offset, or `null` when Google gave no timestamp. */
  publishedAt: string | null;
  source: "GOOGLE" | "FACEBOOK" | "MANUAL";
  /** Always `null` from the API. See `stripForPublic`. */
  authorAvatarUrl: string | null;
}

export interface ReviewDistributionRow {
  star: 1 | 2 | 3 | 4 | 5;
  count: number;
}

export interface ReviewSummary {
  /** One decimal, or `null` when there is nothing to average. NEVER 0 or 5. */
  average: number | null;
  /** Total published reviews matching the filters, not the page size. */
  count: number;
  distribution: ReviewDistributionRow[];
}

export interface ReviewFeedDto {
  reviews: ReviewDto[];
  summary: ReviewSummary;
  hasMore: boolean;
  nextCursor: string | null;
  sourceLabel: string | null;
  fetchedAt: string;
}

export interface GetPublishedReviewsOptions {
  limit?: number;
  serviceTag?: string | null;
  minRating?: number | null;
  /** Keyset pagination: the `id` of the last item from the previous page. */
  cursor?: string | null;
}

export interface SyncSummary {
  source: "GOOGLE" | "FACEBOOK";
  ok: boolean;
  /** True when the provider was not configured — no network call was made. */
  skipped: boolean;
  created: number;
  updated: number;
  failed: number;
  error: string | null;
  latencyMs: number;
}

// ── Internal row shape ───────────────────────────────────────────────────────

interface ReviewRow {
  id: string;
  source: ReviewSource;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  title: string | null;
  body: string;
  serviceTag: string | null;
  publishedAt: Date | null;
}

/** The shape `google.ts` / `facebook.ts` produce. */
export interface NormalisedReview {
  source: "GOOGLE" | "FACEBOOK" | "MANUAL";
  externalId: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  title: string | null;
  body: string;
  serviceTag: string | null;
  publishedAt: Date | null;
}

// ── Time ─────────────────────────────────────────────────────────────────────

const PH_OFFSET_LABEL = "+08:00";

/** ISO 8601 with the real `+08:00` offset. The contract requires the offset. */
export function isoWithPhOffset(instant: Date): string {
  const shifted = new Date(instant.getTime() + 8 * 60 * 60 * 1_000);
  const p = (n: number, w = 2): string => String(n).padStart(w, "0");
  return (
    `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}` +
    `T${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}${PH_OFFSET_LABEL}`
  );
}

// ── PII stripping ────────────────────────────────────────────────────────────

/**
 * Patterns a reviewer sometimes leaves in a review body that must not reach the
 * client: a phone number, an email, a `tel:`/`viber:` link, an @handle, a plate.
 * The body is the reviewer's own words, so this only removes *contact
 * identifiers*, never the sentiment.
 */
const CONTACT_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\b(?:\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, "[phone removed]"],
  [/\+?\d[\d\s().-]{8,}\d/g, "[number removed]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email removed]"],
  [/\b(?:https?:\/\/|www\.)\S+/gi, "[link removed]"],
  [/\b(?:tel|viber|wa|whatsapp)\s*[:=]?\s*\S{4,}/gi, "[contact removed]"],
  [/(?<![A-Za-z0-9])@[A-Za-z0-9_]{4,}/g, "[handle removed]"],
  // A Philippine plate: ABC 123 or ABC-1234. Not needed for a review.
  [/\b[A-Z]{3}[-\s]?\d{3,4}\b/g, "[plate removed]"],
];

/**
 * Makes a review safe to render client-side.
 *
 * Strips: the avatar URL (an opaque but stable per-person identifier), any
 * contact identifier in the body or title, and any `MANUAL` row whose name
 * happens to be stored encrypted.
 *
 * Keeps: the display name the reviewer chose to publish, the rating, the words.
 */
export function stripForPublic(row: ReviewRow): ReviewDto {
  let body = row.body;
  let title = row.title;
  for (const [pattern, replacement] of CONTACT_PATTERNS) {
    body = body.replace(pattern, replacement);
    if (title !== null) title = title.replace(pattern, replacement);
  }

  const name = decryptPii(row.authorName) ?? row.authorName;

  return {
    id: row.id,
    authorName: name.trim().slice(0, 80) || "Customer",
    rating: Math.min(5, Math.max(1, Math.round(row.rating))),
    title: title === null ? null : title.trim().slice(0, 140) || null,
    body: body.trim().slice(0, 1_500),
    serviceTag: row.serviceTag === null ? null : row.serviceTag.trim().slice(0, 40) || null,
    publishedAt: row.publishedAt ? isoWithPhOffset(row.publishedAt) : null,
    source: row.source,
    // Deliberately always null: an avatar hash identifies a person as surely as
    // a name does, and the reviewer published a name, not a photo.
    authorAvatarUrl: null,
  };
}

// ── Summary maths ────────────────────────────────────────────────────────────

/** Empty distribution, highest star first. Never a fabricated star. */
export function emptyDistribution(): ReviewDistributionRow[] {
  return [5, 4, 3, 2, 1].map((star) => ({ star: star as 1 | 2 | 3 | 4 | 5, count: 0 }));
}

/**
 * Computes the summary from the **full matching set**, never from a page. An
 * average taken from the first 6 reviews of 200 is a lie, and it is the exact
 * lie the brief forbids.
 */
export function summarise(ratings: number[]): ReviewSummary {
  if (ratings.length === 0) return { average: null, count: 0, distribution: emptyDistribution() };
  const counts = new Map<number, number>([...Array(5)].map((_, i) => [(i + 1) as number, 0]));
  let total = 0;
  for (const raw of ratings) {
    const star = Math.min(5, Math.max(1, Math.round(raw)));
    counts.set(star, (counts.get(star) ?? 0) + 1);
    total += star;
  }
  return {
    average: Math.round((total / ratings.length) * 10) / 10,
    count: ratings.length,
    distribution: [5, 4, 3, 2, 1].map((star) => ({ star: star as 1 | 2 | 3 | 4 | 5, count: counts.get(star) ?? 0 })),
  };
}

const SOURCE_LABEL: Record<ReviewSource, string> = {
  GOOGLE: "Google reviews",
  FACEBOOK: "Facebook recommendations",
  MANUAL: "What our customers told us",
};

// ── Query ────────────────────────────────────────────────────────────────────

const MAX_LIMIT = 50;
const HARD_LIMIT = 60;

/**
 * Reads published reviews with deterministic ordering plus a real summary.
 *
 * Degradation: no database, or an unmigrated table -> an **empty** feed with a
 * `null` average. Not a throw, and not a placeholder rating.
 */
export async function getPublishedReviews(options: GetPublishedReviewsOptions = {}): Promise<ReviewFeedDto> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(options.limit ?? 10)));
  const serviceTag = options.serviceTag?.trim() || null;
  const minRating =
    typeof options.minRating === "number" && Number.isFinite(options.minRating)
      ? Math.min(5, Math.max(1, Math.round(options.minRating)))
      : null;
  const cursor = options.cursor?.trim() || null;

  const where = {
    isPublished: true,
    ...(serviceTag ? { serviceTag } : {}),
    ...(minRating ? { rating: { gte: minRating } } : {}),
  };

  const result = await withDb(
    async (db) => {
      // 1. Summary over the whole matching set (ratings only — cheap).
      const ratingRows = await db.review.findMany({ where, select: { rating: true } });
      // 2. One page plus one extra row, to compute `hasMore` without a count.
      const page = await db.review.findMany({
        where,
        select: {
          id: true,
          source: true,
          authorName: true,
          authorAvatarUrl: true,
          rating: true,
          title: true,
          body: true,
          serviceTag: true,
          publishedAt: true,
        },
        orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }, { id: "asc" }],
        take: Math.min(limit + 1, HARD_LIMIT),
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      return { ratingRows, page };
    },
    { ratingRows: [] as Array<{ rating: number }>, page: [] as ReviewRow[] },
    { event: "reviews.aggregate" },
  );

  const rows = result.page.slice(0, limit);
  const reviews = rows.map(stripForPublic);
  const summary = summarise(result.ratingRows.map((r) => r.rating));
  const last = rows[rows.length - 1];

  // The label names where the visible reviews came from, and is `null` when
  // there is nothing to attribute.
  const sources = new Set(rows.map((r) => r.source));
  const sourceLabel = sources.size === 0 ? null : sources.size === 1 ? SOURCE_LABEL[rows[0]?.source ?? "MANUAL"] : "Customer reviews";

  return {
    reviews,
    summary,
    hasMore: result.page.length > limit,
    nextCursor: result.page.length > limit && last ? last.id : null,
    sourceLabel,
    fetchedAt: new Date().toISOString(),
  };
}

/** Just the numbers, for the daily digest and `/api/ready`. */
export async function getReviewCounts(sinceMinutes?: number): Promise<{ total: number; average: number | null; newSince: number }> {
  const since = typeof sinceMinutes === "number" ? new Date(Date.now() - sinceMinutes * 60_000) : null;
  return withDb(
    async (db) => {
      const [rows, newRows] = await Promise.all([
        db.review.findMany({ where: { isPublished: true }, select: { rating: true } }),
        since ? db.review.count({ where: { isPublished: true, createdAt: { gte: since } } }) : Promise.resolve(0),
      ]);
      const summary = summarise(rows.map((r) => r.rating));
      return { total: summary.count, average: summary.average, newSince: newRows };
    },
    { total: 0, average: null, newSince: 0 },
    { event: "reviews.counts" },
  );
}

/** Unpublished reviews waiting on staff. Used by the admin board. */
export async function getPendingReviewCount(): Promise<number> {
  return withDb((db) => db.review.count({ where: { isPublished: false } }), 0, { event: "reviews.pending" });
}

export { logger as reviewLogger };
