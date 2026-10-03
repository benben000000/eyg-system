/**
 * POST /api/quote/estimate — the server-side estimator.
 * ============================================================================
 *   200 → ApiResult<QuoteEstimateDto & { promoStatus, promoTitle }>
 *   400 → VALIDATION_ERROR (bad selection, or a service that is no longer offered)
 *   429 → RATE_LIMITED (public tier; this is a cheap, unauthenticated calculation)
 *
 * The homepage and services pages already compute an estimate client-side
 * (`src/components/widgets/internal/quote-engine.ts`) so a number is never
 * missing. This endpoint exists for the paths that must trust the *server's*
 * catalogue — the admin quote builder, a future SMS deep link, and QA.
 *
 * Unlike `POST /api/quote` there is NO captcha and NO honeypot here: nothing is
 * written, nothing personal is taken, and the answer is already public on the
 * services page. The rate limit is the public tier, which is generous.
 *
 * `/book` deep-link contract (also produced client-side):
 *   /book?service=<slug>&service=<slug>&package=<slug>&promo=<CODE>&engine=<e>
 * `service` repeats; `/book` reads them in order (`parseServiceParam`).
 */
import type { NextRequest } from "next/server";

import { ok, parseBody, withApi, type MetaInput } from "@/lib/http";
import { publicLimiter, rateLimit } from "@/lib/ratelimit";
import { requestContext } from "@/lib/request";
import { estimateWithNextStep } from "@/lib/server/quote";
import { quoteEstimateSchema } from "@/lib/server/validation/quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const ctx = requestContext(req);
  const meta: MetaInput = { requestId: ctx.requestId };

  return withApi<Awaited<ReturnType<typeof estimateWithNextStep>>>(meta, async () => {
    await rateLimit({ action: "quote.estimate", ip: ctx.ip, policy: publicLimiter, requestId: ctx.requestId });

    const body = await parseBody(req, quoteEstimateSchema);

    const estimate = await estimateWithNextStep({
      serviceIds: body.serviceIds,
      ...(body.packageId ? { packageId: body.packageId } : {}),
      ...(body.promoCode ? { promoCode: body.promoCode } : {}),
      ...(body.tyreCount !== undefined ? { tyreCount: body.tyreCount } : {}),
      engine: body.engine,
    });

    // A price band is not personal data, but it is not static either. A short
    // shared cache keeps the estimator cheap; `private` would force a re-fetch
    // for every keystroke, which is what the client-side engine avoids.
    return ok(estimate, meta, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  });
}
