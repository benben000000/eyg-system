/**
 * POST /api/booking — create a booking.
 * ============================================================================
 *   201 → ApiResult<BookingDto>
 *   400 → VALIDATION_ERROR  (bad body; `error.fields` keyed by input path)
 *   409 → SLOT_UNAVAILABLE (slot taken; `data.availability` carries a fresh board)
 *   422 → CAPTCHA_FAILED / SPAM_REJECTED (honeypot or min-time-to-submit)
 *   429 → RATE_LIMITED     (booking tier: 8/hour per IP, `Retry-After`)
 *   503 → SERVICE_UNAVAILABLE (rate-limit store or database down — fails closed)
 *
 * Defence in depth, in this order, cheapest first:
 *   1. rate limit     — booking tier, keyed on the verified IP + hashed phone
 *   2. zod            — `.strict()`, rejects unknown keys, trims, caps lengths
 *   3. honeypot +     — `website` must be empty; submission must not be
 *      min-time         faster than ~2 s
 *   4. captcha        — HMAC-signed, expiring, single-use arithmetic challenge
 *   5. offered-slot   — `startAt` must be a slot the board currently offers
 *   6. SERIALIZABLE   — capacity re-checked inside the transaction (the race)
 *
 * Response is `BookingDto` only: no staff notes, no IP, no other customers.
 * On a 409 the body is `ApiFailure` with `details.availability` = the refreshed
 * board, so the wizard can re-offer slots without a second round trip.
 */
import type { NextRequest } from "next/server";

import { created, fail, parseBody, withApi, type MetaInput } from "@/lib/http";
import { ApiError } from "@/lib/errors";
import { verifyCaptcha } from "@/lib/captcha";
import { bookingLimiter, rateLimit } from "@/lib/ratelimit";
import { requestContext } from "@/lib/request";
import type { BookingDto, SlotAvailabilityDto } from "@/lib/types";
import { createBooking } from "@/lib/server/booking";
import { createBookingSchema } from "@/lib/server/validation/booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const ctx = requestContext(req);
  const meta: MetaInput = { requestId: ctx.requestId };

  return withApi<BookingDto>(meta, async () => {
    const body = await parseBody(req, createBookingSchema);

    // 1. Rate limit. The phone is hashed inside `rateLimit`, never stored raw.
    await rateLimit({
      action: "booking.create",
      ip: ctx.ip,
      subject: body.phone,
      policy: bookingLimiter,
      requestId: ctx.requestId,
    });

    // 2-4. Honeypot, min-time-to-submit and the arithmetic challenge.
    await verifyCaptcha(
      {
        token: body.captchaToken,
        answer: body.captchaAnswer,
        renderedAt: ctx.clientTimestamp,
        website: body.website,
        requestId: ctx.requestId,
      },
      ctx.ip,
    );

    try {
      const result = await createBooking(
        {
          name: body.name,
          phone: body.phone,
          ...(body.email ? { email: body.email } : {}),
          startAt: body.startAt,
          serviceIds: body.serviceIds,
          ...(body.packageId ? { packageId: body.packageId } : {}),
          ...(body.promoCode ? { promoCode: body.promoCode } : {}),
          ...(body.vehicle
            ? {
                vehicle: {
                  year: body.vehicle.year,
                  make: body.vehicle.make,
                  model: body.vehicle.model,
                  ...(body.vehicle.variant ? { variant: body.vehicle.variant } : {}),
                  ...(body.vehicle.plate ? { plate: body.vehicle.plate } : {}),
                  ...(body.vehicle.mileageKm !== undefined ? { mileageKm: body.vehicle.mileageKm } : {}),
                },
              }
            : {}),
          notes: body.notes,
          consentSms: body.consentSms,
          consentMarketing: body.consentMarketing,
          website: body.website,
          captchaAnswer: body.captchaAnswer,
          captchaToken: body.captchaToken,
        },
        {
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
          utmSource: ctx.utm.source,
          utmCampaign: ctx.utm.campaign,
          source: "website",
        },
      );

      // 201. `created` sets `no-store` so nothing caches a confirmed booking.
      return created(
        result.booking,
        { ...meta, total: result.availability.slots.length },
        { private: true, headers: { Location: `/api/booking/${result.booking.reference}` } },
      );
    } catch (err) {
      // A slot conflict is the one failure the customer can act on immediately,
      // so the refreshed board rides along in `details`.
      if (ApiError.is(err) && (err.code === "SLOT_UNAVAILABLE" || err.code === "CONFLICT")) {
        const refreshed = await loadBoard(body.startAt, body.serviceIds);
        const error = new ApiError("SLOT_UNAVAILABLE", err.message, {
          fields: err.fields,
          details: refreshed ? { availability: refreshed } : undefined,
        });
        return fail(error, meta);
      }
      throw err;
    }
  });
}

/** Best-effort refresh of the board for the day the customer tried to book. */
async function loadBoard(startAt: string, serviceIds: string[]): Promise<SlotAvailabilityDto | null> {
  try {
    const dateKey = /^\d{4}-\d{2}-\d{2}/.exec(startAt)?.[0];
    if (!dateKey) return null;
    const { getAvailabilityFresh } = await import("@/lib/server/availability");
    return await getAvailabilityFresh({ date: dateKey, serviceIds });
  } catch {
    return null;
  }
}
