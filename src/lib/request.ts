/**
 * REQUEST INTROSPECTION — verified IP, UA, UTM and request-id plumbing.
 * ============================================================================
 * The single most important job here is the IP. It is the primary key for rate
 * limiting, audit logs and the admin allowlist, so it must come from a *header
 * the platform proxy sets* — never from a header a browser could set itself.
 *
 * Resolution order (first match wins):
 *   1. `cf-connecting-ip` / `true-client-ip` / `fly-client-ip` — edge set
 *   2. `x-vercel-forwarded-for` / `x-real-ip`              — platform proxies
 *   3. `x-forwarded-for` left-most entry, but ONLY when a trusted-proxy marker
 *      header is also present (otherwise any client can forge it)
 *   4. `request.ip` (socket address supplied by the runtime)
 *   5. `"0.0.0.0"` — unknown, never empty, so rate-limit keys stay well-formed
 *
 * This module is runtime-agnostic (no `node:` imports) so `middleware.ts` can
 * use the IP/request-id helpers on the edge runtime.
 */

const EDGE_IP_HEADERS = ["cf-connecting-ip", "true-client-ip", "fly-client-ip"] as const;

const PLATFORM_IP_HEADERS = ["x-vercel-forwarded-for", "x-real-ip"] as const;

export const REQUEST_ID_HEADER = "x-request-id";

/** A request id is only trusted when it looks like a uuid / nanoid / short hex. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export function isValidIp(raw: string): boolean {
  const v = raw.trim();
  if (v.length === 0 || v.length > 45) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
    return v.split(".").every((o) => Number(o) >= 0 && Number(o) <= 255);
  }
  return /^[0-9a-fA-F:]{2,45}$/.test(v) && v.includes(":");
}

/**
 * Best-effort verified client IP.
 * `requestIp` is the adapter-provided socket address and is trusted because the
 * caller passes it from the server request object, not from a client header.
 */
export function clientIp(headers: Headers, requestIp?: string | null): string {
  for (const h of EDGE_IP_HEADERS) {
    const v = headers.get(h);
    if (v && isValidIp(v)) return v.trim();
  }
  for (const h of PLATFORM_IP_HEADERS) {
    const v = headers.get(h);
    if (v && isValidIp(v)) return v.trim();
  }
  const trustedProxy = Boolean(headers.get("x-vercel-id") ?? headers.get("fly-request-id") ?? headers.get("cf-ray"));
  if (trustedProxy) {
    const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (first && isValidIp(first)) return first;
  }
  if (requestIp && isValidIp(requestIp)) return requestIp;
  return "0.0.0.0";
}

export function userAgent(headers: Headers): string | null {
  const ua = headers.get("user-agent");
  if (!ua) return null;
  return ua.slice(0, 512);
}

function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `rid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Propagate an inbound request id when it is well-formed, else mint one. */
export function resolveRequestId(headers: Headers): string {
  const inbound = headers.get(REQUEST_ID_HEADER);
  if (inbound && SAFE_REQUEST_ID.test(inbound)) return inbound;
  return newId();
}

export interface Utm {
  source: string | null;
  campaign: string | null;
  medium: string | null;
  content: string | null;
  term: string | null;
}

/** Normalised UTM values for attribution on bookings/leads. */
export function utmFrom(headers: Headers): Utm {
  const read = (key: string): string | null => {
    const v = headers.get(key);
    if (!v) return null;
    const t = v.trim();
    if (t.length === 0 || t.length > 100) return null;
    return t;
  };
  return {
    source: read("utm_source"),
    campaign: read("utm_campaign"),
    medium: read("utm_medium"),
    content: read("utm_content"),
    term: read("utm_term"),
  };
}

/**
 * Header consulted for the minimum-time-to-submit check. The form renders a
 * hidden `ts` field and mirrors it here; a bot that never renders the page
 * cannot produce a sane value. Missing/invalid → the check is skipped, because
 * punishing a real customer with a blocked clock is worse than skipping it.
 */
export const FORM_RENDERED_AT_HEADER = "x-form-rendered-at";

export function clientTimestampFrom(headers: Headers): number | null {
  const v = headers.get(FORM_RENDERED_AT_HEADER);
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export interface RequestContext {
  requestId: string;
  ip: string;
  userAgent: string | null;
  utm: Utm;
  /** Epoch ms of the form render, when the client supplied it. */
  clientTimestamp: number | null;
}

export interface RequestLike {
  headers: Headers;
  /** Supplied by Node route handlers; unavailable on the edge. */
  ip?: string | null;
}

export function requestContext(req: RequestLike): RequestContext {
  const { headers } = req;
  return {
    requestId: resolveRequestId(headers),
    ip: clientIp(headers, req.ip),
    userAgent: userAgent(headers),
    utm: utmFrom(headers),
    clientTimestamp: clientTimestampFrom(headers),
  };
}
