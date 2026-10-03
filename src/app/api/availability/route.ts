/**
 * GET /api/availability — the slot board.
 * ============================================================================
 *   200 → ApiResult<SlotAvailabilityDto>
 *   400 → VALIDATION_ERROR  (bad/absent `date`, or outside the horizon)
 *   429 → RATE_LIMITED      (`RateLimit-*` + `Retry-After`, read tier: fails open)
 *   503 → SERVICE_UNAVAILABLE when the database is unreachable
 *
 * Public. No session required (middleware allows `/api/availability` through).
 * Read-only: no captcha, no honeypot — those protect writes.
 *
 * Query params (both forms accepted, because two different clients call it):
 *   ?date=2026-10-04
 *   ?date=2026-10-04&serviceIds=a&serviceIds=b
 *   ?date=2026-10-04&serviceIds=a,b
 */
import type { NextRequest } from "next/server";

import { ok, withApi, type MetaInput } from "@/lib/http";
import { ApiError } from "@/lib/errors";
import { readLimiter, rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { requestContext } from "@/lib/request";
import type { SlotAvailabilityDto } from "@/lib/types";
import type { ZodError } from "zod";
import { getAvailability } from "@/lib/server/availability";
import { availabilityQuerySchema } from "@/lib/server/validation/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Flattens `serviceIds` so it works whether the client appends the key once
 * per id, sends a comma list, or both. `Object.fromEntries` would keep only the
 * last value of a repeated key, so the entries are folded by hand.
 */
function collectSearchParams(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of new Set(url.searchParams.keys())) {
    if (key === "serviceIds") {
      out[key] = url.searchParams
        .getAll(key)
        .flatMap((v) => v.split(","))
        .map((v) => v.trim())
        .filter(Boolean)
        .join(",");
      continue;
    }
    const value = url.searchParams.get(key);
    if (value !== null) out[key] = value;
  }
  return out;
}

export async function GET(req: NextRequest): Promise<Response> {
  const ctx = requestContext(req);
  const meta: MetaInput = { requestId: ctx.requestId };

  return withApi<SlotAvailabilityDto>(meta, async () => {
    await rateLimit({ action: "availability.read", ip: ctx.ip, policy: readLimiter, requestId: ctx.requestId });

    const parsed = availabilityQuerySchema.safeParse(collectSearchParams(req.nextUrl));
    if (!parsed.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of (parsed.error as ZodError).issues) {
        const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
        (fields[key] ??= []).push(issue.message);
      }
      throw new ApiError("VALIDATION_ERROR", "Please check the date.", { fields });
    }

    const board = await getAvailability({ date: parsed.data.date, serviceIds: parsed.data.serviceIds });

    // Short shared cache: the board is identical for every visitor on a date and
    // the underlying availability cache is already 5 minutes.
    return ok(board, meta, {
      cacheControl: "public, max-age=30, stale-while-revalidate=120",
      headers: rateLimitHeaders(readLimiter, {
        success: true,
        limit: readLimiter.limit,
        remaining: readLimiter.limit,
        reset: Date.now() + readLimiter.windowMs,
        driver: "memory",
      }),
    });
  });
}
