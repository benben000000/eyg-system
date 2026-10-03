/**
 * POST /api/webhooks/resend — EMAIL DELIVERY, BOUNCE AND COMPLAINT EVENTS
 * ============================================================================
 * Resend (via Svix) signs each event and posts JSON. Three events matter:
 *
 *   email.delivered -> `Notification.status = "delivered"`
 *   email.bounced    -> `"failed"` **and suppress the address**
 *   email.complained -> `"failed"` **and suppress the address**
 *
 * SUPPRESSION — THE PART THAT ACTUALLY MATTERS
 * --------------------------------------------
 * A hard bounce or a spam complaint means the address is undeliverable or the
 * recipient considers us junk. Continuing to send to it destroys the sending
 * domain's reputation, and one complaint can cost the shop its ability to email
 * a booking confirmation at all. So both events run `suppressSubscriber()`:
 *
 *   Subscriber.isActive        -> false
 *   Subscriber.unsubscribedAt  -> now
 *   AuditLog                   -> the reason, forever
 *
 * `Subscriber` has no "reason" column and `prisma/schema.prisma` is
 * orchestrator-owned, so the reason is recorded in `AuditLog` with
 * `action: "subscriber.suppressed"`. This is the single most important
 * write on the route.
 *
 * ONE-DIRECTIONAL GUARANTEE
 * ------------------------
 * `suppressSubscriber()` never re-activates an address. `sendEmail`'s
 * `upsertSubscriber()` also refuses to resurrect one. A complaint is permanent
 * for that address; unsubscribing by hand is the only way back.
 *
 * All three events are deduped on the Svix event id, so a provider retry cannot
 * double-apply (or, worse, resurrect).
 *
 * @see docs/ops/INTEGRATIONS.md § Webhooks — Resend
 */

import { contextFrom, guard, readBody } from "@/lib/integrations/api";
import { webhookConfig } from "@/lib/integrations/env";
import { claimWebhookEvent } from "@/lib/integrations/idempotency";
import { applyProviderStatus, findNotificationByProviderId } from "@/lib/integrations/notification-ledger";
import { verifyResendSignature } from "@/lib/integrations/webhook-verify";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/webhooks/resend" });

const ACK = () =>
  new Response(null, { status: 200, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

const REJECT = () =>
  new Response(JSON.stringify({ ok: false, error: { code: "UNAUTHENTICATED", message: "Signature verification failed." } }), {
    status: 401,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

interface ResendEvent {
  type?: string;
  created?: string;
  data?: {
    email_id?: string;
    to?: string[];
    from?: string;
    subject?: string;
    /** Present on `email.bounced`. */
    bounce?: { message?: string; type?: string };
    /** Present on `email.complained`. */
    complaint?: { message?: string };
  };
}

/** Events we act on. Anything else is acknowledged and ignored. */
const HANDLED = new Set(["email.delivered", "email.bounced", "email.complained"]);

export async function POST(req: Request): Promise<Response> {
  const { denied } = await guard(req, "webhook.resend", "webhook");
  if (denied) return denied;

  const ctx = contextFrom(req);

  // ── 1. Raw body, then signature. In that order. Always. ─────────────────
  let raw: string;
  try {
    raw = (await readBody(req, 64 * 1024)).raw;
  } catch (error) {
    logger.warn("resend.unreadable_body", {}, { err: error });
    return REJECT();
  }

  const secret = resendSecret();
  const verdict = verifyResendSignature({
    secret,
    signature: req.headers.get("svix-signature"),
    svixId: req.headers.get("svix-id"),
    svixTimestamp: req.headers.get("svix-timestamp"),
    rawBody: raw,
  });

  if (!verdict.ok) {
    logger.warn("resend.rejected", { reason: verdict.reason });
    return REJECT();
  }

  // ── 2. Parse only after verification. ───────────────────────────────────
  let event: ResendEvent;
  try {
    event = JSON.parse(raw) as ResendEvent;
  } catch {
    logger.warn("resend.invalid_json_after_verify");
    return ACK();
  }

  const type = typeof event.type === "string" ? event.type : "";
  const eventId = verdict.eventId ?? req.headers.get("svix-id") ?? "";
  const emailId = event.data?.email_id ?? "";

  if (!HANDLED.has(type)) {
    logger.debug("resend.ignored_event", { type: type || "unknown" });
    return ACK();
  }

  // Dedupe on the Svix event id. `svix-id` is stable across provider retries.
  const claim = await claimWebhookEvent("resend", eventId || `${type}:${emailId}`);
  if (claim.state === "duplicate") {
    logger.debug("resend.duplicate_event", { type });
    return ACK();
  }

  if (emailId.length === 0) {
    logger.warn("resend.missing_email_id", { type });
    return ACK();
  }

  // ── 3. Apply ────────────────────────────────────────────────────────────
  if (type === "email.delivered") {
    const applied = await applyProviderStatus(emailId, "delivered", null, "email");
    logger.info("resend.delivered", { updated: applied.updated, requestId: ctx.requestId });
    return ACK();
  }

  const isComplaint = type === "email.complained";
  const reason = isComplaint
    ? "complaint"
    : (event.data?.bounce?.type ?? "bounce");

  const applied = await applyProviderStatus(emailId, "failed", `resend:${reason}`, "email");

  // Suppress every address on the message. Resend sends one recipient per
  // message in our configuration, but the array is the API's contract.
  const recipients = Array.isArray(event.data?.to) ? event.data.to : [];
  let suppressed = 0;
  for (const address of recipients) {
    const normalised = address.trim().toLowerCase();
    if (normalised.length < 3 || !normalised.includes("@")) continue;
    const ok = await suppressSubscriber(normalised, reason, eventId);
    if (ok) suppressed += 1;
  }

  // If `to` was empty (it can be, for some bounce shapes) fall back to the
  // address we recorded on the ledger row.
  if (suppressed === 0) {
    const notification = await findNotificationByProviderId(emailId, "email");
    if (notification) {
      // `Notification.recipient` is stored masked, so it cannot be suppressed
      // directly. Log the case; the operator can reconcile from Resend's log.
      logger.warn("resend.suppression_unavailable", { reason, note: "Notification.recipient is stored masked" });
    }
  }

  logger.info("resend.suppressed", { type, reason, suppressed, updated: applied.updated, requestId: ctx.requestId });
  return ACK();
}

/**
 * Resend's webhook signing secret.
 *
 * `RESEND_WEBHOOK_SECRET` (`whsec_…`) when the owner has set one, otherwise the
 * shared `WEBHOOK_SIGNING_SECRET` from the env contract. Returns `null` when
 * neither exists, which makes this receiver reject everything — a
 * half-configured webhook must never become a suppression oracle, because
 * suppressing an address on an unverified payload is a denial-of-service tool.
 */
function resendSecret(): string | null {
  const dedicated = process.env["RESEND_WEBHOOK_SECRET"]?.trim();
  return dedicated && dedicated.length > 0 ? dedicated : webhookConfig().signingSecret ?? null;
}

/**
 * Marks an address as unsubscribable. **One-directional, by design.**
 *
 * - `Subscriber.isActive = false`, `unsubscribedAt = now`.
 * - Creates the row when it is missing, so a bounce on a transactional address
 *   we never subscribed still stops future sends.
 * - Records the reason in `AuditLog` (there is no reason column on
 *   `Subscriber`, and the schema is not ours to change).
 * - Never sets `isActive` back to `true`.
 *
 * Returns `true` when a row is now suppressed.
 */
import { suppressSubscriber } from "@/app/api/webhooks/resend/suppression";


export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true, data: { endpoint: "resend-events", accepts: "POST", handles: [...HANDLED] } }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}