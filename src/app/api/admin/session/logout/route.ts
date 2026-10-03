/**
 * POST /api/admin/session/logout — sign out.
 * ============================================================================
 *   200 → ApiResult<{ signedOut: true }>   (session row deleted, cookies cleared)
 *   429 → RATE_LIMITED
 *
 * CSRF-checked like every other admin write: a cross-site POST must not be able
 * to sign a member of staff out.
 */
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const { DELETE: signOut } = await import("@/app/api/admin/session/route");
  return signOut(req);
}

/** `GET`/`DELETE` on the same path so `fetch(url, { method: "DELETE" })` works. */
export async function DELETE(req: NextRequest): Promise<Response> {
  const { DELETE: signOut } = await import("@/app/api/admin/session/route");
  return signOut(req);
}
