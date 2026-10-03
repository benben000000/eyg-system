/**
 * GET /api/ready — READINESS
 * ============================================================================
 * Answers the *other* question: "can this instance actually serve real traffic?"
 * Load balancers, the deploy pipeline and the on-call engineer all need this
 * route; `/api/health` answers the liveness question and never touches a
 * dependency.
 *
 * Checks, each with a latency number and an `up | down | degraded` verdict:
 *   - database  — `SELECT 1` with a hard timeout
 *   - migrations — `_prisma_migrations` bookkeeping table
 *   - email / sms / reviews — CONFIGURATION only, no network call, so a provider
 *     outage can never make the instance un-ready
 *
 * INFORMATION DISCLOSURE
 * ----------------------
 * Dependency detail is returned **only** when the caller proves it holds the
 * probe secret (`Authorization: Bearer …`, `x-probe-secret`, or `x-cron-secret`).
 * Without it, and in production, the response is the coarse status and nothing
 * else. It never contains a connection string, a host, a stack trace, a query,
 * or a provider's raw error message — only stable codes like `timeout` and
 * `not-initialised`.
 *
 * Status codes: 200 ready, 503 not ready.
 */

import { activeEmailProvider } from "@/lib/integrations/email";
import { APP_VERSION, smsConfig } from "@/lib/integrations/env";
import { contextFrom, maySeeReadinessDetail } from "@/lib/integrations/api";
import { checkMigrations, pingDatabase } from "@/lib/integrations/db";
import { log, requestIdFromHeaders } from "@/lib/logger";
import { REQUEST_ID_HEADER } from "@/lib/request";
import { googleConfigured } from "@/lib/reviews/google";
import { facebookConfigured } from "@/lib/reviews/facebook";
import { reviewsCacheStats } from "@/lib/reviews/cache";
import type { ApiResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const logger = log.child({ scope: "api/ready" });

type Verdict = "up" | "down" | "degraded";

interface DependencyReport {
  name: string;
  status: Verdict;
  latencyMs: number;
  /** Stable, non-sensitive code. Never a message from a provider or a DSN. */
  detail: string | null;
}

export interface ReadyDetail {
  database: DependencyReport;
  migrations: DependencyReport;
  email: DependencyReport;
  sms: DependencyReport;
  reviews: DependencyReport;
}

export interface ReadyPayload {
  status: "ready" | "degraded" | "down";
  version: string;
  uptimeSeconds: number;
  /** Only present when the caller holds the probe secret. */
  dependencies?: ReadyDetail;
  /** Present in both cases so a monitor can alert on the reason. */
  failing: string[];
  requestId: string;
}

const UPTIME = () => Math.floor(process.uptime());

export async function GET(req: Request): Promise<Response> {
  const requestId = await requestIdFromHeaders().catch(() => "ready");
  const ctx = contextFrom(req);
  const meta = { requestId: ctx.requestId || requestId };

  // Never throw out of a probe. A probe that 500s tells the operator nothing.
  try {
    const showDetail = maySeeReadinessDetail(req);

    const [db, migrations] = await Promise.all([pingDatabase(3_000), checkMigrations(3_000)]);

    const emailProvider = activeEmailProvider();
    const sms = smsConfig();
    const google = googleConfigured();
    const facebook = facebookConfigured();
    const cache = reviewsCacheStats();

    const dependencies: ReadyDetail = {
      database: {
        name: "database",
        status: db.ok ? "up" : "down",
        latencyMs: db.latencyMs,
        detail: db.error,
      },
      migrations: {
        name: "migrations",
        status: migrations.ok ? "up" : "down",
        latencyMs: 0,
        detail: migrations.error,
      },
      // Config-only. A provider being unreachable is NOT a readiness failure —
      // every integration degrades, and the site stays up.
      email: {
        name: "email",
        status: emailProvider === "none" ? "degraded" : "up",
        latencyMs: 0,
        detail: emailProvider === "none" ? "no-provider-configured" : null,
      },
      sms: {
        name: "sms",
        status: sms.configured ? "up" : "degraded",
        latencyMs: 0,
        detail: sms.configured ? null : "no-provider-configured",
      },
      reviews: {
        name: "reviews",
        status: google || facebook ? "up" : "degraded",
        latencyMs: 0,
        detail: google || facebook ? null : "no-review-source-configured",
      },
    };

    const failing: string[] = [];
    if (dependencies.database.status !== "up") failing.push("database");
    if (dependencies.migrations.status !== "up") failing.push("migrations");
    const degraded: string[] = [];
    for (const dep of Object.values(dependencies)) {
      if (dep.status === "degraded") degraded.push(dep.name);
    }

    const status: ReadyPayload["status"] =
      failing.length > 0 ? "down" : degraded.length > 0 ? "degraded" : "ready";

    const body: ReadyPayload = {
      status,
      version: APP_VERSION(),
      uptimeSeconds: UPTIME(),
      ...(showDetail ? { dependencies } : {}),
      failing: [...failing, ...degraded.map((d) => `${d}:degraded`)],
      requestId: meta.requestId,
    };

    // Log the detail always; show it only to an authenticated caller.
    logger.info("ready.checked", {
      status,
      failing: body.failing.join(","),
      detailVisible: showDetail,
      dbLatencyMs: db.latencyMs,
      cacheEntries: cache.entries,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      [REQUEST_ID_HEADER]: meta.requestId,
    };

    if (status === "down") {
      const payload: ApiResult<ReadyPayload> = {
        ok: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "One or more dependencies are unavailable." },
        meta,
      };
      return new Response(JSON.stringify(payload), { status: 503, headers });
    }

    // `status` is "ready" or "degraded"; both are a successful probe result and
    // both keep the full body, including the (already redacted) reason.
    const payload: ApiResult<ReadyPayload> = { ok: true, data: body, meta };
    return new Response(JSON.stringify(payload), { status: 200, headers });
  } catch (error) {
    // A probe must never itself be the thing that fails.
    logger.error("ready.threw", {}, { err: error });
    const payload: ApiResult<ReadyPayload> = {
      ok: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Readiness check failed." },
      meta,
    };
    return new Response(JSON.stringify(payload), {
      status: 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        [REQUEST_ID_HEADER]: meta.requestId,
      },
    });
  }
}

/** `HEAD` is what most uptime monitors actually send. */
export async function HEAD(req: Request): Promise<Response> {
  const res = await GET(req);
  return new Response(null, { status: res.status, headers: res.headers });
}
