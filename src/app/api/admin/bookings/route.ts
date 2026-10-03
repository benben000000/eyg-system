/**
 * /api/admin/bookings — the bookings board.
 * ============================================================================
 *   GET  → ApiResult<{ rows, page, pageSize, total }>   200 | 401 | 403
 *   POST → not used; bookings are created publicly.
 *
 * Guards: `requireRole("FRONT_DESK")` (any signed-in staff). No CSRF on a GET.
 * Search uses Prisma `contains` — never string-concatenated SQL.
 *
 * Query: ?status=&date=YYYY-MM-DD&q=&page=&pageSize=
 *   `date` filters on the *local* Manila calendar day of `startAt`; the route
 *   converts it to a UTC window with `localMinutesToUtc`, never with the
 *   server's own timezone.
 */
import { ApiError } from "@/lib/errors";
import { withAdminRead } from "@/lib/server/admin-guard";
import { listBookings } from "@/lib/server/booking";
import { bookingListQuerySchema } from "@/lib/server/validation/admin";
import type { BookingStatusValue } from "@/lib/types";
import type { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface BookingListDto {
  rows: Awaited<ReturnType<typeof listBookings>>["rows"];
  total: number;
  page: number;
  pageSize: number;
}

export const GET = withAdminRead<BookingListDto>(async ({ request }) => {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const key of ["status", "date", "q", "page", "pageSize"]) {
    const value = url.searchParams.get(key);
    if (value !== null) raw[key] = value;
  }

  const parsed = bookingListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of (parsed.error as ZodError).issues) {
      const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
      (fields[key] ??= []).push(issue.message);
    }
    throw new ApiError("VALIDATION_ERROR", "Please check the filters.", { fields });
  }

  const result = await listBookings({
    ...(parsed.data.status ? { status: parsed.data.status as BookingStatusValue } : {}),
    ...(parsed.data.date ? { date: parsed.data.date } : {}),
    ...(parsed.data.q ? { q: parsed.data.q } : {}),
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
  });

  return {
    data: { rows: result.rows, total: result.total, page: result.page, pageSize: result.pageSize },
    headers: { "X-Total-Count": String(result.total) },
  };
});
