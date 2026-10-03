/**
 * GET /api/health — LIVENESS ONLY
 * ============================================================================
 * Answers exactly one question: "is this process running and able to serve a
 * response?" A load balancer must not pull an instance because Postgres is slow
 * — that turns a partial outage into a total one.
 *
 * THEREFORE THIS ROUTE:
 *   - makes **no database call**
 *   - makes **no network call**
 *   - imports nothing that can throw
 *   - responds in well under 5 ms
 *
 * Dependency detail lives on `GET /api/ready`, which is a separate concern with
 * its own auth. See that route for the DB and migration checks.
 */

import { APP_VERSION } from "@/lib/integrations/env";
import { requestIdFromHeaders } from "@/lib/logger";
import { REQUEST_ID_HEADER } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Never cached, never statically optimised — it is a live signal. */
export const revalidate = 0;

/** Process start, frozen once so uptime is stable across requests. */
const PROCESS_START = Date.now();

export interface HealthPayload {
  status: "ok";
  version: string;
  /** Seconds since the Node process started. */
  uptime: number;
  requestId: string;
}

export async function GET(): Promise<Response> {
  const requestId = await requestIdFromHeaders().catch(() => "health");
  const body: HealthPayload = {
    status: "ok",
    version: APP_VERSION(),
    uptime: Math.floor((Date.now() - PROCESS_START) / 1_000),
    requestId,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}
