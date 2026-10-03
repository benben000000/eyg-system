/**
 * EDGE-SAFE CONSTANTS — imported by both `middleware.ts` (edge runtime) and
 * `src/lib/server/auth.ts` (Node runtime).
 *
 * It exists so the session cookie name is defined in exactly one place. The
 * middleware cannot import `auth.ts` (that pulls in `node:crypto`, `argon2` and
 * Prisma, none of which run on the edge), and a hardcoded duplicate of the
 * cookie name would silently drift.
 */

/** Opaque staff session cookie. See `src/lib/server/auth.ts` for the design. */
export const SESSION_COOKIE = "eyg_session";

/** Readable CSRF double-submit cookie (the JS must echo it back in a header). */
export const CSRF_COOKIE = "eyg_csrf";

/** Header the double-submit token is presented in. */
export const CSRF_HEADER = "x-csrf-token";

/** Header the CSP nonce is published on, so `headers()` in the layout can read it. */
export const NONCE_HEADER = "x-nonce";

/**
 * Endpoints whose entire purpose is to be polled by an automated agent: the
 * container HEALTHCHECK, an uptime monitor, a load balancer, an operator's
 * `curl`.
 *
 * The exemption from the middleware's bot damping is explicit here rather than
 * inherited from `PUBLIC_API_PREFIXES`. That list answers a different question —
 * "reachable without a staff session" — and it includes `/api/booking` and
 * `/api/quote`, which are precisely what the scraper block exists to protect.
 * Reusing it would reopen both to scrapers in exchange for fixing the probes.
 *
 * Why this is not only a CI problem. `wget/`, `curl/`, `python-requests` and
 * `node-fetch` are all in the middleware's scraper list, so with no exemption the
 * health endpoints answered 403 to every non-browser caller. The container image
 * could therefore never report healthy, and no external monitor could have told
 * whether the shop was up. An endpoint you cannot poll is not a health check.
 *
 * Neither endpoint exposes customer data: `/api/health` touches nothing but the
 * process, and `/api/ready` reports readiness.
 */
export const PROBE_API_PATHS = ["/api/health", "/api/ready"] as const;

/** True for the health and readiness probes, and nothing else. */
export function isProbeApi(pathname: string): boolean {
  return PROBE_API_PATHS.some((p) => pathname === p);
}

/** Endpoints that must stay reachable without a staff session. */
export const PUBLIC_API_PREFIXES = [
  "/api/availability",
  "/api/booking",
  "/api/quote",
  "/api/captcha",
  "/api/reviews",
  "/api/health",
] as const;

/** Prefixes behind the staff guard. */
/**
 * Path prefixes behind the middleware shallow guard (IP allowlist + session
 * cookie presence). `withAdmin` in each route handler remains the authoritative
 * check — this is defence in depth, so that a route which forgets the guard
 * still fails closed at the edge.
 *
 * `/api/inventory` is here for exactly that reason. It is NOT under
 * `/api/admin`, so before this it received no middleware guard at all.
 */
export const ADMIN_PREFIXES = ["/admin", "/api/admin", "/api/inventory", "/inventory"] as const;

/** Static assets Next serves — never rate limited, never guarded. */
export const STATIC_ASSET_RE =
  /\/_next\/static|\/_next\/image|\/favicon|\/icon|\/apple-icon|\/robots\.txt|\/sitemap|\/brand\/|\/fonts\/|\/og\/|\.svg$|\.png$|\.jpg$|\.webp$|\.avif$|\.ico$|\.woff2?$/i;
