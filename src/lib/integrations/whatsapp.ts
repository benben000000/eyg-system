/**
 * WHATSAPP
 * ============================================================================
 * TWO PATHS, AND THE ZERO-CONFIG ONE IS THE PRIMARY ONE
 * ---------------------------------------------------------------------------
 * 1. **`buildWhatsAppLink(message)` — the primary path.** A `wa.me` deep link
 *    with a prefilled message. It needs no Meta account, no template approval,
 *    no 24-hour window and no API key. It is the whole WhatsApp strategy for a
 *    308-follower shop, and it is what every UI-facing response should return.
 *    The default prefilled text comes from `LINKS.whatsapp` in
 *    `src/config/site.ts` so the copy has one home.
 *
 * 2. **Cloud API sender — optional.** Only active when `WHATSAPP_PHONE_NUMBER_ID`
 *    + `WHATSAPP_ACCESS_TOKEN` are set. It buys us inbound messages and status
 *    callbacks, which is what makes a *reply* to our number reach the shop.
 *
 *    24-HOUR CUSTOMER SERVICE WINDOW
 *    ------------------------------
 *    Outside a window opened by a customer message, Cloud API only accepts
 *    *template* messages, which require Meta approval and cost per conversation.
 *    A window opens when a customer messages the business number and lasts 24
 *    hours. Everything this module sends is therefore treated as a *reply*:
 *    it must be a direct response to something the customer said. We never
 *    initiate a conversation here, so this module will not silently burn a
 *    paid conversation on an outbound promo.
 *
 * SIGNATURE VERIFICATION
 * ----------------------
 * `verifyWhatsAppSignature()` does HMAC-SHA256 over the **raw** body with
 * `WHATSAPP_VERIFY_TOKEN` and compares in constant time. `GET` handles the
 * `hub.verify` subscription challenge.
 *
 * @see docs/ops/INTEGRATIONS.md § WhatsApp
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { BUSINESS, LINKS } from "@/config/site";
import { log } from "@/lib/logger";
import { whatsappConfig } from "./env";
import { withDb } from "./db";
import { fetchJson } from "./http";
import { maskRecipient, recordNotification } from "./notification-ledger";

const logger = log.child({ scope: "integrations/whatsapp" });

/** Matches the prefilled text baked into `LINKS.whatsapp`. */
const DEFAULT_MESSAGE = decodeURIComponent(
  (LINKS.whatsapp.split("text=")[1] ?? "Hi EYG Tire & Auto Care! I'd like to ask about a service.").replace(/\+/g, " "),
);

/** wa.me tolerates long text; cap anyway so a URL cannot blow past client limits. */
const MAX_LINK_MESSAGE = 1_200;

/**
 * PRIMARY PATH. Builds a `wa.me` deep link with a prefilled message.
 *
 * `number` defaults to the shop's WhatsApp number from `site.ts`. Pass `null` to
 * get the generic link with no `?text=`, which is what the floating mobile
 * action bar should use.
 */
export function buildWhatsAppLink(message?: string | null, number?: string | null): string {
  const target = normaliseWaNumber(number ?? BUSINESS.whatsappNumber);
  if (!target) return "https://wa.me/";
  const text = (message ?? DEFAULT_MESSAGE).trim().slice(0, MAX_LINK_MESSAGE);
  if (text.length === 0) return `https://wa.me/${target}`;
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
}

/** Strips `+`, spaces and dashes. Returns `""` when the input is not a number. */
export function normaliseWaNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

/** Pre-filled opener for a specific purpose. Copy has one home: `site.ts`. */
export function whatsappIntentLink(intent: string): string {
  return buildWhatsAppLink(`${DEFAULT_MESSAGE} (${intent})`);
}

// ── Signature verification ───────────────────────────────────────────────────

const HEX = /^[0-9a-f]{64}$/i;

/** Constant-time compare that tolerates length mismatch without throwing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export interface SignatureResult {
  ok: boolean;
  reason: "verified" | "no-secret" | "missing-header" | "malformed-header" | "mismatch";
}

/**
 * Verifies `X-Hub-Signature-256` (Meta's format) over the RAW body.
 *
 * When `WHATSAPP_VERIFY_TOKEN` is unset the module is in "no verification
 * configured" mode and returns `{ ok: false, reason: "no-secret" }` — the route
 * then rejects, because an unverified public webhook is a forgery oracle. This
 * is a deliberate fail-closed choice: the WhatsApp integration is optional, so
 * the right answer when it is half-configured is to refuse, not to trust.
 */
export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null): SignatureResult {
  const secret = whatsappConfig().verifyToken;
  if (!secret) {
    logger.error("whatsapp.no_verify_token", { action: "rejecting webhook as unverifiable" });
    return { ok: false, reason: "no-secret" };
  }
  if (!signatureHeader || signatureHeader.trim().length === 0) {
    return { ok: false, reason: "missing-header" };
  }

  const provided = signatureHeader.trim().replace(/^sha256=/i, "").toLowerCase();
  if (!HEX.test(provided)) return { ok: false, reason: "malformed-header" };

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return safeEqual(expected, provided) ? { ok: true, reason: "verified" } : { ok: false, reason: "mismatch" };
}

export interface VerificationChallenge {
  /** `hub.mode` — must be `subscribe`. */
  mode: string | null;
  /** `hub.verify_token` — must equal `WHATSAPP_VERIFY_TOKEN`. */
  token: string | null;
  /** `hub.challenge` — the value to echo back as plain text. */
  challenge: string | null;
}

export function parseVerificationChallenge(url: string): VerificationChallenge {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    // Relative URL — fall back to a manual parse.
    const q = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
    params = new URLSearchParams(q);
  }
  return {
    mode: params.get("hub.mode"),
    token: params.get("hub.verify_token"),
    challenge: params.get("hub.challenge"),
  };
}

export interface ChallengeResult {
  /** The plain-text body to return, or `null` to return 403. */
  challenge: string | null;
  reason: "ok" | "not-a-subscription" | "token-mismatch" | "missing-challenge" | "no-secret";
}

/**
 * Evaluates the `hub.verify` subscription handshake. Returns the challenge to
 * echo, or a reason to reject. Constant-time token compare.
 */
export function evaluateVerificationChallenge(input: VerificationChallenge): ChallengeResult {
  const secret = whatsappConfig().verifyToken;
  if (!secret) return { challenge: null, reason: "no-secret" };
  if (input.mode !== "subscribe") return { challenge: null, reason: "not-a-subscription" };
  if (!input.token || !safeEqual(input.token, secret)) return { challenge: null, reason: "token-mismatch" };
  if (!input.challenge || input.challenge.length > 256) return { challenge: null, reason: "missing-challenge" };
  return { challenge: input.challenge, reason: "ok" };
}

// ── Outbound sender (optional) ──────────────────────────────────────────────

export interface SendWhatsAppInput {
  /** Customer number, digits only or E.164. */
  to: string;
  body: string;
  template?: string;
  bookingId?: string | null;
  idempotencyKey?: string;
  /**
   * MUST be true. Outside the 24-hour window Cloud API rejects free-form text
   * and, worse, a mis-classified send becomes a billable conversation. This
   * module therefore refuses to send unless the caller asserts the customer
   * actually messaged us first.
   */
  insideCustomerServiceWindow?: boolean;
}

export interface SendWhatsAppResult {
  ok: boolean;
  status: "sent" | "skipped" | "blocked" | "failed";
  providerId: string | null;
  error: string | null;
  /** A `wa.me` link the UI can offer regardless of the API result. */
  fallbackLink: string;
}

/**
 * Sends one WhatsApp message via the Cloud API, or explains why it did not.
 * NEVER THROWS. Always returns a `wa.me` fallback link so a UI can still offer
 * a working button when the API is unavailable — that is the point of the
 * zero-config path.
 */
export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const cfg = whatsappConfig();
  const template = input.template ?? "generic";
  const to = normaliseWaNumber(input.to);
  const fallbackLink = buildWhatsAppLink(input.body.slice(0, 400), to || null);

  const record = async (status: SendWhatsAppResult["status"], error: string | null, providerId: string | null): Promise<void> => {
    await withDb(
      (db) =>
        recordNotification(db, {
          channel: "whatsapp",
          template,
          recipient: input.to,
          body: input.body,
          status,
          providerId,
          error,
          bookingId: input.bookingId ?? null,
        }),
      undefined,
      { event: "whatsapp.record" },
    );
  };

  if (to.length === 0) {
    await record("failed", "invalid-recipient", null);
    return { ok: false, status: "failed", providerId: null, error: "invalid-recipient", fallbackLink };
  }

  if (!cfg.configured) {
    logger.warn("whatsapp.no_provider", { template, effect: "wa.me link only" });
    await record("skipped", "no-provider-configured", null);
    return { ok: false, status: "skipped", providerId: null, error: "no-provider-configured", fallbackLink };
  }

  if (input.insideCustomerServiceWindow !== true) {
    logger.warn("whatsapp.outside_service_window", { template, action: "refused; would cost a billed conversation" });
    await record("blocked", "outside-24h-window", null);
    return { ok: false, status: "blocked", providerId: null, error: "outside-24h-window", fallbackLink };
  }

  const url = `https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`;
  const result = await fetchJson<{ messages?: Array<{ id?: string }> }>(url, {
    provider: "whatsapp",
    method: "POST",
    headers: { authorization: `Bearer ${cfg.accessToken as string}` },
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: input.body.slice(0, 4_096) },
      ...(input.idempotencyKey ? { biz_opaque_callback_data: input.idempotencyKey.slice(0, 64) } : {}),
    },
    timeoutMs: 8_000,
    retries: 1,
  });

  if (!result.ok || !result.data) {
    const code = result.error ?? "send-failed";
    logger.error("whatsapp.send_failed", { template, code, status: result.status });
    await record("failed", code, null);
    return { ok: false, status: "failed", providerId: null, error: code, fallbackLink };
  }

  const providerId = result.data.messages?.[0]?.id ?? null;
  await record("sent", null, providerId);
  logger.info("whatsapp.sent", { template, ok: true, to: maskRecipient(input.to) });
  return { ok: true, status: "sent", providerId, error: null, fallbackLink };
}

// ── Inbound payload parsing ──────────────────────────────────────────────────

export type WhatsAppEventKind = "status" | "text" | "other";

export interface WhatsAppEvent {
  kind: WhatsAppEventKind;
  /** Message id (`wamid.…`). Doubles as the dedupe + Notification key. */
  id: string | null;
  /** Customer number, digits only. */
  from: string | null;
  /** `delivered | read | sent | failed`. */
  status: string | null;
  errorCode: number | null;
  text: string | null;
  /** Milliseconds since epoch the provider stamped. */
  timestamp: number | null;
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Extracts the events we care about from a Cloud API webhook body.
 * Tolerant by design: an unfamiliar shape yields `[]`, never a throw.
 */
export function parseWebhookEvents(body: unknown): WhatsAppEvent[] {
  const root = asRecord(body);
  if (!root) return [];
  const out: WhatsAppEvent[] = [];

  for (const entry of asArray(root["entry"])) {
    const entryRec = asRecord(entry);
    if (!entryRec) continue;
    for (const change of asArray(entryRec["changes"])) {
      const value = asRecord(asRecord(change)?.["value"]);
      if (!value) continue;

      for (const message of asArray(value["messages"])) {
        const m = asRecord(message);
        if (!m) continue;
        const text = asRecord(m["text"])?.["body"];
        out.push({
          kind: typeof text === "string" ? "text" : "other",
          id: typeof m["id"] === "string" ? m["id"] : null,
          from: typeof m["from"] === "string" ? m["from"] : null,
          status: null,
          errorCode: null,
          text: typeof text === "string" ? text.slice(0, 1_000) : null,
          timestamp: typeof m["timestamp"] === "string" ? Number(m["timestamp"]) || null : null,
        });
      }

      for (const status of asArray(value["statuses"])) {
        const s = asRecord(status);
        if (!s) continue;
        const errs = asArray(s["errors"]);
        const err = errs.length > 0 ? asRecord(errs[0]) : null;
        const errorCode = typeof err?.["code"] === "number" ? err["code"] : null;
        out.push({
          kind: "status",
          id: typeof s["id"] === "string" ? s["id"] : null,
          from: typeof s["recipient_id"] === "string" ? s["recipient_id"] : null,
          status: typeof s["status"] === "string" ? s["status"] : null,
          errorCode,
          text: null,
          timestamp: typeof s["timestamp"] === "string" ? Number(s["timestamp"]) || null : null,
        });
      }
    }
  }
  return out;
}

/** Cloud API status → `Notification.status`. `null` when the status is unknown. */
export function mapStatusToNotification(status: string | null): "delivered" | "sent" | "failed" | null {
  switch ((status ?? "").toLowerCase()) {
    case "delivered":
      return "delivered";
    case "sent":
      return "sent";
    case "read":
      return "delivered";
    case "failed":
    case "deleted":
      return "failed";
    default:
      return null;
  }
}
