/**
 * GET /api/admin/session/me — who am I, and is my CSRF token still good?
 * ============================================================================
 *   200 → ApiResult<AdminSessionDto>
 *   401 → UNAUTHENTICATED
 *
 * The admin shell calls this on mount. It is also the cheapest way for a page to
 * re-issue a CSRF token after the 8-hour token lifetime expires, without
 * forcing a re-login.
 */
import { withAdminRead } from "@/lib/server/admin-guard";
import { currentSession, issueCsrfToken } from "@/lib/server/auth";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AdminSessionDto {
  user: { id: string; email: string; name: string; role: string };
  csrfToken: string;
  expiresAt: string;
}

export const GET = withAdminRead<AdminSessionDto>(async () => {
  const session = await currentSession();
  if (!session) throw new ApiError("UNAUTHENTICATED", "Please sign in to continue.");
  return {
    data: {
      user: session.user,
      csrfToken: await issueCsrfToken(session.sessionId),
      expiresAt: session.expiresAt.toISOString(),
    },
  };
});
