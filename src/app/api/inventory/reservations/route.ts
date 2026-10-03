/**
 * /api/inventory/reservations — holds against a booking.
 * ============================================================================
 *   GET  → ApiResult<{ rows, total, page, pageSize }>   200
 *   POST → ApiResult<ReserveResult>                     200 | 400 | 404 | 429
 *
 * ── WHAT POST ACTUALLY DOES ─────────────────────────────────────────────────
 * Either `items: [{ productId, qty }]` or `fromServices: true` (derive the BOM
 * from the booking's services through `ServicePartRequirement`) — never both.
 *
 * The response is a `ReserveResult`, and the field that matters is `blocked`:
 *
 *   blocked: true   → a BLOCKING part is short. The booking must NOT be promised.
 *   blocked: false  → everything blocking is covered; short non-blocking parts
 *                     are reported in `shortfalls` as a warning only.
 *
 * Partial success is the point. Whatever can be held IS held; what could not is
 * reported with the number that is actually available. Nothing is clamped, and
 * there is no read-then-write fallback — the hold is taken by the same guarded
 * `UPDATE … WHERE onHand - reserved >= n RETURNING` the engine uses, so two bays
 * grabbing the last filter produce exactly one winner.
 *
 * Guards: GET `FRONT_DESK`; POST `MANAGER` + CSRF. Taking stock out of
 * availability for a customer is a commitment, and a commitment is a manager's
 * call. Rate limits: `inventory.read` / `inventory.write`.
 */
import { parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { withAdmin, withAdminRead, writeAuditLog } from "@/lib/server/admin-guard";

import { listReservations, reserve } from "@/lib/server/inventory/reservations";
import { inventoryReadLimiter, inventoryWriteLimiter } from "@/lib/server/inventory/stock-engine";
import { parseQuery, reservationListQuerySchema, reserveSchema } from "@/lib/server/inventory/validation.test-support";
import type { ReservationDto, ReservationStatusValue, ReserveResult } from "@/lib/inventory-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ReservationListDto {
  rows: ReservationDto[];
  total: number;
  page: number;
  pageSize: number;
}

export const GET = withAdminRead<ReservationListDto>(async ({ request, ip, requestId }) => {
  await rateLimit({ action: "inventory.reservations.list", ip, policy: inventoryReadLimiter, requestId });
  const query = parseQuery(new URL(request.url).searchParams, reservationListQuerySchema);
  const result = await listReservations({
    ...(query.bookingId ? { bookingId: query.bookingId } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.status ? { status: query.status as ReservationStatusValue } : {}),
    ...(query.page ? { page: query.page } : {}),
    ...(query.pageSize ? { pageSize: query.pageSize } : {}),
  });
  return {
    data: { rows: result.rows, total: result.total, page: result.page, pageSize: result.pageSize },
    headers: { "X-Total-Count": String(result.total) },
  };
});

export const POST = withAdmin("MANAGER", async ({ request, user, ip, requestId }) => {
  await rateLimit({ action: "inventory.reservations.reserve", ip, policy: inventoryWriteLimiter, requestId });
  const body = await parseBody(request, reserveSchema);

  const result = await reserve(body, { actorId: user.id, actorName: user.name, requestId });

  await writeAuditLog({
    action: "inventory.reservation.created",
    entity: "Booking",
    entityId: body.bookingId,
    userId: user.id,
    request,
    meta: {
      held: result.reservations.length,
      shortfalls: result.shortfalls.length,
      blocked: result.blocked,
      ttlMinutes: body.ttlMinutes ?? null,
    },
  });

  const payload: ReserveResult = result;
  return { data: payload, status: 200 };
});
