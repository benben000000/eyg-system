/**
 * NOTIFICATION LEDGER
 * ============================================================================
 * Every outbound message — sent, skipped, failed or blocked — is recorded in
 * the `Notification` model. That table is the shop's audit trail: it is how we
 * answer "did the customer get the confirmation?" at 9pm on a Sunday, and how
 * the Twilio/Resend/WhatsApp webhook routes find the row to update.
 *
 * Status vocabulary (the column is a free-form String):
 *   queued     — recorded, not yet handed to a provider
 *   sent       — provider accepted it
 *   delivered  — provider reported delivery (webhook)
 *   failed     — provider rejected it, or we refused to send it
 *   skipped    — deliberately not sent: no API key, no consent, rate-limited,
 *                duplicate idempotency key, or a PII guard blocked it
 *   blocked    — a policy guard refused it (consent / third-party PII)
 */

import type { Notification, Prisma, PrismaClient } from "@prisma/client";
import { log,  redactString } from "@/lib/logger";
import { withDb } from "./db";

const logger = log.child({ scope: "integrations/notification-ledger" });

export type Channel = "sms" | "email" | "whatsapp";
export type NotificationStatus = "queued" | "sent" | "delivered" | "failed" | "skipped" | "blocked";

export interface RecordNotificationInput {
  channel: Channel;
  template: string;
  recipient: string;
  subject?: string | null;
  body?: string | null;
  status: NotificationStatus;
  bookingId?: string | null;
  providerId?: string | null;
  error?: string | null;
  attempts?: number;
}

export interface NotificationOutcome {
  channel: Channel;
  template: string;
  recipient: string;
  status: NotificationStatus;
  notificationId: string | null;
  providerId: string | null;
  error: string | null;
  attempts: number;
}

type NotificationCreateInput = Prisma.NotificationUncheckedCreateInput;

/**
 * Creates the ledger row. Returns `null` when the database is unavailable so
 * a send can still go out — losing the audit row must never cost the customer
 * their booking confirmation.
 */
export async function recordNotification(
  db: PrismaClient | null,
  input: RecordNotificationInput,
): Promise<{ id: string | null }> {
  const data: NotificationCreateInput = {
    channel: input.channel,
    template: input.template,
    // Recipients are PII. Store a masked form; the provider already has the
    // real value and the staff board has the booking.
    recipient: maskRecipient(input.recipient),
    subject: input.subject ?? null,
    body: input.body ? redactString(input.body).slice(0, 2_000) : null,
    status: input.status,
    providerId: input.providerId ?? null,
    error: input.error ? redactString(input.error).slice(0, 500) : null,
    attempts: Math.max(1, input.attempts ?? 1),
    bookingId: input.bookingId ?? null,
    ...(input.status === "sent" ? { sentAt: new Date() } : {}),
  };

  if (!db) {
    logger.warn("notification.unrecorded", {
      channel: input.channel,
      template: input.template,
      status: input.status,
    });
    return { id: null };
  }

  try {
    const row = await db.notification.create({ data, select: { id: true } });
    return { id: row.id };
  } catch (error) {
    logger.error("notification.record_failed", { channel: input.channel, template: input.template }, { err: error });
    return { id: null };
  }
}

/** Convenience wrapper that resolves the client itself. */
export async function recordNotificationStandalone(input: RecordNotificationInput): Promise<{ id: string | null }> {
  return withDb((db) => recordNotification(db, input), { id: null }, { event: "notification.record" });
}

/**
 * Masks a recipient for the ledger. Emails keep their domain (so staff can tell
 * hotmail from a typo); phone numbers keep only the country code and last two
 * digits.
 */
export function maskRecipient(value: string): string {
  const v = value.trim();
  if (v.includes("@")) {
    const at = v.indexOf("@");
    const local = v.slice(0, at);
    const domain = v.slice(at + 1);
    return `${local.slice(0, 2)}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
  }
  const digits = v.replace(/\D/g, "");
  if (digits.length >= 4) {
    const tail = digits.slice(-2);
    const cc = digits.startsWith("63") ? "+63" : digits.startsWith("0") ? "+63" : `+${digits.slice(0, 1)}`;
    return `${cc}…${tail}`;
  }
  return "…";
}

/**
 * Finds a Notification by the provider's own message id. Used by all three
 * webhook receivers. Returns `null` when the message is unknown (e.g. sent
 * before this deploy, or the ledger write failed).
 */
export async function findNotificationByProviderId(
  providerId: string,
  channel?: Channel,
): Promise<Notification | null> {
  const id = providerId.trim();
  if (id.length === 0 || id.length > 200) return null;
  return withDb<Notification | null>(
    (db) =>
      db.notification.findFirst({
        where: { providerId: id, ...(channel ? { channel } : {}) },
        orderBy: { createdAt: "desc" },
      }),
    null,
    { event: "notification.find_by_provider_id" },
  );
}

/** Applies a delivery-status update. Idempotent by nature (same row, same value). */
export async function applyProviderStatus(
  providerId: string,
  status: Extract<NotificationStatus, "delivered" | "failed" | "sent">,
  error?: string | null,
  channel?: Channel,
): Promise<{ updated: boolean; notificationId: string | null }> {
  const id = providerId.trim();
  if (id.length === 0) return { updated: false, notificationId: null };

  const result = await withDb<{ updated: boolean; notificationId: string | null }>(
    async (db) => {
      const existing = await db.notification.findFirst({
        where: { providerId: id, ...(channel ? { channel } : {}) },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true },
      });
      if (!existing) return { updated: false, notificationId: null };

      // Never walk a terminal state backwards: a late `delivered` after a
      // `failed` is provider noise, not new information.
      if (existing.status === "delivered" && status !== "delivered") {
        return { updated: false, notificationId: existing.id };
      }

      await db.notification.update({
        where: { id: existing.id },
        data: {
          status,
          ...(error ? { error: redactString(error).slice(0, 500) } : {}),
          ...(status === "delivered" || status === "sent" ? { sentAt: new Date() } : {}),
        },
      });
      return { updated: true, notificationId: existing.id };
    },
    { updated: false, notificationId: null },
    { event: "notification.apply_status" },
  );

  return result;
}

/** Recovers Notification rows left in `queued` (process died mid-send). */
export async function reconcileStaleNotifications(olderThanMinutes = 30): Promise<{ requeued: number }> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const count = await withDb<number>(
    async (db) => {
      const rows = await db.notification.findMany({
        where: { status: "queued", createdAt: { lt: cutoff } },
        select: { id: true },
        take: 500,
      });
      if (rows.length === 0) return 0;
      const res = await db.notification.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { status: "failed", error: "abandoned-queued-row" },
      });
      return res.count;
    },
    0,
    { event: "notification.reconcile" },
  );
  return { requeued: count };
}
