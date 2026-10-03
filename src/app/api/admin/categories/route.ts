/**
 * /api/admin/categories — service categories.
 * ============================================================================
 *   GET  → ApiResult<ServiceCategory[]>   (includes inactive; staff need to edit them)
 *   POST → ApiResult<ServiceCategory>     201 | 400 | 401 | 403 | 409
 *
 * Guards: GET any staff; POST requires `MANAGER` + CSRF.
 * Slugs are unique — a collision surfaces as 409 via `fromPrismaError` (P2002).
 * Every write is audited.
 */
import type { NextRequest } from "next/server";

import { parseBody } from "@/lib/http";
import { withAdmin, withAdminRead, writeAuditLog } from "@/lib/server/admin-guard";
import { prisma } from "@/lib/server/db";
import { categoryUpsertSchema } from "@/lib/server/validation/admin";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const categorySelect = {
  id: true,
  slug: true,
  name: true,
  blurb: true,
  icon: true,
  accentFrom: true,
  accentTo: true,
  sortOrder: true,
  isActive: true,
} as const;

type CategoryDto = {
  id: string;
  slug: string;
  name: string;
  blurb: string | null;
  icon: string | null;
  accentFrom: string | null;
  accentTo: string | null;
  sortOrder: number;
  isActive: boolean;
};

export const GET = withAdminRead<CategoryDto[]>(async () => {
  const rows = await prisma.serviceCategory.findMany({ select: categorySelect, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return { data: rows };
});

export const POST = withAdmin("MANAGER", async ({ request, user }) => {
  const body = await parseBody(request, categoryUpsertSchema);

  if (body.id) {
    const updated = await prisma.serviceCategory.update({
      where: { id: body.id },
      data: {
        slug: body.slug,
        name: body.name,
        blurb: body.blurb || null,
        icon: body.icon || null,
        accentFrom: body.accentFrom || null,
        accentTo: body.accentTo || null,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
      select: categorySelect,
    });
    await writeAuditLog({ action: "category.update", entity: "ServiceCategory", entityId: updated.id, userId: user.id, request, meta: { slug: updated.slug } });
    return { data: updated, status: 200 };
  }

  const created = await prisma.serviceCategory.create({
    data: {
      slug: body.slug,
      name: body.name,
      blurb: body.blurb || null,
      icon: body.icon || null,
      accentFrom: body.accentFrom || null,
      accentTo: body.accentTo || null,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    },
    select: categorySelect,
  });
  await writeAuditLog({ action: "category.create", entity: "ServiceCategory", entityId: created.id, userId: user.id, request, meta: { slug: created.slug } });
  logger.info("admin.category_created", { scope: "admin", slug: created.slug });
  return { data: created, status: 201 };
});

/** Alias so a plain HTML form can create a category with `POST`. */
export async function PUT(req: NextRequest): Promise<Response> {
  return POST(req);
}

export type { CategoryDto };
