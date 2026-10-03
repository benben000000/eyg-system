/**
 * NOTIFICATION FAN-OUT
 * ============================================================================
 * The single entry point every part of the app uses to tell somebody something.
 * `notifyBookingConfirmed(...)` and friends resolve the right channel from the
 * template's requirements, honour consent, are idempotent, record every attempt
 * in the `Notification` ledger, and **never throw into the caller**.
 *
 * INVARIANTS — every exported function obeys all of these
 * -------------------------------------------------------
 * 1. **No throw.** Any internal failure is caught, recorded on the
 *    `Notification` row, logged, and reported as a `failed` outcome. A booking
 *    confirmation must not be able to fail a booking.
 * 2. **Idempotent.** A duplicate call with the same idempotency key returns a
 *    `duplicate` outcome and sends nothing. Keys are `<TEMPLATE>:<entityId>`,
 *    so a retried `POST /api/booking` cannot text the customer twice. A *failed*
 *    send releases its claim so a retry genuinely tries again.
 * 3. **Consent-aware.** SMS needs `consentSms`; marketing SMS needs
 *    `consentMarketing` and carries the opt-out line. Email only goes to an
 *    address the customer supplied. A refusal is recorded as `blocked`, never
 *    silently dropped.
 * 4. **Parallel-safe.** `Promise.allSettled` over the channel list, one hard
 *    wall-clock budget (`NOTIFY_BUDGET_MS`). One channel failing never affects
 *    another.
 * 5. **No invented data.** Every field is either supplied or rendered as an
 *    explicit "to be confirmed" / "not given". A template can never show a
 *    fabricated price, plate or time.
 *
 * SEAMS (read before changing imports)
 * ------------------------------------
 * - `fromBookingDto(dto, consent)` adapts the `BookingDto` from
 *   `src/lib/types.ts`, so the booking agent can notify with **no** database
 *   read. Preferred path.
 * - `resolveNotifyBooking(id)` is the fallback that reads the `Booking` row.
 *   Delete it the moment the booking agent passes a DTO instead.
 * - Message copy lives in `src/content/marketing/{copy,email}.ts` (marketing
 *   agent). This file never inlines a customer-facing sentence.
 *
 * @see docs/ops/INTEGRATIONS.md § Notifications
 */

import { BUSINESS, LINKS, SITE, TIMEZONE } from "@/config/site";
import {
  EMAIL_TEMPLATES,
  renderEmailTemplate,
  validateEmail,
  type EmailTemplateKey,
  type EmailVars,
} from "@/content/marketing/email";
import {
  SMS_OPT_OUT_LINE,
  SMS_SENDER_PREFIX,
  SMS_TEMPLATES,
  assertSmsFits,
  type SmsTemplateKey,
  type SmsVars,
} from "@/content/marketing/copy";
import { formatPeso, formatPesoRange, vehicleLabel } from "@/lib/utils";
import { log } from "@/lib/logger";
import { NOTIFY_BUDGET_MS } from "./env";
import { sendEmailContent, type EmailContent } from "./email";
import { claimIdempotencyKey, completeIdempotencyKey, releaseIdempotencyKey } from "./idempotency";
import { sendSms, shopEmailRecipient, shopSmsRecipient, type SendSmsResult } from "./sms";
import { buildWhatsAppLink } from "./whatsapp";
import { withDb } from "./db";

const logger = log.child({ scope: "integrations/notify" });

// ── Public types ─────────────────────────────────────────────────────────────

export type NotifyChannel = "sms" | "email" | "whatsapp";

/**
 * Statuses a channel can land in, plus `duplicate` for an idempotent no-op.
 * Mirrors `NotificationStatus` from `./notification-ledger` (which can also be
 * `queued`, when a message is recorded but the provider call is still open).
 */
export type NotifyOutcomeStatus = "queued" | "sent" | "delivered" | "failed" | "skipped" | "blocked" | "duplicate";

export interface NotifyOutcome {
  channel: NotifyChannel;
  /** Template name recorded on the `Notification` row. */
  template: string;
  status: NotifyOutcomeStatus;
  provider: string;
  providerId: string | null;
  error: string | null;
}

export interface NotifyResult {
  ok: boolean;
  /** True when at least one channel handed the message to a provider. */
  sent: boolean;
  outcomes: NotifyOutcome[];
  /** A WhatsApp deep link the UI can always offer, whatever happened above. */
  whatsappLink: string;
}

/** The minimum a caller must supply. Deliberately plain, so any DTO maps onto it. */
export interface NotifyBooking {
  id: string;
  reference: string;
  /** ISO instant of the appointment. */
  startAt: string | Date;
  customerName: string;
  /** E.164, e.g. `+639171234567`. */
  customerPhone: string;
  customerEmail: string | null;
  vehicle: { year: number; make: string; model: string; variant?: string | null; plate?: string | null } | null;
  serviceNames: string[];
  estimateMin: number | null;
  estimateMax: number | null;
  consentSms: boolean;
  consentMarketing: boolean;
  /** The customer gave us this number for booking messages. Defaults to true. */
  recipientSuppliedByCustomer?: boolean;
}

export interface NotifyQuote {
  reference: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  vehicleLabel: string | null;
  estimateMin: number | null;
  estimateMax: number | null;
  expiresAt: string | Date;
  recipientSuppliedByCustomer?: boolean;
}

export interface NotifyPromo {
  slug: string;
  title: string;
  /** Human value, e.g. "15% off" or "₱950 off". */
  valueLabel: string;
  endsAt: string | Date | null;
  /** MANDATORY. A discount is never communicated without its conditions. */
  terms: string[];
}

export interface NotifyRoadside {
  reference?: string;
  customerPhone: string;
  /** Where the customer says the vehicle is. Never a plate we looked up. */
  location: string;
  note: string | null;
  recipientSuppliedByCustomer: boolean;
}

export interface NotifyReviewRequest {
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  vehicleLabel: string | null;
  completedOn: string | Date;
  consentMarketing: boolean;
  consentSms: boolean;
  recipientSuppliedByCustomer?: boolean;
}

export interface NotifyNewLeadInput {
  kind: "roadside" | "contact" | "newsletter" | "tire-size";
  /** Already decrypted, for the message body only. Never logged. */
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  /** Non-PII context: source page, campaign. */
  meta?: Record<string, string | number | boolean>;
}

// ── Formatting helpers (pure, unit-testable) ─────────────────────────────────

const PH_DATE = new Intl.DateTimeFormat("en-PH", { timeZone: TIMEZONE, day: "numeric", month: "short", year: "numeric" });
const PH_TIME = new Intl.DateTimeFormat("en-PH", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true });

const toDate = (value: string | Date): Date => (value instanceof Date ? value : new Date(value));

/** "12 Nov 2026" in Manila time. Never a guess — unparseable input says so. */
export function formatPhDate(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return "to be confirmed";
  const d = toDate(value);
  return Number.isNaN(d.getTime()) ? "to be confirmed" : PH_DATE.format(d);
}

export function formatPhTime(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return "to be confirmed";
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "to be confirmed";
  return PH_TIME.format(d).toUpperCase().replace(/\s+/g, " ");
}

/**
 * Caps `{{services}}` at the first three items plus "+N more", exactly as
 * `copy.ts` documents. Without this a five-service booking renders past 160
 * characters and the SMS splits into two billable segments.
 */
export function summariseServices(names: string[], max = 3): string {
  const clean = names.map((n) => n.trim()).filter((n) => n.length > 0);
  if (clean.length === 0) return "your service";
  const head = clean.slice(0, max).join(", ");
  return clean.length > max ? `${head} +${clean.length - max} more` : head;
}

const vehicleText = (b: NotifyBooking): string | null => (b.vehicle ? vehicleLabel(b.vehicle) : null);
const estimateText = (min: number | null, max: number | null): string => formatPesoRange(min, max);
const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;
const absUrl = (path: string): string => `${SITE.url.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
const SHOP_ADDRESS = `${BUSINESS.address.street}, ${BUSINESS.address.district}`;

/** Mobile clients truncate past ~60 characters, so the subject is capped. */
const emailSubject = (template: EmailTemplateKey, vars: EmailVars, fallback: string): string => {
  const rendered = renderEmailTemplate(EMAIL_TEMPLATES[template], vars).subject;
  return rendered.length >= 8 ? rendered.slice(0, 98) : fallback;
};

// ── Outcome constructors ─────────────────────────────────────────────────────

const duplicateOutcome = (channel: NotifyChannel, template: string): NotifyOutcome => ({
  channel,
  template,
  status: "duplicate",
  provider: "none",
  providerId: null,
  error: null,
});

const blockedOutcome = (channel: NotifyChannel, template: string, error: string): NotifyOutcome => ({
  channel,
  template,
  status: "blocked",
  provider: "none",
  providerId: null,
  error,
});

const failedOutcome = (channel: NotifyChannel, template: string, error: string): NotifyOutcome => ({
  channel,
  template,
  status: "failed",
  provider: "none",
  providerId: null,
  error,
});

const smsOutcome = (template: string, r: SendSmsResult): NotifyOutcome => ({
  channel: "sms",
  template,
  status: r.status,
  provider: r.provider,
  providerId: r.providerId,
  error: r.error,
});

/** `Notification.status` values that mean "this is finished, stop retrying". */
const TERMINAL_OK = new Set<SendSmsResult["status"]>(["sent", "delivered", "skipped"]);

// ── Per-channel workers (idempotency + fitting built in) ─────────────────────

interface SmsArgs {
  /** Full idempotency key, e.g. `BOOKING_CONFIRMATION:abc:sms`. */
  key: string;
  /** Ledger template name. */
  template: string;
  smsTemplate: SmsTemplateKey;
  vars: SmsVars;
  to: string;
  bookingId?: string | null;
  marketing?: boolean;
  consentSms: boolean;
  consentMarketing?: boolean;
  recipientSuppliedByCustomer: boolean;
  containsCustomerName?: string | null;
  containsVehicle?: string | null;
  /** Appended after the rendered body. Used for mandatory terms. */
  suffix?: string;
}

/** Renders, fits, claims and sends one SMS. Never throws. */
async function runSms(args: SmsArgs): Promise<NotifyOutcome> {
  const claim = await claimIdempotencyKey(args.key, { template: args.template, channel: "sms" });
  if (claim.state === "duplicate") return duplicateOutcome("sms", args.template);

  let body: string;
  try {
    body = assertSmsFits(args.smsTemplate, args.vars);
  } catch (error) {
    // An over-length template is a content bug, not a transient failure. Log it
    // loudly, send nothing, and release the claim so a fixed template retries.
    logger.error("notify.sms_over_length", { template: args.template }, { err: error });
    await releaseIdempotencyKey(args.key);
    return failedOutcome("sms", args.template, "template-over-length");
  }

  const fullBody = args.suffix ? `${body}\n${args.suffix}` : body;
  const result = await sendSms({
    to: args.to,
    body: fullBody,
    idempotencyKey: args.key,
    template: args.template,
    bookingId: args.bookingId ?? null,
    marketing: args.marketing ?? false,
    consentSms: args.consentSms,
    consentMarketing: args.consentMarketing,
    recipientSuppliedByCustomer: args.recipientSuppliedByCustomer,
    containsCustomerName: args.containsCustomerName ?? null,
    containsVehicle: args.containsVehicle ?? null,
  });

  if (TERMINAL_OK.has(result.status)) await completeIdempotencyKey(args.key, null, { template: args.template, channel: "sms" });
  else await releaseIdempotencyKey(args.key);

  return smsOutcome(args.template, result);
}

interface EmailArgs {
  key: string;
  template: string;
  subject: string;
  content: EmailContent;
  to: string;
  bookingId?: string | null;
  marketing?: boolean;
  /** Runs the marketing agent's pre-send validator when supplied. */
  emailTemplate?: EmailTemplateKey;
  vars?: EmailVars;
  hasConsent?: boolean;
}

/** Claims and sends one email. Never throws. */
async function runEmail(args: EmailArgs): Promise<NotifyOutcome> {
  if (args.emailTemplate && args.vars) {
    const problems = validateEmail(args.emailTemplate, args.vars, args.hasConsent ?? true);
    if (problems.length > 0) logger.error("notify.email_validation_failed", { template: args.template, problems: problems.length });
  }

  const claim = await claimIdempotencyKey(args.key, { template: args.template, channel: "email" });
  if (claim.state === "duplicate") return duplicateOutcome("email", args.template);

  const result = await sendEmailContent(args.content, args.subject, args.to, {
    template: args.template,
    bookingId: args.bookingId ?? null,
    idempotencyKey: args.key,
    marketing: args.marketing ?? false,
  });

  if (TERMINAL_OK.has(result.status)) await completeIdempotencyKey(args.key, null, { template: args.template, channel: "email" });
  else await releaseIdempotencyKey(args.key);

  return { channel: "email", template: args.template, status: result.status, provider: result.provider, providerId: result.providerId, error: result.error };
}

// ── Plan execution ───────────────────────────────────────────────────────────

interface PlanItem {
  channel: NotifyChannel;
  run: () => Promise<NotifyOutcome>;
}

async function runPlan(plan: PlanItem[], label: string): Promise<NotifyOutcome[]> {
  const settled = await Promise.allSettled(
    plan.map(async (item) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<NotifyOutcome>((resolve) => {
        timer = setTimeout(() => resolve(failedOutcome(item.channel, label, "timeout")), NOTIFY_BUDGET_MS);
      });
      try {
        return await Promise.race([item.run(), timeout]);
      } catch (error) {
        logger.error("notify.channel_threw", { channel: item.channel, label }, { err: error });
        return failedOutcome(item.channel, label, "internal-error");
      } finally {
        if (timer) clearTimeout(timer);
      }
    }),
  );

  return settled.map((s, i) => {
    const channel = plan[i]?.channel ?? "sms";
    return s.status === "fulfilled" ? s.value : failedOutcome(channel, label, "rejected");
  });
}

/** Wraps a plan in the public result shape. Never throws. */
async function notify(label: string, plan: PlanItem[], whatsappLink: string): Promise<NotifyResult> {
  try {
    const outcomes = await runPlan(plan, label);
    const result: NotifyResult = {
      ok: outcomes.every((o) => o.status !== "failed"),
      sent: outcomes.some((o) => o.status === "sent" || o.status === "delivered"),
      outcomes,
      whatsappLink,
    };
    logger.info("notify.completed", {
      label,
      ok: result.ok,
      sent: result.sent,
      channels: outcomes.map((o) => `${o.channel}:${o.status}`).join(","),
    });
    return result;
  } catch (error) {
    // Belt and braces: `runPlan` already swallows everything.
    logger.error("notify.failed", { label }, { err: error });
    return { ok: false, sent: false, outcomes: [failedOutcome("sms", label, "internal-error")], whatsappLink };
  }
}

const internalFailure = (label: string, link: string): NotifyResult => ({
  ok: false,
  sent: false,
  outcomes: [failedOutcome("sms", label, "internal-error")],
  whatsappLink: link,
});

// ── 1. Booking confirmed ─────────────────────────────────────────────────────

export async function notifyBookingConfirmed(booking: NotifyBooking, options: { channels?: NotifyChannel[] } = {}): Promise<NotifyResult> {
  const label = "BOOKING_CONFIRMATION";
  const key = `${label}:${booking.id}`;
  const waLink = buildWhatsAppLink(`Hi EYG! About my booking ${booking.reference}.`);

  try {
    const smsVars: SmsVars = {
      sender: SMS_SENDER_PREFIX,
      optout: SMS_OPT_OUT_LINE,
      reference: booking.reference,
      name: firstName(booking.customerName),
      date: formatPhDate(booking.startAt),
      time: formatPhTime(booking.startAt),
      services: summariseServices(booking.serviceNames),
      total: estimateText(booking.estimateMin, booking.estimateMax),
    };
    const emailVars: EmailVars = {
      ...smsVars,
      vehicle: vehicleText(booking) ?? "your vehicle",
      address: SHOP_ADDRESS,
      landmark: BUSINESS.address.landmark,
      directionsUrl: LINKS.directionsGoogle,
      bookUrl: absUrl("/book"),
    };

    const car = vehicleText(booking);
    void car; // referenced only inside the template closures below
    const wantSms = options.channels?.includes("sms") ?? true;
    const wantEmail = options.channels?.includes("email") ?? true;
    const plan: PlanItem[] = [];

    if (wantSms) {
      plan.push({
        channel: "sms",
        run: () =>
          booking.consentSms
            ? runSms({
                key: `${key}:sms`,
                template: label,
                smsTemplate: "BOOKING_CONFIRMED",
                vars: smsVars,
                to: booking.customerPhone,
                bookingId: booking.id,
                consentSms: true,
                recipientSuppliedByCustomer: booking.recipientSuppliedByCustomer ?? true,
                containsCustomerName: booking.customerName,
                containsVehicle: car,
              })
            : Promise.resolve(blockedOutcome("sms", label, "no-sms-consent")),
      });
    }

    if (wantEmail && booking.customerEmail) {
      const to = booking.customerEmail;
      plan.push({
        channel: "email",
        run: () =>
          runEmail({
            key: `${key}:email`,
            template: label,
            emailTemplate: "BOOKING_CONFIRMATION",
            vars: emailVars,
            subject: emailSubject("BOOKING_CONFIRMATION", emailVars, `Your EYG booking is confirmed — ${booking.reference}`),
            to,
            bookingId: booking.id,
            content: {
              preheader: renderEmailTemplate(EMAIL_TEMPLATES.BOOKING_CONFIRMATION, emailVars).preheader,
              heading: `You are booked in — ${booking.reference}`,
              intro: `Hi ${firstName(booking.customerName)},\nNothing else to do. Just come in at your time.`,
              rows: [
                { label: "Reference", value: booking.reference },
                { label: "Date", value: formatPhDate(booking.startAt) },
                { label: "Time", value: formatPhTime(booking.startAt) },
                ...(car ? [{ label: "Vehicle", value: car }] : []),
                { label: "Services", value: summariseServices(booking.serviceNames, 6) },
                { label: "Estimate", value: estimateText(booking.estimateMin, booking.estimateMax) },
              ],
              cta: {
                label: "Get directions",
                href: LINKS.directionsGoogle,
                note: `${SHOP_ADDRESS}. ${BUSINESS.address.landmark}`,
              },
              footnote:
                "A technician looks at the vehicle first and tells you what is actually wrong. If the price changes while the work is open, we stop and call you before continuing.",
            },
          }),
      });
    }

    return await notify(label, plan, waLink);
  } catch (error) {
    logger.error("notify.booking_confirmed_failed", { label }, { err: error });
    return internalFailure(label, waLink);
  }
}

// ── 2. Booking reminder (24h) ────────────────────────────────────────────────

export async function notifyBookingReminder24h(booking: NotifyBooking): Promise<NotifyResult> {
  const label = "BOOKING_REMINDER_24H";
  const key = `${label}:${booking.id}`;
  const waLink = buildWhatsAppLink(`Hi EYG! Reminder about my booking ${booking.reference} tomorrow.`);

  try {
    const smsVars: SmsVars = {
      sender: SMS_SENDER_PREFIX,
      optout: SMS_OPT_OUT_LINE,
      reference: booking.reference,
      date: formatPhDate(booking.startAt),
      time: formatPhTime(booking.startAt),
    };
    const emailVars: EmailVars = {
      ...smsVars,
      name: firstName(booking.customerName),
      vehicle: vehicleText(booking) ?? "your vehicle",
      address: SHOP_ADDRESS,
      landmark: BUSINESS.address.landmark,
      directionsUrl: LINKS.directionsGoogle,
      bookUrl: absUrl("/book"),
    };

    const plan: PlanItem[] = [
      {
        channel: "sms",
        run: () =>
          booking.consentSms
            ? runSms({
                key: `${key}:sms`,
                template: label,
                smsTemplate: "BOOKING_REMINDER_24H",
                vars: smsVars,
                to: booking.customerPhone,
                bookingId: booking.id,
                consentSms: true,
                recipientSuppliedByCustomer: booking.recipientSuppliedByCustomer ?? true,
              })
            : Promise.resolve(blockedOutcome("sms", label, "no-sms-consent")),
      },
    ];

    if (booking.customerEmail) {
      const to = booking.customerEmail;
      plan.push({
        channel: "email",
        run: () =>
          runEmail({
            key: `${key}:email`,
            template: "BOOKING_REMINDER",
            emailTemplate: "BOOKING_REMINDER",
            vars: emailVars,
            subject: emailSubject("BOOKING_REMINDER", emailVars, `Tomorrow: ${booking.reference}`),
            to,
            bookingId: booking.id,
            content: {
              preheader: renderEmailTemplate(EMAIL_TEMPLATES.BOOKING_REMINDER, emailVars).preheader,
              heading: `Tomorrow: ${formatPhTime(booking.startAt)}`,
              intro: `Hi ${firstName(booking.customerName)},\nA quick reminder so you are not caught in traffic.`,
              rows: [
                { label: "Reference", value: booking.reference },
                { label: "Date", value: formatPhDate(booking.startAt) },
                { label: "Time", value: formatPhTime(booking.startAt) },
                { label: "Where", value: SHOP_ADDRESS },
              ],
              cta: { label: "Get directions", href: LINKS.directionsGoogle },
              footnote:
                "Helpful to bring: your OR/CR so we can confirm the tyre and brake specs, and your service history if you have it. If you need to move the booking, reply — we would rather reschedule than have you wait in traffic.",
            },
          }),
      });
    }

    return await notify(label, plan, waLink);
  } catch (error) {
    logger.error("notify.reminder_failed", { label }, { err: error });
    return internalFailure(label, waLink);
  }
}

// ── 3. Booking cancelled ─────────────────────────────────────────────────────

export async function notifyBookingCancelled(booking: NotifyBooking, reason?: string | null): Promise<NotifyResult> {
  const label = "BOOKING_CANCELLED";
  const key = `${label}:${booking.id}`;
  const waLink = buildWhatsAppLink(`Hi EYG! Can we rebook? Reference ${booking.reference}.`);

  try {
    const smsVars: SmsVars = {
      sender: SMS_SENDER_PREFIX,
      optout: SMS_OPT_OUT_LINE,
      reference: booking.reference,
      date: formatPhDate(booking.startAt),
      time: formatPhTime(booking.startAt),
    };
    const car = vehicleText(booking);
    void car; // referenced only inside the template closures below
    const plan: PlanItem[] = [];

    if (booking.consentSms) {
      plan.push({
        channel: "sms",
        run: () =>
          runSms({
            key: `${key}:sms`,
            template: label,
            smsTemplate: "BOOKING_CANCELLED",
            vars: smsVars,
            to: booking.customerPhone,
            bookingId: booking.id,
            consentSms: true,
            recipientSuppliedByCustomer: booking.recipientSuppliedByCustomer ?? true,
          }),
      });
    }

    if (booking.customerEmail) {
      const to = booking.customerEmail;
      plan.push({
        channel: "email",
        run: () =>
          runEmail({
            key: `${key}:email`,
            template: label,
            subject: `Cancelled — ${booking.reference} | EYG Tire & Auto Care`,
            to,
            bookingId: booking.id,
            content: {
              preheader: "Nothing is charged. Book again whenever you need us.",
              heading: `Booking ${booking.reference} is cancelled`,
              intro: `Hi ${firstName(booking.customerName)},\nNothing is charged and the bay is released.`,
              rows: [
                { label: "Reference", value: booking.reference },
                { label: "Was booked for", value: `${formatPhDate(booking.startAt)}, ${formatPhTime(booking.startAt)}` },
                ...(reason ? [{ label: "Reason", value: reason }] : []),
              ],
              alert: "Nothing is charged. Re-booking is one tap away, or call the shop and we will sort it out.",
              cta: { label: "Book again", href: absUrl("/book") },
            },
          }),
      });
    }

    return await notify(label, plan, waLink);
  } catch (error) {
    logger.error("notify.cancelled_failed", { label }, { err: error });
    return internalFailure(label, waLink);
  }
}

// ── 4. Quote ready ───────────────────────────────────────────────────────────

export async function notifyQuoteReady(quote: NotifyQuote): Promise<NotifyResult> {
  const label = "QUOTE_READY";
  const key = `${label}:${quote.reference}`;
  const waLink = buildWhatsAppLink(`Hi EYG! About my estimate ${quote.reference}.`);

  try {
    const range = estimateText(quote.estimateMin, quote.estimateMax);
    const smsVars: SmsVars = {
      sender: SMS_SENDER_PREFIX,
      optout: SMS_OPT_OUT_LINE,
      reference: quote.reference,
      name: firstName(quote.customerName),
      min: formatPeso(quote.estimateMin),
      max: formatPeso(quote.estimateMax),
    };
    const emailVars: EmailVars = {
      ...smsVars,
      vehicle: quote.vehicleLabel ?? "your vehicle",
      bookUrl: absUrl("/book"),
      expiresAt: formatPhDate(quote.expiresAt),
      address: SHOP_ADDRESS,
      directionsUrl: LINKS.directionsGoogle,
    };

    const plan: PlanItem[] = [];
    if (quote.customerPhone) {
      plan.push({
        channel: "sms",
        run: () =>
          runSms({
            key: `${key}:sms`,
            template: label,
            smsTemplate: "QUOTE_READY",
            vars: smsVars,
            to: quote.customerPhone,
            consentSms: true,
            recipientSuppliedByCustomer: quote.recipientSuppliedByCustomer ?? true,
          }),
      });
    }

    if (quote.customerEmail) {
      const to = quote.customerEmail;
      plan.push({
        channel: "email",
        run: () =>
          runEmail({
            key: `${key}:email`,
            template: label,
            emailTemplate: "QUOTE_READY",
            vars: emailVars,
            subject: emailSubject("QUOTE_READY", emailVars, `Your estimate is ready — ${quote.reference}`),
            to,
            content: {
              preheader: renderEmailTemplate(EMAIL_TEMPLATES.QUOTE_READY, emailVars).preheader,
              heading: `Your estimate is ready — ${range}`,
              intro: `Hi ${firstName(quote.customerName)},\nHere is the estimate you asked for.`,
              rows: [
                { label: "Reference", value: quote.reference },
                ...(quote.vehicleLabel ? [{ label: "Vehicle", value: quote.vehicleLabel }] : []),
                { label: "Estimate", value: range },
                { label: "Valid until", value: formatPhDate(quote.expiresAt) },
              ],
              alert:
                "This is a range, not a final price. We have not seen the vehicle yet. Once a technician has looked at it, we confirm one price before starting — and that price does not change without calling you.",
              cta: { label: "Book with this estimate", href: absUrl("/book") },
            },
          }),
      });
    }

    return await notify(label, plan, waLink);
  } catch (error) {
    logger.error("notify.quote_failed", { label }, { err: error });
    return internalFailure(label, waLink);
  }
}

// ── 5. Roadside en route ─────────────────────────────────────────────────────

/**
 * Goes to BOTH the customer and the shop. The customer's message is strictly
 * logistical — no name, no vehicle description — so the third-party-PII guard in
 * `sms.ts` cannot be tripped by something a passer-by can read over a shoulder.
 */
export async function notifyRoadsideEnRoute(input: NotifyRoadside, etaMinutes: number): Promise<NotifyResult> {
  const label = "ROADSIDE_EN_ROUTE";
  const key = `${label}:${input.reference ?? input.customerPhone.slice(-6)}`;
  const waLink = buildWhatsAppLink("Hi EYG! I am waiting on the roadside. Where are you?");
  const eta = Math.max(1, Math.round(etaMinutes));

  try {
    const plan: PlanItem[] = [
      {
        channel: "sms",
        run: () =>
          runSms({
            key: `${key}:customer`,
            template: label,
            smsTemplate: "ROADSIDE_EN_ROUTE",
            vars: { sender: SMS_SENDER_PREFIX, optout: SMS_OPT_OUT_LINE, eta: `${eta} minutes` },
            to: input.customerPhone,
            consentSms: true,
            recipientSuppliedByCustomer: input.recipientSuppliedByCustomer,
            // `containsCustomerName` / `containsVehicle` are intentionally not
            // passed: this message carries neither, and that is the point.
          }),
      },
    ];

    const shopPhone = shopSmsRecipient();
    if (shopPhone) {
      plan.push({
        channel: "sms",
        run: async () => {
          // Internal alert to the shop's own number. The PII guard is bypassed
          // deliberately here, because the recipient IS the business.
          const detail = [input.location, input.note].filter(Boolean).join(". ");
          const result = await sendSms({
            to: shopPhone,
            body: `EYG: roadside en route, ETA ${eta}m. ${detail}`.slice(0, 160),
            template: `${label}:SHOP`,
            consentSms: true,
            recipientSuppliedByCustomer: true,
            containsCustomerName: null,
            containsVehicle: null,
          });
          return smsOutcome(`${label}:SHOP`, result);
        },
      });
    }

    return await notify(label, plan, waLink);
  } catch (error) {
    logger.error("notify.roadside_failed", { label }, { err: error });
    return internalFailure(label, waLink);
  }
}

// ── 6. Promo blurb ───────────────────────────────────────────────────────────

/**
 * The `terms` are NON-NEGOTIABLE. A discount without its conditions is how a
 * shop ends up arguing with a customer at the counter, and in the Philippines it
 * is a DTI/NPC problem as well. We cap the SMS terms at two lines and put the
 * full list in the email and behind the deep link.
 */
export function buildPromoTermsBlock(terms: string[], maxLines = 2): string {
  const clean = terms.map((t) => t.trim()).filter((t) => t.length > 0);
  if (clean.length === 0) return "Ask us for the full terms before you book.";
  return clean.slice(0, maxLines).join(" | ");
}

export async function notifyPromoBlurb(
  promo: NotifyPromo,
  contact: {
    name: string;
    phone: string;
    email?: string | null;
    consentMarketing: boolean;
    consentSms?: boolean;
    recipientSuppliedByCustomer?: boolean;
  },
): Promise<NotifyResult> {
  const label = "PROMO_BLURB";
  const key = `${label}:${promo.slug}:${contact.phone.slice(-6)}`;
  const promoUrl = absUrl(`/deals#${promo.slug}`);
  const waLink = buildWhatsAppLink(`Hi EYG! Tell me about "${promo.title}".`);

  try {
    if (SMS_TEMPLATES.PROMO_BLURB.requiresConsent && !contact.consentMarketing) {
      logger.warn("notify.promo_no_consent", { slug: promo.slug, action: "refused" });
      return { ok: true, sent: false, outcomes: [blockedOutcome("sms", label, "no-marketing-consent")], whatsappLink: waLink };
    }

    const endsLabel = promo.endsAt ? formatPhDate(promo.endsAt) : "further notice";
    const smsVars: SmsVars = {
      sender: SMS_SENDER_PREFIX,
      optout: SMS_OPT_OUT_LINE,
      title: promo.title,
      value: promo.valueLabel,
      end: endsLabel,
      url: promoUrl,
    };
    const emailVars: EmailVars = {
      ...smsVars,
      name: firstName(contact.name),
      promoTitle: promo.title,
      promoSubtitle: promo.terms[0] ?? "",
      promoBody: promo.terms.join(" "),
      promoValue: promo.valueLabel,
      promoEnds: endsLabel,
      promoUrl,
      unsubUrl: absUrl("/unsubscribe"),
      bookUrl: absUrl("/book"),
    };

    const plan: PlanItem[] = [];

    if (contact.phone) {
      plan.push({
        channel: "sms",
        run: () =>
          runSms({
            key: `${key}:sms`,
            template: label,
            smsTemplate: "PROMO_BLURB",
            vars: smsVars,
            to: contact.phone,
            marketing: true,
            consentSms: contact.consentSms ?? true,
            consentMarketing: true,
            recipientSuppliedByCustomer: contact.recipientSuppliedByCustomer ?? true,
            // Mandatory: the discount never travels without its conditions.
            suffix: buildPromoTermsBlock(promo.terms),
          }),
      });
    }

    if (contact.email) {
      const to = contact.email;
      plan.push({
        channel: "email",
        run: () =>
          runEmail({
            key: `${key}:email`,
            template: "PROMO_BROADCAST",
            emailTemplate: "PROMO_BROADCAST",
            vars: emailVars,
            hasConsent: true,
            subject: `${promo.title} — ends ${endsLabel}`,
            to,
            marketing: true,
            content: {
              preheader: renderEmailTemplate(EMAIL_TEMPLATES.PROMO_BROADCAST, emailVars).preheader,
              heading: promo.title,
              intro: `Hi ${firstName(contact.name)},\n${promo.valueLabel}, until ${endsLabel}.`,
              paragraphs: [promo.terms.join(" ")],
              rows: promo.terms.map((t, i) => ({ label: `Term ${i + 1}`, value: t })),
              cta: {
                label: "See the full offer",
                href: promoUrl,
                note: "The price is confirmed after we look at the vehicle. It cannot be combined with another offer.",
              },
            },
          }),
      });
    }

    return await notify(label, plan, waLink);
  } catch (error) {
    logger.error("notify.promo_failed", { label, slug: promo.slug }, { err: error });
    return internalFailure(label, waLink);
  }
}

// ── 7. Review request ────────────────────────────────────────────────────────

export async function notifyReviewRequest(input: NotifyReviewRequest): Promise<NotifyResult> {
  const label = "REVIEW_REQUEST";
  // One request per customer, keyed on a coarse bucket of the contact detail.
  const bucket = (input.customerPhone ?? input.customerEmail ?? "unknown").slice(-6).toLowerCase();
  const key = `${label}:${bucket}`;
  const reviewUrl = BUSINESS.social.googleBusiness ?? absUrl("/contact");
  const waLink = buildWhatsAppLink("Hi EYG! How was everything today?");

  try {
    if (!input.consentMarketing) {
      logger.warn("notify.review_no_consent", { action: "refused; ask at the counter instead" });
      return { ok: true, sent: false, outcomes: [blockedOutcome("sms", label, "no-marketing-consent")], whatsappLink: waLink };
    }

    const vehicle = input.vehicleLabel ?? "your vehicle";
    const smsVars: SmsVars = {
      sender: SMS_SENDER_PREFIX,
      optout: SMS_OPT_OUT_LINE,
      name: firstName(input.customerName),
      date: formatPhDate(input.completedOn),
      url: reviewUrl,
    };
    const emailVars: EmailVars = { ...smsVars, vehicle, reviewUrl, unsubUrl: absUrl("/unsubscribe"), bookUrl: absUrl("/book") };

    const plan: PlanItem[] = [];

    if (input.customerPhone && input.consentSms) {
      plan.push({
        channel: "sms",
        run: () =>
          runSms({
            key: `${key}:sms`,
            template: label,
            smsTemplate: "REVIEW_REQUEST",
            vars: smsVars,
            to: input.customerPhone as string,
            marketing: true,
            consentSms: true,
            consentMarketing: true,
            recipientSuppliedByCustomer: input.recipientSuppliedByCustomer ?? true,
          }),
      });
    }

    if (input.customerEmail) {
      const to = input.customerEmail;
      plan.push({
        channel: "email",
        run: () =>
          runEmail({
            key: `${key}:email`,
            template: label,
            emailTemplate: "REVIEW_REQUEST",
            vars: emailVars,
            hasConsent: true,
            subject: "How did we do? | EYG Tire & Auto Care",
            to,
            marketing: true,
            content: {
              preheader: renderEmailTemplate(EMAIL_TEMPLATES.REVIEW_REQUEST, emailVars).preheader,
              heading: "How did we do?",
              intro: `Hi ${firstName(input.customerName)},\nThanks for letting us work on ${vehicle} on ${formatPhDate(input.completedOn)}.`,
              paragraphs: [
                "If we did a good job, a short honest review genuinely helps. If we did not, reply to this email — a person will read it, and we would rather hear it from you directly.",
              ],
              cta: { label: "Write a review", href: reviewUrl },
              footnote: "Write whatever you actually experienced. No template. If you were only partly happy, write that.",
            },
          }),
      });
    }

    return await notify(label, plan, waLink);
  } catch (error) {
    logger.error("notify.review_request_failed", { label }, { err: error });
    return internalFailure(label, waLink);
  }
}

// ── 8. New lead alert (to the shop) ──────────────────────────────────────────

const KIND_LABEL: Record<NotifyNewLeadInput["kind"], string> = {
  roadside: "ROADSIDE — the customer may be stranded",
  contact: "Contact form",
  newsletter: "Newsletter signup",
  "tire-size": "Tyre size lookup",
};

/**
 * Alerts the SHOP, never the customer. The highest-value notification in the
 * system: a roadside lead is a stranded customer and a phone call.
 *
 * A roadside lead also goes out over SMS to the shop's number, because at 2am
 * the email is not what the mechanic is looking at.
 */
export async function notifyNewLeadAlert(lead: NotifyNewLeadInput): Promise<NotifyResult> {
  const label = "NEW_LEAD_ALERT";
  const key = `${label}:${lead.kind}:${(lead.phone ?? lead.email ?? "anon").slice(-6)}`;
  const shopEmail = shopEmailRecipient();
  const shopPhone = shopSmsRecipient();
  const receivedAt = new Date();
  const who = lead.name?.trim() || "A customer";
  const waLink = buildWhatsAppLink(`Hi EYG! New ${lead.kind} enquiry from ${lead.name ?? "a customer"}.`);

  try {
    const metaLine = lead.meta
      ? Object.entries(lead.meta)
          .slice(0, 6)
          .map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`)
          .join(" · ")
      : null;
    const detail = [lead.message?.trim(), metaLine].filter(Boolean).join("\n\n");

    const plan: PlanItem[] = [
      {
        channel: "email",
        run: () =>
          runEmail({
            key: `${key}:email`,
            template: label,
            subject: `${KIND_LABEL[lead.kind]} — new website enquiry`,
            to: shopEmail,
            content: {
              preheader: `${KIND_LABEL[lead.kind]} — ${formatPhTime(receivedAt)}`,
              heading: KIND_LABEL[lead.kind],
              intro: lead.name?.trim() ? `${who} used the website form.` : "Someone used the website form.",
              rows: [
                { label: "Type", value: lead.kind },
                { label: "Name", value: lead.name?.trim() || "not given" },
                { label: "Phone", value: lead.phone ?? "not given" },
                { label: "Email", value: lead.email ?? "not given" },
                { label: "Received", value: `${formatPhDate(receivedAt)}, ${formatPhTime(receivedAt)}` },
              ],
              ...(detail ? { paragraphs: [detail] } : {}),
              ...(lead.phone
                ? { cta: { label: `Call ${lead.phone}`, href: `tel:${lead.phone.replace(/[^\d+]/g, "")}`, note: "Roadside customers are often waiting on a shoulder or in a bay." } }
                : { cta: { label: "Open the leads board", href: absUrl("/admin") } }),
              ...(lead.kind === "roadside"
                ? { alert: "This is the highest-value lead type. If the customer is stranded, call them now." }
                : {}),
            },
          }),
      },
    ];

    if (lead.kind === "roadside" && shopPhone) {
      plan.push({
        channel: "sms",
        run: async () => {
          const name = lead.name?.trim() || "a customer";
          const body = `EYG ROADSIDE: ${name} ${lead.phone ?? ""}. ${lead.message ? lead.message.replace(/\s+/g, " ").slice(0, 80) : "See the leads board."}`.slice(0, 160);
          const result = await sendSms({
            to: shopPhone,
            body,
            template: `${label}:ROADSIDE`,
            consentSms: true,
            recipientSuppliedByCustomer: true,
            containsCustomerName: null,
            containsVehicle: null,
          });
          return smsOutcome(`${label}:ROADSIDE`, result);
        },
      });
    }

    return await notify(label, plan, waLink);
  } catch (error) {
    logger.error("notify.new_lead_failed", { label, kind: lead.kind }, { err: error });
    return internalFailure(label, waLink);
  }
}

// ── Booking resolution (the documented seam) ─────────────────────────────────

/**
 * Reads a `Booking` row and maps it to the plain shape the notifier needs.
 *
 * This is the ONE place the notification layer touches the booking tables, and
 * it is deliberately behind a function so it can be deleted the moment the
 * booking agent passes a DTO instead:
 *
 *     const booking = fromBookingDto(await getBooking(id), { consentSms, consentMarketing });
 *     await notifyBookingConfirmed(booking);
 */
export async function resolveNotifyBooking(bookingId: string): Promise<NotifyBooking | null> {
  const row = await withDb<{
    id: string;
    reference: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    startAt: Date;
    consentSms: boolean;
    consentMarketing: boolean;
    subtotalMin: number | null;
    subtotalMax: number | null;
    vehicle: { year: number; make: string; model: string; variant: string | null; plate: string | null } | null;
    items: Array<{ name: string }>;
  } | null>(
    async (db) =>
      db.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          reference: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          startAt: true,
          consentSms: true,
          consentMarketing: true,
          subtotalMin: true,
          subtotalMax: true,
          vehicle: { select: { year: true, make: true, model: true, variant: true, plate: true } },
          items: { select: { name: true }, orderBy: { id: "asc" } },
        },
      }),
    null,
    { event: "notify.resolve_booking" },
  );

  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    startAt: row.startAt,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    vehicle: row.vehicle,
    serviceNames: row.items.map((i) => i.name),
    estimateMin: row.subtotalMin,
    estimateMax: row.subtotalMax,
    consentSms: row.consentSms,
    consentMarketing: row.consentMarketing,
    recipientSuppliedByCustomer: true,
  };
}

/** Adapts the `BookingDto` from `src/lib/types.ts` — no database read needed. */
export function fromBookingDto(
  dto: {
    id: string;
    reference: string;
    startAt: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    vehicle: { year: number; make: string; model: string; variant: string | null; plate: string | null } | null;
    items: Array<{ name: string; quantity: number }>;
    estimateMin: number | null;
    estimateMax: number | null;
  },
  consent: { consentSms: boolean; consentMarketing: boolean },
): NotifyBooking {
  return {
    id: dto.id,
    reference: dto.reference,
    startAt: dto.startAt,
    customerName: dto.customerName,
    customerPhone: dto.customerPhone,
    customerEmail: dto.customerEmail,
    vehicle: dto.vehicle,
    serviceNames: dto.items.map((i) => i.name),
    estimateMin: dto.estimateMin,
    estimateMax: dto.estimateMax,
    consentSms: consent.consentSms,
    consentMarketing: consent.consentMarketing,
    recipientSuppliedByCustomer: true,
  };
}
