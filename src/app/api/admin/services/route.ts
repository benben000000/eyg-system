/**
 * /api/admin/services — the service catalogue.
 * ============================================================================
 *   GET  → ApiResult<ServiceDto[]>                    (staff see inactive rows)
 *   POST → ApiResult<ServiceDto>                      201 | 400 | 409
 *
 * Guards: GET any staff; POST requires `MANAGER` + CSRF.
 *
 * Editing a service never rewrites history: `BookingItem` and `QuoteRequest`
 * snapshot the name and price at write time, so a price change here affects only
 * future bookings. That is why the booking engine copies rather than references.
 */
import type { NextRequest } from "next/server";

import { parseBody } from "@/lib/http";
import { withAdmin, withAdminRead, writeAuditLog } from "@/lib/server/admin-guard";
import { prisma } from "@/lib/server/db";
import { serviceUpsertSchema } from "@/lib/server/validation/admin";
import type { ServiceDto } from "@/lib/types";
import { clearAvailabilityCache } from "@/lib/server/availability";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const staffSelect = {
  id: true,
  slug: true,
  name: true,
  shortName: true,
  summary: true,
  description: true,
  pricing: true,
  priceMin: true,
  priceMax: true,
  priceNote: true,
  durationMin: true,
  isPopular: true,
  isFeatured: true,
  requiresVehicle: true,
  includes: true,
  excludes: true,
  sortOrder: true,
  isActive: true,
  categoryId: true,
  category: { select: { slug: true, name: true, icon: true } },
} as const;

export const GET = withAdminRead<ServiceDto[]>(async () => {
  const rows = await prisma.service.findMany({
    select: staffSelect,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  // Reuse the public DTO mapper so admin and public shapes cannot drift.
  const publicShaped = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    shortName: r.shortName,
    summary: r.summary,
    pricing: r.pricing,
    priceMin: r.priceMin,
    priceMax: r.priceMax,
    priceNote: r.priceNote,
    durationMin: r.durationMin,
    isPopular: r.isPopular,
    isFeatured: r.isFeatured,
    includes: r.includes,
    category: r.category,
  }));
  return { data: publicShaped };
});

/**
 * `POST` with an `id` updates; without one creates. A separate `PUT`/`PATCH`
 * would be tidier REST, but admin forms are simpler with one verb and one
 * validation schema, and the audit log records which happened.
 */
export const POST = withAdmin("MANAGER", async ({ request, user }) => {
  const body = await parseBody(request, serviceUpsertSchema);

  const data = {
    categoryId: body.categoryId,
    slug: body.slug,
    name: body.name,
    shortName: body.shortName || null,
    summary: body.summary,
    description: body.description,
    pricing: body.pricing,
    priceMin: body.pricing === "CALL_FOR_PRICE" ? null : body.priceMin ?? null,
    priceMax: body.pricing === "CALL_FOR_PRICE" ? null : body.priceMax ?? body.priceMin ?? null,
    priceNote: body.priceNote || null,
    durationMin: body.durationMin ?? null,
    isPopular: body.isPopular,
    isFeatured: body.isFeatured,
    requiresVehicle: body.requiresVehicle,
    includes: body.includes,
    excludes: body.excludes,
    sortOrder: body.sortOrder,
    isActive: body.isActive,
  };

  const row = body.id
    ? await prisma.service.update({ where: { id: body.id }, data, select: staffSelect })
    : await prisma.service.create({ data, select: staffSelect });

  // A price or duration change invalidates any cached estimate the client may
  // hold, and the availability cache is keyed on service ids.
  clearAvailabilityCache();

  await writeAuditLog({
    action: body.id ? "service.update" : "service.create",
    entity: "Service",
    entityId: row.id,
    userId: user.id,
    request,
    meta: { slug: row.slug, pricing: row.pricing, priceMin: row.priceMin, priceMax: row.priceMax },
  });
  logger.info("admin.service_saved", { scope: "admin", slug: row.slug, id: row.id, updated: Boolean(body.id) });

  return {
    data: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortName: row.shortName,
      summary: row.summary,
      pricing: row.pricing,
      priceMin: row.priceMin,
      priceMax: row.priceMax,
      priceNote: row.priceNote,
      durationMin: row.durationMin,
      isPopular: row.isPopular,
      isFeatured: row.isFeatured,
      includes: row.includes,
      category: row.category,
    } satisfies ServiceDto,
    status: body.id ? 200 : 201,
  };
});

export async function PUT(req: NextRequest): Promise<Response> {
  return POST(req);
}

