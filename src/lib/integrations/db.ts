/**
 * PRISMA ACCESS (integrations layer)
 * ============================================================================
 * Thin, non-throwing wrapper around the app's singleton client.
 *
 * SEAM — read before changing anything here
 * ----------------------------------------
 * The canonical client is `@/lib/server/db` (owned by backend-core), which
 * caches the pool on `globalThis.__eygPrisma`. We import it lazily and reuse
 * that exact instance, so the site has **one** connection pool, not two.
 *
 * If `@/lib/server/db` cannot be loaded (partial checkout, a stripped test
 * environment), we construct a local client so this module stays usable on its
 * own. That fallback is a documented duplication risk — see the report.
 *
 * Guarantees
 * ----------
 * - `tryGetDb()` returns `null` instead of throwing when Postgres is not
 *   configured, so a DB outage degrades to "no data", never a 500.
 * - `withDb(fn, fallback)` is the ONLY sanctioned way for an integration read
 *   path to touch the database. It never throws.
 * - `pingDatabase` / `checkMigrations` back `/api/ready`.
 */

import type { PrismaClient } from "@prisma/client";
import { log } from "@/lib/logger";
import { envStr } from "./env";

const logger = log.child({ scope: "integrations/db" });

export const PRISMA_UNAVAILABLE = "database-unavailable";

type GlobalWithPrisma = typeof globalThis & {
  __eygPrisma?: PrismaClient;
  __eygIntegrationsPrisma?: PrismaClient;
};

let client: PrismaClient | null | undefined;
let warnedLocal = false;

async function resolveClient(): Promise<PrismaClient | null> {
  if (client !== undefined) return client;
  if (!envStr("DATABASE_URL")) {
    logger.warn("db.no_database_url", { effect: "integrations return empty results" });
    client = null;
    return null;
  }

  // Preferred: the app-wide singleton.
  try {
    const mod = (await import("@/lib/server/db")) as { prisma?: PrismaClient };
    if (mod.prisma) {
      client = mod.prisma;
      return client;
    }
  } catch (error) {
    if (!warnedLocal) {
      warnedLocal = true;
      logger.warn("db.singleton_unavailable", { action: "constructing a local client instead" }, { err: error });
    }
  }

  // Fallback: a local instance, cached on globalThis so HMR does not leak pools.
  const g = globalThis as GlobalWithPrisma;
  if (g.__eygIntegrationsPrisma) {
    client = g.__eygIntegrationsPrisma;
    return client;
  }
  try {
    const { PrismaClient: PrismaCtor } = (await import("@prisma/client")) as unknown as {
      PrismaClient: new () => PrismaClient;
    };
    const local = new PrismaCtor();
    g.__eygIntegrationsPrisma = local;
    client = local;
    logger.warn("db.local_client_created", { note: "not the @/lib/server/db singleton" });
  } catch (error) {
    logger.error("db.client_init_failed", {}, { err: error });
    client = null;
  }
  return client;
}

/** The shared client, or `null`. Never throws. */
export async function tryGetDb(): Promise<PrismaClient | null> {
  try {
    return await resolveClient();
  } catch (error) {
    logger.error("db.resolve_failed", {}, { err: error });
    return null;
  }
}

/** The shared client. THROWS when the database is unreachable. */
export async function getDb(): Promise<PrismaClient> {
  const db = await tryGetDb();
  if (!db) throw new Error(PRISMA_UNAVAILABLE);
  return db;
}

export function isDatabaseConfigured(): boolean {
  return envStr("DATABASE_URL") !== undefined;
}

export interface WithDbOptions {
  event?: string;
  fields?: Record<string, string | number | boolean>;
}

/**
 * Runs `fn` with the client, returning `fallback` on any failure — no database,
 * refused connection, or unmigrated table. This is the only way an integration
 * read path is allowed to touch Postgres.
 */
export async function withDb<T>(
  fn: (db: PrismaClient) => Promise<T>,
  fallback: T,
  options: WithDbOptions = {},
): Promise<T> {
  const db = await tryGetDb();
  if (!db) {
    logger.warn("db.unavailable", { event: options.event ?? "query", ...(options.fields ?? {}) });
    return fallback;
  }
  try {
    return await fn(db);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
    logger.warn("db.query_failed", { event: options.event ?? "query", code, ...(options.fields ?? {}) });
    return fallback;
  }
}

/** `withDb` plus success/failure timing. Used by cron jobs. */
export async function withDbTimed<T>(
  event: string,
  fn: (db: PrismaClient) => Promise<T>,
  fallback: T,
  fields: Record<string, string | number | boolean> = {},
): Promise<{ value: T; ok: boolean; latencyMs: number; error: string | null }> {
  const started = Date.now();
  const db = await tryGetDb();
  if (!db) {
    logger.warn("db.unavailable", { event, ...fields });
    return { value: fallback, ok: false, latencyMs: 0, error: PRISMA_UNAVAILABLE };
  }
  try {
    const value = await fn(db);
    return { value, ok: true, latencyMs: Date.now() - started, error: null };
  } catch (error) {
    const latencyMs = Date.now() - started;
    logger.error("db.query_failed", { event, latencyMs, ...fields }, { err: error });
    return { value: fallback, ok: false, latencyMs, error: "query-failed" };
  }
}

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(label));
      },
    );
  });

/** Liveness ping with a hard timeout. Backs `/api/ready`. */
export async function pingDatabase(timeoutMs = 3_000): Promise<{ ok: boolean; latencyMs: number; error: string | null }> {
  const db = await tryGetDb();
  if (!db) return { ok: false, latencyMs: 0, error: PRISMA_UNAVAILABLE };
  const started = Date.now();
  try {
    await withTimeout(db.$queryRaw`SELECT 1`, timeoutMs, "db-timeout");
    return { ok: true, latencyMs: Date.now() - started, error: null };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const code = error instanceof Error && error.message === "db-timeout" ? "timeout" : "unavailable";
    logger.warn("db.ping_failed", { latencyMs, code });
    return { ok: false, latencyMs, error: code };
  }
}

interface MigrationRow {
  total: number;
  finished: number;
  rolled_back: number;
  failed: number;
}

/**
 * Reads Prisma's own bookkeeping table. A missing table means
 * `prisma migrate deploy` has never run. Never throws.
 */
export async function checkMigrations(
  timeoutMs = 3_000,
): Promise<{ ok: boolean; applied: number; failed: number; error: string | null }> {
  const db = await tryGetDb();
  if (!db) return { ok: false, applied: 0, failed: 0, error: PRISMA_UNAVAILABLE };

  try {
    const rows = (await withTimeout(
      db.$queryRaw<MigrationRow[]>`
        SELECT
          COUNT(*)::int                                          AS total,
          COUNT(*) FILTER (WHERE finished_at IS NOT NULL)::int   AS finished,
          COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL)::int AS rolled_back,
          COUNT(*) FILTER (WHERE applied_steps_count > 0
                             AND finished_at IS NULL
                             AND rolled_back_at IS NULL)::int    AS failed
        FROM _prisma_migrations
      `,
      timeoutMs,
      "migrations-timeout",
    )) as MigrationRow[];

    const row = rows[0];
    if (!row) return { ok: false, applied: 0, failed: 0, error: "no-migrations" };
    const applied = Number(row.finished) - Number(row.rolled_back);
    const failed = Number(row.failed);
    return {
      ok: failed === 0 && applied > 0,
      applied,
      failed,
      error: failed > 0 ? "failed-migration" : null,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : "";
    const code = msg.includes("does not exist") ? "not-initialised" : msg.includes("timeout") ? "timeout" : "check-failed";
    return { ok: false, applied: 0, failed: 0, error: code };
  }
}

/** Test hook. */
export function resetDbCache(): void {
  client = undefined;
}
