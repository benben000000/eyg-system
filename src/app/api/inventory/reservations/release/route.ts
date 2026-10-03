/**
 * /api/inventory/reservations/release — put held stock back on the shelf.
 * ============================================================================
 *   POST → ApiResult<{ affected, units, movements, reservations, stock }>
 *                                                        200 | 400 | 404 | 409
 *
 * Why a route of its own rather than a PATCH: releasing is a *move*, not an
 * edit. It writes a `RELEASE` row to the ledger, decrements `reserved` under a
 * guard, and transitions every `HELD` row on the booking to `RELEASED` — and it
 * must be exactly one of those things, idempotently. A second call finds nothing
 * `HELD` and reports `affected: 0` rather than erroring, because a double-tapped
 * "cancel the booking" must not look like a failure.
 *
 * **`RELEASED` is the only status ever touched.** The request may send
 * `statuses`, but it is ignored on purpose: a `CONSUMED` row is not a hold.
 * Un-reserving it would *inflate* `available` and let the shop promise a part
 * that is already fitted to somebody's car — the mirror image of overselling.
 *
 * `reason` is mandatory. "Customer cancelled", "job rescheduled", "bay blocked"
 * are reasons; a bare click is not, because the next person to read this ledger
 * row is trying to work out why the shelf and the system disagreed.
 *
 * Guards: `MANAGER` + CSRF. Rate limit: `inventory.write`.
 */
import { parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { withAdmin, writeAuditLog } from "@/lib/server/admin-guard";

import { release } from "@/lib/server/inventory/reservations";
import { inventoryWriteLimiter } from "@/lib/server/inventory/stock-engine";
import { releaseReservationsSchema } from "@/lib/server/inventory/validation.test-support";
import type { ReservationActionResult } from "@/lib/server/inventory/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAdmin("MANAGER", async ({ request, user, ip, requestId }) => {
  await rateLimit({ action: "inventory.reservations.release", ip, policy: inventoryWriteLimiter, requestId });
  const body = await parseBody(request, releaseReservationsSchema);

  const result: ReservationActionResult = await release(body, {
    actorId: user.id,
    actorName: user.name,
    requestId,
  });

  await writeAuditLog({
    action: "inventory.reservation.released",
    entity: "Booking",
    entityId: body.bookingId,
    userId: user.id,
    request,
    meta: { affected: result.affected, units: result.units },
  });

  return { data: result, status: 200 };
});
