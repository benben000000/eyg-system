/**
 * /api/admin/closures — bay closures and blackout windows.
 * ============================================================================
 *   GET   → ApiResult<ClosureDto[]>                          200
 *   POST  → ApiResult<ClosureDto>                            201 | 400
 *   DELETE → removes one closure. Body: `{ id }`.           200 | 404
 *
 * Guards: GET any staff; POST and DELETE require `MANAGER` + CSRF. Closing a bay
 * takes capacity away from customers who may already hold a booking, so it is a
 * manager decision and it is audited.
 *
 * A closure that overlaps the local calendar day is removed from the slot board
 * by `computeAvailability` in `slot-math.ts`. Because the board is cached for
 * five minutes, this route also clears that cache so the change is visible now.
 */
import { ApiError } from "@/lib/errors";
import { parseBody } from "@/lib/http";
import { withAdmin, withAdminRead, writeAuditLog } from "@/lib/server/admin-guard";
import { prisma } from "@/lib/server/db";
import { clearAvailabilityCache } from "@/lib/server/availability";
import { closureUpsertSchema } from "@/lib/server/validation/admin";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const closureSelect = {
  id: true,
  title: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  isActive: true,
  createdAt: true,
} as const;

export interface ClosureDto {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  isActive: boolean;
  createdAt: string;
}

const deleteSchema = z.object({ id: z.string().trim().min(4).max(40) }).strict();

export const GET = withAdminRead<ClosureDto[]>(async () => {
  const rows = await prisma.bayClosure.findMany({
    select: closureSelect,
    orderBy: { startsAt: "desc" },
    take: 200,
  });
  return { data: rows.map((r) => ({ ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString(), createdAt: r.createdAt.toISOString() })) };
});

export const POST = withAdmin("MANAGER", async ({ request, user }) => {
  const body = await parseBody(request, closureUpsertSchema);

  const data = {
    title: body.title,
    startsAt: new Date(body.startsAt),
    endsAt: new Date(body.endsAt),
    reason: body.reason || null,
    isActive: body.isActive,
  };

  const row = body.id
    ? await prisma.bayClosure.update({ where: { id: body.id }, data, select: closureSelect })
    : await prisma.bayClosure.create({ data, select: closureSelect });

  clearAvailabilityCache();
  await writeAuditLog({
    action: body.id ? "closure.update" : "closure.create",
    entity: "BayClosure",
    entityId: row.id,
    userId: user.id,
    request,
    meta: { title: row.title, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), isActive: row.isActive },
  });

  return {
    data: { ...row, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), createdAt: row.createdAt.toISOString() },
    status: body.id ? 200 : 201,
  };
});

export const DELETE = withAdmin("MANAGER", async ({ request, user }) => {
  const body = await parseBody(request, deleteSchema);
  const existing = await prisma.bayClosure.findUnique({ where: { id: body.id }, select: { id: true, title: true } });
  if (!existing) throw new ApiError("NOT_FOUND", "Closure not found.");

  await prisma.bayClosure.delete({ where: { id: body.id } });
  clearAvailabilityCache();
  await writeAuditLog({ action: "closure.delete", entity: "BayClosure", entityId: body.id, userId: user.id, request, meta: { title: existing.title } });

  return { data: { deleted: true, id: body.id } };
});
