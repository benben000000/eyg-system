/**
 * EYG TIRE & AUTO CARE — MARKETING SEED: EMAIL TEMPLATES
 * ============================================================================
 * Consumed by the backend notification layer (backend-integrations) via
 * `nodemailer` / `resend`.
 *
 * THE SMS TEMPLATES LIVE IN `./copy.ts`
 * ------------------------------------
 * They are re-exported here so a consumer of this file can reach the whole
 * messaging set from one import. Do not duplicate an SMS body into this file —
 * two copies of the same message will drift, and the copy that reaches a
 * customer is the one nobody re-reads.
 *
 * WHY PLAIN-TEXT BODIES INSTEAD OF HTML STRINGS
 * ---------------------------------------------
 * Each template carries `subject`, `preheader` and a plain-text `body`. The
 * renderer wraps the text in the brand shell (yellow-on-black motorsport header,
 * Barlow body type, logo) so a copy change never requires a designer, and so
 * every email still renders correctly in a client that strips HTML — which, in
 * the Philippines, is more clients than anyone would like to admit.
 *
 * LEGAL (Philippines — Data Privacy Act of 2012, NPC Advisory on Direct Marketing)
 * --------------------------------------------------------------------------------
 * • Every email must identify the sender (name, address, contact).
 * • Every marketing email must carry a working unsubscribe mechanism.
 * • Marketing sends need recorded consent (`Subscriber.confirmedAt`).
 * • Transactional mail is sent only where the customer initiated it
 *   (`Booking.consentSms` equivalent, `Customer.email` on a booking).
 * • DO NOT use an unverified or purchased mailing list. Ever. See
 *   docs/marketing/CAMPAIGN-ROADMAP.md §Q1 for the consent capture flow.
 *
 * VOICE: warm, plain, competent, neighbourly. Short sentences. No exclamation-mark
 * stacking. One idea per email.
 * ============================================================================
 */

import {
  SMS_MAX_LENGTH,
  SMS_OPT_OUT_LINE,
  SMS_SENDER_PREFIX,
  SMS_TEMPLATE_KEYS,
  SMS_TEMPLATES,
  SMS_TOKENS,
  assertSmsConsent,
  assertSmsFits,
  renderSms,
  smsLength,
} from "./copy";
import type { SmsTemplateKey, SmsVars } from "./copy";

export {
  SMS_MAX_LENGTH,
  SMS_OPT_OUT_LINE,
  SMS_SENDER_PREFIX,
  SMS_TEMPLATE_KEYS,
  SMS_TEMPLATES,
  SMS_TOKENS,
  assertSmsConsent,
  assertSmsFits,
  renderSms,
  smsLength,
};
export type { SmsTemplateKey, SmsVars };

// ── Template contract ───────────────────────────────────────────────────────

export const EMAIL_TEMPLATE_KEYS = [
  "BOOKING_CONFIRMATION",
  "BOOKING_REMINDER",
  "QUOTE_READY",
  "REVIEW_REQUEST",
  "PROMO_BROADCAST",
  "NEWSLETTER",
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export interface EmailTemplate {
  readonly key: EmailTemplateKey;
  /** Subject line. May contain `{{token}}`. Kept short — mobile truncates ~45ch. */
  readonly subject: string;
  /** Preheader: the grey line in the inbox preview. Must add to the subject. */
  readonly preheader: string;
  /** Plain-text body. Paragraphs separated by a blank line. */
  readonly body: string;
  /** Primary button. `href` may contain `{{token}}` — usually a deep link. */
  readonly cta: { readonly label: string; readonly href: string } | null;
  /** "transactional" = customer-requested. "marketing" = needs consent + unsub. */
  readonly purpose: "transactional" | "marketing";
  readonly requiresConsent: boolean;
  /** Legal note. Written into the `Notification.body` audit field. */
  readonly purposeNote: string;
}

export const EMAIL_TEMPLATES: Readonly<Record<EmailTemplateKey, EmailTemplate>> = {
  // ── 1. Booking confirmation ───────────────────────────────────────────────
  BOOKING_CONFIRMATION: {
    key: "BOOKING_CONFIRMATION",
    subject: "Booked — {{reference}} | EYG Tire & Auto Care",
    preheader: "Your bay is held. Here is what you need to know before you come in.",
    body:
      "Hi {{name}},\n\n" +
      "You are booked in. Nothing else to do — just come in at your time.\n\n" +
      "YOUR BOOKING\n" +
      "Reference: {{reference}}\n" +
      "Date: {{date}}\n" +
      "Time: {{time}}\n" +
      "Vehicle: {{vehicle}}\n" +
      "Services: {{services}}\n\n" +
      "WHERE WE ARE\n" +
      "{{address}}\n" +
      "Landmark: {{landmark}}\n" +
      "How to get here: {{directionsUrl}}\n\n" +
      "WHAT TO EXPECT\n" +
      "A technician looks at the vehicle first, then tells you what is actually " +
      "wrong and what it will cost. If the price changes while the work is open, " +
      "we stop and call you before continuing. Nothing gets done until you say yes.\n\n" +
      "If anything changes, reply to this email or message us on Facebook with your " +
      "reference number. We will find your booking straight away.\n\n" +
      "See you soon,\n" +
      "EYG Tire & Auto Care",
    cta: { label: "Get directions", href: "{{directionsUrl}}" },
    purpose: "transactional",
    requiresConsent: true,
    purposeNote:
      "Confirms a booking the customer made. Transactional — no unsubscribe line, " +
      "but the footer still carries our business identity as required by the Data Privacy Act.",
  },

  // ── 2. Booking reminder ──────────────────────────────────────────────────
  BOOKING_REMINDER: {
    key: "BOOKING_REMINDER",
    subject: "Tomorrow: {{reference}} at {{time}} | EYG Tire & Auto Care",
    preheader: "A quick reminder, plus what to bring with you.",
    body:
      "Hi {{name}},\n\n" +
      "Reminder about tomorrow.\n\n" +
      "Reference: {{reference}}\n" +
      "Date: {{date}}\n" +
      "Time: {{time}}\n" +
      "Location: {{address}}\n\n" +
      "HELPFUL TO BRING\n" +
      "• Your registration or OR/CR, so we can confirm the tyre and brake specs.\n" +
      "• Your service history, if you have it. It makes the inspection faster.\n" +
      "• Anything that is making a noise — describe it on the way in, even if you " +
      "cannot describe it clearly yet.\n\n" +
      "If you need to move the booking, reply to this email or message us. " +
      "We would rather reschedule than have you wait in traffic for a bay that is " +
      "not free.\n\n" +
      "EYG Tire & Auto Care",
    cta: { label: "Reschedule", href: "{{bookUrl}}" },
    purpose: "transactional",
    requiresConsent: true,
    purposeNote: "Service reminder for an existing booking. Transactional.",
  },

  // ── 3. Quote ready ───────────────────────────────────────────────────────
  QUOTE_READY: {
    key: "QUOTE_READY",
    subject: "Your estimate is ready — {{reference}}",
    preheader: "A range, not a final price. Here is what we are basing it on.",
    body:
      "Hi {{name}},\n\n" +
      "Here is the estimate you asked for.\n\n" +
      "Reference: {{reference}}\n" +
      "Vehicle: {{vehicle}}\n" +
      "Estimate: {{min}} to {{max}}\n\n" +
      "WHAT THIS NUMBER IS\n" +
      "Labour plus the parts we expect to need on a car in average condition. " +
      "The reason it is a range and not one figure is simple: we have not seen " +
      "your vehicle yet. Once the technician has looked at it, we confirm a single " +
      "price before starting, and that price does not change without calling you.\n\n" +
      "This estimate is valid until {{expiresAt}}.\n\n" +
      "If it looks wrong to you, tell us — a second opinion on a quote costs you " +
      "nothing and we would genuinely rather you did.\n\n" +
      "EYG Tire & Auto Care",
    cta: { label: "Book with this estimate", href: "{{bookUrl}}" },
    purpose: "transactional",
    requiresConsent: true,
    purposeNote: "Delivers an estimate the customer requested. Transactional.",
  },

  // ── 4. Review request ────────────────────────────────────────────────────
  // Sent once per completed booking. Never sent to a customer with an unresolved
  // complaint — that combination damages more than it earns. See the protocol in
  // docs/marketing/MESSENGER-MACROS.md §Complaints.
  REVIEW_REQUEST: {
    key: "REVIEW_REQUEST",
    subject: "How did we do?",
    preheader: "One honest review helps us more than anything else we could do.",
    body:
      "Hi {{name}},\n\n" +
      "Thanks for letting us work on the {{vehicle}} on {{date}}.\n\n" +
      "We run a small shop, and in this area most people find us because somebody " +
      "they trust told them. So the reviews matter a lot more here than they would " +
      "in a city.\n\n" +
      "If we did a good job, a short honest review genuinely helps. If we did not, " +
      "we would rather hear it from you directly — reply to this email and a " +
      "person will read it.\n\n" +
      "Leave it here: {{reviewUrl}}\n\n" +
      "Write whatever you actually experienced. No template. If you were only partly " +
      "happy, write that — mixed reviews are worth more than perfect ones.\n\n" +
      "If you would rather not get the occasional note from us, unsubscribe here: " +
      "{{unsubUrl}}\n\n" +
      "Thank you for coming to us,\n" +
      "EYG Tire & Auto Care",
    cta: { label: "Write a review", href: "{{reviewUrl}}" },
    purpose: "marketing",
    requiresConsent: true,
    purposeNote:
      "Review request. Treated as marketing under the NPC advisory, so it carries " +
      "the unsubscribe line and requires recorded consent. One per completed " +
      "booking, never bundled with a promotional email.",
  },

  // ── 5. Promo broadcast ───────────────────────────────────────────────────
  // The rule that keeps this honest: one offer, one email, a real expiry date,
  // and no invented scarcity. "Ending soon" only if the stated date is real.
  PROMO_BROADCAST: {
    key: "PROMO_BROADCAST",
    subject: "{{promoTitle}} — ends {{promoEnds}}",
    preheader: "{{promoSubtitle}}",
    body:
      "Hi {{name}},\n\n" +
      "{{promoTitle}}\n" +
      "{{promoSubtitle}}\n\n" +
      "{{promoBody}}\n\n" +
      "The offer: {{promoValue}}\n" +
      "It runs until {{promoEnds}}. After that we take it down, so if you have been " +
      "meaning to, this is the window.\n\n" +
      "A few honest notes so you are not surprised at the counter:\n" +
      "• The price is confirmed after we look at the vehicle.\n" +
      "• It cannot be combined with another offer.\n" +
      "• If we are not the right shop for the job, we will tell you.\n\n" +
      "See the full terms: {{promoUrl}}\n\n" +
      "You are receiving this because you asked us to keep you posted, or because you " +
      "booked with us. If this is not useful, you can unsubscribe here: {{unsubUrl}}\n\n" +
      "Thank you,\n" +
      "EYG Tire & Auto Care",
    cta: { label: "See the offer", href: "{{promoUrl}}" },
    purpose: "marketing",
    requiresConsent: true,
    purposeNote:
      "Promotional broadcast. Requires recorded consent, a working unsubscribe link " +
      "and honest terms. Maximum one promo broadcast per 21 days per subscriber — " +
      "see SMS_MARKETING_COOLDOWN_DAYS in ./copy.ts.",
  },

  // ── 6. Newsletter ────────────────────────────────────────────────────────
  // The monthly one. Its job is to be worth opening even when nothing is on
  // sale — that is what keeps the list alive and the deliverability clean.
  NEWSLETTER: {
    key: "NEWSLETTER",
    subject: "{{issueTitle}} — EYG monthly",
    preheader: "{{previewLine}}",
    body:
      "Hi {{name}},\n\n" +
      "{{greeting}}\n\n" +
      "{{issueBody}}\n\n" +
      "AT THE SHOP THIS MONTH\n" +
      "{{whatsNew}}\n\n" +
      "A REMINDER ABOUT {{seasonLabel}}\n" +
      "{{seasonTip}}\n\n" +
      "If you need a bay, book here: {{bookUrl}} or call the shop. " +
      "Walk-ins are welcome when a bay is free.\n\n" +
      "If you would rather not get this, unsubscribe here: {{unsubUrl}}\n\n" +
      "Thank you,\n" +
      "EYG Tire & Auto Care",
    cta: { label: "Book a bay", href: "{{bookUrl}}" },
    purpose: "marketing",
    requiresConsent: true,
    purposeNote:
      "Monthly newsletter. Marketing consent required. Never send an issue with an " +
      "empty {{issueBody}} or {{whatsNew}} — an empty newsletter is the fastest way to " +
      "get marked as spam. NOTE: the token is {{issueBody}}, not {{body}}, because " +
      "{{body}} collides with the template's own body field.",
  },
} as const;

// ── Rendering ───────────────────────────────────────────────────────────────

/** Tokens valid in every email body. Superset of `SmsToken`. */
export const EMAIL_TOKENS = [
  ...SMS_TOKENS,
  "address",
  "landmark",
  "directionsUrl",
  "bookUrl",
  "reviewUrl",
  "unsubUrl",
  "vehicle",
  "expiresAt",
  "promoTitle",
  "promoSubtitle",
  "promoBody",
  "promoValue",
  "promoEnds",
  "promoUrl",
  "issueTitle",
  "previewLine",
  "greeting",
  "issueBody",
  "whatsNew",
  "seasonLabel",
  "seasonTip",
] as const;
export type EmailToken = (typeof EMAIL_TOKENS)[number];

export type EmailVars = Partial<Record<EmailToken, string | number>>;

const EMAIL_TOKEN_RE = /\{\{(\w+)\}\}/g;

/**
 * Fills a template's subject / preheader / body / cta href.
 * Leaves unknown tokens as literal `{{token}}` so a typo is visible in preview
 * rather than silently vanishing from a customer's inbox.
 */
export function renderEmailTemplate(
  template: EmailTemplate,
  vars: EmailVars = {},
): { subject: string; preheader: string; body: string; ctaHref: string | null } {
  const fill = (input: string): string =>
    input.replace(EMAIL_TOKEN_RE, (match, token: string) => {
      const value = (vars as Record<string, string | number | undefined>)[token];
      return value === undefined || value === "" ? match : String(value);
    });

  return {
    subject: fill(template.subject),
    preheader: fill(template.preheader),
    body: fill(template.body),
    ctaHref: template.cta ? fill(template.cta.href) : null,
  };
}

/**
 * Pre-send guard. Returns the list of problems; an empty array means the email
 * is safe to send. Call this in the send path and in CI.
 *
 * Checks:
 *   1. Marketing templates must have consent.
 *   2. Marketing templates must render an unsubscribe link.
 *   3. No unfilled `{{token}}` may survive into the rendered body — an unfilled
 *      token in a customer-facing email is a defect, not a cosmetic issue.
 *   4. Subject must be non-empty and under 100 characters (mobile truncation).
 */
export function validateEmail(
  key: EmailTemplateKey,
  vars: EmailVars,
  hasConsent: boolean,
): string[] {
  const template = EMAIL_TEMPLATES[key];
  const rendered = renderEmailTemplate(template, vars);
  const problems: string[] = [];

  if (template.requiresConsent && !hasConsent) {
    problems.push(
      `${key} is a ${template.purpose} email and requires recorded consent. Refusing to send.`,
    );
  }

  const parts: ReadonlyArray<readonly [string, string]> = [
    ["subject", rendered.subject],
    ["preheader", rendered.preheader],
    ["body", rendered.body],
  ];

  const unfilled = parts
    .flatMap(([, value]: readonly [string, string]) => value.match(EMAIL_TOKEN_RE) ?? [])
    .filter((v, i, a) => a.indexOf(v) === i);

  if (unfilled.length > 0) {
    problems.push(`${key} has unfilled tokens after render: ${unfilled.join(", ")}`);
  }

  if (template.purpose === "marketing" && !/\{\{unsubUrl\}\}|unsubscribe/i.test(rendered.body)) {
    problems.push(`${key} is marketing but has no unsubscribe mechanism in the rendered body.`);
  }

  if (rendered.subject.trim().length === 0) {
    problems.push(`${key} rendered an empty subject line.`);
  } else if (rendered.subject.length > 100) {
    problems.push(`${key} subject is ${rendered.subject.length} chars — will truncate on mobile.`);
  }

  return problems;
}

// ── Footer (identical on every email, required by the Data Privacy Act) ─────
/**
 * Rendered below every email body regardless of template. Identifies the
 * sender — name, physical address, contact — which the NPC requires on
 * commercial electronic messages.
 */
export const EMAIL_FOOTER = {
  businessIdentity:
    "EYG Tire & Auto Care\n{{address}}\n{{phone}} · {{email}}",
  unsubscribeNote:
    "You are receiving this because you asked us to keep you posted, or because you " +
    "booked a service with us. Unsubscribe: {{unsubUrl}}",
  preferenceNote:
    "You can also just reply to this email and tell us what you would like to receive. " +
    "We will keep it to exactly that.",
} as const;