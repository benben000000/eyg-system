/**
 * GET /api/captcha — issues one arithmetic challenge.
 * ============================================================================
 *   200 → ApiResult<{ provider, question, token, expiresIn }>
 *   429 → RATE_LIMITED
 *
 * The token is an HMAC-signed, expiring, single-use redemption ticket. The
 * ANSWER IS NOT IN THE TOKEN — it lives in a short-lived server-side record
 * bound to the nonce inside the token. So the client cannot:
 *   - read the answer out of the response,
 *   - solve challenges offline in bulk,
 *   - replay a token after using it.
 *
 * `GET /api/booking/challenge` returns the same shape; it exists because
 * `types.ts` documents `captchaAnswer` as coming from that path. Both call the
 * same engine, so a token from either works on any public form.
 */
import type { NextRequest } from "next/server";

import { ok, withApi, type MetaInput } from "@/lib/http";
import { captchaProvider, issueCaptchaChallenge } from "@/lib/captcha";
import { publicLimiter, rateLimit } from "@/lib/ratelimit";
import { requestContext } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface CaptchaChallengeDto {
  /** `turnstile` | `math` | `disabled`. The UI renders accordingly. */
  provider: "turnstile" | "math" | "disabled";
  /** Human prompt. Empty when `provider` is not `math`. */
  question: string;
  token: string;
  /** Seconds the customer has to answer. */
  expiresIn: number;
  /** Public site key, present only for the Turnstile provider. */
  siteKey?: string;
}

export async function GET(req: NextRequest): Promise<Response> {
  const ctx = requestContext(req);
  const meta: MetaInput = { requestId: ctx.requestId };

  return withApi<CaptchaChallengeDto>(meta, async () => {
    // Public tier, not the login tier: this is a legitimate first interaction
    // for every anonymous visitor, so it must be generous.
    await rateLimit({ action: "captcha.issue", ip: ctx.ip, policy: publicLimiter, requestId: ctx.requestId });

    const provider = captchaProvider();
    if (provider !== "math") {
      // Nothing to solve: tell the client which widget to render instead of
      // returning an empty challenge it would then have to special-case.
      const dto: CaptchaChallengeDto = { provider, question: "", token: "", expiresIn: 0 };
      return ok(dto, meta, { private: true });
    }

    const challenge = issueCaptchaChallenge();
    const dto: CaptchaChallengeDto = {
      provider,
      question: challenge.question,
      token: challenge.token,
      expiresIn: challenge.expiresIn,
    };
    // A challenge token must never be cached by a CDN or the browser.
    return ok(dto, meta, { private: true });
  });
}
