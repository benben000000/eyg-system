/**
 * /api/admin/session — the staff sign-in screen's data.
 * ============================================================================
 *   GET    → ApiResult<SessionUser & { csrfToken }>   200 | 401
 *   POST   → sign in.                                    200 | 401 | 429 | 503
 *   DELETE → sign out.                                  204
 *
 * Guard: middleware already enforces the `ADMIN_IP_ALLOWLIST` and the presence of
 * a session cookie; this route does the authoritative check.
 *
 * Security properties:
 *  - **No user enumeration.** `login()` returns one message for an unknown
 *    email, a wrong password, a locked account and a deactivated account, and
 *    burns equivalent CPU on the unknown-email path.
 *  - **Lockout.** Consecutive failures back off 1m → 5m → 15m → 1h.
 *  - **Rate limited** on the `login` tier, keyed on the verified IP only — the
 *    email is deliberately *not* part of the key, so an attacker cannot lock a
 *    colleague out by guessing their address.
 *  - **CSRF** is issued with the session so admin forms can double-submit it.
 */
import type { NextRequest } from "next/server";

import { created, ok, parseBody, withApi, type MetaInput } from "@/lib/http";
import { ApiError } from "@/lib/errors";
import { clientIp, userAgent } from "@/lib/request";
import { loginLimiter, rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import {
  clearSessionCookie,
  currentSession,
  destroySession,
  issueCsrfToken,
  login,
  readSessionToken,
  setCsrfCookie,
  setSessionCookie,
  writeAuditLog,
} from "@/lib/server/auth";
import { loginSchema } from "@/lib/server/validation/admin";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AdminSessionDto {
  user: { id: string; email: string; name: string; role: string };
  /** Send this back in the `x-csrf-token` header on every admin write. */
  csrfToken: string;
  expiresAt: string;
}

/** GET — who am I? Used by the admin shell to decide whether to render. */
export async function GET(req: NextRequest): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? "admin-session";
  const meta: MetaInput = { requestId };

  return withApi<AdminSessionDto>(meta, async () => {
    const session = await currentSession();
    if (!session) throw new ApiError("UNAUTHENTICATED", "Please sign in to continue.");
    const csrfToken = await issueCsrfToken(session.sessionId);
    return ok(
      {
        user: session.user,
        csrfToken,
        expiresAt: session.expiresAt.toISOString(),
      },
      meta,
      { private: true },
    );
  });
}

/** POST — sign in. */
export async function POST(req: NextRequest): Promise<Response> {
  const ctx = { requestId: req.headers.get("x-request-id") ?? "admin-login" };
  const meta: MetaInput = { requestId: ctx.requestId };

  return withApi<AdminSessionDto>(meta, async () => {
    // 1. Rate limit BEFORE parsing, so a flood of malformed bodies still costs
    //    the attacker their budget. Keyed on the IP alone — never the email, so
    //    nobody can lock a colleague out by guessing their address.
    //    `rateLimit` throws `ApiError("RATE_LIMITED")`, which `fail()` renders
    //    with `Retry-After` from `error.retryAfter`.
    const limit = await rateLimit({ action: "admin.login", ip: clientIp(req.headers), policy: loginLimiter, requestId: ctx.requestId });

    const body = await parseBody(req, loginSchema);

    const outcome = await login(body.email, body.password, {
      ip: clientIp(req.headers),
      userAgent: userAgent(req.headers),
    });

    if (!outcome.ok || !outcome.session || !outcome.user) {
      // Identical response for every failure mode. `retryAfter` is only
      // returned when the account is actually locked, which an attacker learns
      // nothing useful from (it says "this password was wrong", not "this
      // account exists" — an unknown email never returns it).
      throw new ApiError("UNAUTHENTICATED", "Invalid email or password.", {
        status: 401,
        ...(outcome.retryAfter !== undefined ? { retryAfter: outcome.retryAfter } : {}),
        details: outcome.retryAfter !== undefined ? { retryAfter: outcome.retryAfter } : undefined,
      });
    }

    await setSessionCookie(outcome.session.token, outcome.session.expiresAt);
    const csrfToken = await issueCsrfToken(outcome.session.sessionId);
    await setCsrfCookie(csrfToken);

    await writeAuditLog({
      action: "auth.login",
      entity: "User",
      entityId: outcome.user.id,
      userId: outcome.user.id,
      request: req,
      meta: { role: outcome.user.role },
    });

    logger.info("auth.login_ok", { requestId: ctx.requestId, scope: "auth", userId: outcome.user.id, role: outcome.user.role });

    return created(
      { user: outcome.user, csrfToken, expiresAt: outcome.session.expiresAt.toISOString() },
      meta,
      { private: true, headers: rateLimitHeaders(loginLimiter, limit) },
    );
  });
}

/** DELETE — sign out and destroy the session row. */
export async function DELETE(req: NextRequest): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? "admin-logout";
  const meta: MetaInput = { requestId };

  return withApi<{ signedOut: true }>(meta, async () => {
    const session = await currentSession();
    if (session) {
      await writeAuditLog({
        action: "auth.logout",
        entity: "User",
        entityId: session.user.id,
        userId: session.user.id,
        request: req,
      });
    }
    const token = await readSessionToken();
    if (token) await destroySession(token);
    await clearSessionCookie();
    return ok({ signedOut: true }, meta, { private: true });
  });
}
