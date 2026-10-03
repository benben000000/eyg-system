/**
 * GET /api/booking/challenge — per-booking arithmetic challenge.
 * ============================================================================
 *   200 → ApiResult<{ provider, question, token, expiresIn }>
 *   429 → RATE_LIMITED
 *
 * Identical payload to `GET /api/captcha`; `src/lib/types.ts` documents the
 * `captchaAnswer` on `CreateBookingInput` as coming from here. Both endpoints
 * share one engine, so a token obtained from either is valid on any public form.
 * This route simply lets the booking wizard fetch a challenge lazily, when the
 * customer reaches the confirm step, instead of on page load.
 */
import type { NextRequest } from "next/server";

import { ok, withApi, type MetaInput } from "@/lib/http";
import { captchaProvider, issueCaptchaChallenge } from "@/lib/captcha";
import { publicLimiter, rateLimit } from "@/lib/ratelimit";
import { requestContext } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface BookingChallengeDto {
  provider: "turnstile" | "math" | "disabled";
  question: string;
  token: string;
  expiresIn: number;
  /** The exact body keys `POST /api/booking` expects back. */
  submitAs: { captchaToken: string; captchaAnswer: number };
}

export async function GET(req: NextRequest): Promise<Response> {
  const ctx = requestContext(req);
  const meta: MetaInput = { requestId: ctx.requestId };

  return withApi<BookingChallengeDto>(meta, async () => {
    await rateLimit({ action: "booking.challenge", ip: ctx.ip, policy: publicLimiter, requestId: ctx.requestId });

    const provider = captchaProvider();
    if (provider !== "math") {
      return ok({ provider, question: "", token: "", expiresIn: 0, submitAs: { captchaToken: "", captchaAnswer: 0 } }, meta, {
        private: true,
      });
    }

    const challenge = issueCaptchaChallenge();
    return ok(
      {
        provider,
        question: challenge.question,
        token: challenge.token,
        expiresIn: challenge.expiresIn,
        submitAs: { captchaToken: challenge.token, captchaAnswer: 0 },
      },
      meta,
      { private: true },
    );
  });
}
