/**
 * GET /api/booking/[reference] — the customer's booking status page.
 * ============================================================================
 *   200 → ApiResult<BookingDto>
 *   404 → NOT_FOUND (unknown reference, or `phone` does not match)
 *   429 → RATE_LIMITED
 *
 * Ownership: a 6-character reference is only ~32 bits of entropy, so when a
 * `phone` query param is present it must match the booking's phone (last four
 * digits at minimum). A wrong phone and an unknown reference both return 404 so
 * the endpoint cannot be used to test whether a booking exists.
 *
 * The DTO deliberately excludes staff notes, cancel reasons, IP and UTM.
 */
import type { NextRequest } from "next/server";

import { fail, ok, withApi, type MetaInput } from "@/lib/http";
import { ApiError } from "@/lib/errors";
import { publicLimiter, rateLimit } from "@/lib/ratelimit";
import { requestContext } from "@/lib/request";
import type { BookingDto } from "@/lib/types";
import type { ZodError } from "zod";
import { lookupBooking } from "@/lib/server/booking";
import { bookingReferenceSchema } from "@/lib/server/validation/booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ reference: string }>;
}

export async function GET(req: NextRequest, routeCtx: RouteCtx): Promise<Response> {
  const ctx = requestContext(req);
  const meta: MetaInput = { requestId: ctx.requestId };

  return withApi<BookingDto>(meta, async () => {
    // Stricter than the public tier: this endpoint is a lookup oracle.
    await rateLimit({ action: "booking.lookup", ip: ctx.ip, policy: publicLimiter, requestId: ctx.requestId });

    const { reference } = await routeCtx.params;
    const parsed = bookingReferenceSchema.safeParse(decodeURIComponent(reference));
    if (!parsed.success) {
      const issues = (parsed.error as ZodError).issues;
      throw new ApiError("NOT_FOUND", "We could not find that booking reference.", {
        fields: { reference: issues.map((i) => i.message) },
      });
    }

    const phone = req.nextUrl.searchParams.get("phone") ?? undefined;
    const booking = await lookupBooking({ reference: parsed.data, ...(phone ? { phone } : {}) });

    // A booking status page is per-customer; never cache it.
    return ok(booking, meta, { private: true });
  });
}

/** Explicit 405 so a HEAD/OPTIONS probe gets the envelope, not an HTML 404. */
export async function HEAD(): Promise<Response> {
  return fail(new ApiError("VALIDATION_ERROR", "Use GET."), { requestId: "head" });
}
