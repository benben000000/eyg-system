/**
 * /api/inventory/counts — cycle counts.
 * ============================================================================
 *   GET  → ApiResult<{ rows, total, page, pageSize }>   200
 *   POST → ApiResult<StockCountDto>                      201 | 400
 *
 * Creating a count SNAPSHOTS `expected` for every line in scope from the live
 * `StockLevel.onHand`. That snapshot is the record of what the system believed
 * when counting started, and it is never rewritten — a sale that lands mid-count
 * cannot silently change the number the counter is being asked to confirm.
 *
 * Scope: `all`, a `ProductKind`, or a single `productId`. A count sheet is a
 * physical artefact; a shop of this size counts a category at a time.
 *
 * Guards: GET `FRONT_DESK`; POST `MANAGER` + CSRF. Opening a count is a
 * commitment of counter time, not a stock change, but it is the root of every
 * adjustment that follows, so it is manager-gated.
 *
 * Rate limit: `inventory.read` for GET, `inventory.count` for POST (30/min — a
 * count screen posts a burst of lines and nothing else does this).
 */
import { parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { withAdmin, withAdminRead, writeAuditLog } from "@/lib/server/admin-guard";

import { createCount, listCounts } from "@/lib/server/inventory/counts";
import { inventoryCountLimiter, inventoryReadLimiter } from "@/lib/server/inventory/stock-engine";
import { countListQuerySchema, createCountSchema, parseQuery } from "@/lib/server/inventory/validation.test-support";
import type { StockCountDto, StockCountStatusValue } from "@/lib/inventory-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface CountListDto {
  rows: StockCountDto[];
  total: number;
  page: number;
  pageSize: number;
}

export const GET = withAdminRead<CountListDto>(async ({ request, ip, requestId }) => {
  await rateLimit({ action: "inventory.counts.list", ip, policy: inventoryReadLimiter, requestId });
  const query = parseQuery(new URL(request.url).searchParams, countListQuerySchema);
  const result = await listCounts(
    { ...(query.status ? { status: query.status as StockCountStatusValue } : {}), ...query },
    { includeCost: true },
  );
  return {
    data: { rows: result.rows, total: result.total, page: result.page, pageSize: result.pageSize },
    headers: { "X-Total-Count": String(result.total) },
  };
});

export const POST = withAdmin("MANAGER", async ({ request, user, ip, requestId }) => {
  await rateLimit({ action: "inventory.counts.create", ip, policy: inventoryCountLimiter, requestId });
  const body = await parseBody(request, createCountSchema);

  const count = await createCount(body, { actorId: user.id, actorName: user.name, requestId });

  await writeAuditLog({
    action: "inventory.count.created",
    entity: "StockCount",
    entityId: count.id,
    userId: user.id,
    request,
    meta: { reference: count.reference, scope: count.scope, lines: count.summary.total },
  });

  return { data: count, status: 201 };
});
