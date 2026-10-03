/**
 * ENVIRONMENT — single source of truth for runtime configuration.
 * ============================================================================
 * `import "server-only"` is the first statement so that pulling this module into a
 * Client Component (or anything that reaches the browser bundle) is a *build
 * error*, not a runtime leak. `NEXT_PUBLIC_*` values live in `publicEnv`, which
 * is deliberately a separate object with its own `server-only`-free module
 * (`src/lib/public-env.ts`) so that client code can import them safely.
 *
 * Design rules:
 *  - Parse `process.env` exactly once, at module load. No lazy re-reads.
 *  - Fail *fast* and *loudly* at boot with one readable message listing every
 *    offending key. A boot that limps along on a half-valid environment is how
 *    null secrets and dead features reach production.
 *  - Never echo a secret *value* into an error message — reference the key only.
 */
import "server-only";

import { z } from "zod";

// ── Helpers ─────────────────────────────────────────────────────────────────

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v, ctx) => {
    if (typeof v === "boolean") return v;
    const s = v.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(s)) return true;
    if (["0", "false", "no", "off", ""].includes(s)) return false;
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "expected true/false/1/0/yes/no" });
    return z.NEVER;
  });

/** Empty string → undefined, so `""` in a .env behaves like "not set". */
const emptyToUndef = (v: unknown): unknown => {
  if (typeof v === "string" && v.trim() === "") return undefined;
  return v;
};

const optionalTrimmed = z.preprocess(emptyToUndef, z.string().trim().optional());

const _optionalNumber = (min: number, max: number) =>
  z.preprocess(emptyToUndef, z.coerce.number().int().min(min).max(max).optional());

const optionalUrl = z.preprocess(
  emptyToUndef,
  z
    .string()
    .trim()
    .url("must be an absolute URL")
    .optional(),
);

const intFromEnv = (min: number, max: number, fallback: number) =>
  z.preprocess(emptyToUndef, z.coerce.number().int().min(min).max(max)).catch(fallback);

/**
 * A secret that must be present and at least `minLength` chars, but whose value
 * is NEVER echoed. `zod`'s own `too_small` message for a string schema only
 * reports the *required* length, so the value can never leak through an error.
 */
const secret = (minLength: number) =>
  z
    .string({ required_error: "is required" })
    .transform((v) => v.trim())
    .refine((v) => v.length >= minLength, {
      message: `must be at least ${minLength} characters`,
    });

// ── Schema ──────────────────────────────────────────────────────────────────

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).catch("development"),
    DATABASE_URL: z
      .string()
      .min(1, "is required")
      .refine((v) => /^postgres(ql)?:\/\//.test(v), { message: "must be a postgresql:// connection string" }),

    /**
     * Non-pooled connection, used only by `prisma migrate deploy` and by
     * `scripts/db-backup.mjs`. Optional: when it is empty the two fall back to
     * `DATABASE_URL`, which is correct for local development and wrong for a
     * serverless deploy — `scripts/predeploy-check.mjs` warns about that.
     */
    DIRECT_URL: z
      .string()
      .optional()
      .transform((v) => (v ?? "").trim())
      .refine((v) => v === "" || /^postgres(ql)?:\/\//.test(v), {
        message: "must be a postgresql:// connection string",
      }),

    /**
     * Extra origins permitted to make state-changing requests. Validated here
     * (rather than read straight off `process.env`) so `.env.example` and the
     * schema cannot drift, and so a malformed entry fails boot instead of being
     * silently ignored by the CSRF allowlist.
     */
    CSRF_ALLOWED_ORIGINS: z
      .string()
      .optional()
      .transform((v) => (v ?? "").trim())
      .refine(
        (v) =>
          v === "" ||
          v
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
            .every((o) => /^https?:\/\/[^\s/]+$/.test(o)),
        { message: "must be a comma-separated list of absolute origins, e.g. https://preview-1.vercel.app" },
      ),

    // Secrets
    AUTH_SECRET: secret(32),
    PII_ENCRYPTION_KEY: secret(32),
    WEBHOOK_SIGNING_SECRET: secret(16),

    // Rate limiting
    UPSTASH_REDIS_REST_URL: optionalUrl,
    UPSTASH_REDIS_REST_TOKEN: optionalTrimmed,
    RATE_LIMIT_PUBLIC_PER_MINUTE: intFromEnv(1, 1000, 10),
    RATE_LIMIT_BOOKING_PER_HOUR: intFromEnv(1, 1000, 8),
    RATE_LIMIT_QUOTE_PER_HOUR: intFromEnv(1, 1000, 12),
    RATE_LIMIT_LOGIN_PER_15MIN: intFromEnv(1, 1000, 8),
    RATE_LIMIT_READ_PER_MINUTE: intFromEnv(1, 100_000, 240),

    // Bot protection
    CAPTCHA_ENABLED: booleanish.catch(true),
    CAPTCHA_TTL_SECONDS: intFromEnv(30, 3600, 600),
    TURNSTILE_SECRET_KEY: optionalTrimmed,

    // Transactional email
    RESEND_API_KEY: optionalTrimmed,
    EMAIL_FROM: optionalTrimmed,
    SMTP_HOST: optionalTrimmed,
    SMTP_PORT: intFromEnv(1, 65535, 587),
    SMTP_USER: optionalTrimmed,
    SMTP_PASSWORD: optionalTrimmed,
    SMTP_SECURE: booleanish.catch(false),

    // SMS
    TWILIO_ACCOUNT_SID: optionalTrimmed,
    TWILIO_AUTH_TOKEN: optionalTrimmed,
    TWILIO_FROM_NUMBER: optionalTrimmed,

    // WhatsApp Cloud API
    WHATSAPP_PHONE_NUMBER_ID: optionalTrimmed,
    WHATSAPP_ACCESS_TOKEN: optionalTrimmed,
    WHATSAPP_VERIFY_TOKEN: optionalTrimmed,

    // Reviews
    GOOGLE_PLACE_ID: optionalTrimmed,
    GOOGLE_API_KEY: optionalTrimmed,
    FACEBOOK_PAGE_ACCESS_TOKEN: optionalTrimmed,

    // Observability
    SENTRY_DSN: optionalTrimmed,
    SENTRY_AUTH_TOKEN: optionalTrimmed,
    SENTRY_ORG: optionalTrimmed,
    SENTRY_PROJECT: optionalTrimmed,
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).catch("info"),

    // Admin security
    ADMIN_IP_ALLOWLIST: optionalTrimmed,

    // Seed-only (never required at runtime; read directly by prisma/seed.ts).
    ADMIN_EMAIL: optionalTrimmed,
    ADMIN_PASSWORD: optionalTrimmed,
  })
  .superRefine((val, ctx) => {
    // Upstash needs *both* halves; a half-configured pair silently degrades to
    // the Postgres driver, which is confusing during an incident.
    const hasUrl = Boolean(val.UPSTASH_REDIS_REST_URL);
    const hasToken = Boolean(val.UPSTASH_REDIS_REST_TOKEN);
    if (hasUrl !== hasToken) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasUrl ? "UPSTASH_REDIS_REST_TOKEN" : "UPSTASH_REDIS_REST_URL"],
        message: "must be set together with its pair",
      });
    }
    // Resend and SMTP are mutually exclusive mail transports.
    if (val.RESEND_API_KEY && val.SMTP_HOST) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RESEND_API_KEY"],
        message: "set RESEND_API_KEY or SMTP_*, not both",
      });
    }
    if (val.SMTP_HOST && (!val.SMTP_USER || !val.SMTP_PASSWORD)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_USER"],
        message: "SMTP_USER + SMTP_PASSWORD are required when SMTP_HOST is set",
      });
    }
    // Twilio needs a full triple; a partial triple means texts never arrive.
    const twilioParts = [val.TWILIO_ACCOUNT_SID, val.TWILIO_AUTH_TOKEN, val.TWILIO_FROM_NUMBER];
    if (twilioParts.some(Boolean) && !twilioParts.every(Boolean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TWILIO_AUTH_TOKEN"],
        message: "TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER must all be set",
      });
    }
  });

// ── Parse, or die with one readable message ─────────────────────────────────

/**
 * `NEXT_PUBLIC_SITE_URL` is validated here, deliberately *outside*
 * `serverSchema`. Two reasons:
 *  1. It is a `NEXT_PUBLIC_*` key, so Next inlines it into the client bundle at
 *     build time and it is not a runtime server secret — putting it in the
 *     server schema would blur that line.
 *  2. It still has to fail closed. `seo.ts`, `sitemap.ts` and every OG tag build
 *     absolute URLs from it, so a typo (`eygtireautocare.ph`, no scheme) would
 *     silently ship broken canonicals and a 404 sitemap with no other signal.
 *
 * The check is absolute-URL-only with an http/https scheme, and the resulting
 * `siteUrl` has any trailing slashes stripped so `SITE.url + path` never doubles.
 */
const siteUrlSchema = z.preprocess(
  (v) => (v === undefined || v === "" ? "http://localhost:3000" : v),
  z
    .string()
    .trim()
    .url("must be an absolute URL, e.g. https://eygtireautocare.ph")
    .refine((v) => v.startsWith("http://") || v.startsWith("https://"), {
      message: "must start with http:// or https://",
    })
    .refine((v) => !v.includes(" "), { message: "must not contain spaces" })
    .transform((v) => v.replace(/\/+$/, "")),
);

const parsedSiteUrl = siteUrlSchema.safeParse(process.env.NEXT_PUBLIC_SITE_URL);

// SECURITY (SEC-02): the CSRF origin allowlist is built from `siteUrl`. If
// `NEXT_PUBLIC_SITE_URL` is unset in production it silently falls back to
// localhost, which would reject every legitimate mutation. Fail boot loudly
// instead of shipping a site whose booking form 403s in production.
const isProd = process.env.NODE_ENV === "production";
const siteUrlMissingInProd = isProd && (process.env.NEXT_PUBLIC_SITE_URL === undefined || process.env.NEXT_PUBLIC_SITE_URL === "");

const parsed = serverSchema.safeParse(process.env);
const bootIssues: string[] = [
  ...(parsed.success ? [] : parsed.error.issues.map((issue) => `${(issue.path.length > 0 ? issue.path.join(".") : "(root)")}: ${issue.message}`)),
  ...(parsedSiteUrl.success ? [] : parsedSiteUrl.error.issues.map((issue) => `NEXT_PUBLIC_SITE_URL: ${issue.message}`)),
  ...(siteUrlMissingInProd
    ? ["NEXT_PUBLIC_SITE_URL: is required in production (the CSRF allowlist is derived from it)"]
    : []),
];

if (bootIssues.length > 0) {
  const keys = [
    ...new Set(
      bootIssues.map((line) => line.split(":")[0] ?? "(root)").filter((k) => k.length > 0),
    ),
  ];

  throw new Error(
    [
      "",
      "══════════════════════════════════════════════════════════════════",
      " EYG Tire & Auto Care — invalid environment",
      " The app refuses to boot. Fix the variable(s) below and restart.",
      " Values are never printed: only the keys are shown.",
      "══════════════════════════════════════════════════════════════════",
      ...bootIssues.map((line) => `  • ${line}`),
      "",
      " Copy .env.example → .env.local and fill in every value.",
      ` Missing/invalid keys: ${keys.join(", ")}`,
      "",
    ].join("\n"),
  );
}

const raw = parsed.success ? parsed.data : serverSchema.parse(process.env);
const rawSiteUrl = parsedSiteUrl.success ? parsedSiteUrl.data : "http://localhost:3000";

// ── Export ──────────────────────────────────────────────────────────────────

export interface AppEnv {
  readonly nodeEnv: "development" | "test" | "production";
  readonly isServer: true;
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  readonly isVercel: boolean;

  readonly siteUrl: string;
  /**
   * Extra origins allowed to make state-changing requests, comma-separated.
   * Used for Vercel preview domains and any future custom domain. Never needs
   * to include `siteUrl` — that is always allowed.
   */
  readonly csrfAllowedOrigins: string;
  readonly databaseUrl: string;
  /** Non-pooled connection for migrations and backups. Falls back to `databaseUrl`. */
  readonly directUrl: string;

  readonly authSecret: string;
  readonly piiEncryptionKey: string;
  readonly webhookSigningSecret: string;

  readonly rateLimit: {
    readonly publicPerMinute: number;
    readonly bookingPerHour: number;
    readonly quotePerHour: number;
    readonly loginPer15Min: number;
    readonly readPerMinute: number;
    readonly upstashUrl: string | undefined;
    readonly upstashToken: string | undefined;
    readonly hasUpstash: boolean;
  };

  readonly captcha: {
    readonly enabled: boolean;
    readonly ttlSeconds: number;
    readonly turnstileSecretKey: string | undefined;
    readonly turnstileSiteKey: string | undefined;
  };

  readonly email: {
    readonly resendApiKey: string | undefined;
    readonly from: string;
    readonly smtp: {
      readonly host: string | undefined;
      readonly port: number;
      readonly user: string | undefined;
      readonly password: string | undefined;
      readonly secure: boolean;
    };
  };

  readonly sms: {
    readonly accountSid: string | undefined;
    readonly authToken: string | undefined;
    readonly fromNumber: string | undefined;
  };

  readonly whatsapp: {
    readonly phoneNumberId: string | undefined;
    readonly accessToken: string | undefined;
    readonly verifyToken: string | undefined;
  };

  readonly reviews: {
    readonly googlePlaceId: string | undefined;
    readonly googleApiKey: string | undefined;
    readonly facebookPageAccessToken: string | undefined;
  };

  readonly sentry: {
    readonly dsn: string | undefined;
    readonly authToken: string | undefined;
    readonly org: string | undefined;
    readonly project: string | undefined;
  };

  readonly adminIpAllowlist: readonly string[];

  readonly logLevel: "debug" | "info" | "warn" | "error" | "silent";
  readonly googleMapsApiKey: string | undefined;
  readonly gaMeasurementId: string | undefined;
  readonly plausibleDomain: string | undefined;
  readonly appVersion: string;
}

function splitAllowlist(raw_: string | undefined): string[] {
  if (!raw_) return [];
  return raw_
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const env: AppEnv = Object.freeze({
  nodeEnv: raw.NODE_ENV,
  isServer: true,
  isProduction: raw.NODE_ENV === "production",
  isDevelopment: raw.NODE_ENV === "development",
  isTest: raw.NODE_ENV === "test",
  isVercel: process.env.VERCEL === "1",

  siteUrl: rawSiteUrl,
  csrfAllowedOrigins: raw.CSRF_ALLOWED_ORIGINS,
  databaseUrl: raw.DATABASE_URL,
  directUrl: raw.DIRECT_URL || raw.DATABASE_URL,

  authSecret: raw.AUTH_SECRET,
  piiEncryptionKey: raw.PII_ENCRYPTION_KEY,
  webhookSigningSecret: raw.WEBHOOK_SIGNING_SECRET,

  rateLimit: Object.freeze({
    publicPerMinute: raw.RATE_LIMIT_PUBLIC_PER_MINUTE,
    bookingPerHour: raw.RATE_LIMIT_BOOKING_PER_HOUR,
    quotePerHour: raw.RATE_LIMIT_QUOTE_PER_HOUR,
    loginPer15Min: raw.RATE_LIMIT_LOGIN_PER_15MIN,
    readPerMinute: raw.RATE_LIMIT_READ_PER_MINUTE,
    upstashUrl: raw.UPSTASH_REDIS_REST_URL,
    upstashToken: raw.UPSTASH_REDIS_REST_TOKEN,
    hasUpstash: Boolean(raw.UPSTASH_REDIS_REST_URL && raw.UPSTASH_REDIS_REST_TOKEN),
  }),

  captcha: Object.freeze({
    enabled: raw.CAPTCHA_ENABLED,
    ttlSeconds: raw.CAPTCHA_TTL_SECONDS,
    turnstileSecretKey: raw.TURNSTILE_SECRET_KEY,
    turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined,
  }),

  email: Object.freeze({
    resendApiKey: raw.RESEND_API_KEY,
    from: raw.EMAIL_FROM ?? "EYG Tire & Auto Care <bookings@eygtireautocare.ph>",
    smtp: Object.freeze({
      host: raw.SMTP_HOST,
      port: raw.SMTP_PORT,
      user: raw.SMTP_USER,
      password: raw.SMTP_PASSWORD,
      secure: raw.SMTP_SECURE,
    }),
  }),

  sms: Object.freeze({
    accountSid: raw.TWILIO_ACCOUNT_SID,
    authToken: raw.TWILIO_AUTH_TOKEN,
    fromNumber: raw.TWILIO_FROM_NUMBER,
  }),

  whatsapp: Object.freeze({
    phoneNumberId: raw.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: raw.WHATSAPP_ACCESS_TOKEN,
    verifyToken: raw.WHATSAPP_VERIFY_TOKEN,
  }),

  reviews: Object.freeze({
    googlePlaceId: raw.GOOGLE_PLACE_ID,
    googleApiKey: raw.GOOGLE_API_KEY,
    facebookPageAccessToken: raw.FACEBOOK_PAGE_ACCESS_TOKEN,
  }),

  sentry: Object.freeze({
    dsn: raw.SENTRY_DSN,
    authToken: raw.SENTRY_AUTH_TOKEN,
    org: raw.SENTRY_ORG,
    project: raw.SENTRY_PROJECT,
  }),

  adminIpAllowlist: Object.freeze(splitAllowlist(raw.ADMIN_IP_ALLOWLIST)),

  logLevel: raw.LOG_LEVEL,
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || undefined,
  gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || undefined,
  plausibleDomain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() || undefined,
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
});

/** Optional runtime configuration read by seed tooling only. */
export function seedAdminCredentials(): { email: string | undefined; password: string | undefined } {
  return { email: raw.ADMIN_EMAIL, password: raw.ADMIN_PASSWORD };
}
