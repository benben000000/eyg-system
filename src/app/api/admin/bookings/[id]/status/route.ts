/**
 * /api/admin/bookings/[id]/status — move a booking through the state machine.
 * ============================================================================
 *   PATCH → ApiResult<BookingDto & { board }>   200 | 401 | 403 | 404 | 409
 *
 * Guards: `requireRole("FRONT_DESK")` + CSRF double-submit token.
 * `MANAGER` is required for the destructive states (`CANCELLED`, `NO_SHOW`)
 * because they release a bay a customer may be relying on — enforced in the
 * handler via `roleAtLeast`.
 *
 * Illegal transitions are rejected with a 409 by `assertTransition`, and every
 * accepted transition writes a `BookingEvent` inside the same transaction.
 */
import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/errors";
import { withAdmin, writeAuditLog } from "@/lib/server/admin-guard";
import { changeBookingStatus } from "@/lib/server/booking";
import {
  onBookingCompleted,
  onBookingConfirmed,
  releaseBookingParts,
} from "@/lib/server/inventory/booking-hooks";
import { logger } from "@/lib/logger";
import { roleAtLeast } from "@/lib/server/auth";
import { bookingStatusUpdateSchema } from "@/lib/server/validation/admin";
import type { BookingDto } from "@/lib/types";
import type { ZodError } from "zod";

/**
 * Map a booking transition onto the inventory work it implies.
 *
 * Only three transitions touch stock, and each maps to exactly one action:
 *
 *   CONFIRMED             reserve every bill-of-materials part with a TTL
 *   COMPLETED / READY     consume - the parts physically left the shelf
 *   CANCELLED / NO_SHOW   release - the parts are still on the shelf, and a
 *                         hold that is not returned starves the next customer
 *
 * RESCHEDULED back to PENDING also releases, so a rebooked job cannot carry
 * the previous job's parts into a new slot.
 *
 * A booking whose services have no bill of materials is a no-op, not an
 * error: absence of a BOM is normal for most services.
 */
async function syncInventoryForStatus(bookingId: string, to: string): Promise<void> {
  if (to === "CONFIRMED") {
    const result = await onBookingConfirmed(bookingId);
    if (result?.blocked) {
      // A blocked-but-taken booking must stay distinguishable from an ordinary
      // one, or isBlocking drifts wrong on whichever side nobody audits.
      logger.warn("inventory.booking_blocked", {
        bookingId,
        shortfalls: result.shortfalls.length,
      });
    }
    return;
  }
  if (to === "COMPLETED" || to === "READY") {
    await onBookingCompleted(bookingId);
    return;
  }
  if (to === "CANCELLED" || to === "NO_SHOW" || to === "PENDING") {
    await releaseBookingParts(bookingId, "booking-status:" + to);
  }
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/** States that need a manager, because they take a bay away from a customer. */
const DESTRUCTIVE = new Set(["CANCELLED", "NO_SHOW"]);

export interface StatusChangeDto {
  booking: BookingDto;
  board: Awaited<ReturnType<typeof changeBookingStatus>>["board"];
}

export async function PATCH(req: NextRequest, routeCtx: RouteCtx): Promise<Response> {
  const guarded = withAdmin("FRONT_DESK", async ({ request, requestId, user }): Promise<{ data: StatusChangeDto; status?: 200 }> => {
    const { id } = await routeCtx.params;
    const bookingId = id.trim();
    if (!/^[a-z0-9]{4,40}$/i.test(bookingId)) {
      throw new ApiError("NOT_FOUND", "Booking not found.");
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bookingStatusUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of (parsed.error as ZodError).issues) {
        const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
        (fields[key] ??= []).push(issue.message);
      }
      throw new ApiError("VALIDATION_ERROR", "Please check the highlighted fields.", { fields });
    }

    if (DESTRUCTIVE.has(parsed.data.status) && !roleAtLeast(user.role, "MANAGER")) {
      throw new ApiError("FORBIDDEN", "Only a manager can cancel or mark a no-show.");
    }

    const result = await changeBookingStatus({
      id: bookingId,
      to: parsed.data.status,
      actor: `${user.email}#${user.id.slice(-4)}`,
      staffNotes: parsed.data.staffNotes,
      reason: parsed.data.reason,
      requestId,
      ip: null,
    });

    // Inventory side-effects, dispatched once the transition is known.
    //
    // Fire-and-forget on purpose. The booking change has already committed,
    // and a stock outage must never be able to fail a status change a mechanic
    // is standing in front of a customer to make. Each hook is individually
    // idempotent, so a retry is safe.
    //
    // Without this call the inventory is a spreadsheet with extra steps: parts
    // would never be held, released or consumed, and the reason
    // ServicePartRequirement exists would go unused.
    void syncInventoryForStatus(bookingId, result.booking.status).catch((error: unknown) => {
      logger.error("inventory.hook_failed", { bookingId, to: result.booking.status }, { err: error });
    });
    // Audit every status change, including the from/to pair.
    await writeAuditLog({
      action: `booking.${parsed.data.status.toLowerCase()}`,
      entity: "Booking",
      entityId: bookingId,
      userId: user.id,
      request,
      meta: { from: result.booking.status, to: parsed.data.status, reference: result.booking.reference },
    });

    return { data: { booking: result.booking, board: result.board } };
  });
  return guarded(req);
}

/** `POST` is accepted as an alias so a plain HTML form can drive this. */
export async function POST(req: NextRequest, routeCtx: RouteCtx): Promise<Response> {
  return PATCH(req, routeCtx);
}
