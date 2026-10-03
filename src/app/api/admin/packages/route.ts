/**
 * /api/admin/packages — bundled service packages.
 * ============================================================================
 *   GET  → ApiResult<PackageDto[]>   200
 *   POST → ApiResult<PackageDto>     201 | 400 | 409
 *
 * Guards: GET any staff; POST requires `MANAGER` + CSRF.
 *
 * `itemServiceIds` is replaced wholesale on every write (deleteMany + createMany
 * inside one transaction) so a removed item cannot linger.
 */
import type { NextRequest } from "next/server";

import { parseBody } from "@/lib/http";
import { withAdmin, withAdminRead, writeAuditLog } from "@/lib/server/admin-guard";
import { prisma } from "@/lib/server/db";
import { packageUpsertSchema } from "@/lib/server/validation/admin";
import { listPackages } from "@/lib/server/quote";
import { clearAvailabilityCache } from "@/lib/server/availability";
import type { PackageDto } from "@/lib/types";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminRead<PackageDto[]>(async () => ({ data: await listPackages() }));

export const POST = withAdmin("MANAGER", async ({ request, user }) => {
  const body = await parseBody(request, packageUpsertSchema);

  // Every referenced service must exist, otherwise `PackageItem` would dangle.
  const services = await prisma.service.findMany({
    where: { id: { in: body.itemServiceIds } },
    select: { id: true },
  });
  if (services.length !== new Set(body.itemServiceIds).size) {
    throw new ApiError("VALIDATION_ERROR", "One of the selected services no longer exists.", {
      fields: { itemServiceIds: ["Please pick from the current list."] },
    });
  }

  const data = {
    categoryId: body.categoryId ?? null,
    slug: body.slug,
    name: body.name,
    tagline: body.tagline,
    description: body.description,
    priceMin: body.priceMin,
    priceMax: body.priceMax ?? null,
    compareAtMin: body.compareAtMin ?? null,
    savingsPct: body.savingsPct ?? null,
    badge: body.badge || null,
    isSeasonal: body.isSeasonal,
    seasonKey: body.seasonKey || null,
    validFrom: body.validFrom ? new Date(body.validFrom) : null,
    validUntil: body.validUntil ? new Date(body.validUntil) : null,
    isFeatured: body.isFeatured,
    isActive: body.isActive,
    sortOrder: body.sortOrder,
  };

  const uniqueIds = [...new Set(body.itemServiceIds)];

  const row = await prisma.$transaction(async (tx) => {
    const pkg = body.id
      ? await tx.package.update({ where: { id: body.id }, data, select: { id: true, slug: true } })
      : await tx.package.create({ data, select: { id: true, slug: true } });
    await tx.packageItem.deleteMany({ where: { packageId: pkg.id } });
    await tx.packageItem.createMany({
      data: uniqueIds.map((serviceId) => ({ packageId: pkg.id, serviceId, quantity: 1 })),
    });
    return pkg;
  });

  clearAvailabilityCache();
  await writeAuditLog({
    action: body.id ? "package.update" : "package.create",
    entity: "Package",
    entityId: row.id,
    userId: user.id,
    request,
    meta: { slug: row.slug, itemCount: uniqueIds.length, priceMin: body.priceMin },
  });

  const dto = (await listPackages()).find((p) => p.id === row.id) ?? null;
  if (!dto) throw new ApiError("INTERNAL_ERROR", "The package was saved but could not be read back.");

  return { data: dto, status: body.id ? 200 : 201 };
});

export async function PUT(req: NextRequest): Promise<Response> {
  return POST(req);
}
