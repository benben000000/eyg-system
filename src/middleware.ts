/**
 * EDGE MIDDLEWARE — security headers, CSP nonce, CSRF, bot damping, admin guard.
 * ============================================================================
 * Runs on every request before a page or route handler. Deliberately
 * edge-safe: no `node:` imports, no Prisma, no argon2. Anything that needs those
 * lives in the route handler behind `requireUser()`.
 *
 * The layering this file enforces:
 *
 *   static assets   → pass straight through, no headers beyond HSTS
 *   /api/*          → bot damping, CSRF origin check, no staff guard on the
 *                     public booking/quote/captcha/reviews/health endpoints
 *   /api/admin/*    → IP allowlist + session-cookie presence (shallow guard),
 *                     then `requireUser()` in the handler does the real check
 *   /admin          → same shallow guard, redirected to the sign-in screen
 *   pages           → permissive rate limit, CSP nonce, full header set
 *
 * The admin guard here is intentionally *shallow*: it can only see whether the
 * cookie exists, not whether it is valid (that needs the database). A forged or
 * stale cookie gets past middleware and is rejected by the handler, which is
 * the correct place for the authoritative check.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { REQUEST_ID_HEADER, clientIp, resolveRequestId } from "@/lib/request";
import { ADMIN_PREFIXES, CSRF_COOKIE, NONCE_HEADER, PUBLIC_API_PREFIXES, SESSION_COOKIE, STATIC_ASSET_RE, isProbeApi } from "@/lib/session-cookie";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ── CSP ─────────────────────────────────────────────────────────────────────

/**
 * Sources we are willing to load from. Kept tight on purpose:
 *  - `https://*.fbcdn.net` — Facebook OG images and the page plugin.
 *  - `https://images.unsplash.com` — gallery photography.
 *  - `https://*.googleapis.com` — the Google Maps embed and map tiles.
 *  - `https://api.resend.com` — server-side email only; harmless in the policy
 *    and it means a future client-side mail widget does not need a CSP change.
 */
function contentSecurityPolicy(nonce: string): string {
  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    // `strict-dynamic` lets a nonce'd Next.js bootstrap load its own chunks
    // without enumerating every hashed path. Browsers that do not understand it
    // fall back to `'self'`.
    ["script-src", ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]],
    // Tailwind v4 and `next/font` both inject inline styles, so inline style is
    // required. It is a materially smaller risk than inline script.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", "https://*.fbcdn.net", "https://images.unsplash.com", "https://*.googleapis.com"]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", ["'self'", "https://*.googleapis.com", "https://api.resend.com"]],
    ["frame-src", ["'self'", "https://www.google.com", "https://www.facebook.com"]],
    ["media-src", ["'self'"]],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  if (env.isProduction) directives.push(["upgrade-insecure-requests", []]);

  return directives.map(([key, values]) => (values.length > 0 ? `${key} ${values.join(" ")}` : key)).join("; ");
}

function applySecurityHeaders(res: NextResponse, nonce: string, requestId: string): NextResponse {
  res.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
  res.headers.set(NONCE_HEADER, nonce);
  res.headers.set(REQUEST_ID_HEADER, requestId);
  res.headers.set("X-DNS-Prefetch-Control", "on");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-XSS-Protection", "0");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), interest-cohort=()");
  res.headers.set("X-Download-Options", "noopen");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (env.isProduction) {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return res;
}

// ── CSRF: origin / referer allowlist ────────────────────────────────────────

/**
 * SECURITY: the allowlist is built ONLY from trusted configuration. It must
 * NEVER be derived from the inbound `Host` header — an attacker controls that
 * header, so `Host: evil.example` + `Origin: http://evil.example` would authorise
 * its own cross-site POST and the CSRF defence would certify itself (DEF-012).
 *
 * Sources, in order:
 *   1. `NEXT_PUBLIC_SITE_URL`  — the canonical origin. Required in production.
 *   2. `CSRF_ALLOWED_ORIGINS`   — explicit comma-separated extras (preview hosts).
 *   3. The inbound `Host`       — **development only**, so localhost and LAN IPs work.
 *
 * Plaintext `http://` is never trusted in production.
 */
function buildOriginAllowlist(req: NextRequest): Set<string> {
  const allowed = new Set<string>();

  const push = (raw: string | undefined | null, opts: { requireHttps?: boolean } = {}) => {
    const trimmed = (raw ?? "").trim().replace(/\/+$/, "");
    if (trimmed.length <= "://".length) return;
    try {
      const url = new URL(trimmed);
      // Extras must be HTTPS in production, so a typo or a stray plaintext
      // preview origin cannot weaken the check. The canonical
      // `NEXT_PUBLIC_SITE_URL` is exempt: the operator declares it explicitly,
      // `env.ts` requires it to be present in production, and a local
      // `next start` legitimately runs on http://localhost.
      if (opts.requireHttps && env.isProduction && url.protocol !== "https:") return;
      allowed.add(url.origin);
    } catch {
      /* malformed entry — ignore it rather than widening the allowlist */
    }
  };

  push(env.siteUrl);
  for (const extra of (env.csrfAllowedOrigins ?? "").split(",")) push(extra, { requireHttps: true });

  if (!env.isProduction) {
    const host = req.headers.get("host");
    push(host && `http://${host}`);
    push(host && `https://${host}`);
  }

  return allowed;
}

/** Memoised per-process: the allowlist cannot change within a request lifecycle. */
let originAllowlistCache: { key: string; set: Set<string> } | null = null;
function originAllowlist(req: NextRequest): Set<string> {
  const key = `${env.siteUrl}|${env.csrfAllowedOrigins ?? ""}|${env.isProduction ? "prod" : "dev"}`;
  if (!originAllowlistCache || originAllowlistCache.key !== key) {
    originAllowlistCache = { key, set: buildOriginAllowlist(req) };
  }
  return originAllowlistCache.set;
}

function originAllowed(req: NextRequest): boolean {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) return true;

  const allowed = originAllowlist(req);

  // Fail closed: if production somehow has an empty allowlist, reject mutations
  // rather than accept them all.
  if (allowed.size === 0) {
    return env.isProduction ? false : true;
  }

  const origin = req.headers.get("origin");
  if (origin) return allowed.has(origin.replace(/\/+$/, ""));

  // Some privacy tools strip `Origin` on same-origin form posts. Fall back to
  // `Referer`, and only accept an exact origin match.
  const referer = req.headers.get("referer");
  if (!referer) {
    // Neither header: a real browser always sends one for a cross-site POST, so
    // this is a non-browser client. Provider webhooks authenticate with
    // `WEBHOOK_SIGNING_SECRET` instead of cookies, so they are exempt.
    return req.nextUrl.pathname.startsWith("/api/webhooks");
  }
  try {
    return allowed.has(new URL(referer).origin);
  } catch {
    return false;
  }
}

// ── Bot damping ─────────────────────────────────────────────────────────────

/** Obvious scrapers. Matched on the UA only — no behavioural heuristics here. */
const SCRAPER_UA = [
  "semrushbot",
  "ahrefsbot",
  "mj12bot",
  "dotbot",
  "rogerbot",
  "blexbot",
  "petalbot",
  "yandexbot",
  "screaming frog",
  "python-requests",
  "python-urllib",
  "curl/",
  "wget/",
  "libwww-perl",
  "scrapy",
  "headlesschrome",
  "phantomjs",
  "puppeteer",
  "playwright",
  "okhttp",
  "java/",
  "go-http-client",
  "axios/",
  "node-fetch",
];

/** Some of the above are legitimate SEO bots that must NOT be blocked. */
const ALLOWED_BOTS = ["googlebot", "bingbot", "applebot", "facebookexternalhit", "twitterbot", "slackbot", "discordbot"];

function isLikelyScraper(ua: string | null): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  if (ALLOWED_BOTS.some((b) => lower.includes(b))) return false;
  return SCRAPER_UA.some((b) => lower.includes(b));
}

/**
 * Permissive, per-instance page-load limiter. Generous on purpose: a customer
 * on 3G clicking through the funnel can fire a dozen requests in a minute and
 * must never see a 429. Its job is to blunt a runaway script, not to meter
 * humans.
 */
const PAGE_MAX_PER_MINUTE = 120;
const pageHits = new Map<string, { count: number; resetAt: number }>();

function pageRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = pageHits.get(ip);
  if (!entry || entry.resetAt <= now) {
    pageHits.set(ip, { count: 1, resetAt: now + 60_000 });
    if (pageHits.size > 5_000) {
      const oldest = pageHits.keys().next();
      if (!oldest.done) pageHits.delete(oldest.value);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > PAGE_MAX_PER_MINUTE;
}

// ── Admin guard ─────────────────────────────────────────────────────────────

/** True when `ip` matches an entry in `ADMIN_IP_ALLOWLIST`. Empty = disabled. */
export function ipAllowed(ip: string, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) return true; // disabled
  for (const rule of allowlist) {
    if (rule.includes("/")) {
      if (cidrMatch(ip, rule)) return true;
      continue;
    }
    if (rule === ip) return true;
  }
  return false;
}

function cidrMatch(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split("/");
  if (!range || bitsRaw === undefined) return false;
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const toLong = (v: string): number | null => {
    const parts = v.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
    return ((parts[0] as number) << 24) | ((parts[1] as number) << 16) | ((parts[2] as number) << 8) | (parts[3] as number);
  };
  const ipLong = toLong(ip);
  const rangeLong = toLong(range);
  if (ipLong === null || rangeLong === null) return false; // IPv6 rules are not supported
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipLong & mask) === (rangeLong & mask);
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAdmin(pathname: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function problem(
  status: number,
  code: string,
  message: string,
  requestId: string,
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code, message }, meta: { requestId } },
    { status, headers: { ...headers, [REQUEST_ID_HEADER]: requestId } },
  );
}

// ── Entry point ─────────────────────────────────────────────────────────────

export function middleware(req: NextRequest): NextResponse {
  const requestId = resolveRequestId(req.headers);
  const pathname = req.nextUrl.pathname;
  // `NextRequest.ip` was removed in Next 15, so the verified IP comes purely
  // from proxy-set headers. See `src/lib/request.ts` for the resolution order.
  const ip = clientIp(req.headers);
  const ua = req.headers.get("user-agent");
  const log = logger.child({ requestId, scope: "middleware", path: pathname });

  // 1. Static assets: straight through. CSP on an image response is wasted bytes.
  if (STATIC_ASSET_RE.test(pathname)) {
    const res = NextResponse.next();
    res.headers.set(REQUEST_ID_HEADER, requestId);
    return res;
  }

  const isApi = pathname.startsWith("/api/");

  // 2. Bot damping. Scrapers get a hard 403 on the API so they cannot burn
  //    database connections; real browsers are untouched.
  //
  //    `/api/health` and `/api/ready` are exempt, and the exemption is
  //    deliberately narrow — see PROBE_API_PATHS. `wget/`, `curl/` and
  //    `python-requests` are all in the list below, so without this the
  //    container's own HEALTHCHECK is answered with a 403 and the image can
  //    never report healthy. Same for every uptime monitor and load balancer
  //    that probes over HTTP rather than pretending to be a browser.
  if (isApi && !isProbeApi(pathname) && isLikelyScraper(ua)) {
    log.warn("bot.blocked", { ip, reason: "scraper_ua" });
    return problem(403, "FORBIDDEN", "Automated access is not allowed.", requestId);
  }

  // 3. Page-load damping. Deliberately not applied to `/api/*`: those routes
  //    have their own tiered budgets (a booking submit must not be blocked just
  //    because the customer browsed ten pages first).
  if (!isApi && pageRateLimited(ip)) {
    log.warn("bot.page_rate_limited", { ip });
    return problem(429, "RATE_LIMITED", "Too many requests. Please slow down.", requestId, { "Retry-After": "30" });
  }

  // 4. CSRF origin check on state-changing requests.
  if (MUTATING_METHODS.has(req.method.toUpperCase()) && !originAllowed(req)) {
    // The origins themselves are not sensitive, and naming them is the only way
    // an operator can debug "my form always 403s" without reading the source.
    log.warn("csrf.rejected", {
      ip,
      method: req.method,
      path: pathname,
      origin: req.headers.get("origin") ?? null,
      referer: req.headers.get("referer") ?? null,
      allowed: [...originAllowlist(req)],
      siteUrl: env.siteUrl,
      isProduction: env.isProduction,
    });
    return problem(403, "FORBIDDEN", "Request blocked by the security check. Please reload the page.", requestId);
  }

  // 5. Admin guard. `/api/booking`, `/api/quote`, `/api/captcha`, `/api/reviews`
  //    and `/api/health` are on `PUBLIC_API_PREFIXES` and therefore never reach
  //    this block — that is what makes the "public without admin auth" rule
  //    explicit rather than incidental.
  if (isAdmin(pathname) && !isPublicApi(pathname)) {
    // The IP allowlist always applies, including on the sign-in screen.
    if (!ipAllowed(ip, env.adminIpAllowlist)) {
      log.warn("admin.ip_blocked", { ip });
      return isApi
        ? problem(403, "FORBIDDEN", "This area is not available from your network.", requestId)
        : NextResponse.redirect(new URL("/403", req.url));
    }
    // …but the session redirect must never fire on the sign-in screen itself,
    // or the browser loops `/admin/login → /admin/login?next=…` forever.
    const isSignInPage = pathname === "/admin/login" || pathname === "/admin/login/";
    const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
    const hasCsrf = Boolean(req.cookies.get(CSRF_COOKIE)?.value);
    if (!hasSession && !isSignInPage) {
      if (isApi) return problem(401, "UNAUTHENTICATED", "Please sign in to continue.", requestId);
      const url = new URL("/admin/login", req.url);
      // Preserve where the staff member was heading, but never an absolute URL
      // (that would be an open redirect).
      url.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(url);
    }
    if (!hasCsrf && hasSession && !isSignInPage && MUTATING_METHODS.has(req.method.toUpperCase())) {
      log.warn("admin.csrf_cookie_missing", { ip });
      return problem(403, "FORBIDDEN", "Missing CSRF cookie. Please sign in again.", requestId);
    }
  }

  // 6. Everything else: pass through with the full header set + a fresh nonce.
  //    The nonce goes on BOTH the request headers (so `headers()` in the root
  //    layout can read it and stamp `<script nonce={…}>`) and the response
  //    headers (so the CSP can reference it).
  const nonce = base64UrlNonce();  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  return applySecurityHeaders(res, nonce, requestId);
}

function base64UrlNonce(): string {
  const bytes = new Uint8Array(16);
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  // `btoa` exists on both the edge runtime and Node >= 16.
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const config = {
  /**
   * Everything except static assets (handled in code, because the regex must
   * stay in one place with the scraper list). `api/webhooks` is matched here so
   * provider callbacks never pay for CSP generation.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
