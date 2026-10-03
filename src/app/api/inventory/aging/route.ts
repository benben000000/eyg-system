/**
 * /api/inventory/aging — DOT codes and shelf life.
 * ============================================================================
 *   GET ?kind=&inStockOnly=&limit=
 *       → ApiResult<AgeingReport>   200 | 400 | 401 | 403 | 429
 *
 * ── THE MOST IMPORTANT THING THIS ENDPOINT DOES NOT DO ───────────────────────
 * It does not BLOCK anything. An old tyre or a drum of oil two weeks from its
 * date is *information* for the counter: "this one is from 2023, want the newer
 * one?" Refusing a customer whose car is already up on the lift because of a
 * sell-by date would be a worse failure than selling one tyre a month late, and
 * it is exactly the "never block a sale for a non-blocking part" rule. Nothing
 * here is consulted by `getServiceAvailability()` or by any booking guard.
 *
 * ── WHERE THE NUMBERS COME FROM ─────────────────────────────────────────────
 *  - Tyres: the DOT code (`WKYY` → the Monday of that production week). Age is
 *    days since that week started, so two tyres from one batch always age
 *    identically. `isNearExpiry` here means "past the shop's stale threshold"
 *    (`TYRE_STALE_DAYS`, a shop policy the owner must confirm — NOT researched).
 *  - Everything else: `shelfLifeDays` measured from the day the SKU entered the
 *    catalogue. There is no per-batch receipt date in the schema, so this is an
 *    ESTIMATE of the catalogue entry, not a batch expiry. Reported to the
 *    orchestrator as a schema request (`Product.expiryAt`).
 *
 * NO COST ON THIS ENDPOINT. The ageing report feeds a clearance campaign that
 * runs on public marketing, so it exposes `sellPrice` only — never `costPrice`.
 * It is nevertheless `FRONT_DESK`-gated, because DOT codes are internal
 * provenance and ageing must never be framed to a customer as "we are trying to
 * dump old stock on you".
 *
 * Rate limit: `inventory.read`.
 */
import { rateLimit } from "@/lib/ratelimit";
import { withAdminRead } from "@/lib/server/admin-guard";

import { ageing, type AgeingReport } from "@/lib/server/inventory/reporting";
import { inventoryReadLimiter } from "@/lib/server/inventory/stock-engine";
import { agingQuerySchema, parseQuery } from "@/lib/server/inventory/validation.test-support";
import type { ProductKindValue } from "@/lib/inventory-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminRead<AgeingReport>(async ({ request, ip, requestId }) => {
  await rateLimit({ action: "inventory.aging", ip, policy: inventoryReadLimiter, requestId });
  const query = parseQuery(new URL(request.url).searchParams, agingQuerySchema);

  const report = await ageing({
    ...(query.kind ? { kind: query.kind as ProductKindValue } : {}),
    ...(query.inStockOnly !== undefined ? { inStockOnly: query.inStockOnly } : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {}),
  });

  return { data: report, cacheControl: "no-store, max-age=0" };
});
