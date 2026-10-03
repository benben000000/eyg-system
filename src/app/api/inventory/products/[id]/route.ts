/**
 * /api/inventory/products/[id] — one catalogue entry.
 * ============================================================================
 *   GET    → ApiResult<ProductDto>                       200 | 404
 *   PATCH  → ApiResult<ProductDto>                       200 | 400 | 404 | 409
 *   DELETE → ApiResult<ProductDto>                       200 | 409   (SOFT delete)
 *
 * Guards: GET `FRONT_DESK`; PATCH and DELETE `MANAGER` + CSRF.
 *
 * DELETE NEVER DELETES A ROW. `StockMovement` is append-only, `Reservation` and
 * `ServicePartRequirement` both reference a product, and a deleted SKU cannot be
 * explained six weeks later. Deactivation is the operation: the SKU stops being
 * receivable and stoppable, the shelf label stays valid, and every past movement
 * remains readable. Use PATCH `{ isActive: true }` to bring it back.
 *
 * PATCH cannot change stock. There is no quantity field in the schema, and the
 * only way to move stock is `POST /api/inventory/movements` with a reason.
 *
 * Rate limits: `inventory.read` / `inventory.write`.
 */
import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/errors";
import { parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { withAdmin, withAdminRead, writeAuditLog } from "@/lib/server/admin-guard";

import { deactivateProduct, getProductById, updateProduct } from "@/lib/server/inventory/products";
import { inventoryReadLimiter, inventoryWriteLimiter } from "@/lib/server/inventory/stock-engine";
import { updateProductSchema } from "@/lib/server/inventory/validation.test-support";
import type { ProductDto } from "@/lib/inventory-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/** CUIDs only. A malformed id is a 404, never a 400 — it cannot exist. */
async function readId(routeCtx: RouteCtx): Promise<string> {
  const { id } = await routeCtx.params;
  const trimmed = id.trim();
  if (!/^[a-z0-9]{4,40}$/i.test(trimmed)) throw new ApiError("NOT_FOUND", "Product not found.");
  return trimmed;
}

export function GET(req: NextRequest, routeCtx: RouteCtx): Promise<Response> {
  return withAdminRead<ProductDto>(async ({ ip, requestId }) => {
    await rateLimit({ action: "inventory.products.read", ip, policy: inventoryReadLimiter, requestId });
    const id = await readId(routeCtx);
    return { data: await getProductById(id, { includeCost: true }) };
  })(req);
}

export function PATCH(req: NextRequest, routeCtx: RouteCtx): Promise<Response> {
  return withAdmin("MANAGER", async ({ request, user, ip, requestId }) => {
    await rateLimit({ action: "inventory.products.update", ip, policy: inventoryWriteLimiter, requestId });
    const id = await readId(routeCtx);
    const body = await parseBody(request, updateProductSchema);

    // `sku` is deliberately not in `updateProductSchema`: the shelf label, the
    // reorder list and every printed PO already say that code.
    const product = await updateProduct({ ...body, id });

    await writeAuditLog({
      action: "inventory.product_updated",
      entity: "Product",
      entityId: id,
      userId: user.id,
      request,
      meta: { sku: product.sku, fields: Object.keys(body) },
    });

    return { data: product };
  })(req);
}

export function DELETE(req: NextRequest, routeCtx: RouteCtx): Promise<Response> {
  return withAdmin("MANAGER", async ({ request, user, ip, requestId }) => {
    await rateLimit({ action: "inventory.products.deactivate", ip, policy: inventoryWriteLimiter, requestId });
    const id = await readId(routeCtx);
    const product = await deactivateProduct(id);

    await writeAuditLog({
      action: "inventory.product_deactivated",
      entity: "Product",
      entityId: id,
      userId: user.id,
      request,
      meta: { sku: product.sku },
    });

    return { data: product };
  })(req);
}
