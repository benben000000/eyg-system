/**
 * WEBHOOK SIGNATURE VERIFICATION
 * ============================================================================
 * One rule governs this file: **the signature is computed over the raw bytes
 * the provider sent.** `request.json()` re-serialises, reorders keys, drops
 * duplicate keys and normalises unicode — a signature computed over a parsed
 * body will mismatch roughly half the time, and a "fix" is to disable
 * verification. So every receiver reads `await req.text()` first and hands that
 * string here.
 *
 * Algorithms implemented:
 *   - Twilio   — HMAC-SHA1, base64, over `url + sortedConcatenatedParams`
 *   - Resend   — Svix scheme: HMAC-SHA256, base64, over
 *                `${svix_id}.${svix_timestamp}.${rawBody}`, secret is
 *                `whsec_…` base64-decoded
 *   - Generic  — HMAC-SHA256 over the raw body, hex or base64 digest
 *                (WhatsApp via `verifyWhatsAppSignature` in `./whatsapp.ts`)
 *
 * Every comparison is constant-time. Every failure returns a *_reason* and a
 * generic message; the _reason is logged, the client gets a 401 with nothing
 * useful in it.
 *
 * @see docs/ops/INTEGRATIONS.md § Webhooks
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { log } from "@/lib/logger";
import { webhookConfig } from "./env";

const logger = log.child({ scope: "integrations/webhook-verify" });

export type VerifyFailure =
  | "no-secret"
  | "missing-header"
  | "malformed-header"
  | "mismatch"
  | "expired"
  | "skew";

export interface VerifyResult {
  ok: boolean;
  /** Machine-readable failure cause. Never surfaced to the client. */
  reason: VerifyFailure | "verified";
  /** Provider event/message id, when the header carried one. */
  eventId: string | null;
  /** Provider event type, when the header carried one. */
  eventType: string | null;
}

const OK: VerifyResult = { ok: true, reason: "verified", eventId: null, eventType: null };
const fail = (reason: VerifyFailure, eventId: string | null = null, eventType: string | null = null): VerifyResult => ({
  ok: false,
  reason,
  eventId,
  eventType,
});

/** Constant-time compare that never throws on a length mismatch. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Burn a comparison so the timing profile stays flat regardless of length.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

const _b64 = (input: string): string => Buffer.from(input, "utf8").toString("base64");

// ── Twilio ───────────────────────────────────────────────────────────────────

/**
 * Twilio's `X-Twilio-Signature`: base64(HMAC-SHA1(authToken, url + params)),
 * where `params` are the POST fields sorted by key and concatenated as
 * `key + value` with no separator.
 *
 * The URL is the *exact* URL Twilio posted to, including query string. Getting
 * it wrong (protocol, host, trailing slash) produces a mismatch that looks
 * like a forgery, so `resolvePublicUrl` below rebuilds it from the deployment's
 * own `NEXT_PUBLIC_SITE_URL` rather than trusting a `Host` header.
 */
export function verifyTwilioSignature(args: {
  authToken: string | null;
  signature: string | null;
  url: string;
  params: URLSearchParams;
}): VerifyResult {
  if (!args.authToken) {
    logger.error("webhook.twilio.no_secret", { action: "rejecting as unverifiable" });
    return fail("no-secret");
  }
  if (!args.signature || args.signature.trim().length === 0) return fail("missing-header");

  const keys = [...args.params.keys()].sort();
  const concatenated = keys.map((k) => `${k}${args.params.get(k) ?? ""}`).join("");
  const payload = `${args.url}${concatenated}`;
  const expected = createHmac("sha1", args.authToken).update(payload, "utf8").digest("base64");

  if (!constantTimeEqual(expected, args.signature.trim())) {
    logger.warn("webhook.twilio.mismatch", { paramCount: keys.length });
    return fail("mismatch");
  }
  return OK;
}

/**
 * Twilio signs against the public URL it was configured with. Behind a proxy the
 * incoming host header is not trustworthy, so we rebuild from
 * `TWILIO_WEBHOOK_BASE_URL` (preferred) or `NEXT_PUBLIC_SITE_URL`.
 */
export function resolvePublicUrl(path: string, incomingUrl: string): string {
  const configured = process.env["TWILIO_WEBHOOK_BASE_URL"];
  const base = configured ?? process.env["NEXT_PUBLIC_SITE_URL"];
  if (base) return new URL(path, base.replace(/\/+$/, "")).toString();
  try {
    const parsed = new URL(incomingUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return incomingUrl;
  }
}

// ── Resend (Svix scheme) ─────────────────────────────────────────────────────

/** Resend/Svix reject a timestamp older than five minutes to stop replays. */
export const RESEND_TOLERANCE_SECONDS = 300;

/**
 * `sv1,<base64url or base64 signature>` where the signed content is
 * `${svix_id}.${svix_timestamp}.${rawBody}` and the key is the base64-decoded
 * `whsec_…` secret.
 */
export function verifyResendSignature(args: {
  secret: string | null;
  signature: string | null;
  svixId: string | null;
  svixTimestamp: string | null;
  rawBody: string;
  nowSeconds?: number;
}): VerifyResult {
  if (!args.secret) {
    logger.error("webhook.resend.no_secret", { action: "rejecting as unverifiable" });
    return fail("no-secret");
  }
  if (!args.svixId || !args.svixTimestamp) return fail("missing-header", args.svixId);
  if (!args.signature || args.signature.trim().length === 0) return fail("missing-header", args.svixId);

  const timestamp = Number(args.svixTimestamp);
  if (!Number.isFinite(timestamp)) return fail("malformed-header", args.svixId);

  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > RESEND_TOLERANCE_SECONDS) {
    logger.warn("webhook.resend.stale_timestamp", { skewSeconds: Math.abs(now - timestamp) });
    return fail("expired", args.svixId);
  }

  // Multiple signatures can be present during a secret rotation; any one may
  // match, and all of them are compared (so a rotation window stays open
  // without opening a forgery window).
  const candidates = args.signature
    .split(" ")
    .map((part) => part.split(",").find((p) => p.startsWith("v1,"))?.slice(3) ?? "")
    .filter((v) => v.length > 0);
  if (candidates.length === 0) return fail("malformed-header", args.svixId);

  const key = decodeSecret(args.secret);
  const expected = createHmac("sha256", key)
    .update(`${args.svixId}.${args.svixTimestamp}.${args.rawBody}`, "utf8")
    .digest("base64");

  for (const candidate of candidates) {
    if (constantTimeEqual(expected, candidate) || constantTimeEqual(expected, Buffer.from(candidate, "base64").toString("base64"))) {
      return OK;
    }
  }
  logger.warn("webhook.resend.mismatch", { candidates: candidates.length });
  return fail("mismatch", args.svixId);
}

/** `whsec_<base64>` → raw key. A non-prefixed secret is used as UTF-8 bytes. */
export function decodeSecret(secret: string): Buffer {
  const trimmed = secret.trim();
  if (trimmed.startsWith("whsec_")) {
    const b64part = trimmed.slice(6);
    const decoded = Buffer.from(b64part, "base64");
    if (decoded.length > 0) return decoded;
  }
  return Buffer.from(trimmed, "utf8");
}

// ── Generic HMAC ─────────────────────────────────────────────────────────────

/**
 * HMAC-SHA256 over the raw body, accepting either a hex or a base64 digest.
 * Used for any provider that does not match the Twilio or Svix scheme, and by
 * the tests as a reference implementation.
 */
export function verifyHmacSha256(args: {
  secret: string | null;
  signature: string | null;
  rawBody: string;
  /** Prefix to strip, e.g. `sha256=`. */
  prefix?: string;
}): VerifyResult {
  if (!args.secret) {
    logger.error("webhook.hmac.no_secret", { action: "rejecting as unverifiable" });
    return fail("no-secret");
  }
  if (!args.signature || args.signature.trim().length === 0) return fail("missing-header");

  const provided = args.signature.trim().replace(args.prefix ?? "", "").trim();
  if (provided.length === 0) return fail("malformed-header");

  const key = args.secret.startsWith("whsec_") ? decodeSecret(args.secret) : Buffer.from(args.secret, "utf8");
  const hex = createHmac("sha256", key).update(args.rawBody, "utf8").digest("hex");
  const b64Digest = createHmac("sha256", key).update(args.rawBody, "utf8").digest("base64");

  if (constantTimeEqual(hex, provided.toLowerCase()) || constantTimeEqual(b64Digest, provided)) return OK;
  return fail("mismatch");
}

// ── Unified entry point ──────────────────────────────────────────────────────

/**
 * Verifies a request against the shared `WEBHOOK_SIGNING_SECRET`. Used by
 * providers that simply sign the raw body with one shared secret. A per-provider
 * secret wins when present, so this never fights a dedicated implementation.
 */
export function verifySharedSecret(args: { rawBody: string; signature: string | null }): VerifyResult {
  const shared = webhookConfig().signingSecret;
  if (!shared) {
    logger.error("webhook.shared.no_secret", { action: "rejecting as unverifiable" });
    return fail("no-secret");
  }
  return verifyHmacSha256({ secret: shared, signature: args.signature, rawBody: args.rawBody });
}

/** Generic 401 body. Reveals nothing about which check failed. */
export function signatureRejection(_reason: VerifyFailure): { status: 401; body: { ok: false; error: { code: "UNAUTHENTICATED"; message: string } } } {
  return {
    status: 401,
    body: { ok: false, error: { code: "UNAUTHENTICATED", message: "Signature verification failed." } },
  };
}

/** Helper for receivers: read a header case-insensitively. */
export function header(req: Request, name: string): string | null {
  return req.headers.get(name) ?? req.headers.get(name.toLowerCase());
}
