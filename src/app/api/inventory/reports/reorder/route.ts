/**
 * /api/inventory/reports/reorder — what to order, and what it will cost.
 * ============================================================================
 *   GET ?kind=&supplierId=&includeInactive=&limit=
 *       → ApiResult<{ rows, total, estimatedCost }>   200 | 400 | 401 | 403 | 429
 *
 * Every row is at or below its reorder point **on `available`, not `onHand`**:
 * four filters that are all promised to four bookings are not four filters the
 * shop can sell, and ordering against `onHand` is how a shop buys stock it
 * already sold.
 *
 * `suggestedQty` is deliberately explainable at the counter — the owner's
 * configured order quantity, or just enough to lift `available` back to the
 * reorder point, and at least one unit when the shelf is empty. A cleverer
 * forecast needs sales history this shop does not have yet.
 *
 * COST: this report is `MANAGER`-only precisely BECAUSE it carries money:
 * `costPrice` and `estimatedCost` are attached. There is no anonymous version of
 * this route, so `costPrice` cannot be reached without a staff session at
 * `MANAGER` or above.
 *
 * Rate limit: `inventory.read`.
 */
import { rateLimit } from "@/lib/ratelimit";
import { withAdmin } from "@/lib/server/admin-guard";

import { reorderSuggestions } from "@/lib/server/inventory/reporting";
import { inventoryReadLimiter } from "@/lib/server/inventory/stock-engine";
import { parseQuery, reorderQuerySchema } from "@/lib/server/inventory/validation.test-support";
import type { ProductKindValue, ReorderRowDto } from "@/lib/inventory-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ReorderReportDto {
  rows: ReorderRowDto[];
  total: number;
  /** Total pesos at cost. Present because this route is MANAGER-only. */
  estimatedCost: number | null;
}

export const GET = withAdmin(
  "MANAGER",
  // A GET cannot carry a CSRF token: a browser navigation sends none, so
  // demanding one 403s a legitimate manager every time they open this screen.
  // The MANAGER floor stays because this report carries cost figures.
  async ({ request, ip, requestId }) => {
    await rateLimit({
      action: "inventory.reports.reorder",
      ip,
      policy: inventoryReadLimiter,
      requestId,
    });
    const query = parseQuery(new URL(request.url).searchParams, reorderQuerySchema);

    const result = await reorderSuggestions(
      {
        ...(query.kind ? { kind: query.kind as ProductKindValue } : {}),
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...(query.includeInactive !== undefined ? { includeInactive: query.includeInactive } : {}),
        ...(query.limit !== undefined ? { limit: query.limit } : {}),
      },
      { includeCost: true },
    );

    return { data: result, headers: { "X-Total-Count": String(result.total) } };
  },
  { csrf: false },
);
