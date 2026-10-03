/**
 * PUBLIC ENV — the only environment module a Client Component may import.
 * ============================================================================
 * `src/lib/env.ts` is `server-only`: importing it from anything that reaches the
 * browser bundle is a build error. This module is the deliberate escape hatch.
 *
 * It contains `NEXT_PUBLIC_*` values and nothing else. Every key here is
 * inlined into the client bundle at build time by Next.js, which means these
 * values are **public forever** — including in the git history of a fork.
 *
 * The rule this file exists to make hard: if a value must never leave the
 * server, it does not belong here. No `DATABASE_URL`, no `AUTH_SECRET`, no
 * `TURNSTILE_SECRET_KEY` (only the Turnstile *site* key is public).
 *
 * Nothing is validated at runtime here: `process.env.NEXT_PUBLIC_*` is replaced
 * with a literal by the Next compiler, so a zod schema would either be stripped
 * or would validate a value the client cannot change. `NEXT_PUBLIC_SITE_URL` is
 * validated at boot by `src/lib/env.ts` (server side) — see the comment there.
 */

/** Canonical origin, no trailing slash. Validated at boot by `env.ts`. */
export const siteUrl: string = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Google Maps JavaScript API key. Public by design; MUST be restricted by HTTP
 * referrer in the Google Cloud console, and restricted to the Maps JS API.
 * Never use it for anything that costs money to call.
 */
export const googleMapsApiKey: string | undefined = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;

/** GA4 measurement ID (`G-XXXXXXX`). Undefined = analytics stays off. */
export const gaMeasurementId: string | undefined = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || undefined;

/** Plausible domain. Undefined = Plausible stays off. */
export const plausibleDomain: string | undefined = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || undefined;

/**
 * Cloudflare Turnstile **site** key. The matching secret key is server-only and
 * lives in `env.captcha.turnstileSecretKey`. When this is undefined the site
 * falls back to the built-in arithmetic challenge.
 */
export const turnstileSiteKey: string | undefined = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined;

/** Shown in the footer and sent to Sentry as a release tag. */
export const appVersion: string = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

/**
 * Frozen so a Client Component cannot mutate a value that other components have
 * already read, which would produce a hydration mismatch.
 */
export const publicEnv = Object.freeze({
  siteUrl,
  googleMapsApiKey,
  gaMeasurementId,
  plausibleDomain,
  turnstileSiteKey,
  appVersion,
}) as Readonly<{
  siteUrl: string;
  googleMapsApiKey: string | undefined;
  gaMeasurementId: string | undefined;
  plausibleDomain: string | undefined;
  turnstileSiteKey: string | undefined;
  appVersion: string;
}>;

/**
 * Absolute URL from a site-relative path. Duplicated here (rather than imported
 * from `@/lib/utils`, which `env.ts` deliberately does not depend on) so a
 * Client Component never pulls in server code to build a link.
 */
export function absoluteUrl(path = "/"): string {
  return new URL(path.startsWith("/") ? path : `/${path}`, siteUrl).toString();
}
