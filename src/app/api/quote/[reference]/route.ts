/**
 * GET /api/quote/[reference] — a quote request the customer can come back to.
 * ============================================================================
 *   200 → ApiResult<QuoteRequestDto>
 *   404 → NOT_FOUND (unknown reference, or `phone` mismatch)
 *   429 → RATE_LIMITED
 *
 * Ownership: as with bookings, a bare reference is not proof. When `phone` is
 * present it must match. Wrong phone and unknown reference both 404.
 *
 * Staff see the full record through `/api/admin/*`, which is behind the session
 * guard — this route is deliberately customer-shaped only.
 */
import type { NextRequest } from "next/server";

import { ok, withApi, type MetaInput } from "@/lib/http";
import { ApiError } from "@/lib/errors";
import { publicLimiter, rateLimit } from "@/lib/ratelimit";
import { requestContext } from "@/lib/request";
import type { QuoteRequestDto } from "@/lib/types";
import type { ZodError } from "zod";
import { prisma } from "@/lib/server/db";
import { quoteReferenceSchema } from "@/lib/server/validation/booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ reference: string }>;
}

/** A 6-char reference is only ~32 bits; require ownership on every lookup. */
export async function GET(req: NextRequest, routeCtx: RouteCtx): Promise<Response> {
  const ctx = requestContext(req);
  const meta: MetaInput = { requestId: ctx.requestId };

  return withApi<QuoteRequestDto>(meta, async () => {
    await rateLimit({ action: "quote.lookup", ip: ctx.ip, policy: publicLimiter, requestId: ctx.requestId });

    const { reference: raw } = await routeCtx.params;
    const parsed = quoteReferenceSchema.safeParse(decodeURIComponent(raw));
    if (!parsed.success) {
      const issues = (parsed.error as ZodError).issues;
      throw new ApiError("NOT_FOUND", "We could not find that estimate.", {
        fields: { reference: issues.map((i) => i.message) },
      });
    }

    const phone = req.nextUrl.searchParams.get("phone")?.replace(/\D/g, "") ?? "";
    const row = await prisma.quoteRequest.findUnique({
      where: { reference: parsed.data },
      select: { reference: true, phone: true, estimateMin: true, estimateMax: true, createdAt: true },
    });
    // Identical response for "no such reference" and "wrong phone", so this
    // endpoint cannot be used to discover which references are real.
    if (!row) throw new ApiError("NOT_FOUND", "We could not find that estimate.");
    const digits = row.phone.replace(/\D/g, "");
    if (phone.length < 4 || !digits.endsWith(phone.slice(-4))) {
      throw new ApiError("NOT_FOUND", "We could not find that estimate.");
    }

    const dto: QuoteRequestDto = {
      reference: row.reference,
      estimateMin: row.estimateMin ?? 0,
      estimateMax: row.estimateMax ?? row.estimateMin ?? 0,
      requestedAt: row.createdAt.toISOString(),
    };
    return ok(dto, meta, { private: true });
  });
}
