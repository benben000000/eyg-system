/**
 * ROUTE HELPERS
 * ============================================================================
 * The glue between my API routes and the app's shared plumbing
 * (`@/lib/http`, `@/lib/errors`, `@/lib/request`, `@/lib/ratelimit`,
 * `@/lib/captcha`). Every route in `src/app/api/{reviews,leads,promos,webhooks,
 * cron,health}` starts here, which is what makes the security posture uniform:
 *
 *   request context → rate limit → raw-body read → signature → validate →
 *   persist → notify → respond
 *
 * Nothing in here throws into a route body unless the route wants it to.
 */

import { createHash } from "node:crypto";

import { ApiError, rateLimited, spamRejected, validationError } from "@/lib/errors";
import { fail, ok, withApi, type MetaInput } from "@/lib/http";
import { clientIp, requestContext, REQUEST_ID_HEADER } from "@/lib/request";
import type { z } from "zod";

import { log } from "@/lib/logger";
import { safeEqual } from "./crypto";
import { envStr, isProduction, webhookConfig } from "./env";
import { guardRateLimit, rateLimitHeaders, type GuardResult, type RouteTier } from "./rate-limit";

const logger = log.child({ scope: "integrations/api" });

/** Every route under my ownership is a Node route (raw bodies, Prisma, crypto). */
export const NODE_RUNTIME = "nodejs" as const;
/** Nothing is statically prerendered; all of these read request state or the DB. */
export const FORCE_DYNAMIC = "force-dynamic" as const;

// ── Request context ──────────────────────────────────────────────────────────

export interface RouteContext {
  requestId: string;
  ip: string;
  userAgent: string | null;
  utm: { source: string | null; campaign: string | null; medium: string | null; content: string | null; term: string | null };
  /** Epoch ms of the form render, when the client sent `x-form-rendered-at`. */
  renderedAt: number | null;
  meta: MetaInput;
}

export function contextFrom(req: Request): RouteContext {
  const ctx = requestContext({ headers: req.headers });
  return {
    requestId: ctx.requestId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    utm: ctx.utm,
    renderedAt: ctx.clientTimestamp,
    meta: { requestId: ctx.requestId },
  };
}

// ── Response helpers ─────────────────────────────────────────────────────────

/** `ApiSuccess` with a weak-ish (content) ETag and the standard cache headers. */
export function jsonWithCache<T>(
  data: T,
  ctx: RouteContext,
  options: { cacheControl?: string; etag?: string; status?: number; headers?: Record<string, string> } = {},
): Response {
  const etag = options.etag ? toWeakEtag(options.etag) : undefined;
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
    ...(etag ? { ETag: etag } : {}),
    [REQUEST_ID_HEADER]: ctx.requestId,
  };
  if (options.cacheControl) headers["Cache-Control"] = options.cacheControl;
  const res = ok(data, ctx.meta, { ...(options.status ? { status: options.status } : {}), headers });
  return res;
}

/** 304 when the client's ETag matches, otherwise a normal 200. */
export function jsonCached<T>(
  data: T,
  ctx: RouteContext,
  req: Request,
  options: { cacheControl: string; etag: string },
): Response {
  const etag = toWeakEtag(options.etag);
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch && matchesEtag(ifNoneMatch, etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": options.cacheControl,
        [REQUEST_ID_HEADER]: ctx.requestId,
      },
    });
  }
  return jsonWithCache(data, ctx, { cacheControl: options.cacheControl, etag: options.etag });
}

export function toWeakEtag(seed: string): string {
  const hash = createHash("sha1").update(seed).digest("base64url").slice(0, 27);
  return `W/"${hash}"`;
}

/** Handles `If-None-Match: *` and comma-separated lists and weak prefixes. */
export function matchesEtag(header: string, etag: string): boolean {
  if (header.trim() === "*") return true;
  const normalise = (v: string): string => v.trim().replace(/^W\//, "");
  const target = normalise(etag);
  return header.split(",").some((candidate) => normalise(candidate) === target);
}

/** Standard error response. */
export function failWith(error: ApiError, ctx: RouteContext, headers: Record<string, string> = {}): Response {
  const response = fail(error, ctx.meta);
  for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
  return response;
}

// ── Rate limiting ────────────────────────────────────────────────────────────

export interface GuardedContext extends RouteContext {
  guard: GuardResult;
}

/**
 * Consumes the rate-limit budget and returns the context, or a ready-made 429.
 * A route only needs:
 *
 *     const { ctx, denied } = await guard(req, "promos.claim", "promoClaim");
 *     if (denied) return denied;
 */
export async function guard(
  req: Request,
  action: string,
  tier: RouteTier,
  subject?: string,
): Promise<{ ctx: RouteContext; denied: Response | null; guard: GuardResult }> {
  const ctx = contextFrom(req);
  const result = await guardRateLimit(tier, action, clientIp(req.headers), subject);
  if (result.allowed) return { ctx, denied: null, guard: result };
  const error = result.error ?? rateLimited("Too many requests. Please wait a moment and try again.", result.retryAfter);
  return { ctx, denied: failWith(error, ctx, rateLimitHeaders(result)), guard: result };
}

// ── Body reading ─────────────────────────────────────────────────────────────

export interface RawBody {
  raw: string;
  json: unknown;
  form: URLSearchParams;
  bytes: number;
}

/**
 * Reads the request body ONCE, as text, and exposes it three ways.
 *
 * Signature verification requires the exact bytes the provider signed, so the
 * raw text is authoritative and the parsed forms are derived from it. A body
 * over `maxBytes` is rejected before it is buffered.
 */
export async function readBody(req: Request, maxBytes = 64 * 1024): Promise<RawBody> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw validationError("Request body is too large.");
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    throw validationError("We could not read that request. Please try again.");
  }
  if (raw.length > maxBytes) {
    throw validationError("Request body is too large.");
  }

  let json: unknown = null;
  try {
    json = raw.length > 0 ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }

  return { raw, json, form: new URLSearchParams(raw), bytes: raw.length };
}

/** JSON body or a 400. */
export function parseJsonBody<T>(body: RawBody, schema: z.ZodType<T>): T {
  if (body.json === null) throw validationError("Request body must be valid JSON.");
  const result = schema.safeParse(body.json);
  if (!result.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
      (fields[key] ??= []).push(issue.message);
    }
    throw validationError("Please check the highlighted fields.", fields);
  }
  return result.data;
}

// ── Anti-bot ─────────────────────────────────────────────────────────────────

/** A human cannot fill this and submit in under two seconds. */
export const MIN_SUBMIT_MS = 2_000;
/** Tolerance for a client clock that is ahead of the server. */
const FUTURE_TOLERANCE_MS = 60_000;

/**
 * Honeypot + minimum-time-to-submit. These two run on **every** public write
 * endpoint regardless of the captcha provider. A missing render stamp is not
 * punished (privacy-hardened browsers and bookmarklet posts do not send it);
 * only a stamp that is impossibly fast or absurdly future-dated is rejected.
 */
export function checkBotSignals(website: string | null | undefined, renderedAt: number | null | undefined): void {
  if (typeof website === "string" && website.trim().length > 0) {
    logger.warn("bot.honeypot", {});
    throw spamRejected("Your submission looked automated. Please try again.");
  }
  if (typeof renderedAt === "number" && Number.isFinite(renderedAt)) {
    const elapsed = Date.now() - renderedAt;
    if (elapsed < MIN_SUBMIT_MS || elapsed < -FUTURE_TOLERANCE_MS) {
      logger.warn("bot.too_fast", { elapsedMs: Math.round(elapsed) });
      throw spamRejected("That was submitted unusually fast. Please try again.");
    }
  }
}

// ── Shared auth guards (cron, readiness) ─────────────────────────────────────

export type AuthFailure = "missing-secret" | "no-secret-configured" | "bad-secret";

/**
 * Constant-time bearer check for the cron dispatcher and the readiness probe.
 *
 * Accepts `Authorization: Bearer <secret>`, `x-cron-secret: <secret>` and
 * `x-probe-secret: <secret>`.
 *
 * When no secret is configured:
 *   production -> `no-secret-configured` (the route must 503, never run open)
 *   elsewhere  -> allowed, loudly warned, so local cron works out of the box
 */
export function checkCronAuth(req: Request): { ok: true; degraded: boolean } | { ok: false; reason: AuthFailure } {
  const secret = webhookConfig().cronSecret;
  if (!secret) {
    if (isProduction()) {
      logger.error("cron.no_secret", { action: "refusing to run unauthenticated in production" });
      return { ok: false, reason: "no-secret-configured" };
    }
    logger.warn("cron.no_secret", { note: "running unauthenticated outside production" });
    return { ok: true, degraded: true };
  }

  const header = req.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim();
  const provided = bearer ?? req.headers.get("x-cron-secret")?.trim() ?? req.headers.get("x-probe-secret")?.trim() ?? "";

  if (provided.length === 0) {
    logger.warn("cron.auth_missing", {});
    return { ok: false, reason: "missing-secret" };
  }
  if (!safeEqual(provided, secret)) {
    logger.warn("cron.auth_rejected", {});
    return { ok: false, reason: "bad-secret" };
  }
  return { ok: true, degraded: false };
}

/** `/api/ready` detail is only revealed to a caller that holds the secret. */
export function maySeeReadinessDetail(req: Request): boolean {
  const secret = webhookConfig().readySecret;
  if (!secret) return !isProduction();
  const header = req.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim();
  const provided = bearer ?? req.headers.get("x-probe-secret")?.trim() ?? req.headers.get("x-cron-secret")?.trim() ?? "";
  return provided.length > 0 && safeEqual(provided, secret);
}

// ── Misc ─────────────────────────────────────────────────────────────────────

/** Coerces a query-string integer inside `[min, max]`, falling back to a default. */
export function queryInt(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** First present value from a set of possible query-parameter names. */
export function queryValue(url: string, ...names: string[]): string | null {
  try {
    const params = new URL(url).searchParams;
    for (const name of names) {
      const v = params.get(name);
      if (v !== null && v.trim().length > 0) return v.trim();
    }
  } catch {
    /* relative URL */
  }
  return null;
}

export { ok, fail, withApi, ApiError, envStr, isProduction };
