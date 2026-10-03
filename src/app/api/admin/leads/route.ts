/**
 * /api/admin/leads — the website lead inbox.
 * ============================================================================
 *   GET   → ApiResult<{ rows, total, page, pageSize }>   200
 *   PATCH → ApiResult<LeadDto>                          200 | 400 | 404
 *
 * Guards: GET any staff; PATCH requires `MANAGER` + CSRF, because a lead's
 * status is the record of a customer conversation and should not be flippable by
 * whoever happens to be on the front desk.
 *
 * `backend-integrations` owns `POST /api/leads` (the public capture route).
 * This route only reads and triages what it produced.
 */
import { ApiError } from "@/lib/errors";
import { parseBody } from "@/lib/http";
import { withAdmin, withAdminRead, writeAuditLog } from "@/lib/server/admin-guard";
import { prisma } from "@/lib/server/db";
import { leadListQuerySchema, leadStatusUpdateSchema } from "@/lib/server/validation/admin";
import type { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const leadSelect = {
  id: true,
  kind: true,
  name: true,
  phone: true,
  email: true,
  message: true,
  meta: true,
  status: true,
  createdAt: true,
} as const;

export interface LeadListDto {
  rows: Array<{
    id: string;
    kind: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    message: string | null;
    meta: unknown;
    status: string;
    createdAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

function fieldsFrom(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

export const GET = withAdminRead<LeadListDto>(async ({ request }) => {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const key of ["kind", "status", "page", "pageSize"]) {
    const value = url.searchParams.get(key);
    if (value !== null) raw[key] = value;
  }
  const parsed = leadListQuerySchema.safeParse(raw);
  if (!parsed.success) throw new ApiError("VALIDATION_ERROR", "Please check the filters.", { fields: fieldsFrom(parsed.error) });

  const where: { kind?: string; status?: string } = {};
  if (parsed.data.kind) where.kind = parsed.data.kind;
  if (parsed.data.status) where.status = parsed.data.status;

  const [rows, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      select: leadSelect,
      orderBy: { createdAt: "desc" },
      skip: (parsed.data.page - 1) * parsed.data.pageSize,
      take: parsed.data.pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    data: {
      rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      total,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    },
  };
});

/** PATCH — triage a lead. The body is `{ id, status }`. */
export const PATCH = withAdmin("MANAGER", async ({ request, user }) => {
  const body = await parseBody(request, leadStatusUpdateSchema);

  const existing = await prisma.lead.findUnique({ where: { id: body.id }, select: { id: true, status: true } });
  if (!existing) throw new ApiError("NOT_FOUND", "Lead not found.");

  const row = await prisma.lead.update({ where: { id: body.id }, data: { status: body.status }, select: leadSelect });
  await writeAuditLog({
    action: "lead.status",
    entity: "Lead",
    entityId: body.id,
    userId: user.id,
    request,
    meta: { from: existing.status, to: body.status, kind: row.kind },
  });

  return { data: { ...row, createdAt: row.createdAt.toISOString() } };
});
