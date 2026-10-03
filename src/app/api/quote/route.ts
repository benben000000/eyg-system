/**
 * POST /api/quote — capture an instant-quote request (a lead).
 * ============================================================================
 *   201 → ApiResult<QuoteRequestDto>
 *   400 → VALIDATION_ERROR (bad body; `error.fields` keyed by input path)
 *   422 → CAPTCHA_FAILED / SPAM_REJECTED
 *   429 → RATE_LIMITED (quote tier: 12/hour per IP + hashed phone)
 *   503 → SERVICE_UNAVAILABLE (rate-limit store down — the write tier fails closed)
 *
 * The *estimate itself* needs no endpoint: `src/components/widgets/internal/
 * quote-engine.ts` computes it client-side so a number is always on screen, even
 * when this endpoint is down. This route only records the lead and returns the
 * reference the customer quotes on the phone.
 *
 * Defence in depth, same order as `/api/booking`: rate limit → zod (strict) →
 * honeypot + min-time → captcha.
 */
import type { NextRequest } from "next/server";

import { created, parseBody, withApi, type MetaInput } from "@/lib/http";
import { verifyCaptcha } from "@/lib/captcha";
import { quoteLimiter, rateLimit } from "@/lib/ratelimit";
import { requestContext } from "@/lib/request";
import type { QuoteRequestDto } from "@/lib/types";
import { estimateWithNextStep } from "@/lib/server/quote";
import { createQuoteRequestSchema } from "@/lib/server/validation/quote";
import { prisma } from "@/lib/server/db";
import { makeReference, normalisePhone } from "@/lib/utils";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quote references are visibly different from booking references. */
const QUOTE_REFERENCE_PREFIX = "EYG-Q-";

export async function POST(req: NextRequest): Promise<Response> {
  const ctx = requestContext(req);
  const meta: MetaInput = { requestId: ctx.requestId };

  return withApi<QuoteRequestDto>(meta, async () => {
    const body = await parseBody(req, createQuoteRequestSchema);

    await rateLimit({
      action: "quote.request",
      ip: ctx.ip,
      subject: body.phone,
      policy: quoteLimiter,
      requestId: ctx.requestId,
    });
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

    // Compute the estimate FIRST: an invalid selection must not leave a lead row
    // behind for the shop to call about.
    const estimate = await estimateWithNextStep({
      serviceIds: body.serviceIds,
      ...(body.packageId ? { packageId: body.packageId } : {}),
      ...(body.promoCode ? { promoCode: body.promoCode } : {}),
      ...(body.tyreCount !== undefined ? { tyreCount: body.tyreCount } : {}),
      engine: body.engine,
    });

    const phone = normalisePhone(body.phone);
    const customer = await upsertCustomer({
      name: body.name,
      phone,
      email: body.email ?? null,
    });

    const reference = await nextReference();
    const row = await prisma.quoteRequest.create({
      data: {
        reference,
        customerId: customer.id,
        name: body.name,
        phone,
        email: body.email ?? null,
        vehicleYear: body.vehicleYear ?? null,
        vehicleMake: body.vehicleMake || null,
        vehicleModel: body.vehicleModel || null,
        packageSlug: estimate.nextStep.href.match(/[?&]package=([^&]+)/)?.[1] ?? null,
        selections: {
          serviceIds: body.serviceIds,
          engine: body.engine,
          tyreCount: body.tyreCount ?? null,
          tyreSize: body.tyreSize || null,
          promoCode: body.promoCode ?? null,
          promoStatus: estimate.promoStatus,
          isApproximate: estimate.isApproximate,
        } as never,
        estimateMin: estimate.min,
        estimateMax: estimate.max,
        notes: body.notes ? body.notes.slice(0, 600) : null,
        createdIp: ctx.ip,
      },
      select: { reference: true, createdAt: true },
    });

    logger.info("quote.requested", {
      requestId: ctx.requestId,
      scope: "quote",
      reference: row.reference,
      estimateMin: estimate.min,
      estimateMax: estimate.max,
      promoStatus: estimate.promoStatus,
    });

    const dto: QuoteRequestDto = {
      reference: row.reference,
      estimateMin: estimate.min,
      estimateMax: estimate.max,
      requestedAt: row.createdAt.toISOString(),
    };
    return created(dto, meta, { private: true });
  });
}

/** Retry on the (astronomically unlikely) unique collision. */
async function nextReference(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = makeReference(QUOTE_REFERENCE_PREFIX);
    const clash = await prisma.quoteRequest.findUnique({ where: { reference }, select: { id: true } });
    if (!clash) return reference;
  }
  return makeReference(QUOTE_REFERENCE_PREFIX, 8);
}

/**
 * Upsert by phone. Never overwrites an existing name/email with junk — a
 * mistyped form must not destroy the record the shop already has.
 */
async function upsertCustomer(data: { name: string; phone: string; email: string | null }): Promise<{ id: string }> {
  const existing = await prisma.customer.findUnique({ where: { phone: data.phone }, select: { id: true, email: true } });
  if (existing) {
    if (data.email && !existing.email) {
      await prisma.customer.update({ where: { id: existing.id }, data: { email: data.email } });
    }
    return { id: existing.id };
  }
  return prisma.customer.create({
    data: { name: data.name, phone: data.phone, email: data.email },
    select: { id: true },
  });
}
