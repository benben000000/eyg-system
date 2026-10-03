/**
 * /api/inventory/products — the catalogue.
 * ============================================================================
 *   GET  → ApiResult<{ rows, total, page, pageSize }>   200 | 400 | 401 | 403 | 429
 *   POST → ApiResult<ProductDto>                          201 | 400 | 409
 *
 * Guards: GET any signed-in staff (`FRONT_DESK`) — a mechanic at the shelf needs
 * to search. POST requires `MANAGER` + a CSRF token, because adding a SKU to the
 * catalogue is a change to the shop's books and its pricing.
 *
 * COST: both handlers are staff-authenticated, so `includeCost` is true and
 * `costPrice` / `marginPct` are attached. The one inventory endpoint a public
 * surface may reach is `/api/inventory/availability`, which never sets this flag.
 *
 * Query: ?q=&kind=&size=&brand=&supplierId=&barcode=&lowStock=&includeInactive=
 *        &page=&pageSize=
 *   `q` is the operator's search box. When it parses as a tyre size it is matched
 *   EXACTLY against the indexed `size` column first (see `listProducts`), because
 *   the tyre-size lookup is the most frequent query this shop makes.
 *
 * Rate limits: `inventory.read` for the GET, `inventory.write` for the POST.
 */
import { parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { withAdmin, withAdminRead, writeAuditLog } from "@/lib/server/admin-guard";

import { createProduct, listProducts } from "@/lib/server/inventory/products";
import { inventoryReadLimiter, inventoryWriteLimiter } from "@/lib/server/inventory/stock-engine";
import { createProductSchema, parseQuery, productListQuerySchema } from "@/lib/server/inventory/validation.test-support";
import type { ProductDto } from "@/lib/inventory-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ProductListDto {
  rows: ProductDto[];
  total: number;
  page: number;
  pageSize: number;
}

export const GET = withAdminRead<ProductListDto>(async ({ request, ip, requestId }) => {
  await rateLimit({ action: "inventory.products.list", ip, policy: inventoryReadLimiter, requestId });

  const query = parseQuery(new URL(request.url).searchParams, productListQuerySchema);
  const result = await listProducts(query, { includeCost: true });

  return {
    data: {
      rows: result.rows as ProductDto[],
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    },
    headers: { "X-Total-Count": String(result.total) },
  };
});

export const POST = withAdmin("MANAGER", async ({ request, user, ip, requestId }) => {
  await rateLimit({ action: "inventory.products.create", ip, policy: inventoryWriteLimiter, requestId });
  const body = await parseBody(request, createProductSchema);

  // `parseBody` already strips unknown keys with a 400; this is the semantic
  // check: a SKU is the shelf label, and two SKUs on one label is how the shelf
  // and the system start telling different stories.
  const product = await createProduct(body);

  await writeAuditLog({
    action: "inventory.product_created",
    entity: "Product",
    entityId: product.id,
    userId: user.id,
    request,
    // Never the cost. An audit log is a place a compromised account looks first.
    meta: { sku: product.sku, kind: product.kind, sellPrice: product.sellPrice },
  });

  return { data: product, status: 201 };
});
