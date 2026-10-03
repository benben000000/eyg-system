/**
 * GET /api/reviews — PUBLIC SOCIAL PROOF
 * ============================================================================
 * Contract consumed by `src/hooks/useReviews.ts` (widgets agent):
 *
 *   GET /api/reviews?limit=12&serviceTag=tyres&minRating=4&cursor=<reviewId>
 *   200 → ApiResult<ReviewFeedDto>
 *   304 → when `If-None-Match` matches
 *   429 → ApiFailure with `meta.retryAfter`
 *
 * PRIVACY — THE HARD PART OF THIS ROUTE
 * -------------------------------------
 * A review is customer content, and the response is public and cacheable by a
 * CDN. The response therefore carries **no PII beyond the display name the
 * reviewer chose to publish**:
 *   - `authorAvatarUrl` is always `null` (a Google avatar hash identifies a
 *     person as reliably as a name does, and the reviewer published a name)
 *   - phone numbers, emails, `tel:`/`wa` links, @handles and Philippine plates
 *     are stripped from the body and title by `stripForPublic()`
 *   - nothing else about the customer is ever selected from the database
 *
 * NEVER FABRICATE
 * ---------------
 * No Google key, no database, or a Google outage all produce the same honest
 * answer: `reviews: []`, `count: 0`, `average: null`. `average` is never `0`
 * and never `5`. The UI ships a designed empty state for exactly this case.
 *
 * CACHING
 * -------
 * `Cache-Control: public, max-age=300, stale-while-revalidate=3600` plus a
 * content `ETag`. The server-side cache is stale-while-revalidate too (see
 * `src/lib/reviews/cache.ts`), so a provider outage never blanks the homepage.
 */

import { ApiError } from "@/lib/errors";
import {
  failWith,
  guard,
  jsonCached,
  queryInt,
  queryValue,
} from "@/lib/integrations/api";
import { rateLimitHeaders } from "@/lib/integrations/rate-limit";
import { log } from "@/lib/logger";
import { getPublishedReviews, type ReviewFeedDto } from "@/lib/reviews/aggregate";
import { emptyReviewFeed, reviewsCacheKey, withReviewsCache } from "@/lib/reviews/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/reviews" });

/** Five minutes at the edge, an hour of stale-while-revalidate behind it. */
const CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";

export async function GET(req: Request): Promise<Response> {
  const { ctx, denied, guard: result } = await guard(req, "reviews.read", "reads");
  if (denied) return denied;

  try {
    const limit = queryInt(queryValue(req.url, "limit"), 10, 1, 50);
    const serviceTag = queryValue(req.url, "serviceTag", "tag");
    const minRatingRaw = queryInt(queryValue(req.url, "minRating"), 0, 0, 5);
    const minRating = minRatingRaw >= 1 ? minRatingRaw : null;
    const cursor = queryValue(req.url, "cursor");

    const key = reviewsCacheKey({ limit, serviceTag, minRating, cursor });
    const cached = await withReviewsCache<ReviewFeedDto>(
      key,
      () => getPublishedReviews({ limit, serviceTag, minRating, cursor }),
      emptyReviewFeed(),
    );

    // The ETag seeds on the *content*, not on the envelope, so the per-request
    // `meta.requestId` cannot invalidate it on every hit.
    const etagSeed = JSON.stringify({
      r: cached.value.reviews.map((r) => [r.id, r.rating, r.body.length]),
      s: cached.value.summary,
      p: cached.value.nextCursor,
    });

    logger.debug("reviews.served", {
      count: cached.value.reviews.length,
      total: cached.value.summary.count,
      average: cached.value.summary.average,
      state: cached.state,
      limit,
      hasServiceTag: Boolean(serviceTag),
      minRating,
    });

    return jsonCached(cached.value, ctx, req, { cacheControl: CACHE_CONTROL, etag: etagSeed });
  } catch (error) {
    logger.error("reviews.failed", {}, { err: error });
    return failWith(
      // Never expose an internal message; the client has an empty state.
      new ApiError("SERVICE_UNAVAILABLE", "We could not load reviews right now.", { retryAfter: 30 }),
      ctx,
      rateLimitHeaders(result),
    );
  }
}
