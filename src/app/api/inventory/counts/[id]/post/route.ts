/**
 * /api/inventory/counts/[id]/post — write the variances to the ledger.
 * ============================================================================
 *   POST → ApiResult<{ count, movements, blocked, replayed }>  200 | 404 | 409
 *
 * A route of its own, not a PATCH on the count, because this is the moment stock
 * actually moves and it deserves an unmistakable name on the audit log.
 *
 * ── ATOMIC AND IDEMPOTENT ───────────────────────────────────────────────────
 * ONE `SERIALIZABLE` transaction contains the `DRAFT|COUNTING|REVIEW → POSTED`
 * claim AND one `postMovementInTx` per non-zero variance. Therefore:
 *
 *   • Posting twice adjusts twice? No. The second call sees `POSTED` and returns
 *     `replayed: true` with nothing applied.
 *   • A variance that is refused rolls back the WHOLE post — no adjustments, no
 *     status change, no half-applied count. The 409 names the product.
 *
 * ── WHY A DOWNWARD VARIANCE CAN BE REFUSED ──────────────────────────────────
 * "Counted 3, system says 5, and 4 of those are promised to a job in the bay."
 * Applying the −2 would either push `available` negative (impossible — the guard
 * refuses) or silently eat a customer's held filter. Neither is acceptable, so
 * the post is refused and the counter is told to release the hold. The count stays
 * in `REVIEW` so it can be posted the moment the bay is finished.
 *
 * Each variance writes ONE `ADJUST_UP` / `ADJUST_DOWN` ledger row whose reason
 * names the count reference and both numbers, so a row is self-explanatory weeks
 * later. Nothing is ever deleted to "undo" a count.
 *
 * Guards: `MANAGER` + CSRF. Rate limit: `inventory.count`.
 */
import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { withAdmin, writeAuditLog } from "@/lib/server/admin-guard";

import { postCount, type PostCountResult } from "@/lib/server/inventory/counts";
import { inventoryCountLimiter } from "@/lib/server/inventory/stock-engine";

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

export function POST(req: NextRequest, routeCtx: RouteCtx): Promise<Response> {
  return withAdmin("MANAGER", async ({ request, user, ip, requestId }) => {
    await rateLimit({ action: "inventory.counts.post", ip, policy: inventoryCountLimiter, requestId });
    const id = await readId(routeCtx);

    const result: PostCountResult = await postCount(id, { actorId: user.id, actorName: user.name, requestId });

    await writeAuditLog({
      action: "inventory.count.posted",
      entity: "StockCount",
      entityId: id,
      userId: user.id,
      request,
      meta: {
        reference: result.count.reference,
        variances: result.movements.length,
        netVariance: result.count.summary.netVariance,
        replayed: result.replayed,
      },
    });

    return { data: result, status: 200 };
  })(req);
}
