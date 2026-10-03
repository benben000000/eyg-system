/**
 * BOT PROTECTION — arithmetic challenge, honeypot, min-time-to-submit.
 * ============================================================================
 * Three independent, cheap layers. All three are required on every public
 * write endpoint; none of them can be bypassed by "configuring them off" at the
 * route level (only `CAPTCHA_ENABLED=false` in env disables the math step, and
 * the honeypot + timing checks still run).
 *
 * 1. **Arithmetic challenge** (`CAPTCHA_ENABLED`, `CAPTCHA_TTL_SECONDS`)
 *    `GET /api/captcha` → `{ question, token }`.
 *    The token is an HMAC-signed, expiring, **single-use** value whose payload
 *    carries a *server-side nonce*. The answer is NEVER in the token — it lives
 *    in a short-lived server-side record keyed by the nonce. So the client
 *    receives a signed question and cannot reverse it, cannot compute the answer
 *    offline, cannot batch answers for many challenges, and cannot replay a
 *    token after using it once.
 *
 * 2. **Honeypot** (`website`) — a field that is `display:none`d and
 *    `aria-hidden`, `tabindex="-1"`, `autocomplete="off"`. Humans never fill it.
 *
 * 3. **Minimum time to submit** (~2 s) — a human cannot render the page, read a
 *    label and submit in under two seconds. The form stamps
 *    `x-form-rendered-at`; a missing stamp is NOT punished (it would break
 *    privacy-hardened browsers and bookmarklet posts), only a stamp that is too
 *    fast, or a stamp from the future, is rejected.
 *
 * If `TURNSTILE_SECRET_KEY` is set, Cloudflare Turnstile takes priority.
 */
import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { ApiError, captchaFailed, spamRejected } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Challenges expire fast; the map is bounded so an attacker cannot grow it. */
const MAX_TRACKED_CHALLENGES = 20_000;
const CHALLENGE_SWEEP_MS = 5 * 60_000;

/**
 * In-memory challenge store. Deliberately process-local: a challenge is only
 * ever issued and redeemed on the same instance in the common (single-region,
 * sticky) deployment, and if it is not, the customer simply asks for a new
 * question. A Redis-backed store would be needed only for a multi-region
 * active/active deploy — documented in the report as a known seam.
 */
interface Challenge {
  nonce: string;
  answer: number;
  expiresAt: number;
  issuedAt: number;
  used: boolean;
}

const challenges = new Map<string, Challenge>();
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < CHALLENGE_SWEEP_MS) return;
  lastSweep = now;
  for (const [nonce, c] of challenges) {
    if (c.expiresAt < now) challenges.delete(nonce);
  }
  // Hard cap: drop oldest issuance first.
  if (challenges.size > MAX_TRACKED_CHALLENGES) {
    const excess = challenges.size - MAX_TRACKED_CHALLENGES;
    let removed = 0;
    for (const nonce of challenges.keys()) {
      challenges.delete(nonce);
      removed += 1;
      if (removed >= excess) break;
    }
  }
}

export interface CaptchaChallenge {
  /** Human-readable arithmetic prompt, e.g. "What is 7 + 5?" */
  question: string;
  /** Signed, expiring, single-use redemption token. */
  token: string;
  /** Seconds the client has to answer. */
  expiresIn: number;
}

/** Provider actually in force. The UI reads this to render the right widget. */
export function captchaProvider(): "turnstile" | "math" | "disabled" {
  if (env.captcha.turnstileSecretKey) return "turnstile";
  return env.captcha.enabled ? "math" : "disabled";
}

function sign(payload: string): string {
  return createHmac("sha256", env.authSecret).update(payload).digest("base64url");
}

/**
 * Operands stay two-digit where possible. Small single-digit answers collide
 * with digits that necessarily appear in the base64url nonce and signature, and
 * "the answer must not be smuggled in the token" is much easier to *prove* when
 * the answer is a two-digit number that base64 output is unlikely to contain.
 */
function operand(): number {
  const bytes = randomBytes(1);
  return 10 + ((bytes[0] as number) % 40); // 10–49
}

export function issueCaptchaChallenge(): CaptchaChallenge {
  const now = Date.now();
  sweep(now);

  const a = operand();
  const b = operand();
  // ~50/50 add or subtract, but subtraction is always a-b >= 1 so the answer
  // is never negative (a negative answer confuses humans and screen readers).
  const coinFlip = randomBytes(1)[0] as number;
  const subtract = coinFlip % 2 === 0 && a > b;
  const question = subtract ? `What is ${a} − ${b}?` : `What is ${a} + ${b}?`;
  const answer = subtract ? a - b : a + b;

  const nonce = randomBytes(18).toString("base64url");
  const expiresAt = now + env.captcha.ttlSeconds * 1000;
  challenges.set(nonce, { nonce, answer, expiresAt, issuedAt: now, used: false });

  const payload = `${nonce}.${expiresAt}`;
  return { question, token: `${payload}.${sign(payload)}`, expiresIn: env.captcha.ttlSeconds };
}

export interface CaptchaVerifyInput {
  token?: string | undefined;
  answer?: number | undefined;
  /** Form render time in epoch ms (from `x-form-rendered-at`). */
  renderedAt?: number | null;
  /** Honeypot field. Must be empty. */
  website?: string | undefined;
  /** Turnstile response, when the provider is Turnstile. */
  turnstileToken?: string | undefined;
  requestId?: string;
}

export interface CaptchaVerifyResult {
  /** Surfaced as machine-readable detail so the UI can explain itself. */
  provider: "turnstile" | "math" | "disabled";
  /** True when the honeypot or timing check rejected the submission. */
  spamSignal: boolean;
}

/** Constant-time compare that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so timing does not leak the length difference.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function verifyMath(token: string, answer: number, now: number): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expiresRaw, signature] = parts as [string, string, string];
  if (!nonce || !expiresRaw || !signature) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt)) return false;
  if (!safeEqual(signature, sign(`${nonce}.${expiresRaw}`))) return false;
  if (expiresAt < now) return false;

  const challenge = challenges.get(nonce);
  if (!challenge) return false;
  // Single use: burn the nonce whether or not the answer was right, so a wrong
  // answer cannot be brute-forced against the same token.
  challenges.delete(nonce);
  if (challenge.used || challenge.expiresAt < now) return false;

  return challenge.answer === answer;
}

async function verifyTurnstile(token: string | undefined, ip: string, requestId?: string): Promise<boolean> {
  if (!token) return false;
  const secret = env.captcha.turnstileSecretKey as string;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip === "0.0.0.0" ? undefined : ip }),
      cache: "no-store",
    });
    if (!res.ok) {
      logger.warn("captcha.turnstile_unavailable", { requestId, scope: "captcha", status: res.status });
      return false;
    }
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    logger.error("captcha.turnstile_failed", {
      requestId,
      scope: "captcha",
      err: err instanceof Error ? err.name : typeof err,
    });
    // Fail closed: if the verifier is unreachable we must not wave the request in.
    return false;
  }
}

/** Humans need at least this long between seeing the form and submitting. */
export const MIN_SUBMIT_SECONDS = 2;
/** Tolerance for a client clock that is slightly ahead/behind the server. */
const CLOCK_SKEW_TOLERANCE_MS = 60_000;

/**
 * Runs all three layers. Throws `ApiError("SPAM_REJECTED")` for the honeypot /
 * timing checks and `ApiError("CAPTCHA_FAILED")` for the challenge.
 *
 * When `CAPTCHA_ENABLED=false` the math step is skipped but the honeypot and
 * timing checks still apply.
 */
export async function verifyCaptcha(input: CaptchaVerifyInput, ip: string): Promise<CaptchaVerifyResult> {
  const provider = captchaProvider();

  // ── Layer 1: honeypot ────────────────────────────────────────────────────
  // ANY content at all is a rejection, including whitespace: a real browser
  // never puts a single character in a hidden field, so a lone space is just as
  // much a bot as a URL.
  if (typeof input.website === "string" && input.website.length > 0) {
    logger.warn("captcha.honeypot", { requestId: input.requestId, scope: "captcha", provider });
    throw spamRejected();
  }

  // ── Layer 2: minimum time to submit ─────────────────────────────────────
  if (typeof input.renderedAt === "number" && Number.isFinite(input.renderedAt)) {
    const elapsed = Date.now() - input.renderedAt;
    if (elapsed < MIN_SUBMIT_SECONDS * 1000) {
      logger.warn("captcha.too_fast", { requestId: input.requestId, scope: "captcha", elapsedMs: elapsed });
      throw spamRejected("That was submitted unusually fast. Please try again.");
    }
    // A stamp far in the future means a spoofed header or a wildly wrong clock.
    if (elapsed < -CLOCK_SKEW_TOLERANCE_MS) {
      logger.warn("captcha.future_stamp", { requestId: input.requestId, scope: "captcha", elapsedMs: elapsed });
      throw spamRejected("That was submitted unusually fast. Please try again.");
    }
  }

  // ── Layer 3: the challenge itself ───────────────────────────────────────
  if (provider === "disabled") return { provider, spamSignal: false };

  if (provider === "turnstile") {
    const ok = await verifyTurnstile(input.turnstileToken, ip, input.requestId);
    if (!ok) throw captchaFailed("Please complete the security check.");
    return { provider, spamSignal: false };
  }

  const token = input.token;
  const answer = input.answer;
  if (!token || typeof answer !== "number" || !Number.isInteger(answer)) {
    throw captchaFailed();
  }
  if (!verifyMath(token, answer, Date.now())) {
    throw captchaFailed();
  }
  return { provider, spamSignal: false };
}

/** Test helper — clears issued challenges between cases. */
export function resetCaptchaChallenges(): void {
  challenges.clear();
  lastSweep = 0;
}

export { ApiError };
