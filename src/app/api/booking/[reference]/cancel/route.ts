/**
 * POST /api/booking/[reference]/cancel — self-service cancellation.
 * ============================================================================
 *   200 → ApiResult<BookingDto>  (including the idempotent already-cancelled case)
 *   404 → NOT_FOUND              (unknown reference, or `phone` mismatch)
 *   409 → CONFLICT               (too late, or already past PENDING/CONFIRMED)
 *   422 → SPAM_REJECTED          (honeypot / submitted impossibly fast)
 *   429 → RATE_LIMITED
 *
 * Rules:
 *  - Up to `SELF_CANCEL_CUTOFF_MINUTES` (2 h) before the slot starts.
 *  - Only from `PENDING` or `CONFIRMED`.
 *  - Ownership is proven by `phone`; unknown reference and wrong phone both 404.
 *  - Idempotent: cancelling an already-cancelled booking succeeds and returns the
 *    same DTO, because a double-tapped button must not produce a scary error.
 *  - Always writes a `BookingEvent` on a real cancellation, and always fires the
 *    cancellation notice AFTER commit.
 */
import type { NextRequest } from "next/server";

import { ok, parseBody, withApi, type MetaInput } from "@/lib/http";
import { ApiError } from "@/lib/errors";
import { verifyCaptcha } from "@/lib/captcha";
import { bookingLimiter, rateLimit } from "@/lib/ratelimit";
import { requestContext } from "@/lib/request";
import type { BookingDto } from "@/lib/types";
import { cancelBooking, lookupBooking } from "@/lib/server/booking";
import { bookingReferenceSchema, cancelBookingSchema } from "@/lib/server/validation/booking";
import { onBookingCancelled } from "@/lib/server/inventory/booking-hooks";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ reference: string }>;
}

export async function POST(req: NextRequest, routeCtx: RouteCtx): Promise<Response> {
  const ctx = requestContext(req);
  const meta: MetaInput = { requestId: ctx.requestId };

  return withApi<BookingDto>(meta, async () => {
    await rateLimit({
      action: "booking.cancel",
      ip: ctx.ip,
      policy: bookingLimiter,
      requestId: ctx.requestId,
    });

    const { reference: rawReference } = await routeCtx.params;
    const parsedRef = bookingReferenceSchema.safeParse(decodeURIComponent(rawReference));
    if (!parsedRef.success) throw new ApiError("NOT_FOUND", "We could not find that booking reference.");

    const body = await parseBody(req, cancelBookingSchema);

    // Honeypot + min-time-to-submit. The math challenge is deliberately NOT
    // required here: cancelling is a reducing action, and the ownership proof
    // (reference + phone) is already a strong signal.
    await verifyCaptcha(
      {
        renderedAt: ctx.clientTimestamp,
        website: body.website,
        requestId: ctx.requestId,
      },
      ctx.ip,
    );

    const phone = req.nextUrl.searchParams.get("phone") ?? undefined;
    if (!phone) {
      throw new ApiError("VALIDATION_ERROR", "Add ?phone= to prove this booking is yours.", {
        fields: { phone: ["Required."] },
      });
    }

    // Ownership proof BEFORE the cancellation: an unknown reference and a wrong
    // phone both 404 here, so this endpoint cannot be used to probe references.
    await lookupBooking({ reference: parsedRef.data, phone });

    const booking = await cancelBooking({
      reference: parsedRef.data,
      reason: body.reason,
      verified: true,
      requestId: ctx.requestId,
    });

    // Release any stock held for this booking. The parts never left the shelf,
    // so the hold must go back — otherwise the next customer is told a part is
    // unavailable while it sits in the back room.
    //
    // Fire-and-forget for the same reason as the status route: the cancellation
    // has already committed and a stock outage must not be able to undo it.
    // The hook is idempotent, and the TTL sweep is the backstop.
    void onBookingCancelled(booking.id, body.reason).catch((error: unknown) => {
      logger.error("inventory.cancel_release_failed", { bookingId: booking.id }, { err: error });
    });
    // Never cached: the status just changed.
    return ok(booking, meta, { private: true });
  });
}
