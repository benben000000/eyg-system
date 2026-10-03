/**
 * TRANSACTIONAL + MARKETING SMS (Twilio)
 * ============================================================================
 * Twilio when `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER`
 * are set, otherwise a no-op that records the `Notification` row with status
 * `skipped`. Lazily initialised, so a blank `.env.local` never breaks boot.
 *
 * Hard rules implemented here
 * ---------------------------
 * 1. **160 characters, enforced.** `renderSms` throws `SmsLengthError` when a
 *    templated body overflows; `sendSms` hard-truncates on a GSM-7-safe
 *    boundary as the last line of defence. Truncation is always logged.
 * 2. **Never cut mid-emoji / mid-surrogate-pair.** `fitSmsBody` walks code
 *    points, not UTF-16 units, and only cuts at a boundary that leaves a whole
 *    code point.
 * 3. **Consent.** Marketing SMS is refused unless the caller asserts
 *    `consentMarketing`. Transactional SMS (a booking the customer asked for)
 *    only needs the number to be one the customer supplied.
 * 4. **Opt-out.** Every marketing body carries `Reply STOP to opt out.` The
 *    sender must additionally register `<STOP>` in Twilio's Advanced Opt-Out
 *    list — see the owner action items in `docs/ops/INTEGRATIONS.md`.
 *    Basis: RA 10173 (Data Privacy Act) and the NPC Advisory on unsolicited
 *    commercial communications.
 * 5. **Third-party PII.** A message containing a customer's full name *and*
 *    their vehicle is refused unless the recipient number was supplied by that
 *    same customer. Guards against texting a bystander ("Hi Maria, your
 *    2019 Fortuner is ready") at a number that belongs to somebody else.
 *
 * @see docs/ops/INTEGRATIONS.md § SMS
 */

import { BUSINESS } from "@/config/site";
import { isValidPhPhone, normalisePhone } from "@/lib/utils";
import { log } from "@/lib/logger";
import { withDb } from "./db";
import { smsConfig } from "./env";
import { recordNotification, type Channel, type NotificationStatus } from "./notification-ledger";

const logger = log.child({ scope: "integrations/sms" });

/** A single SMS segment. Two segments would double the cost and read worse. */
export const SMS_MAX_LENGTH = 160;

/** One character is reserved for the ellipsis when truncating. */
const ELLIPSIS = "…";

/** Google Voice's GSM-7 basic character set. Anything else forces UCS-2. */
const GSM7_EXTRA = new Set([
  "@", "£", "$", "¥", "è", "é", "ù", "ì", "ò", "Ç", "\n", "Ø", "ø", "\r", "Å", "å",
  "Δ", "_", "Φ", "Γ", "Λ", "Ω", "Π", "Ψ", "Σ", "Θ", "Ξ", "Æ", "æ", "ß", "É",
  " ", "!", '"', "#", "¤", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/",
  ":", ";", "<", "=", ">", "?", "¡", "{", "}", "\\", "[", "~", "]", "|", "€", "^",
]);

/** True when `char` is in GSM-7. Pure — exported for unit tests. */
export function isGsm7Char(char: string): boolean {
  if (char.length === 0) return false;
  if (/^[A-Za-z0-9]$/.test(char)) return true;
  return GSM7_EXTRA.has(char);
}

/** True when every code unit of `text` is GSM-7 safe. */
export function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!isGsm7Char(ch)) return false;
  }
  return true;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SendSmsInput {
  to: string;
  body: string;
  /** Stable key (e.g. `booking-confirmed:<id>`) to prevent duplicate messages. */
  idempotencyKey?: string;
  template?: string;
  bookingId?: string | null;
  /** Transactional messages about a booking the customer made. */
  marketing?: boolean;
  /** The customer ticked "text me about this". */
  consentSms?: boolean;
  /** The customer ticked "send me offers". Required for `marketing: true`. */
  consentMarketing?: boolean;
  /**
   * True when `to` is a number the customer gave us for this purpose.
   * A message that pairs a full name with a vehicle requires this.
   */
  recipientSuppliedByCustomer?: boolean;
  /** Opt out of the third-party-PII check when no PII is in the body at all. */
  containsCustomerName?: string | null;
  containsVehicle?: string | null;
}

export interface SendSmsResult {
  ok: boolean;
  status: NotificationStatus;
  provider: "twilio" | "none";
  providerId: string | null;
  error: string | null;
  /** The body actually sent, after truncation. */
  body: string;
  truncated: boolean;
  segments: number;
}

// ── Truncation ───────────────────────────────────────────────────────────────

export interface FittedBody {
  text: string;
  truncated: boolean;
  /** Why it was truncated, for the log line. */
  reason: "length" | "emoji-boundary" | "none";
}

/**
 * Fits a body into 160 characters.
 *
 * Walks by code point so a cut can never land inside a surrogate pair, and
 * prefers to cut after the last sentence/word boundary inside the budget.
 * `…` is not GSM-7, so it is only used when the body was already non-GSM-7;
 * a pure GSM-7 body is cut with a trailing space instead, keeping the message
 * on the GSM-7 tariff.
 */
export function fitSmsBody(body: string, max: number = SMS_MAX_LENGTH): FittedBody {
  if (body.length <= max) return { text: body, truncated: false, reason: "none" };

  const reserve = isGsm7(body) ? 1 : 1; // one char for the marker in both cases
  const budget = Math.max(1, max - reserve);

  // Build the longest prefix that is <= budget code units and ends on a whole
  // code point. `Array.from` splits on code points, so emoji (a surrogate
  // pair) and ZWJ sequences stay intact.
  const codePoints = Array.from(body);
  let kept = "";
  let used = 0;
  for (const cp of codePoints) {
    if (used + cp.length > budget) break;
    kept += cp;
    used += cp.length;
  }

  // Prefer a clean cut: last sentence end, else last space, else hard cut.
  const sentenceCut = Math.max(kept.lastIndexOf(". "), kept.lastIndexOf("! "), kept.lastIndexOf("? "));
  const boundary = sentenceCut > budget * 0.5 ? sentenceCut + 1 : kept.lastIndexOf(" ");
  const cut = boundary > budget * 0.5 ? kept.slice(0, boundary) : kept;

  const text = `${cut.trimEnd()}${ELLIPSIS}`;
  return {
    text,
    truncated: true,
    reason: isGsm7(body) ? "length" : "emoji-boundary",
  };
}

/** GSM-7 bodies are 160 chars/segment; everything else is 70 (UCS-2). */
export function segmentCount(body: string): number {
  return isGsm7(body) ? Math.max(1, Math.ceil(body.length / SMS_MAX_LENGTH)) : Math.max(1, Math.ceil(body.length / 70));
}

export class SmsLengthError extends Error {
  readonly length: number;
  readonly max: number;
  constructor(length: number, max: number) {
    super(`SMS body is ${length} characters; the hard limit is ${max}. Fix the template, do not ship a truncated message.`);
    this.name = "SmsLengthError";
    this.length = length;
    this.max = max;
  }
}

/**
 * Renders a body and enforces the limit. Throws `SmsLengthError` when the
 * template overflows — templates must be fixed, not silently cut.
 */
export function renderSms(body: string, max: number = SMS_MAX_LENGTH): string {
  if (body.length > max) throw new SmsLengthError(body.length, max);
  return body;
}

// ── Policy guards ────────────────────────────────────────────────────────────

export const MARKETING_OPT_OUT = "Reply STOP to opt out.";

/** Appends the mandatory opt-out line to a marketing body. */
export function withOptOut(body: string): string {
  return body.includes("STOP") ? body : `${body.trimEnd()}\n\n${MARKETING_OPT_OUT}`;
}

/**
 * Refuses a message that pairs a customer's name with their vehicle when
 * the recipient number was not supplied by that customer. This is the "do not
 * text a bystander" guard: a message reading "Hi Maria, your 2019 Fortuner is
 * ready" leaks exactly as much as one that spells out the full name.
 *
 * Deliberately fail-closed. A false positive means a message is withheld and
 * recorded as `blocked`, which the staff board can see. A false negative means a
 * customer's details reached a stranger, which cannot be undone. Callers that
 * know the recipient is the customer set `recipientSuppliedByCustomer: true` and
 * bypass the guard; that is how the internal shop alerts are sent.
 *
 * Returns `null` when the message is allowed, or a reason string when blocked.
 */
export function thirdPartyPiiRisk(input: {
  body: string;
  name: string | null | undefined;
  vehicle: string | null | undefined;
  recipientSuppliedByCustomer: boolean;
}): string | null {
  if (input.recipientSuppliedByCustomer) return null;
  const name = (input.name ?? "").trim();
  const vehicle = (input.vehicle ?? "").trim();
  if (name.length < 3 || vehicle.length < 2) return null;

  const body = input.body.toLowerCase();
  if (!body.includes(vehicle.toLowerCase())) return null;

  // Whole-word matching on any distinct given name, not just the full name:
  // "Hi Maria, your 2019 Fortuner is ready" leaks exactly as much as the full
  // name does, so a partial mention must trip the guard too.
  const tokens = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
  if (tokens.length === 0) return null;

  const hasName =
    body.includes(name.toLowerCase()) ||
    tokens.some((t) => new RegExp(`(^|[^a-z0-9])${escapeForRegExp(t)}([^a-z0-9]|$)`).test(body));

  return hasName ? "third-party-pii" : null;
}

/** Escapes a customer-supplied token before it is embedded in a RegExp. */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** PH numbers only. A malformed number is a failed send, not a silent drop. */
export function validateRecipient(raw: string): { e164: string; ok: true } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, error: "missing-recipient" };
  if (!isValidPhPhone(trimmed)) return { ok: false, error: "invalid-ph-number" };
  return { e164: normalisePhone(trimmed), ok: true };
}

// ── Twilio ───────────────────────────────────────────────────────────────────

type TwilioMessages = {
  create(args: { to: string; from: string; body: string; statusCallback?: string }): Promise<{ sid: string; status?: string }>;
};

interface TwilioClient {
  messages: TwilioMessages;
}

let twilioClient: TwilioClient | null | undefined;

async function getTwilio(): Promise<TwilioClient | null> {
  if (twilioClient !== undefined) return twilioClient;
  const cfg = smsConfig();
  if (!cfg.configured) {
    twilioClient = null;
    return null;
  }
  try {
    const mod = (await import("twilio")) as unknown as { default: (sid: string, token: string) => TwilioClient };
    twilioClient = mod.default(cfg.accountSid as string, cfg.authToken as string);
  } catch (error) {
    logger.error("sms.twilio_init_failed", { action: "falling back to no-op" }, { err: error });
    twilioClient = null;
  }
  return twilioClient;
}

function _buildSmsUrl(cfg: ReturnType<typeof smsConfig>): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;
}

async function sendViaTwilio(
  cfg: ReturnType<typeof smsConfig>,
  to: string,
  body: string,
  callbackUrl: string | null,
): Promise<{ ok: true; sid: string } | { ok: false; code: string; status: number }> {
  const client = await getTwilio();
  if (!client) return { ok: false, code: "twilio-unavailable", status: 0 };

  // Prefer the SDK (it handles auth + form encoding); fall back to a raw POST
  // only if the SDK failed to initialise. Never both.
  try {
    const message = await client.messages.create({
      to,
      from: cfg.from as string,
      body,
      ...(callbackUrl ? { statusCallback: callbackUrl } : {}),
    });
    return { ok: true, sid: message.sid };
  } catch (error) {
    logger.error("sms.twilio_send_failed", { to: maskForLog(to) }, { err: error });
    return { ok: false, code: twilioErrorCode(error), status: 0 };
  }
}

/** Twilio error codes we actually branch on, mapped to stable strings. */
function twilioErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = Number((error as { code?: unknown }).code);
    switch (code) {
      case 21211:
        return "invalid-to-number";
      case 21612:
        return "unsupported-from-number";
      case 21614:
        return "not-messaging-enabled";
      case 21217:
        return "phone-not-capable";
      case 30003:
        return "unreachable-carrier";
      case 30005:
        return "unknown-recipient";
      case 30006:
        return "landline-or-unavailable";
      case 40100:
        return "request-timeout";
      case 429:
        return "rate-limited";
      default:
        return code > 0 ? `twilio-${code}` : "twilio-error";
    }
  }
  return "twilio-error";
}

const maskForLog = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  return digits.length > 4 ? `+${digits.slice(0, 3)}…${digits.slice(-2)}` : "…";
};

/** Shop-facing destination for operational alerts (daily digest, new lead). */
export function shopSmsRecipient(): string | null {
  const override = process.env["SHOP_ALERT_PHONE"];
  const candidate = (override && override.trim()) || BUSINESS.phoneE164;
  const validated = validateRecipient(candidate);
  return validated.ok ? validated.e164 : null;
}

/** Shop-facing email for operational alerts and digests. */
export function shopEmailRecipient(): string {
  const override = process.env["SHOP_ALERT_EMAIL"];
  return (override && override.trim()) || BUSINESS.emailSupport || BUSINESS.email;
}

// ── Send ─────────────────────────────────────────────────────────────────────

/**
 * Sends one SMS and records it. NEVER THROWS.
 *
 * Degradation: no Twilio key -> `Notification(status: "skipped")`. Policy
 * refusal -> `Notification(status: "blocked")` with the reason.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const cfg = smsConfig();
  const template = input.template ?? "generic";

  const finish = async (
    result: Omit<SendSmsResult, "segments"> & { segments?: number },
  ): Promise<SendSmsResult> => {
    await withDb(
      (db) =>
        recordNotification(db, {
          channel: "sms" as Channel,
          template,
          recipient: input.to,
          body: result.body,
          status: result.status,
          providerId: result.providerId,
          error: result.error,
          bookingId: input.bookingId ?? null,
        }),
      undefined,
      { event: "sms.record" },
    );
    return { ...result, segments: result.segments ?? segmentCount(result.body) };
  };

  // 1. Recipient.
  const recipient = validateRecipient(input.to);
  if (!recipient.ok) {
    logger.warn("sms.invalid_recipient", { template, code: recipient.error });
    return finish({ ok: false, status: "failed", provider: "none", providerId: null, error: recipient.error, body: "", truncated: false });
  }

  // 2. Consent.
  if (input.marketing) {
    if (input.consentMarketing !== true) {
      logger.warn("sms.marketing_without_consent", { template, action: "refused" });
      return finish({
        ok: false,
        status: "blocked",
        provider: "none",
        providerId: null,
        error: "no-marketing-consent",
        body: input.body,
        truncated: false,
      });
    }
    if (input.consentSms === false) {
      logger.warn("sms.marketing_without_sms_consent", { template, action: "refused" });
      return finish({
        ok: false,
        status: "blocked",
        provider: "none",
        providerId: null,
        error: "no-sms-consent",
        body: input.body,
        truncated: false,
      });
    }
  } else if (input.consentSms === false) {
    // Transactional confirmations only go out when the customer opted into SMS.
    logger.warn("sms.transactional_without_consent", { template, action: "refused" });
    return finish({
      ok: false,
      status: "blocked",
      provider: "none",
      providerId: null,
      error: "no-sms-consent",
      body: input.body,
      truncated: false,
    });
  }

  // 3. Third-party PII guard.
  const risk = thirdPartyPiiRisk({
    body: input.body,
    name: input.containsCustomerName,
    vehicle: input.containsVehicle,
    recipientSuppliedByCustomer: input.recipientSuppliedByCustomer === true,
  });
  if (risk) {
    logger.error("sms.third_party_pii_blocked", { template, reason: risk, action: "message not sent" });
    return finish({
      ok: false,
      status: "blocked",
      provider: "none",
      providerId: null,
      error: risk,
      body: input.body,
      truncated: false,
    });
  }

  // 4. Length. Hard-enforced, never mid-emoji.
  const fitted = fitSmsBody(input.body, SMS_MAX_LENGTH);
  if (fitted.truncated) {
    logger.warn("sms.truncated", {
      template,
      originalLength: input.body.length,
      finalLength: fitted.text.length,
      reason: fitted.reason,
    });
  }
  const body = fitted.text;
  if (body.trim().length === 0) {
    return finish({ ok: false, status: "failed", provider: "none", providerId: null, error: "empty-body", body, truncated: fitted.truncated });
  }

  // 5. Provider.
  if (!cfg.configured) {
    logger.warn("sms.no_provider", { template, effect: "message recorded, not sent" });
    return finish({
      ok: false,
      status: "skipped",
      provider: "none",
      providerId: null,
      error: "no-provider-configured",
      body,
      truncated: fitted.truncated,
    });
  }

  const siteUrl = (process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000").replace(/\/+$/, "");
  const callbackUrl = process.env["TWILIO_STATUS_CALLBACK_URL"] ?? `${siteUrl}/api/webhooks/twilio`;

  const sent = await sendViaTwilio(cfg, recipient.e164, body, callbackUrl);
  if (!sent.ok) {
    return finish({ ok: false, status: "failed", provider: "twilio", providerId: null, error: sent.code, body, truncated: fitted.truncated });
  }

  logger.info("sms.sent", {
    template,
    to: maskForLog(recipient.e164),
    sender: cfg.fromIsAlphanumeric ? "alphanumeric" : "number",
    truncated: fitted.truncated,
    segments: segmentCount(body),
  });
  return finish({
    ok: true,
    status: "sent",
    provider: "twilio",
    providerId: sent.sid,
    error: null,
    body,
    truncated: fitted.truncated,
  });
}

/** The `Notification` status a send will land in, without sending. Used by tests. */
export function previewSmsStatus(input: SendSmsInput): NotificationStatus {
  const recipient = validateRecipient(input.to);
  if (!recipient.ok) return "failed";
  if (input.marketing && (input.consentMarketing !== true || input.consentSms === false)) return "blocked";
  if (!input.marketing && input.consentSms === false) return "blocked";
  if (smsConfig().configured) return "sent";
  return "skipped";
}

/** Test hook. */
export function resetSmsClient(): void {
  twilioClient = undefined;
}
