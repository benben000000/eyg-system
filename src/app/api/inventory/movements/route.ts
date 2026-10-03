/**
 * /api/inventory/movements — the ledger, and the ONLY write path for stock.
 * ============================================================================
 *   GET  → ApiResult<{ rows, total, page, pageSize }>   200
 *   POST → ApiResult<PostMovementResult | PostMovementRejection>
 *                                                        200 | 400 | 404 | 409
 *
 * ── WHY THIS IS THE ONLY DOOR ───────────────────────────────────────────────
 * `StockMovement` is an append-only ledger. Nothing in this codebase updates or
 * deletes a movement, and nothing moves `StockLevel` without writing one here.
 * That is what makes "why is this number wrong?" answerable six weeks later:
 * there is exactly one place a change can come from, and it carries a reason.
 *
 * ── REFUSALS ARE 200, NOT 500 ───────────────────────────────────────────────
 * A refusal is a *valid answer*, not a server fault: "only 3 left" is the single
 * most useful thing the counter can be told. The body carries
 * `{ ok: false, reason, requested, available, message }` (the contract's
 * `PostMovementRejection`), and the value is never clamped. Validation failures
 * (unknown kind, missing reason) are 400 because the request was malformed.
 *
 * ── IDEMPOTENCY ─────────────────────────────────────────────────────────────
 * Send `idempotencyKey` and a retried submit returns the ORIGINAL movement with
 * `replayed: true` — it does not double-apply and it does not 409. Two taps on
 * "Consume" must not cost the shop two filters. The same key against a different
 * product IS a 409, because answering with another product's movement would hand
 * back a number that has nothing to do with the request.
 *
 * ── WHY RESERVE/RELEASE ARE REFUSED HERE ────────────────────────────────────
 * Those two kinds change the *promise*, not the shelf, and they only expire
 * correctly if a `Reservation` row exists with a TTL. Posting one here would move
 * `reserved` with nothing that the cron sweep could ever release. They belong to
 * `/api/inventory/reservations`.
 *
 * Guards: GET `FRONT_DESK`; POST `MANAGER` + CSRF (a manager moves the numbers).
 * Rate limits: `inventory.read` / `inventory.write` (60/min, fails CLOSED).
 */
import { ApiError } from "@/lib/errors";
import { parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { withAdmin, withAdminRead, writeAuditLog } from "@/lib/server/admin-guard";

import { isPromiseKind } from "@/lib/server/inventory/stock-engine.test-support";
import {
  inventoryReadLimiter,
  inventoryWriteLimiter,
  isMovementRefusal,
  listMovements,
  postMovement,
} from "@/lib/server/inventory/stock-engine";
import { movementListQuerySchema, parseQuery, postMovementSchema } from "@/lib/server/inventory/validation.test-support";
import type { MovementDto, PostMovementRejection, PostMovementResult } from "@/lib/inventory-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface MovementListDto {
  rows: MovementDto[];
  total: number;
  page: number;
  pageSize: number;
}

export const GET = withAdminRead<MovementListDto>(async ({ request, ip, requestId }) => {
  await rateLimit({ action: "inventory.movements.list", ip, policy: inventoryReadLimiter, requestId });
  const query = parseQuery(new URL(request.url).searchParams, movementListQuerySchema);
  const result = await listMovements(query);
  return {
    data: { rows: result.rows, total: result.total, page: result.page, pageSize: result.pageSize },
    headers: { "X-Total-Count": String(result.total) },
  };
});

export type MovementPostDto = PostMovementResult | PostMovementRejection;

export const POST = withAdmin<MovementPostDto>("MANAGER", async ({ request, user, ip, requestId }) => {
  await rateLimit({ action: "inventory.movements.post", ip, policy: inventoryWriteLimiter, requestId });
  const body = await parseBody(request, postMovementSchema);

  if (isPromiseKind(body.kind)) {
    throw new ApiError("VALIDATION_ERROR", "Holds are created through the reservations endpoint.", {
      fields: {
        kind: [
          body.kind === "RESERVE"
            ? "Use POST /api/inventory/reservations so the hold gets a TTL and can expire."
            : "Use POST /api/inventory/reservations/release.",
        ],
      },
    });
  }

  const outcome = await postMovement(
    {
      productId: body.productId,
      kind: body.kind,
      qty: body.qty,
      reason: body.reason,
      ...(body.reference ? { reference: body.reference } : {}),
      ...(body.bookingId ? { bookingId: body.bookingId } : {}),
      ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}),
      // A RECEIVE opens a lot. `dotCode` is this delivery's tyre code and
      // `unitCost` is what THIS delivery was invoiced at — which may differ from
      // the catalogue's current cost, and a margin computed months later has to
      // be the margin that was actually made.
      ...(body.dotCode ? { dotCode: body.dotCode } : {}),
      ...(body.unitCost !== undefined ? { unitCost: body.unitCost } : {}),
    },
    { actorId: user.id, actorName: user.name, requestId },
  );

  if (isMovementRefusal(outcome)) {
    // 200 with the refusal in the body: this is a valid answer about stock, not
    // a failed request. The UI reads `available` and says "3 left".
    return { data: outcome, status: 200 };
  }

  await writeAuditLog({
    action: `inventory.movement.${body.kind.toLowerCase()}`,
    entity: "StockMovement",
    entityId: outcome.movement.id,
    userId: user.id,
    request,
    // The reason and the lot, never the cost. An audit row is a prime target for
    // a compromised account.
    meta: {
      productId: body.productId,
      kind: body.kind,
      qty: body.qty,
      onHandAfter: outcome.movement.onHandAfter,
      dotCode: body.dotCode ?? null,
      hasLotCost: body.unitCost !== undefined,
      replayed: outcome.replayed,
    },
  });

  return { data: outcome, status: 200 };
});
