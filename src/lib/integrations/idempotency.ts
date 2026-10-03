/**
 * IDEMPOTENCY + WEBHOOK EVENT DEDUPE
 * ============================================================================
 * Two jobs, one mechanism.
 *
 * 1. `claimIdempotencyKey` — stops a retried booking confirmation from sending
 *    two SMS messages. The `Notification` model has no unique constraint we can
 *    hang a key off (`prisma/schema.prisma` is orchestrator-owned and cannot be
 *    edited from here), so the `Setting` table (`key` is the primary key, value
 *    is Json) is used as a claim ledger:
 *
 *        key   = "idem:" + sha256(idempotencyKey)     -- never the raw key
 *        value = { template, channel, at, state }
 *
 *    A `create` against a primary key is atomic, so the loser of a race gets
 *    Prisma `P2002` and we report "already claimed". No row lock, no advisory
 *    lock, works on plain Postgres.
 *
 * 2. `claimWebhookEvent` — stops a provider retry from double-applying a status
 *    callback, keyed on the provider's own event/message id.
 *
 * Both fall back to an in-process `Map` when the database is unavailable, so a
 * retry against a degraded database still does not double-send within one
 * instance. TTL keeps the ledger small.
 */

import { createHash } from "node:crypto";
import { log,  redactString } from "@/lib/logger";
import { withDb } from "./db";

const logger = log.child({ scope: "integrations/idempotency" });

const KEY_PREFIX = "idem:";
const EVENT_PREFIX = "evt:";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h — long enough to cover retries
const SWEEP_SAMPLE = 500;

export type ClaimState = "claimed" | "duplicate" | "unavailable";

export interface ClaimResult {
  state: ClaimState;
  /** Present when `state === "duplicate"` — when the original was claimed. */
  claimedAt: string | null;
}

interface LedgerValue {
  template: string;
  channel: string;
  at: string;
  state: "claimed" | "done";
  notificationId?: string | null;
}

const memory = new Map<string, number>();

function hash(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("base64url");
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}

function readClaimedAt(value: unknown): string | null {
  if (typeof value === "object" && value !== null && "at" in value) {
    const at = (value as { at?: unknown }).at;
    if (typeof at === "string") return at;
  }
  return null;
}

/** Drops expired in-process claims so a long-lived process cannot leak memory. */
function sweepMemory(now = Date.now()): void {
  if (memory.size < 1_000) return;
  for (const [k, exp] of memory) {
    if (exp <= now) memory.delete(k);
  }
}

async function claim(settingsKey: string, payload: LedgerValue, ttlMs: number): Promise<ClaimResult> {
  const now = Date.now();
  sweepMemory(now);

  const localExpiry = memory.get(settingsKey);
  if (localExpiry !== undefined && localExpiry > now) {
    return { state: "duplicate", claimedAt: new Date(localExpiry - ttlMs).toISOString() };
  }

  const dbClaimed = await withDb<ClaimResult>(
    async (db) => {
      try {
        await db.setting.create({
          data: { key: settingsKey, value: payload as unknown as object },
        });
        return { state: "claimed", claimedAt: payload.at };
      } catch (error) {
        if (isUniqueViolation(error)) {
          const existing = await db.setting.findUnique({ where: { key: settingsKey }, select: { value: true } });
          return { state: "duplicate", claimedAt: readClaimedAt(existing?.value) };
        }
        throw error;
      }
    },
    { state: "unavailable", claimedAt: null },
    { event: "idempotency.claim" },
  );

  if (dbClaimed.state === "claimed") {
    memory.set(settingsKey, now + ttlMs);
    return dbClaimed;
  }

  if (dbClaimed.state === "duplicate") {
    memory.set(settingsKey, now + ttlMs);
    return dbClaimed;
  }

  // Database unavailable: fall back to in-process dedupe so a retry storm
  // against a degraded database still cannot double-send on this instance.
  memory.set(settingsKey, now + ttlMs);
  logger.warn("idempotency.memory_fallback", { keyKind: settingsKey.startsWith(EVENT_PREFIX) ? "event" : "message" });
  return { state: "claimed", claimedAt: payload.at };
}

export interface ClaimOptions {
  template: string;
  channel: string;
  ttlMs?: number;
}

/**
 * Claims an idempotency key. Returns `claimed` exactly once per key per TTL.
 * A `duplicate` result means "already done" — the caller must not send.
 */
export async function claimIdempotencyKey(idempotencyKey: string, options: ClaimOptions): Promise<ClaimResult> {
  const key = idempotencyKey.trim();
  if (key.length === 0 || key.length > 200) {
    // A malformed key cannot be deduplicated; treat it as unclaimable so the
    // caller falls back to its own single-flight protection.
    return { state: "unavailable", claimedAt: null };
  }
  return claim(`${KEY_PREFIX}${hash(key)}`, {
    template: options.template,
    channel: options.channel,
    at: new Date().toISOString(),
    state: "claimed",
  }, options.ttlMs ?? DEFAULT_TTL_MS);
}

/** Marks a claim finished (and optionally links the Notification row id). */
export async function completeIdempotencyKey(
  idempotencyKey: string,
  notificationId: string | null,
  options: ClaimOptions,
): Promise<void> {
  const key = idempotencyKey.trim();
  if (key.length === 0) return;
  const settingsKey = `${KEY_PREFIX}${hash(key)}`;
  await withDb(
    async (db) => {
      await db.setting.update({
        where: { key: settingsKey },
        data: {
          value: { template: options.template, channel: options.channel, at: new Date().toISOString(), state: "done", notificationId },
        },
      });
    },
    undefined,
    { event: "idempotency.complete" },
  );
}

/**
 * Releases a claim so a genuine retry can go out. Called when the send itself
 * failed — we want the retry to actually try again.
 */
export async function releaseIdempotencyKey(idempotencyKey: string): Promise<void> {
  const key = idempotencyKey.trim();
  if (key.length === 0) return;
  const settingsKey = `${KEY_PREFIX}${hash(key)}`;
  memory.delete(settingsKey);
  await withDb(
    async (db) => {
      await db.setting.deleteMany({ where: { key: settingsKey } });
    },
    undefined,
    { event: "idempotency.release" },
  );
}

/** Fetches the Notification row id previously recorded for a key. */
export async function notificationIdForKey(
  idempotencyKey: string,
  options: ClaimOptions,
): Promise<string | null> {
  const key = idempotencyKey.trim();
  if (key.length === 0) return null;
  const settingsKey = `${KEY_PREFIX}${hash(key)}`;
  const value = await withDb<LedgerValue | null>(
    (db) => db.setting.findUnique({ where: { key: settingsKey }, select: { value: true } }).then((r) => (r?.value as LedgerValue | null) ?? null),
    null,
    { event: "idempotency.lookup" },
  );
  void options;
  return typeof value?.notificationId === "string" ? value.notificationId : null;
}

// ── Webhook event dedupe ─────────────────────────────────────────────────────

/**
 * Claims a provider event. `provider` + `eventId` must be stable across the
 * provider's retries (Twilio `SmsSid`/status, Resend `svix-id`, WhatsApp
 * `wamid`).
 */
export async function claimWebhookEvent(provider: string, eventId: string, ttlMs = 7 * 24 * 60 * 60 * 1000): Promise<ClaimResult> {
  const id = eventId.trim();
  if (id.length === 0 || id.length > 200) return { state: "unavailable", claimedAt: null };
  return claim(`${EVENT_PREFIX}${provider}:${hash(id)}`, {
    template: `webhook:${provider}`,
    channel: "webhook",
    at: new Date().toISOString(),
    state: "claimed",
  }, ttlMs);
}

/**
 * Housekeeping for the `sweep-rate-limits` job: deletes expired ledger rows.
 * Idempotent — safe to run twice.
 */
export async function sweepIdempotencyLedger(olderThanMs = DEFAULT_TTL_MS): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const deleted = await withDb<number>(
    async (db) => {
      const rows = await db.setting.findMany({
        where: { key: { startsWith: KEY_PREFIX } },
        select: { key: true, updatedAt: true },
        take: SWEEP_SAMPLE,
      });
      const stale = rows.filter((r) => r.updatedAt < cutoff).map((r) => r.key);
      if (stale.length === 0) return 0;
      const res = await db.setting.deleteMany({ where: { key: { in: stale } } });
      return res.count;
    },
    0,
    { event: "idempotency.sweep" },
  );
  const now = Date.now();
  for (const [k, exp] of memory) {
    if (exp <= now) memory.delete(k);
  }
  return { deleted };
}

/** Test hook. */
export function resetIdempotencyMemory(): void {
  memory.clear();
}

/** Safe diagnostic: only ever the hashed form. */
export function safeKeyLabel(idempotencyKey: string): string {
  return idempotencyKey.trim().length === 0 ? "(empty)" : redactString(hash(idempotencyKey)).slice(0, 12);
}
