/**
 * POST /api/webhooks/twilio — SMS DELIVERY STATUS CALLBACKS
 * ============================================================================
 * Twilio posts `application/x-www-form-urlencoded` delivery receipts here. The
 * only job is to move the matching `Notification` row from `sent` to
 * `delivered` or `failed` so the shop can answer "did they get it?".
 *
 * THE THREE RULES OF A WEBHOOK RECEIVER
 * -------------------------------------
 * 1. **Verify over the RAW body.** `X-Twilio-Signature` is
 *    base64(HMAC-SHA1(authToken, url + sortedParams)). A re-serialised body
 *    produces a different string, so this route reads `await req.text()` and
 *    parses from that. `verifyTwilioSignature` is given both the raw text and
 *    the `URLSearchParams` derived from it.
 * 2. **Return 200 fast, then do the work inline.** Twilio retries anything that
 *    is not a 2xx within its retry window, and a slow handler means duplicate
 *    receipts. The database write here is a single indexed `update`.
 * 3. **Be idempotent.** Every event is deduped on `SmsSid` through the
 *    idempotency ledger, and the status update is an `update` on one row — so a
 *    provider retry cannot double-apply.
 *
 * URL NOTE: Twilio signs the URL it was configured with. Behind a proxy the
 * inbound host is untrustworthy, so `resolvePublicUrl()` rebuilds the URL from
 * `TWILIO_WEBHOOK_BASE_URL` (preferred) or `NEXT_PUBLIC_SITE_URL`. Getting this
 * wrong looks exactly like a forgery; it is logged distinctly.
 *
 * @see docs/ops/INTEGRATIONS.md § Webhooks — Twilio
 */

import { contextFrom, guard, readBody } from "@/lib/integrations/api";
import { smsConfig } from "@/lib/integrations/env";
import { claimWebhookEvent } from "@/lib/integrations/idempotency";
import { applyProviderStatus } from "@/lib/integrations/notification-ledger";
import { resolvePublicUrl, verifyTwilioSignature } from "@/lib/integrations/webhook-verify";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/webhooks/twilio" });

/** Twilio's status vocabulary, mapped onto our `Notification.status`. */
const STATUS_MAP: Readonly<Record<string, "delivered" | "failed" | "sent">> = {
  queued: "sent",
  sending: "sent",
  sent: "sent",
  delivered: "delivered",
  read: "delivered",
  undelivered: "failed",
  failed: "failed",
  canceled: "failed",
};

/** 200 with an empty body. Twilio does not read the response, and empty is cheapest. */
const ACK = () =>
  new Response(null, { status: 200, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

const REJECT = () =>
  new Response(JSON.stringify({ ok: false, error: { code: "UNAUTHENTICATED", message: "Signature verification failed." } }), {
    status: 401,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export async function POST(req: Request): Promise<Response> {
  // A provider callback has no customer IP to rate-limit on and must never be
  // rejected for volume, so this is a generous open tier.
  const { denied } = await guard(req, "webhook.twilio", "webhook");
  if (denied) return denied;

  const cfg = smsConfig();
  const ctx = contextFrom(req);

  let form: URLSearchParams;
  try {
    const body = await readBody(req, 32 * 1024);
    form = body.form;
  } catch (error) {
    logger.warn("twilio.unreadable_body", {}, { err: error });
    return REJECT();
  }

  const signature = req.headers.get("x-twilio-signature");
  const url = resolvePublicUrl("/api/webhooks/twilio", req.url);
  const verdict = verifyTwilioSignature({ authToken: cfg.authToken ?? null, signature, url, params: form });

  if (!verdict.ok) {
    logger.warn("twilio.rejected", { reason: verdict.reason, url, params: form.size });
    return REJECT();
  }

  // ── Verified. Do the minimum, then 200. ─────────────────────────────────
  const messageSid = form.get("MessageSid");
  const messageStatus = (form.get("MessageStatus") ?? "").toLowerCase();
  const errorCode = form.get("ErrorCode");

  if (!messageSid || !messageStatus) {
    // A verified but unrecognised event (e.g. a future Twilio field). Ack it.
    logger.info("twilio.unhandled_event", { hasSid: Boolean(messageSid), status: messageStatus || "none" });
    return ACK();
  }

  const mapped = STATUS_MAP[messageStatus];
  if (!mapped) {
    logger.info("twilio.unknown_status", { status: messageStatus });
    return ACK();
  }

  // Dedupe on the provider's own message id. A provider retry returns `duplicate`
  // and we ack without re-applying — the update is idempotent anyway, and the
  // ledger keeps the log honest.
  const claim = await claimWebhookEvent("twilio", `${messageSid}:${messageStatus}`);
  if (claim.state === "duplicate") {
    logger.debug("twilio.duplicate_event", { status: messageStatus });
    return ACK();
  }

  const applied = await applyProviderStatus(
    messageSid,
    mapped,
    errorCode ? `twilio:${errorCode}` : null,
    "sms",
  );

  logger.info("twilio.status_applied", {
    status: messageStatus,
    mapped,
    updated: applied.updated,
    // ErrorCode is a Twilio code, not customer data.
    errorCode: errorCode ?? undefined,
    requestId: ctx.requestId,
  });

  return ACK();
}

/** A `GET` here is someone poking at the URL. Nothing to do. */
export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true, data: { endpoint: "twilio-status-callback", accepts: "POST" } }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
