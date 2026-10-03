/**
 * NOTIFICATIONS — backend-core's adapter onto `@/lib/integrations/notify`.
 * ============================================================================
 * `src/lib/integrations/notify.ts` (backend-integrations) owns delivery: Twilio,
 * Resend, WhatsApp, the `Notification` ledger and the idempotency keys. This
 * file exists only so `src/lib/server/booking.ts` does not have to know that.
 *
 * ── THE SEAM ────────────────────────────────────────────────────────────────
 * `booking.ts` calls exactly two functions:
 *
 *     notifyBookingConfirmation(input)   // after a booking commits
 *     notifyBookingCancellation(input)   // after a cancellation commits
 *
 * Both are `void`-safe: they never throw and never reject, so a booking can
 * never be rolled back by a notification failure. Both are called strictly
 * AFTER the transaction commits.
 *
 * If the integrations module cannot be loaded (a unit test that stubs Prisma, a
 * partially-deployed build), we fall back to writing a `Notification` row with
 * `status: "queued"` directly through Prisma. That keeps the durable record
 * intact, and a later cron pass can pick the row up.
 */
import "server-only";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/server/db";

export type NotificationChannel = "sms" | "email" | "whatsapp";

/** The minimum the booking engine knows; maps 1:1 onto `NotifyBooking`. */
export interface NotifyBookingInput {
  bookingId: string;
  reference: string;
  customerName: string;
  phone: string;
  email: string | null;
  /** ISO instant with `+08:00`. */
  startAtIso: string;
  serviceNames: string[];
  estimateMin: number | null;
  estimateMax: number | null;
  status: string;
  vehicle: { year: number; make: string; model: string; variant?: string | null; plate?: string | null } | null;
  consentSms: boolean;
  consentMarketing: boolean;
  requestId?: string;
}

export interface NotificationResult {
  /** `true` when a provider actually took the message. */
  sent: boolean;
  /** `true` when the ledger row was written (queued, sent or blocked). */
  recorded: boolean;
  /** A WhatsApp deep link the UI can always offer. */
  whatsappLink: string;
}

const UNREACHABLE: NotificationResult = { sent: false, recorded: false, whatsappLink: "" };

/** Queues a plain ledger row. Used only when the integrations module fails. */
async function queueFallback(channel: NotificationChannel, template: string, input: NotifyBookingInput): Promise<NotificationResult> {
  try {
    await prisma.notification.create({
      data: {
        bookingId: input.bookingId,
        channel,
        template,
        recipient: channel === "email" ? (input.email ?? input.phone) : input.phone,
        subject: `${input.reference} — EYG Tire & Auto Care`,
        // No customer-facing prose here: copy belongs to the marketing agent's
        // templates, so a fallback row records the *event*, not a message.
        body: null,
        status: "queued",
      },
    });
    return { sent: false, recorded: true, whatsappLink: "" };
  } catch (err) {
    logger.error("notify.fallback_queue_failed", {
      requestId: input.requestId,
      bookingId: input.bookingId,
      channel,
      err: err instanceof Error ? err.name : typeof err,
    });
    return UNREACHABLE;
  }
}

/**
 * Fires the booking confirmation. Called after `createBooking()` commits.
 * Fire-and-forget: the caller does not await it and cannot be rejected by it.
 */
export function notifyBookingConfirmation(input: NotifyBookingInput): Promise<NotificationResult> {
  return dispatch("confirmed", input);
}

/** Fires the cancellation notice. Called after `cancelBooking()` commits. */
export function notifyBookingCancellation(input: NotifyBookingInput): Promise<NotificationResult> {
  return dispatch("cancelled", input);
}

async function dispatch(kind: "confirmed" | "cancelled", input: NotifyBookingInput): Promise<NotificationResult> {
  try {
    const mod = (await import("@/lib/integrations/notify")) as {
      notifyBookingConfirmed?: (b: unknown) => Promise<{ sent: boolean; whatsappLink: string }>;
      notifyBookingCancelled?: (b: unknown, reason?: string | null) => Promise<{ sent: boolean; whatsappLink: string }>;
    };

    const payload = {
      id: input.bookingId,
      reference: input.reference,
      startAt: input.startAtIso,
      customerName: input.customerName,
      customerPhone: input.phone,
      customerEmail: input.email,
      vehicle: input.vehicle,
      serviceNames: input.serviceNames,
      estimateMin: input.estimateMin,
      estimateMax: input.estimateMax,
      consentSms: input.consentSms,
      consentMarketing: input.consentMarketing,
      recipientSuppliedByCustomer: true,
    };

    const result =
      kind === "confirmed"
        ? await mod.notifyBookingConfirmed?.(payload)
        : await mod.notifyBookingCancelled?.(payload, null);

    if (!result) throw new Error("integrations/notify exported no matching function");

    logger.info("notify.dispatched", {
      requestId: input.requestId,
      bookingId: input.bookingId,
      kind,
      sent: result.sent,
    });
    return { sent: result.sent, recorded: true, whatsappLink: result.whatsappLink };
  } catch (err) {
    logger.warn("notify.integrations_unavailable", {
      requestId: input.requestId,
      bookingId: input.bookingId,
      kind,
      err: err instanceof Error ? err.name : typeof err,
    });
    return queueFallback(kind === "confirmed" ? "sms" : "sms", `booking.${kind}`, input);
  }
}
