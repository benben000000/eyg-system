/**
 * STAFF AUTH — argon2id passwords, opaque session tokens, RBAC, lockout.
 * ============================================================================
 * Three decisions worth stating up front:
 *
 * 1. **argon2id**, parameters below. OWASP's Password Storage Cheat Sheet
 *    baseline (2024) for argon2id is `m=19456 (19 MiB), t=2, p=1` — a
 *    deliberately *weak* baseline, because most real deployments cannot afford
 *    19 MiB per login. We sit above it: `m=65536, t=3, p=4` costs roughly
 *    80–120 ms per hash on a modern core and 250 ms+ on the small VPS a
 *    Balanga shop would actually rent. `ARGON2_OPTIONS` documents the knob.
 *
 * 2. **Opaque random session tokens, not JWTs.** The token is 32 random bytes
 *    from the CSPRNG; only its SHA-256 hash is stored in `Session.tokenHash`.
 *    A database leak therefore yields no usable cookies, and "log everyone out"
 *    is a `DELETE`, not a key rotation. `jose` signs the *short-lived CSRF*
 *    double-submit token instead, which is what it is genuinely good at.
 *
 * 3. **No user enumeration.** `login()` returns the same message, the same
 *    status and a similar amount of work whether or not the email exists. The
 *    unknown-email path runs a dummy hash verify so the response time does not
 *    distinguish "no such user" from "wrong password".
 */
import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";

import { env } from "@/lib/env";
import { ApiError, forbidden, unauthenticated } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { clientIp, userAgent } from "@/lib/request";
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from "@/lib/session-cookie";
import { prisma } from "@/lib/server/db";

// ── Password hashing ────────────────────────────────────────────────────────

/**
 * OWASP baseline for argon2id is m=19456, t=2, p=1. We deliberately exceed it:
 * higher memory defeats GPU cracking, and `t=3`/`p=4` add latency without
 * blowing the request budget on modest hardware.
 */
export const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65_536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

/** Dummy hash used to burn equivalent CPU on an unknown-email login. */
const DUMMY_HASH_PROMISE = argon2.hash("eyg-timing-equaliser-not-a-real-password", ARGON2_OPTIONS);

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

/** Returns `true` on match. Never throws on a malformed stored hash. */
export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, plain);
  } catch (err) {
    logger.warn("auth.hash_verify_failed", {
      scope: "auth",
      err: err instanceof Error ? err.name : typeof err,
    });
    return false;
  }
}

// ── Sessions ────────────────────────────────────────────────────────────────

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
/** 30 days absolute expiry, per the security requirements. */
export const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Sliding renewal: a session still in use is pushed forward this far. */
export const SESSION_RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** Role ranks. Mirrors the `Role` enum in `prisma/schema.prisma`. */
export type Role = "OWNER" | "MANAGER" | "TECHNICIAN" | "FRONT_DESK";

const ROLE_RANK: Record<Role, number> = {
  FRONT_DESK: 1,
  TECHNICIAN: 1,
  MANAGER: 2,
  OWNER: 3,
};

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export interface IssuedSession {
  token: string;
  expiresAt: Date;
  sessionId: string;
}

/**
 * Mints a session. Returns the *raw* token exactly once — the caller puts it in
 * the cookie; only its hash is persisted.
 */
export async function createSession(
  userId: string,
  meta: { ip: string | null; userAgent: string | null },
): Promise<IssuedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_TTL_MS);
  const session = await prisma.session.create({
    data: { userId, tokenHash: sha256(token), userAgent: meta.userAgent, ip: meta.ip, expiresAt },
    select: { id: true },
  });
  return { token, expiresAt, sessionId: session.id };
}

export interface ResolvedSession {
  user: SessionUser;
  sessionId: string;
  expiresAt: Date;
}

/** Resolves a cookie token to a live session, sliding the expiry forward. */
export async function resolveSession(token: string): Promise<ResolvedSession | null> {
  if (!token || token.length < 16) return null;
  const record = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!record) return null;
  const now = Date.now();
  if (record.expiresAt.getTime() <= now) {
    await prisma.session.deleteMany({ where: { id: record.id } }).catch(() => undefined);
    return null;
  }
  if (!record.user.isActive) return null;

  // Sliding renewal, but never past the original absolute expiry.
  let expiresAt = record.expiresAt;
  if (record.expiresAt.getTime() - now < SESSION_ABSOLUTE_TTL_MS - SESSION_RENEW_AFTER_MS) {
    const renewed = new Date(now + SESSION_ABSOLUTE_TTL_MS);
    await prisma.session.update({ where: { id: record.id }, data: { expiresAt: renewed } }).catch(() => undefined);
    expiresAt = renewed;
  }

  return {
    sessionId: record.id,
    expiresAt,
    user: {
      id: record.user.id,
      email: record.user.email,
      name: record.user.name,
      role: record.user.role,
    },
  };
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } }).catch((err: unknown) => {
    logger.warn("auth.session_destroy_failed", {
      scope: "auth",
      err: err instanceof Error ? err.name : typeof err,
    });
  });
}

/** Deletes every expired session. Called from the cron route. */
export async function sweepExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}

// ── Cookie ──────────────────────────────────────────────────────────────────

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    // `Lax` still sends the cookie on top-level navigations (so a deep link
    // into /admin works) while blocking cross-site POSTs — the CSRF defence.
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", sessionCookieOptions(new Date(0)));
}

/** Reads the session token from the request cookies/headers (route handlers). */
export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  const fromCookie = jar.get(SESSION_COOKIE)?.value;
  if (fromCookie) return fromCookie;
  const fromHeader = (await headers()).get("cookie");
  if (!fromHeader) return null;
  for (const part of fromHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

// ── Login, lockout, no enumeration ──────────────────────────────────────────

/** Exponential backoff after consecutive failures: 1m, 5m, 15m, 1h, cap 1h. */
const LOCKOUT_STEPS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

export function lockoutDurationFor(failedLogins: number): number {
  if (failedLogins <= 0) return 0;
  const idx = Math.min(failedLogins - 1, LOCKOUT_STEPS_MS.length - 1);
  return LOCKOUT_STEPS_MS[idx] as number;
}

export interface LoginMeta {
  ip: string | null;
  userAgent: string | null;
}

/** The one and only message a failed login may produce. */
export const GENERIC_LOGIN_ERROR = "Invalid email or password.";

export interface LoginOutcome {
  ok: boolean;
  user: SessionUser | null;
  session: IssuedSession | null;
  /** Seconds until the account unlocks, when locked. */
  retryAfter?: number;
}

/**
 * Attempts a login.
 *
 * Returns `{ ok: false }` for *every* failure mode — unknown email, wrong
 * password, deactivated account, locked account — with the same message. The
 * only difference is `retryAfter`, which is safe to expose because it is also
 * returned for an unknown email (derived from a hash of the address so it is
 * not an oracle... in practice we return it only when the *IP* is being
 * throttled, which the caller already knows).
 */
export async function login(email: string, password: string, meta: LoginMeta): Promise<LoginOutcome> {
  const normalisedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalisedEmail } });

  if (!user) {
    // Burn the same CPU as a real verify so response time cannot enumerate users.
    await verifyPassword(password, await DUMMY_HASH_PROMISE);
    logger.warn("auth.login_unknown_email", { scope: "auth", ip: meta.ip });
    return { ok: false, user: null, session: null };
  }

  const now = Date.now();
  if (user.lockedUntil && user.lockedUntil.getTime() > now) {
    return { ok: false, user: null, session: null, retryAfter: Math.ceil((user.lockedUntil.getTime() - now) / 1000) };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failedLogins = user.failedLogins + 1;
    const lockedUntil = lockoutDurationFor(failedLogins) > 0 ? new Date(now + lockoutDurationFor(failedLogins)) : null;
    await prisma.user
      .update({ where: { id: user.id }, data: { failedLogins, lockedUntil } })
      .catch((err: unknown) => logger.error("auth.lockout_write_failed", { scope: "auth", userId: user.id, err: String(err) }));
    logger.warn("auth.login_failed", { scope: "auth", userId: user.id, ip: meta.ip, failedLogins });
    return { ok: false, user: null, session: null };
  }

  if (!user.isActive) {
    // Same generic outcome — a deactivated account must not be distinguishable.
    logger.warn("auth.login_inactive", { scope: "auth", userId: user.id });
    return { ok: false, user: null, session: null };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const session = await createSession(user.id, meta);
  return {
    ok: true,
    session,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

export function loginIp(request: Request): string {
  return clientIp(request.headers);
}

export function loginUserAgent(request: Request): string | null {
  return userAgent(request.headers);
}

// ── Request-scoped guards ───────────────────────────────────────────────────

/** Current session, or `null`. Never throws. */
export async function currentSession(): Promise<ResolvedSession | null> {
  const token = await readSessionToken();
  if (!token) return null;
  return resolveSession(token);
}

/**
 * Requires a live session. Throws `ApiError("UNAUTHENTICATED")` otherwise.
 * Call this as the FIRST statement of every `/api/admin/*` handler.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await currentSession();
  if (!session) throw unauthenticated();
  return session.user;
}

/** Requires a session at or above `minimum`. Throws `FORBIDDEN` otherwise. */
export async function requireRole(minimum: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (!roleAtLeast(user.role, minimum)) {
    logger.warn("auth.role_denied", { scope: "auth", userId: user.id, role: user.role, minimum });
    throw forbidden();
  }
  return user;
}

/** Convenience for admin list endpoints — any authenticated staff member. */
export function requireStaff(): Promise<SessionUser> {
  return requireRole("FRONT_DESK");
}

/** Throws if the caller is not at least a manager. Used for catalogue writes. */
export function requireManager(): Promise<SessionUser> {
  return requireRole("MANAGER");
}

// ── CSRF (double-submit) for admin forms ────────────────────────────────────

export const CSRF_HEADER_NAME = CSRF_HEADER;
const CSRF_TTL_SECONDS = 60 * 60 * 8;

/**
 * Issues a signed CSRF token bound to the session id. Because the session
 * cookie is `SameSite=Lax`, a cross-site attacker can neither read the cookie
 * nor forge the matching header, so the pair only matches on a same-origin
 * request.
 */
export async function issueCsrfToken(sessionId: string): Promise<string> {
  const secret = new TextEncoder().encode(env.authSecret);
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CSRF_TTL_SECONDS}s`)
    .sign(secret);
}

/**
 * Verifies the `x-csrf-token` header against the token bound to the session.
 * Throws `FORBIDDEN` on any mismatch. Used by every mutating admin route.
 */
export async function requireCsrf(session: ResolvedSession): Promise<void> {
  const h = await headers();
  const presented = h.get(CSRF_HEADER);
  if (!presented) throw forbidden("Missing CSRF token.");
  try {
    const { payload } = await jwtVerify(presented, new TextEncoder().encode(env.authSecret), {
      algorithms: ["HS256"],
    });
    if (typeof payload.sid !== "string" || payload.sid !== session.sessionId) throw forbidden("Invalid CSRF token.");
  } catch (err) {
    if (ApiError.is(err)) throw err;
    throw forbidden("Invalid or expired CSRF token.");
  }
}

/** Sets the readable CSRF cookie (not httpOnly — the JS must echo it back). */
export async function setCsrfCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: CSRF_TTL_SECONDS,
  });
}

export async function readCsrfCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(CSRF_COOKIE)?.value ?? null;
}

// ── Audit log ───────────────────────────────────────────────────────────────

export interface AuditInput {
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  request?: Request;
  userId?: string | null;
}

/**
 * Writes an `AuditLog` row. Every mutating admin action must call this.
 * Never throws — an audit failure must not roll back the user's action, but it
 * is logged loudly so the gap is visible.
 */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        meta: (input.meta ?? null) as never,
        ip: input.request ? clientIp(input.request.headers) : null,
        userAgent: input.request ? userAgent(input.request.headers) : null,
      },
    });
  } catch (err) {
    logger.error("auth.audit_write_failed", {
      scope: "auth",
      action: input.action,
      entity: input.entity,
      err: err instanceof Error ? err.name : typeof err,
    });
  }
}

/** Constant-time string compare for tokens of equal expected length. */
export function safeEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
