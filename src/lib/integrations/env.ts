/**
 * SAFE ENVIRONMENT ACCESS
 * ============================================================================
 * `src/lib/env.ts` is owned by the backend-core agent and validates the whole
 * environment at boot. This module is a *local, non-throwing* reader for the
 * integrations layer only, so that a missing or malformed variable degrades a
 * single integration instead of failing the request.
 *
 * Rule: never throw from here. Every getter has a documented default and the
 * caller decides what to do with `null`.
 *
 * @see docs/ops/INTEGRATIONS.md — the env contract.
 */

const raw = (key: string): string | undefined => {
  try {
    const v = process.env[key];
    if (typeof v !== "string") return undefined;
    const trimmed = v.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  } catch {
    return undefined;
  }
};

/** `undefined` when unset or blank. */
export function envStr(key: string): string | undefined {
  return raw(key);
}

/** `fallback` when unset, blank, or not a finite number. */
export function envNum(key: string, fallback: number): number {
  const v = raw(key);
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** `fallback` when unset, blank, or not one of `allowed`. */
export function envEnum<const T extends readonly string[]>(
  key: string,
  allowed: T,
  fallback: T[number],
): T[number] {
  const v = raw(key)?.toLowerCase();
  if (v === undefined) return fallback;
  const match = allowed.find((a) => a.toLowerCase() === v);
  return match ?? fallback;
}

/** `false` unless the value is an explicit truthy string. */
export function envBool(key: string, fallback = false): boolean {
  const v = raw(key)?.toLowerCase();
  if (v === undefined) return fallback;
  if (["1", "true", "yes", "on", "enabled"].includes(v)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(v)) return false;
  return fallback;
}

export function isProduction(): boolean {
  return envStr("NODE_ENV") === "production";
}

export function isTestEnv(): boolean {
  return envStr("NODE_ENV") === "test" || envStr("VITEST") === "true";
}

/** Base URL without a trailing slash, e.g. for building absolute links. */
export function siteUrl(): string {
  return (envStr("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
}

export const APP_VERSION = (): string => envStr("NEXT_PUBLIC_APP_VERSION") ?? "0.0.0-dev";

/** Seconds to wait for an outbound provider call before giving up. */
export const DEFAULT_TIMEOUT_MS = 8_000;

/** Wall-clock cap for a whole notification fan-out. */
export const NOTIFY_BUDGET_MS = 12_000;

// ── Grouped views over the documented env contract ───────────────────────────

export interface EmailConfig {
  /** "resend" | "smtp" | "none" */
  provider: "resend" | "smtp" | "none";
  resendApiKey: string | undefined;
  from: string;
  replyTo: string | undefined;
  smtp: { host: string; port: number; user: string | undefined; password: string | undefined; secure: boolean } | null;
}

export function emailConfig(): EmailConfig {
  const resendApiKey = envStr("RESEND_API_KEY");
  const host = envStr("SMTP_HOST");
  const user = envStr("SMTP_USER");
  const password = envStr("SMTP_PASSWORD");
  const smtp =
    host && user && password
      ? {
          host,
          port: envNum("SMTP_PORT", 587),
          user,
          password,
          secure: envBool("SMTP_SECURE", envNum("SMTP_PORT", 587) === 465),
        }
      : null;

  return {
    provider: resendApiKey ? "resend" : smtp ? "smtp" : "none",
    resendApiKey,
    from: envStr("EMAIL_FROM") ?? "EYG Tire & Auto Care <bookings@eygtireautocare.ph>",
    replyTo: envStr("EMAIL_REPLY_TO"),
    smtp,
  };
}

export interface SmsConfig {
  configured: boolean;
  accountSid: string | undefined;
  authToken: string | undefined;
  /** Either an E.164 number or an alphanumeric sender ID. */
  from: string | undefined;
  /** Alphanumeric sender IDs must be <= 11 chars and start with a letter. */
  fromIsAlphanumeric: boolean;
}

export function smsConfig(): SmsConfig {
  const accountSid = envStr("TWILIO_ACCOUNT_SID");
  const authToken = envStr("TWILIO_AUTH_TOKEN");
  const from = envStr("TWILIO_FROM_NUMBER");
  return {
    configured: Boolean(accountSid && authToken && from),
    accountSid,
    authToken,
    from,
    fromIsAlphanumeric: from ? /^[A-Za-z][A-Za-z0-9 ]{0,10}$/.test(from) : false,
  };
}

export interface WhatsAppConfig {
  configured: boolean;
  phoneNumberId: string | undefined;
  accessToken: string | undefined;
  verifyToken: string | undefined;
  apiVersion: string;
}

export function whatsappConfig(): WhatsAppConfig {
  const phoneNumberId = envStr("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = envStr("WHATSAPP_ACCESS_TOKEN");
  return {
    configured: Boolean(phoneNumberId && accessToken),
    phoneNumberId,
    accessToken,
    verifyToken: envStr("WHATSAPP_VERIFY_TOKEN"),
    apiVersion: envStr("WHATSAPP_API_VERSION") ?? "v21.0",
  };
}

export interface WebhookConfig {
  /** HMAC secret shared with providers that sign the raw body. */
  signingSecret: string | undefined;
  /** Bearer secret for cron + readiness probes. */
  cronSecret: string | undefined;
  /** Optional extra guard on `/api/ready` detail. */
  readySecret: string | undefined;
}

export function webhookConfig(): WebhookConfig {
  return {
    signingSecret: envStr("WEBHOOK_SIGNING_SECRET"),
    cronSecret: envStr("CRON_SECRET"),
    readySecret: envStr("READY_PROBE_SECRET") ?? envStr("CRON_SECRET") ?? envStr("AUTH_SECRET"),
  };
}

export interface ReviewsConfig {
  googlePlaceId: string | undefined;
  googleApiKey: string | undefined;
  facebookPageToken: string | undefined;
  facebookPageId: string | undefined;
}

export function reviewsConfig(): ReviewsConfig {
  return {
    googlePlaceId: envStr("GOOGLE_PLACE_ID"),
    googleApiKey: envStr("GOOGLE_API_KEY"),
    facebookPageToken: envStr("FACEBOOK_PAGE_ACCESS_TOKEN"),
    facebookPageId: envStr("FACEBOOK_PAGE_ID") ?? envStr("FACEBOOK_PAGE_NAME"),
  };
}

export interface CaptchaConfig {
  enabled: boolean;
  turnstileSecret: string | undefined;
  ttlSeconds: number;
}

export function captchaConfig(): CaptchaConfig {
  return {
    enabled: envBool("CAPTCHA_ENABLED", true),
    turnstileSecret: envStr("TURNSTILE_SECRET_KEY"),
    ttlSeconds: envNum("CAPTCHA_TTL_SECONDS", 600),
  };
}

export interface RateLimitConfig {
  publicPerMinute: number;
  bookingPerHour: number;
  quotePerHour: number;
}

export function rateLimitConfig(): RateLimitConfig {
  return {
    publicPerMinute: envNum("RATE_LIMIT_PUBLIC_PER_MINUTE", 10),
    bookingPerHour: envNum("RATE_LIMIT_BOOKING_PER_HOUR", 8),
    quotePerHour: envNum("RATE_LIMIT_QUOTE_PER_HOUR", 12),
  };
}

export function piiEncryptionKey(): string | undefined {
  return envStr("PII_ENCRYPTION_KEY");
}

export function upstashConfig(): { url: string; token: string } | null {
  const url = envStr("UPSTASH_REDIS_REST_URL");
  const token = envStr("UPSTASH_REDIS_REST_TOKEN");
  return url && token ? { url, token } : null;
}
