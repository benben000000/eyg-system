/**
 * GET /api/promos — ACTIVE PROMOTIONS
 * ============================================================================
 * The `/deals` data source. Returns promotions ordered by `priority DESC` (a
 * staff decision, in `src/content/marketing/promotions.ts`) with a computed
 * `isLive`.
 *
 * `isLive` AND THE TIMEZONE
 * -------------------------
 * `startsAt` / `endsAt` are `DateTime` columns — instants, already unambiguous.
 * The timezone matters for the *display* and for the day boundary, so:
 *   - `endsAt` is inclusive: a promo ending at 23:59:59+08:00 is live all day.
 *   - `startsAt`/`endsAt` are also echoed as `+08:00` ISO strings so a client
 *     rendering a countdown never has to guess the offset.
 *   - `isUpcoming` / `isExpired` are returned explicitly so the UI can show the
 *     pre-armed promos honestly instead of hiding them or, worse, showing them
 *     as buyable.
 *
 * `terms` IS ALWAYS INCLUDED. A discount without its conditions is not a
 * response we are willing to send — that is the single most important field in
 * this payload, and `buildPromoResponse` cannot produce a promo without it.
 *
 * IMPRESSIONS
 * -----------
 * `viewCount` is incremented once per *uncached* request for live promos, in a
 * fire-and-forget write that can never delay or fail the response. A CDN-cached
 * hit does not increment, so the number is "impressions on uncached requests",
 * which is documented rather than quietly overstated.
 *
 * DEGRADATION: no database -> `{ promos: [], total: 0 }` with a 200. The deals
 * page has a designed empty state; it must not 500 because Postgres blinked.
 */

import {
  guard,
  jsonWithCache,
  queryInt,
  queryValue,
} from "@/lib/integrations/api";
import { withDb } from "@/lib/integrations/db";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/promos" });

const CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

import { buildPromoResponse, type PromosDto, type PromoRow } from "@/app/api/promos/presenters";

export async function GET(req: Request): Promise<Response> {
  const { ctx, denied } = await guard(req, "promos.read", "reads");
  if (denied) return denied;

  const now = new Date();
  const includeInactive = queryValue(req.url, "includeInactive") === "true";
  const limit = queryInt(queryValue(req.url, "limit"), 50, 1, 100);

  const rows = await withDb<PromoRow[]>(
    async (db) =>
      db.promotion.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          description: true,
          kind: true,
          badge: true,
          code: true,
          valuePct: true,
          valueOff: true,
          terms: true,
          imageUrl: true,
          isActive: true,
          startsAt: true,
          endsAt: true,
          priority: true,
          viewCount: true,
          claimCount: true,
        },
      }),
    [],
    { event: "promos.list" },
  );

  const promos = rows.map((row) => buildPromoResponse(row, now));
  const live = promos.filter((p) => p.isLive);

  // Impression counter. Fire-and-forget: a slow write must never delay the
  // page, and a failure is not the customer's problem. `void` + a catch inside
  // means this can never produce an unhandled rejection.
  if (live.length > 0) {
    void withDb(
      async (db) => {
        await db.promotion.updateMany({ where: { id: { in: live.map((p) => p.id) } }, data: { viewCount: { increment: 1 } } });
      },
      null,
      { event: "promos.view" },
    );
  }

  logger.debug("promos.listed", { total: promos.length, live: live.length });

  const data: PromosDto = { promos, total: promos.length, liveCount: live.length, timezone: "Asia/Manila", fetchedAt: now.toISOString() };

  // `viewCount` changes on every request, so the payload is short-lived cached
  // and the counter is documented as best-effort rather than exact.
  return jsonWithCache(data, ctx, { cacheControl: CACHE_CONTROL });
}