/**
 * /api/inventory/reports/valuation — what is on the shelves, and what it is worth.
 * ============================================================================
 *   GET ?kind=&includeInactive=
 *       → ApiResult<ValuationDto>   200 | 400 | 401 | 403 | 429
 *
 * Two numbers, two different questions, and both are labelled in the payload:
 *
 *  - `units` / `retailValue` / `byKind` use `onHand`, because "what do I own?" is
 *    a question about the physical shelf. Stock promised to a job is still owned.
 *  - The operational reports (reorder, availability) use `available`, because
 *    "what can I sell / need to buy?" is a question about the promise.
 *
 * `costValue` is the margin-relevant figure and it is a cost, so this route is
 * `MANAGER`-only and there is no anonymous variant of it. `grossMargin` is
 * derived from `retailValue − costValue` and is also money, same gate.
 *
 * Rate limit: `inventory.read`.
 */
import { rateLimit } from "@/lib/ratelimit";
import { withAdmin } from "@/lib/server/admin-guard";

import { valuation } from "@/lib/server/inventory/reporting";
import { inventoryReadLimiter } from "@/lib/server/inventory/stock-engine";
import { parseQuery, valuationQuerySchema } from "@/lib/server/inventory/validation.test-support";
import type { ProductKindValue, ValuationDto } from "@/lib/inventory-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ValuationReportDto extends ValuationDto {
  /** `retailValue - costValue`. Money: same MANAGER gate as `costValue`. */
  grossMargin: number;
  marginPct: number | null;
}

export const GET = withAdmin(
  "MANAGER",
  // A GET cannot carry a CSRF token: a browser navigation sends none, so
  // demanding one 403s a legitimate manager every time they open this screen.
  // The MANAGER floor stays because this report carries cost figures.
  async ({ request, ip, requestId }) => {
    await rateLimit({
      action: "inventory.reports.valuation",
      ip,
      policy: inventoryReadLimiter,
      requestId,
    });
    const query = parseQuery(new URL(request.url).searchParams, valuationQuerySchema);

    const base = await valuation(
      {
        ...(query.kind ? { kind: query.kind as ProductKindValue } : {}),
        ...(query.includeInactive !== undefined ? { includeInactive: query.includeInactive } : {}),
      },
      { includeCost: true },
    );

    const costValue = base.costValue ?? 0;
    const grossMargin = base.retailValue - costValue;
    const data: ValuationReportDto = {
      ...base,
      grossMargin,
      marginPct: base.retailValue > 0 ? Math.round((grossMargin / base.retailValue) * 100) : null,
    };

    return { data };
  },
  { csrf: false },
);
