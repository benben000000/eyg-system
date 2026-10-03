/**
 * /api/inventory/counts/[id] — one count: the variance report, and the sheet.
 * ============================================================================
 *   GET   → ApiResult<StockCountDto>                  200 | 404
 *   PATCH → ApiResult<StockCountDto>                  200 | 400 | 404 | 409
 *
 * GET is the **variance report before posting**: every line with its snapshotted
 * `expected`, the counted figure, the derived variance, and whether it is
 * significant. That is the question a manager asks first after counting — "is
 * this worth chasing?" — and answering it must not require posting an adjustment
 * to find out. `summary.varianceValue` (pesos at cost) is staff-only.
 *
 * PATCH records ONE counted line. `counted` is a whole number a human typed;
 * `variance` is derived server-side and can never be supplied by the client, and
 * `expected` is frozen at creation. Re-counting a line overwrites `counted` (the
 * counter changed their mind) but never the snapshot.
 *
 * Guards: GET `FRONT_DESK`; PATCH `MANAGER` + CSRF. Recording a count is what
 * eventually moves stock, so it is manager-gated even though the move itself
 * happens on POST.
 *
 * Rate limits: `inventory.read` / `inventory.count`.
 */
import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/errors";
import { parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { withAdmin, withAdminRead, writeAuditLog } from "@/lib/server/admin-guard";

import { getCount, recordCountLine } from "@/lib/server/inventory/counts";
import { inventoryCountLimiter, inventoryReadLimiter } from "@/lib/server/inventory/stock-engine";
import { recordCountLineSchema } from "@/lib/server/inventory/validation.test-support";
import type { StockCountDto } from "@/lib/inventory-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

async function readId(routeCtx: RouteCtx): Promise<string> {
  const { id } = await routeCtx.params;
  const trimmed = id.trim();
  if (!/^[a-z0-9]{4,40}$/i.test(trimmed)) throw new ApiError("NOT_FOUND", "Stock count not found.");
  return trimmed;
}

export function GET(req: NextRequest, routeCtx: RouteCtx): Promise<Response> {
  return withAdminRead<StockCountDto>(async ({ ip, requestId }) => {
    await rateLimit({ action: "inventory.counts.read", ip, policy: inventoryReadLimiter, requestId });
    const id = await readId(routeCtx);
    return { data: await getCount(id, { includeCost: true }) };
  })(req);
}

export function PATCH(req: NextRequest, routeCtx: RouteCtx): Promise<Response> {
  return withAdmin("MANAGER", async ({ request, user, ip, requestId }) => {
    await rateLimit({ action: "inventory.counts.record", ip, policy: inventoryCountLimiter, requestId });
    const id = await readId(routeCtx);
    const body = await parseBody(request, recordCountLineSchema);

    const count = await recordCountLine(
      { countId: id, productId: body.productId, counted: body.counted, ...(body.note ? { note: body.note } : {}) },
      { actorId: user.id, actorName: user.name, requestId },
    );

    // One audit row per line is too noisy to be useful; the count's own
    // `countedBy` / `countedAt` columns carry the attribution, and the ledger
    // row written on POST carries it into history.
    await writeAuditLog({
      action: "inventory.count.recorded",
      entity: "StockCount",
      entityId: id,
      userId: user.id,
      request,
      meta: { productId: body.productId, counted: body.counted },
    });

    return { data: count };
  })(req);
}
