/**
 * /api/admin/promotions — promo code management.
 * ============================================================================
 *   GET  → ApiResult<PromotionDto[]>  200
 *   POST → ApiResult<PromotionDto>    201 | 400 | 409
 *
 * Guards: GET any staff; POST requires `MANAGER` + CSRF.
 *
 * The `code` column is what `estimate()` in `quote.ts` looks up when a customer
 * types a promo into the estimator. Changing a code here changes what the
 * estimator accepts within one availability-cache generation, so the write
 * clears that cache.
 */
import type { NextRequest } from "next/server";

import { parseBody } from "@/lib/http";
import { withAdmin, withAdminRead, writeAuditLog } from "@/lib/server/admin-guard";
import { prisma } from "@/lib/server/db";
import { promotionUpsertSchema } from "@/lib/server/validation/admin";
import { clearAvailabilityCache } from "@/lib/server/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const promoSelect = {
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
} as const;

export const GET = withAdminRead<unknown[]>(async () => {
  const rows = await prisma.promotion.findMany({ select: promoSelect, orderBy: [{ priority: "desc" }, { endsAt: "asc" }] });
  return { data: rows };
});

export const POST = withAdmin("MANAGER", async ({ request, user }) => {
  const body = await parseBody(request, promotionUpsertSchema);

  const data = {
    slug: body.slug,
    title: body.title,
    subtitle: body.subtitle,
    description: body.description,
    kind: body.kind,
    badge: body.badge || null,
    code: body.code ?? null,
    valuePct: body.valuePct ?? null,
    valueOff: body.valueOff ?? null,
    terms: body.terms,
    imageUrl: body.imageUrl ?? null,
    isActive: body.isActive,
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
    priority: body.priority,
  };

  const row = body.id
    ? await prisma.promotion.update({ where: { id: body.id }, data, select: promoSelect })
    : await prisma.promotion.create({ data, select: promoSelect });

  clearAvailabilityCache();
  await writeAuditLog({
    action: body.id ? "promotion.update" : "promotion.create",
    entity: "Promotion",
    entityId: row.id,
    userId: user.id,
    request,
    // `code` and `valueOff` are marketing data, not secrets — safe to audit.
    meta: { slug: row.slug, code: row.code, kind: row.kind, isActive: row.isActive },
  });

  return { data: row, status: body.id ? 200 : 201 };
});

export async function PUT(req: NextRequest): Promise<Response> {
  return POST(req);
}
