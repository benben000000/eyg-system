/**
 * Shared plumbing for every `/api/admin/*` route.
 * ============================================================================
 * Keeping the guard sequence in one place means a new admin endpoint cannot
 * accidentally skip a step. The order is always:
 *
 *   1. `requireRole(minimum)` — a live session at or above the minimum role
 *   2. `requireCsrf(session)`   — double-submit token (writes only)
 *   3. the handler, which returns data (never a raw Response)
 *   4. `writeAuditLog(...)`     — every mutating action
 *
 * Middleware has already done the cheap checks (`ADMIN_IP_ALLOWLIST`, cookie
 * presence, origin/referer); this module does the authoritative ones.
 */
import "server-only";

import type { NextRequest } from "next/server";

import { ok, withApi, type MetaInput } from "@/lib/http";
import { requestContext } from "@/lib/request";
import {
  currentSession,
  requireCsrf,
  requireRole,
  writeAuditLog,
  type Role,
  type SessionUser,
} from "@/lib/server/auth";

export interface AdminContext {
  request: NextRequest;
  requestId: string;
  ip: string;
  userAgent: string | null;
  meta: MetaInput;
  user: SessionUser;
}

/** What a guarded handler returns. The wrapper turns it into an `ApiResult`. */
export interface AdminResult<T> {
  data: T;
  status?: 200 | 201 | 204;
  headers?: Record<string, string>;
  cacheControl?: string;
}

type GuardedHandler<T> = (ctx: AdminContext) => Promise<AdminResult<T>>;

/**
 * Wraps an admin handler with the authoritative guard.
 *
 * `minimum` is the lowest role that may call it:
 *   `FRONT_DESK` — read the board, check a customer in, confirm a job
 *   `MANAGER`    — change the catalogue, close a bay, edit a promo
 *   `OWNER`      — anything, including staff accounts
 */
export function withAdmin<T>(
  minimum: Role,
  handler: GuardedHandler<T>,
  options: { csrf?: boolean } = {},
): (req: NextRequest) => Promise<Response> {
  const needsCsrf = options.csrf ?? true;
  return async function adminRoute(req: NextRequest): Promise<Response> {
    const ctx = requestContext(req);
    const meta: MetaInput = { requestId: ctx.requestId };

    return withApi<T>(meta, async () => {
      const user = await requireRole(minimum);
      if (needsCsrf) {
        const session = await currentSession();
        // `requireRole` already proved a session exists.
        if (session) await requireCsrf(session);
      }
      const result = await handler({
        request: req,
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta,
        user,
      });
      // Staff payloads contain customer PII: never cached by a CDN or the browser.
      return ok(result.data, meta, {
        ...(result.status ? { status: result.status } : {}),
        ...(result.headers ? { headers: result.headers } : {}),
        ...(result.cacheControl ? { cacheControl: result.cacheControl } : { private: true }),
      });
    });
  };
}

/** Read-only variant: a session is enough, no CSRF token is demanded. */
export function withAdminRead<T>(handler: GuardedHandler<T>): (req: NextRequest) => Promise<Response> {
  return withAdmin("FRONT_DESK", handler, { csrf: false });
}

export { currentSession, requireCsrf, requireRole, writeAuditLog };
export type { Role, SessionUser };
