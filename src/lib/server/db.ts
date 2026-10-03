/**
 * PRISMA CLIENT SINGLETON
 * ============================================================================
 * Next.js dev hot-reload re-evaluates every module on save. Without the
 * `globalThis` cache each reload would open a fresh connection pool, and
 * Postgres' default `max_connections` would be exhausted after ~20 saves —
 * a failure that looks exactly like "the site randomly goes down in dev".
 *
 * `globalThis.__eygPrisma` is the canonical pattern from the Prisma docs: it
 * survives module re-evaluation in dev and is never used in production.
 */
import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

declare global {
   
  var __eygPrisma: PrismaClient | undefined;
}

const SLOW_QUERY_MS = 400;

/**
 * Keys whose values must never reach a log line. Parameter objects for these
 * models contain customer names, phones, emails and staff notes.
 */
const _REDACTED_FIELDS = new Set([
  "customerName",
  "customerPhone",
  "customerEmail",
  "phone",
  "email",
  "name",
  "notes",
  "staffNotes",
  "serviceNotes",
  "plate",
  "vin",
  "passwordHash",
  "tokenHash",
  "twoFactorSecret",
]);

function redactParams(args: unknown): unknown {
  if (Array.isArray(args)) {
    // Prisma passes `[selector, payload]`. Only the *shape* is logged.
    return args.map((_, i) => (i === 1 ? "[payload redacted]" : i === 0 ? "[selector]" : "?"));
  }
  return "[args]";
}

function createClient(): PrismaClient {
  return new PrismaClient({
    // Explicitly set so the runtime never falls back to a libpq/URL parse
    // difference between local, Docker and Vercel Postgres.
    datasources: { db: { url: env.databaseUrl } },
    log: env.isDevelopment
      ? [
          { emit: "event", level: "query" },
          { emit: "stdout", level: "warn" },
          { emit: "stdout", level: "error" },
        ]
      : [
          { emit: "stdout", level: "error" },
          { emit: "stdout", level: "warn" },
        ],
  });
}

interface QueryEvent {
  duration: number;
  query: string;
  params: unknown;
  target: string;
}

function attachSlowQueryLogging(client: PrismaClient): void {
  // Prisma only emits `query` events for the `query` log level, which we only
  // enable in development — production stays quiet. `$on` is typed against
  // `Prisma.LogLevel`, which does not include `"query"`, so the event type has
  // to be restated here.
  const on = client.$on as unknown as (event: "query", callback: (e: QueryEvent) => void) => void;
  on.call(client, "query", (event) => {
    if (typeof event.duration === "number" && event.duration >= SLOW_QUERY_MS) {
      logger.warn("db.slow_query", {
        scope: "prisma",
        durationMs: event.duration,
        query: (event.query ?? "").slice(0, 400).replace(/\s+/g, " "),
        params: redactParams(event.params),
      });
    }
  });
}

function buildClient(): PrismaClient {
  const client = createClient();
  attachSlowQueryLogging(client);

  client.$connect().catch((err: unknown) => {
    // Do not throw at import time: `/api/health` and the 500 page must still
    // render and report the problem clearly.
    logger.error("db.connect_failed", {
      scope: "prisma",
      err: err instanceof Error ? { name: err.name, message: err.message } : { value: typeof err },
    });
  });

  if (env.isDevelopment) {
    const hexFields = ["databaseUrl", "piiEncryptionKey", "authSecret"];
    logger.debug("db.client_created", {
      scope: "prisma",
      environment: env.nodeEnv,
      // Field NAMES only — never values.
      sensitiveKeysRedacted: hexFields.length,
    });
  }

  return client;
}

export const prisma: PrismaClient = globalThis.__eygPrisma ?? buildClient();

if (env.isDevelopment) globalThis.__eygPrisma = prisma;

/**
 * Runs `fn` inside a `Serializable` transaction, retrying on Postgres
 * serialization failures (`40001`) / write-write deadlocks (`40P01`), which
 * Prisma surfaces as `P2034`.
 *
 * Used by the booking engine: capacity is re-checked inside the transaction,
 * and under two concurrent requests exactly one commit can win the re-check —
 * the other retries, sees the new count, and returns a clean 409.
 */
export async function withSerializableRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  opts: { attempts?: number; requestId?: string } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (err) {
      // `isPrismaKnownError` narrows, but only when `useUnknownInCatchVariables`
      // is on; the explicit `instanceof` keeps the narrowing local and obvious.
      const retryable = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      lastError = err;
      if (!retryable || attempt === attempts) throw err;
      logger.warn("db.transaction_retry", {
        requestId: opts.requestId,
        scope: "prisma",
        attempt,
      });
      // Small randomised backoff so two retries do not collide again.
      await new Promise((r) => setTimeout(r, 25 * attempt + Math.floor(Math.random() * 25)));
    }
  }
  throw lastError;
}

export { Prisma };
export default prisma;
