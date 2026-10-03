/**
 * EYG TIRE & AUTO CARE — MARKETING SEED: SHARED COPY
 * ============================================================================
 * Every user-facing marketing string that is *not* per-service, per-package or
 * per-promotion lives here, so the tone stays consistent across `/`, `/services`,
 * `/deals`, `/contact` and the transactional messages.
 *
 * OWNED BY: marketing agent. Imported by frontend-pages, widgets and the
 * backend notification layer. Do not duplicate these strings — import them.
 *
 * VOICE (the whole game)
 * ----------------------
 * The brand is yellow-on-black motorsport. The *copy* is the opposite: warm,
 * plain, competent, neighbourly. Short sentences. No hype adjectives. No
 * exclamation-mark stacking. Respectful Taglish boundaries — we use the
 * Filipino automotive words locals already use (PMS, vulcanizing, ayusin/check,
 * change oil, brake pad, roadside) and we do not sprinkle English through
 * Tagalog we are not fluent in.
 *
 * HARD COPY RULES (break these and the work gets sent back)
 * ---------------------------------------------------------
 *   • No invented facts. No numbers here that are not already in `site.ts`.
 *   • No fake urgency. No "last chance", no resetting countdowns, no "2 slots left".
 *   • No unearned authority. Not "certified", not "licensed", not "authorised dealer".
 *   • Never imply a service outcome. Say what we check, not what it will fix.
 *   • Price framing is always a *range* or "after inspection". Never a bare number
 *     presented as final.
 * ============================================================================
 */

// ── Brand promise ──────────────────────────────────────────────────────────
/**
 * OWNER COMMITMENT REQUIRED.
 * "We confirm before we start" is a promise the shop has to actually keep — it
 * is the single strongest anti-overcharging claim available to this business
 * and it is the one most likely to be tested by a customer's cousin. Do not
 * publish it until the owner has agreed to the operating rule.
 */
export const BRAND_PROMISE = {
  confirmBeforeWeStart:
    "We tell you the price before we start. If it changes while we work, we stop and call you.",
  honestAnswer:
    "If your car is fine, we will tell you it is fine. That is the whole business.",
  noSurprise:
    "Nothing gets done until you say yes to the price.",
} as const;

// ── Hero ───────────────────────────────────────────────────────────────────
export const HERO = {
  eyebrow: "Balanga City · EGSA Fourlanes, Tuyo",
  headline: "Tyres, brakes and oil. Priced before we start.",
  subhead:
    "A tyre and auto care bay on the Fourlanes in Tuyo. Bring us the question you have " +
    "been putting off — we will look at it properly, show you what we found, and give " +
    "you the price before anything gets touched.",
  primaryCta: "Book a bay",
  secondaryCta: "Call the shop",
  reassurance:
    "Tire pressure checks are free. Bring the car in and ask.",
  /** Alt text for the hero image — REQUIRED, never empty. */
  heroImageAlt:
    "A technician mounting a tire on the lift at EYG Tire & Auto Care in Tuyo, Balanga City",
} as const;

// ── Emergency roadside banner ──────────────────────────────────────────────
export const ROADSIDE_BANNER = {
  eyebrow: "Stuck on the road?",
  headline: "Call us. We come to you.",
  body:
    "Flat, no air, warning lights, or a noise you do not recognise. Call the shop and " +
    "tell us where you are. We will tell you straight away whether it is safe to drive " +
    "the last kilometre or whether you should switch the engine off and stay put.",
  ctaLabel: "Call now",
  /** What to say when they ring, so triage is fast. */
  callerTip: "Have your plate number and your exact location ready.",
  safetyLine: "Hazards on. Seatbelt on. Stay in the car if you are on a busy road.",
} as const;

// ── Section eyebrows (the small uppercase kicker above each heading) ─────────
export const SECTION_EYEBROWS = {
  services: "What we do",
  packages: "Bundles",
  pricing: "Straight pricing",
  proof: "Our work",
  team: "The people",
  bay: "The bay",
  howItWorks: "How it goes",
  testimonials: "From the neighbours",
  reviews: "What people say",
  faq: "Questions we get asked",
  deals: "This month",
  promos: "Open right now",
  gallery: "Inside the shop",
  about: "About EYG",
  contact: "Find us",
  location: "Where we are",
  contactChannel: "Get in touch",
  hours: "Opening hours",
  payments: "How you can pay",
  emergency: "Emergency",
  quickLinks: "Quick links",
  newsletter: "Stay in touch",
} as const;

// ── Footer ─────────────────────────────────────────────────────────────────
/**
 * Hours are deliberately NOT baked in here. Render from `BUSINESS_HOURS` in
 * `@/config/site` so the footer and the `/contact` page can never disagree.
 */
export const FOOTER = {
  pitch:
    "EYG Tire & Auto Care — a tyre and auto care bay on EGSA Fourlanes, Tuyo, Balanga City, " +
    "Bataan. Tyres, preventive maintenance, brakes, alignment and roadside help, for the " +
    "cars that actually get driven here.",
  prompt: "Need a bay? Book online, or just call the shop.",
  legalNote: "Prices quoted on this site are estimates. Your final price is confirmed after inspection.",
} as const;

// ── Trust / proof block ────────────────────────────────────────────────────
export const TRUST_BLOCK = {
  heading: "Why people come back",
  points: [
    "We show you the old part. Every time.",
    "You get the price before the wrench turns.",
    "If it does not need doing, we tell you it does not need doing.",
    "Small shop. The same faces when you come back.",
  ],
} as const;

// ── How-it-works ───────────────────────────────────────────────────────────
export const HOW_IT_WORKS = {
  heading: "How it goes",
  steps: [
    {
      title: "Tell us what is wrong",
      body: "Call, message, or book online. A few questions: what happened, when it started, how it sounds.",
    },
    {
      title: "We look, then we price",
      body: "A technician inspects the vehicle and tells you what is actually wrong — and what is not.",
    },
    {
      title: "You decide",
      body: "We give you the price and the options. Nothing is done until you say yes.",
    },
    {
      title: "Straightforward handover",
      body: "You get the parts we removed, an itemised invoice, and a plain explanation of what happens next.",
    },
  ],
} as const;

// ── Microcopy (short labels the frontend needs) ────────────────────────────
export const MICROCOPY = {
  priceDisclaimer:
    "Estimates only. Your final price is confirmed after we inspect the vehicle.",
  quoteDisclaimer:
    "This is an estimate based on what you selected. Parts, condition and hidden faults can change the final price.",
  rangeExplainer: "Why a range?",
  rangeExplainerBody:
    "Labour is fixed, but the part depends on your vehicle and what condition we find it in. " +
    "We quote a range, then confirm a single price before we start.",
  reviewDisclaimer:
    "Reviews are posted by customers who visited. We never write our own.",
  emptyStateReviews: "No reviews yet. Be the first — we would rather have an honest one than a fast one.",
  openNow: "Open now",
  closedNow: "Closed",
  opensAt: "Opens {time}",
  closesAt: "Closes {time}",
  closedToday: "Closed today",
  bayHeldForYou: "Your bay is held for 10 minutes.",
  validUntil: "Valid until {date}",
  minLeadTime: "Bookings need at least 90 minutes' notice.",
  subjectToInspection: "Subject to inspection",
  subjectToInspectionLong:
    "We can quote from the outside. The confirmed price comes after the technician has seen the vehicle.",
} as const;

// ============================================================================
// TRANSACTIONAL SMS
// ============================================================================
// ⚠️  EVERY TEMPLATE BELOW IS VERIFIED ≤ 160 CHARACTERS WHEN RENDERED.
//     `assertSmsFits()` throws if a rendered message exceeds 160, which
//     prevents the 7-bit / 160-char segment split that silently doubles the
//     customer's messaging cost. QA: unit-test this file.
//
// LEGAL BASIS (Philippines, RA 9486 / DTI Circular 05-02)
// -------------------------------------------------------
// • Transactional SMS = a message the customer themselves asked for in relation
//   to a product or service they are using. Exempt from the opt-out requirement.
//   Still sent only where `consentSms` was captured at booking (`Booking.consentSms`).
// • Marketing / promotional SMS = covered. Must identify the sender and must
//   carry a working opt-out. That is why `PROMO_BLURB`, `REVIEW_REQUEST` and
//   `SERVICE_DUE_NUDGE` carry "Reply STOP to opt out." and nothing else is allowed
//   to send without consent.
// • The sender should be a registered alphanumeric ID. ⚠️ SUGGESTED — REQUIRES
//   OWNER CONFIRMATION: request a registered sender ID with the SMS provider
//   (the shop's legal name and business registration are needed). Until that is
//   live, the "EYG Tire" prefix inside the message body is what identifies us.
//
// LENGTH BUDGET — MEASURED, NOT ESTIMATED
//   Audited with worst-case realistic substitutions:
//   reference "EYG-7F3K9A" (10) · date "12 Nov 2026" (11) · time "9:00 AM" (7)
//   services "PMS A, tire rotation, brake check +1 more" (41)
//     = first 3 line items + "+N more". Callers MUST cap {{services}} this way.
//   Longest rendered message is BOOKING_CONFIRMED at 147 chars. Next longest is
//   SERVICE_DUE_NUDGE at 136. Every other template has 30+ characters of slack.
//   `assertSmsFits()` re-checks at send time and throws rather than letting an
//   over-length message split into two billable segments.
//   QA: run a unit test over all 11 keys with worst-case vars.
// ============================================================================

export const SMS_MAX_LENGTH = 160;

/**
 * The only non-ASCII code points still inside GSM 03.38 (the basic set plus the
 * extension table). Anything else forces the whole message to UCS-2, which
 * bills and delivers it as 3 segments rather than 1.
 */
export const GSM7_EXTRA: ReadonlySet<string> = new Set([
  "£", "¤", "¥", "§", "¿", "Ä", "Å", "Æ", "Ç", "É", "Ñ", "Ö", "Ø", "Ü", "ß", "à",
  "ä", "å", "æ", "ç", "è", "é", "ì", "ñ", "ò", "ö", "ø", "ù", "ü", "Δ", "Φ", "Γ",
  "Λ", "Ω", "Π", "Ψ", "Σ", "Θ", "Ξ", "€", "[", "\\", "]", "}", "~", "^", "|", "_",
]);

/** Exact opt-out line. Must appear verbatim in every marketing SMS. */
export const SMS_OPT_OUT_LINE = "Reply STOP to opt out.";

/** Identifies the sender in the message body while the registered ID is pending. */
export const SMS_SENDER_PREFIX = "EYG Tire";

export const SMS_TEMPLATE_KEYS = [
  "BOOKING_CONFIRMED",
  "BOOKING_REMINDER_24H",
  "BOOKING_CANCELLED",
  "BOOKING_CAR_READY",
  "BOOKING_DELAYED",
  "QUOTE_RECEIVED",
  "QUOTE_READY",
  "ROADSIDE_EN_ROUTE",
  "PROMO_BLURB",
  "REVIEW_REQUEST",
  "SERVICE_DUE_NUDGE",
] as const;
export type SmsTemplateKey = (typeof SMS_TEMPLATE_KEYS)[number];

export interface SmsTemplate {
  readonly key: SmsTemplateKey;
  /** Template body. `{{token}}` placeholders are substituted at send time. */
  readonly body: string;
  /** "transactional" = customer-requested. "marketing" = needs opt-out + consent. */
  readonly purpose: "transactional" | "marketing";
  /** Requires `Booking.consentSms === true` (or `marketingOptIn` for marketing). */
  readonly requiresConsent: boolean;
  /** Legal meaning of the message, for the audit trail in `Notification`. */
  readonly purposeNote: string;
}

export const SMS_TEMPLATES: Readonly<Record<SmsTemplateKey, SmsTemplate>> = {
  BOOKING_CONFIRMED: {
    key: "BOOKING_CONFIRMED",
    body:
      "{{sender}}: booked. Ref {{reference}}, {{date}} {{time}}. " +
      "{{services}}. EGSA 4lanes Tuyo. Reply CALL to change",
    purpose: "transactional",
    requiresConsent: true,
    purposeNote:
      "Confirms a booking the customer requested. Transactional under RA 9486. " +
      "Caller must summarise {{services}} to the first 3 line items plus '+N more' so " +
      "the render cannot exceed 160 characters on a large booking.",
  },
  BOOKING_REMINDER_24H: {
    key: "BOOKING_REMINDER_24H",
    body:
      "{{sender}}: tomorrow {{time}} on {{date}}, ref {{reference}}. " +
      "EGSA Fourlanes, Tuyo. Reply CALL if plans change.",
    purpose: "transactional",
    requiresConsent: true,
    purposeNote: "Service reminder for an existing booking. Transactional under RA 9486.",
  },
  BOOKING_CANCELLED: {
    key: "BOOKING_CANCELLED",
    body:
      "{{sender}}: booking {{reference}} on {{date}} at {{time}} is cancelled. " +
      "Nothing charged. Reply CALL to rebook.",
    purpose: "transactional",
    requiresConsent: true,
    purposeNote: "Cancellation notice. Transactional under RA 9486.",
  },
  BOOKING_CAR_READY: {
    key: "BOOKING_CAR_READY",
    body:
      "{{sender}}: your car is ready. Ref {{reference}}. " +
      "Collect before {{time}} so we can close your bay.",
    purpose: "transactional",
    requiresConsent: true,
    purposeNote: "Work-completion notice. Transactional under RA 9486.",
  },
  BOOKING_DELAYED: {
    key: "BOOKING_DELAYED",
    body:
      "{{sender}}: ref {{reference}} is running about {{mins}} late. " +
      "Still today, no rush on your end. Thanks for waiting.",
    purpose: "transactional",
    requiresConsent: true,
    purposeNote: "Proactive delay notice. Reduces no-shows; Transactional under RA 9486.",
  },
  QUOTE_RECEIVED: {
    key: "QUOTE_RECEIVED",
    body:
      "{{sender}}: we got your request, ref {{reference}}. " +
      "We will call during shop hours to confirm the details.",
    purpose: "transactional",
    requiresConsent: true,
    purposeNote: "Acknowledges a quote request the customer submitted. Transactional.",
  },
  QUOTE_READY: {
    key: "QUOTE_READY",
    body:
      "{{sender}}: your estimate is ready. Ref {{reference}}, about " +
      "{{min}} to {{max}}. Final price after inspection. Reply to book.",
    purpose: "transactional",
    requiresConsent: true,
    purposeNote: "Delivers a quote the customer asked for. Transactional under RA 9486.",
  },
  ROADSIDE_EN_ROUTE: {
    key: "ROADSIDE_EN_ROUTE",
    body:
      "{{sender}}: on our way to you, about {{eta}}. " +
      "Hazards on, engine off if you can, stay in the car.",
    purpose: "transactional",
    requiresConsent: true,
    purposeNote: "Roadside ETA. The customer requested help. Transactional under RA 9486.",
  },
  PROMO_BLURB: {
    key: "PROMO_BLURB",
    body:
      "{{sender}}: {{title}}, {{value}} until {{end}}. " +
      "Ask us before you come in. {{optout}}",
    purpose: "marketing",
    requiresConsent: true,
    purposeNote:
      "Promotional. Requires marketing consent AND the opt-out line. RA 9486 promotional rule.",
  },
  REVIEW_REQUEST: {
    key: "REVIEW_REQUEST",
    body:
      "{{sender}}: thanks for coming in today. A Google review helps us more than " +
      "anything: {{url}} {{optout}}",
    purpose: "marketing",
    requiresConsent: true,
    purposeNote:
      "Review request. Sent once per completed booking, never in the same hour as the SMS receipt. Carries the opt-out line.",
  },
  SERVICE_DUE_NUDGE: {
    key: "SERVICE_DUE_NUDGE",
    body:
      "{{sender}}: long time since your last visit. A check-up is " +
      "{{value}} until {{end}}. {{url}} {{optout}}",
    purpose: "marketing",
    requiresConsent: true,
    purposeNote:
      "Win-back. Marketing consent only, one message per 90 days, never combined with an offer already sent.",
  },
} as const;

// ── Rendering (content-side guarantee) ──────────────────────────────────────

/**
 * Every token that may appear in an SMS body. Mirrored by the email templates
 * in `./email.ts` (which allows more).
 */
export const SMS_TOKENS = [
  "sender",
  "optout",
  "reference",
  "name",
  "date",
  "time",
  "services",
  "servicesCount",
  "mins",
  "eta",
  "min",
  "max",
  "url",
  "title",
  "value",
  "end",
  "plate",
  "total",
] as const;
export type SmsToken = (typeof SMS_TOKENS)[number];

export type SmsVars = Partial<Record<SmsToken, string | number>>;

const TOKEN_RE = /\{\{(\w+)\}\}/g;

/**
 * Comma-separated service names are the longest and least predictable value in
 * any template. Rather than trusting every caller to summarise them, the
 * renderer enforces the rule itself: at most three names, then "+N more", and a
 * hard per-name cap. A three-service booking rendered 169 characters before
 * this, which made `assertSmsFits` throw and silently cost the customer their
 * confirmation SMS entirely (DEF-011).
 */
function summariseServices(raw: string): string {
  const names = raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  if (names.length <= 1) return raw;

  const MAX_NAMES = 3;
  const shown = names.slice(0, MAX_NAMES);
  const hidden = names.length - shown.length;
  // Individual names are never character-truncated. A pathologically long single
  // name means something upstream is wrong, and silently cutting it would hide
  // that — the length guard is the correct response, not a quiet truncation.
  return hidden > 0 ? `${shown.join(", ")} +${hidden} more` : shown.join(", ");
}

/** Tokens whose value the renderer post-processes rather than trusting. */
const TRANSFORMED_TOKENS: ReadonlySet<string> = new Set(["services"]);

/**
 * Fills `{{token}}` placeholders, collapses the whitespace left by stripped
 * tokens, and trims. Unknown tokens are left as-is so a typo is visible in
 * preview rather than silently swallowed.
 */
export function renderSms(key: SmsTemplateKey, vars: SmsVars = {}): string {
  const template = SMS_TEMPLATES[key];
  const filled = template.body.replace(TOKEN_RE, (match, token: string) => {
    const value = (vars as Record<string, string | number | undefined>)[token];
    if (value === undefined || value === "") return match;
    const asText = String(value);
    return TRANSFORMED_TOKENS.has(token) ? summariseServices(asText) : asText;
  });
  return filled
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

/** Rendered character length of a message. */
export function smsLength(key: SmsTemplateKey, vars: SmsVars = {}): number {
  return renderSms(key, vars).length;
}

/**
 * Renders a message and throws if it exceeds `SMS_MAX_LENGTH`.
 *
 * Why it throws rather than truncates: a truncated SMS is a broken promise to a
 * customer, and an over-length SMS gets billed as two segments. Both are worse
 * than a loud failure in development. Called by the notification layer and by
 * the QA unit test for this file.
 *
 * Defaults `sender` and `optout` so production sends never forget them.
 */
export function assertSmsFits(key: SmsTemplateKey, vars: SmsVars = {}): string {
  const body = renderSms(key, { sender: SMS_SENDER_PREFIX, optout: SMS_OPT_OUT_LINE, ...vars });

  // DEF-010: this is the last gate before the SMS provider. A template that
  // still reads "on {{date}}, {{time}}" is a message that would be delivered
  // verbatim to a customer standing at the counter, so refuse it here rather
  // than shipping it. Length alone is not a safety check.
  const leftover = /\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/.exec(body);
  if (leftover) {
    throw new Error(
      `SMS template ${key} still contains an unfilled placeholder: "${leftover[0]}".\n` +
        `Every {{token}} must be supplied through \`vars\` before send.\n` +
        `Rendered: "${body}"`,
    );
  }

  // DEF-009: a single non-GSM-7 character (em dash, curly quote, ellipsis)
  // downgrades the whole message to UCS-2, which bills and delivers it as
  // 3 segments instead of 1 — the customer pays for three. Report every
  // offender by codepoint so the author can find it.
  const offenders = [...new Set(
    [...body]
      .filter((ch) => ch.codePointAt(0)! > 127 && !GSM7_EXTRA.has(ch))
      .map((ch) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`),
  )];
  if (offenders.length > 0) {
    throw new Error(
      `SMS template ${key} contains non-GSM-7 characters: ${offenders.join(", ")}.\n` +
        `Each one makes the whole message UCS-2 (3 segments, 3x cost). Replace with ASCII.\n` +
        `Rendered: "${body}"`,
    );
  }

  // GSM-7 counts a character as one segment unit; using code points avoids
  // under-counting any surrogate pair that survived the check above.
  if (body.length > SMS_MAX_LENGTH) {
    throw new Error(
      `SMS template ${key} rendered ${body.length} characters, over the ${SMS_MAX_LENGTH} limit.\n` +
        `Shorten the template body in src/content/marketing/copy.ts, or pass shorter values.\n` +
        `Rendered: "${body}"`,
    );
  }
  return body;
}

/** Legal-consent guard: refuses to render marketing SMS without opt-in. */
export function assertSmsConsent(key: SmsTemplateKey, hasConsent: boolean): void {
  if (SMS_TEMPLATES[key].requiresConsent && !hasConsent) {
    throw new Error(
      `SMS template ${key} is a ${SMS_TEMPLATES[key].purpose} message and requires explicit ` +
        `consent (Booking.consentSms or Customer.marketingOptIn). Refusing to send.`,
    );
  }
}

/**
 * Marketing-send guard. Prevents two marketing SMS inside the cool-down window,
 * and stops a promo competing with a review request in the same week.
 * Window value is a suggestion — see docs/marketing/PROMO-PLAYBOOK.md §7.
 */
export const SMS_MARKETING_COOLDOWN_DAYS = 21;