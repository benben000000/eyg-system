/**
 * POST /api/admin/session/login — staff sign-in.
 * ============================================================================
 *   200 → ApiResult<AdminSessionDto>   (sets `eyg_session` + `eyg_csrf` cookies)
 *   400 → VALIDATION_ERROR
 *   401 → UNAUTHENTICATED  ("Invalid email or password." — always, for any failure)
 *   429 → RATE_LIMITED     (login tier: 8 per 15 min per IP)
 *   503 → SERVICE_UNAVAILABLE
 *
 * A thin alias over `POST /api/admin/session`, kept because an admin form that
 * posts to `/api/admin/session/login` is the obvious URL and having both means
 * nobody has to guess. The CSRF origin check in middleware does not apply to
 * sign-in (there is no session to protect yet).
 */
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const { POST: signIn } = await import("@/app/api/admin/session/route");
  return signIn(req);
}
