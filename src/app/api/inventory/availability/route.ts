/**
 * /api/inventory/availability — THE PROMISE CHECK.
 * ============================================================================
 *   GET ?serviceIds=a,b,c  → ApiResult<AvailabilityDto>   200 | 400 | 429
 *
 * This is the ONE inventory endpoint a public surface may reach, and it is the
 * only one that is not behind `withAdmin`. It exists because "we have your size
 * in stock" is the strongest promise a tyre shop can make, and a server component
 * cannot ask a customer-facing page that question through a staff-authenticated
 * route.
 *
 * ── WHAT IT DELIBERATELY DOES NOT RETURN ────────────────────────────────────
 *  - No `costPrice`, no `marginPct`. The public branch is built by mapping
 *    `ServiceAvailabilityDto`, which has no cost field in the contract, so a cost
 *    number is *structurally* unreachable from it — not merely omitted by a flag.
 *  - No `onHand` or `reserved`. Only `available`, which is the single number a
 *    promise is allowed to be made against.
 *  - No supplier, no cost basis, no internal ids beyond the product id the
 *    service already references.
 *
 * A signed-in staff member calling the same endpoint additionally receives
 * `costPrice` / `marginPct` on each part, because the same box drives the operator
 * UI. `costVisible` says which of the two happened.
 *
 * ── PESSIMISM ───────────────────────────────────────────────────────────────
 * `canFulfil` is `true` only when every BLOCKING part has enough `available`.
 * A short non-blocking part warns; it never blocks. Nothing here is optimistic:
 * a service with no bill of materials returns `canFulfil: true` (nothing is
 * required, so nothing is missing) and `parts: []`, which is honest rather than
 * pessimistic about a thing we have not modelled.
 *
 * Cache-Control: `no-store`. A stale availability answer is a promise the shop
 * cannot keep, which is the one failure this endpoint exists to prevent.
 *
 * Rate limit: `inventory.read` — generous, and it fails OPEN, because a customer
 * mid-booking must not see an error because Redis blinked.
 */
import type { NextRequest } from "next/server";

import { ok, withApi } from "@/lib/http";
import type { PartAvailabilityDto, ServiceAvailabilityDto } from "@/lib/inventory-types";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { requestContext } from "@/lib/request";
import { currentSession, roleAtLeast } from "@/lib/server/auth";

import { getServiceAvailability, getStaffServiceAvailability } from "@/lib/server/inventory/availability";
import { inventoryReadLimiter } from "@/lib/server/inventory/stock-engine";
import { availabilityQuerySchema, parseQuery } from "@/lib/server/inventory/validation.test-support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** A part that may carry cost when — and only when — the caller is staff. */
export type AvailabilityPartDto = PartAvailabilityDto & {
  costPrice?: number;
  marginPct?: number | null;
};

export interface AvailabilityServiceDto extends Omit<ServiceAvailabilityDto, "parts"> {
  parts: AvailabilityPartDto[];
}

export interface AvailabilityDto {
  services: AvailabilityServiceDto[];
  /** `true` only when the caller holds a staff session. */
  costVisible: boolean;
}

export async function GET(req: NextRequest): Promise<Response> {
  const ctx = requestContext(req);
  const meta = { requestId: ctx.requestId };

  // `withApi` turns every throw into a safe `ApiResult`, so no failure here can
  // leak a stack, a SQL fragment or a Prisma code to the caller.
  return withApi<AvailabilityDto>(meta, async () => {
    await rateLimit({
      action: "inventory.availability",
      ip: ctx.ip,
      policy: inventoryReadLimiter,
      requestId: ctx.requestId,
    });

    const query = parseQuery(new URL(req.url).searchParams, availabilityQuerySchema);

    // Staff augmentation. `currentSession()` never throws in normal use; a
    // failure is logged and falls back to the PUBLIC shape, which is fail-safe
    // because that shape has no cost field to leak.
    const session = await currentSession().catch((err: unknown) => {
      logger.warn("inventory.availability.session_failed", {
        scope: "inventory",
        requestId: ctx.requestId,
        err: err instanceof Error ? err.name : typeof err,
      });
      return null;
    });
    const canSeeCost = session !== null && roleAtLeast(session.user.role, "FRONT_DESK");

    const rows = canSeeCost
      ? await getStaffServiceAvailability(query.serviceIds)
      : await getServiceAvailability(query.serviceIds);

    const services: AvailabilityServiceDto[] = rows.map((row) => ({
      serviceId: row.serviceId,
      serviceSlug: row.serviceSlug,
      name: row.name,
      canFulfil: row.canFulfil,
      blockers: row.blockers,
      parts: row.parts as AvailabilityPartDto[],
    }));

    logger.info("inventory.availability_checked", {
      scope: "inventory",
      requestId: ctx.requestId,
      services: services.length,
      blocked: services.filter((s) => !s.canFulfil).length,
      costVisible: canSeeCost,
    });

    return ok<AvailabilityDto>({ services, costVisible: canSeeCost }, meta, { cacheControl: "no-store, max-age=0" });
  });
}
