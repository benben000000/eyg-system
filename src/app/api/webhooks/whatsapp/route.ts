/**
 * POST /api/webhooks/whatsapp — STATUS CALLBACKS + SUBSCRIPTION HANDSHAKE
 * ============================================================================
 * Two responsibilities on one URL, which is what Meta expects.
 *
 * `GET`  → the `hub.verify` subscription challenge. Echoes `hub.challenge` back
 *          as plain text **only** when `hub.verify_token` matches
 *          `WHATSAPP_VERIFY_TOKEN` in constant time.
 * `POST` → `X-Hub-Signature-256` is verified as HMAC-SHA256 over the **raw**
 *          body, then delivery statuses are applied to the `Notification` row
 *          keyed on the `wamid`.
 *
 * FAIL-CLOSED ON A MISSING SECRET
 * -------------------------------
 * With no `WHATSAPP_VERIFY_TOKEN` the POST receiver rejects everything. That is
 * deliberate: an unverified public webhook is a forgery oracle, and the
 * WhatsApp integration is entirely optional — refusing is correct.
 *
 * INBOUND CUSTOMER MESSAGES
 * -------------------------
 * A customer texting the shop's number is the single highest-value event in this
 * whole system (a stranded driver). They are logged and counted, and the shop is
 * pointed at the leads board; turning a reply into an automatic `Lead` row is
 * deliberately left as an owner decision, because an unauthenticated stranger's
 * message must not be able to create rows in the business's books.
 *
 * @see docs/ops/INTEGRATIONS.md § WhatsApp
 */

import { contextFrom, guard, readBody } from "@/lib/integrations/api";
import { claimWebhookEvent } from "@/lib/integrations/idempotency";
import { applyProviderStatus } from "@/lib/integrations/notification-ledger";
import {
  evaluateVerificationChallenge,
  mapStatusToNotification,
  parseVerificationChallenge,
  parseWebhookEvents,
  verifyWhatsAppSignature,
} from "@/lib/integrations/whatsapp";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/webhooks/whatsapp" });

const ACK = () =>
  new Response(null, { status: 200, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

const REJECT = () =>
  new Response(JSON.stringify({ ok: false, error: { code: "UNAUTHENTICATED", message: "Signature verification failed." } }), {
    status: 401,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

/**
 * `GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`
 *
 * Returns the challenge as `text/plain` on success, and a bare 403 on any
 * mismatch. The response body is exactly the challenge string, nothing else —
 * that is the contract Meta implements against.
 */
export async function GET(req: Request): Promise<Response> {
  const parsed = parseVerificationChallenge(req.url);
  const result = evaluateVerificationChallenge(parsed);

  if (result.reason !== "ok" || result.challenge === null) {
    logger.warn("whatsapp.challenge_rejected", { reason: result.reason });
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  logger.info("whatsapp.challenge_accepted");
  return new Response(result.challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const { denied } = await guard(req, "webhook.whatsapp", "webhook");
  if (denied) return denied;

  const ctx = contextFrom(req);

  let raw: string;
  try {
    raw = (await readBody(req, 64 * 1024)).raw;
  } catch (error) {
    logger.warn("whatsapp.unreadable_body", {}, { err: error });
    return REJECT();
  }

  const verdict = verifyWhatsAppSignature(raw, req.headers.get("x-hub-signature-256"));
  if (!verdict.ok) {
    logger.warn("whatsapp.rejected", { reason: verdict.reason, requestId: ctx.requestId });
    return REJECT();
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    logger.warn("whatsapp.invalid_json_after_verify");
    return ACK();
  }

  const events = parseWebhookEvents(body);
  if (events.length === 0) {
    logger.debug("whatsapp.no_events");
    return ACK();
  }

  let applied = 0;
  let duplicates = 0;
  let inbound = 0;

  for (const event of events) {
    if (event.kind === "text" || event.kind === "other") {
      // An inbound customer message. Counted and logged, never auto-persisted.
      inbound += 1;
      logger.info("whatsapp.inbound_message", {
        kind: event.kind,
        hasText: event.text !== null,
        hasMedia: event.kind === "other",
        // No phone number: it is the customer's, and this log is shipped.
        requestId: ctx.requestId,
      });
      continue;
    }

    const mapped = mapStatusToNotification(event.status);
    if (!event.id || !mapped) {
      logger.debug("whatsapp.status_ignored", { status: event.status ?? "unknown" });
      continue;
    }

    const claim = await claimWebhookEvent("whatsapp", `${event.id}:${event.status ?? "unknown"}`);
    if (claim.state === "duplicate") {
      duplicates += 1;
      continue;
    }

    const result = await applyProviderStatus(event.id, mapped, event.errorCode ? `whatsapp:${event.errorCode}` : null, "whatsapp");
    if (result.updated) applied += 1;
  }

  logger.info("whatsapp.processed", { events: events.length, applied, duplicates, inbound, requestId: ctx.requestId });
  return ACK();
}
