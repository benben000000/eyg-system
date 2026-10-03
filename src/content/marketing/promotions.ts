/**
 * EYG TIRE & AUTO CARE — MARKETING SEED: PROMOTIONS
 * ============================================================================
 * Consumed by `prisma/seed.ts` (backend agent).
 * Structurally identical to `prisma/schema.prisma` → `model Promotion`
 * (+ `enum PromoKind`), so each object can be passed straight to
 * `prisma.promotion.create({ data })`.
 *
 * WHY THE TYPES ARE DECLARED HERE INSTEAD OF IMPORTED FROM @prisma/client
 * ---------------------------------------------------------------------------
 * `@prisma/client` is *generated* at install/build time (`prisma generate`).
 * If a content module imported it, `tsc --noEmit` and `next lint` would fail on
 * a fresh clone before generation had run. These local interfaces are
 * hand-mirrored from `prisma/schema.prisma`. If the Prisma model changes,
 * update the mirror in the same commit. See the report → "Requests".
 *
 * ⚠️  EVERY PESO FIGURE IN THIS FILE IS A PLACEHOLDER.
 *     No price here has been confirmed by the shop owner. Each one is flagged
 *     inline with `SUGGESTED — REQUIRES OWNER CONFIRMATION`.
 *     Do not publish any of it on a live page until the owner signs off.
 *
 * ⚠️  DATE WINDOWS are anchored to the 2026–2027 campaign cycle so the seed
 *     produces an immediately coherent `/deals` page. They are examples, not
 *     commitments. `endsAt` should be a hard, published date — no silent
 *     extensions. Rolling a window is an owner decision, not a code change.
 *
 * PROMOTION POLICY (see docs/marketing/PROMO-PLAYBOOK.md for the full version)
 *   • Never run two live discounts in the same category at once.
 *   • Effective discount depth ceiling: 20% off list (30% only as a bundle).
 *   • Every promo carries an expiry date, a terms block and an owner.
 *   • No countdown timers that reset. No invented scarcity.
 * ============================================================================
 */

/** Mirror of `prisma/schema.prisma` → `enum PromoKind`. */
export const PROMO_KINDS = [
  "PERCENT_OFF",
  "FIXED_OFF",
  "BUNDLE",
  "CLEARANCE",
  "SEASONAL",
  "TIRES",
] as const;
export type PromoKind = (typeof PROMO_KINDS)[number];

/** Mirror of `prisma/schema.prisma` → `model Promotion` (create-input shape). */
export interface PromotionSeed {
  /** Stable, URL-safe. Used by `/deals/[slug]` and the `PromoClaim` FK. */
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  kind: PromoKind;
  badge: string | null;
  /** Optional claimable code. Unique in the DB — keep them short and loud. */
  code: string | null;
  /** Percent off, for `PERCENT_OFF` / `CLEARANCE`. Integer percent. */
  valuePct: number | null;
  /** Peso off, for `FIXED_OFF` / `BUNDLE`. Integer pesos. */
  valueOff: number | null;
  /** Plain-language terms. Rendered verbatim on `/deals` — keep them short. */
  terms: string[];
  imageUrl: string | null;
  isActive: boolean;
  /** ISO 8601 with an explicit +08:00 offset (Asia/Manila). */
  startsAt: string | null;
  /** ISO 8601 with an explicit +08:00 offset (Asia/Manila). */
  endsAt: string | null;
  /** Higher sorts first on `/deals`. 100 = hero slot. */
  priority: number;
}

const PH_OFFSET = "+08:00";
const at = (isoDate: string, hhmm = "00:00") => `${isoDate}T${hhmm}:00${PH_OFFSET}`;

// ============================================================================
// 1. RAINY SEASON SAFETY BUNDLE — the mandated seasonal anchor.
// ============================================================================
// MARKETING RATIONALE:
// Philippine wet season (roughly June–November in Region III) is the single
// highest-intent window of the year for this shop. Rain means (a) visible
// tread wear, (b) wipers that no longer clear, (c) brakes that get asked
// about. The customer already believes something is wrong; we are not
// manufacturing a fear, we are giving them a defined, bounded task.
// Psychologically this is a *bundle*, not a discount: it removes the
// "how much will this cost me if I ask" barrier, which is the real objection
// at a shop they have never used. The peso saving is secondary — the win is
// that one trip answers three anxieties.
// Depth note: 20% effective. Deep enough to feel real, shallow enough that
// it does not read as "cheap shop" (PROMO-PLAYBOOK §4).

const RAINY_SEASON_SAFETY: PromotionSeed = {
  slug: "rainy-season-safety-bundle",
  title: "Rainy Season Safety Bundle",
  subtitle: "Tyre inspection, fresh wipers, and a brake check — before the clouds roll in.",
  description:
    "Three things that quietly matter the moment the rains start, done in one bay visit. " +
    "We check every tyre's pressure, tread depth and sidewall condition, fit a new pair of " +
    "wiper blades, and put the brakes on the lift so you can see what we see. " +
    "You get a written list of what is fine and what is not — including 'nothing to do yet'.",
  kind: "BUNDLE",
  badge: "Rainy Season Pick",
  code: "RAINYSAFE",
  valuePct: null,
  // SUGGESTED — REQUIRES OWNER CONFIRMATION (₱950 off; anchored to a ₱3,350 à-la-carte total)
  valueOff: 950,
  terms: [
    "Bundle total is an estimate. Final price is confirmed after the technician inspects the vehicle.",
    "Wiper blades are charged at the price of the brand and size you choose.",
    "One vehicle per booking. Cannot be combined with other offers.",
    "Brake parts, if you need them, are quoted separately before any work starts.",
    "Valid until 30 November 2026. Rainy season is long — book early, not last minute.",
  ],
  imageUrl: null,
  isActive: true,
  startsAt: at("2026-06-01"),
  endsAt: at("2026-11-30", "23:59"),
  priority: 100,
};

// ============================================================================
// 2. TYRE CLEARANCE
// ============================================================================
// MARKETING RATIONALE:
// Tyres are the one category where customers *already* intend to spend, so a
// clearance does not create demand — it captures it. It also gives the shop a
// reason to post daily (new arrivals, a size, a price) which is exactly the
// Facebook behaviour that drives walk-ins in this market.
// Depth note: 10%. Tyre margins are thin and brands matter to buyers; a deep
// tyre discount is the fastest way to be read as a reseller, not a care centre.
// The clearance runs on *listed stock only*, which is honest scarcity without
// inventing any.

const TYRE_CLEARANCE: PromotionSeed = {
  slug: "tyre-clearance",
  title: "Tyre Clearance — listed sizes",
  subtitle: "Overstock sizes, cleared at a straight 10% off. No trade-in games.",
  description:
    "We hold sizes that move slowly. Rather than let them age in the rack, we clear them " +
    "at a flat 10% off the listed price. What is on the list is what is in the bay — " +
    "we do not advertise a size we cannot bolt on the same day. Ask us what is in stock " +
    "before you drive over; the list changes as stock lands.",
  kind: "CLEARANCE",
  badge: "Clearance",
  code: "TIRESAVE",
  // SUGGESTED — REQUIRES OWNER CONFIRMATION (flat 10% off listed stock price)
  valuePct: 10,
  valueOff: null,
  terms: [
    "Applies to listed clearance stock only, while that stock lasts.",
    "Price shown is the tyre only. Mounting, balancing and valve stems are charged separately.",
    "We will confirm the size is in stock before you come in. No size is promised by this ad.",
    "Cannot be combined with the Rainy Season Safety Bundle or any other offer.",
    "Valid until 20 December 2026.",
  ],
  imageUrl: null,
  isActive: true,
  startsAt: at("2026-10-05"),
  endsAt: at("2026-12-20", "23:59"),
  priority: 90,
};

// ============================================================================
// 3. FIRST-TIME CUSTOMER PMS OFFER
// ============================================================================
// MARKETING RATIONALE:
// The hardest customer in this market is the first-timer, because the fear is
// "this shop will overcharge me and I won't know". A first-visit offer buys
// permission: it lets someone try the shop for a small, bounded, low-risk job.
// 15% is deliberately modest. A first-timer who gets a cheap and competent
// PMS comes back for the tyres; a first-timer who gets a suspiciously cheap
// PMS assumes something was skipped.
// CRM note: the code is the mechanism for building a phone-number list that
// legitimately consented to marketing contact (consent captured at booking).

const FIRST_TIME_PMS: PromotionSeed = {
  slug: "first-visit-pms",
  title: "First Visit PMS — 15% Off",
  subtitle: "Your first preventive maintenance service with us, at 15% off.",
  description:
    "Never been to EYG before? Start with a PMS. Oil, filter, the usual checks, and a " +
    "straight answer on what your car needs next — even when the answer is 'nothing urgent'. " +
    "We would rather earn the tyres and the brakes later than sell them to you now.",
  kind: "PERCENT_OFF",
  badge: "First Visit",
  code: "FIRSTPMS",
  // SUGGESTED — REQUIRES OWNER CONFIRMATION (15% off the PMS line)
  valuePct: 15,
  valueOff: null,
  terms: [
    "New customers only. One per phone number, one per vehicle.",
    "Discount applies to the PMS service line only — not to parts you add that day.",
    "Final price is confirmed after inspection. If the service takes longer than quoted, we call you first.",
    "Cannot be combined with any other offer.",
    "Valid until 31 December 2026.",
  ],
  imageUrl: null,
  isActive: true,
  startsAt: at("2026-10-01"),
  endsAt: at("2026-12-31", "23:59"),
  priority: 80,
};

// ============================================================================
// 4. MID-YEAR CHECK-UP
// ============================================================================
// NOTE ON THE DATE WINDOW: "mid-year" is taken literally. The window is set to
// the next true mid-year (May–July) rather than being stretched to cover
// today, because a deal called *mid-year* running in December teaches customers
// that EYG's dates mean nothing. It is pre-armed so the scheduler can switch it
// on without anyone remembering to build it. See the report → "Risks".
//
// MARKETING RATIONALE:
// A check-up is a low-commitment, high-information offer. It costs the shop an
// hour of bay time, and it produces the most valuable thing a tyre shop can
// own: an accurate service history per vehicle. That history is what makes the
// next PMS, tyre and brake conversation specific instead of speculative —
// and specificity is what this market actually buys.
// Discount is small on purpose (₱300). The product being sold is the record,
// not the discount.

const MID_YEAR_CHECKUP: PromotionSeed = {
  slug: "mid-year-check-up",
  title: "Mid-Year Check-Up",
  subtitle: "A one-hour look at the car you have been driving all year.",
  description:
    "Six months in, most cars are telling you something: a tyre losing a pound a week, a " +
    "brake pedal that feels a little soft, a belt that squeaks when you turn the AC on. " +
    "Book the mid-year check-up and we will go through it item by item — brakes, tyres, " +
    "suspension, belts, fluids, battery. You leave with a written list, sorted into " +
    "'do now', 'watch it' and 'nothing to worry about'.",
  kind: "SEASONAL",
  badge: "Book Ahead",
  code: "MYCHECK",
  valuePct: null,
  // SUGGESTED — REQUIRES OWNER CONFIRMATION (₱300 off a ₱1,000 check-up)
  valueOff: 300,
  terms: [
    "The check-up itself is charged. This discount reduces the check-up fee, it does not make it free.",
    "Repairs found during the check-up are quoted and approved by you before any work begins.",
    "One vehicle per booking.",
    "Cannot be combined with any other offer.",
    "Valid 1 May 2027 to 31 July 2027. Bookings can be taken earlier; the price applies to the work done in-window.",
  ],
  imageUrl: null,
  isActive: true,
  startsAt: at("2027-05-01"),
  endsAt: at("2027-07-31", "23:59"),
  priority: 50,
};

// ============================================================================
// 5. BIRTHDAY / LOYALTY MECHANIC SPECIAL
// ============================================================================
// MARKETING RATIONALE:
// Two mechanisms in one, because in Balanga these are the same social act.
// A birthday mechanic special gives the shop a *person* — the customer's kid
// gets a turn on the lift, the customer gets a photo of it. A loyalty mechanic
// special gives the returning customer something that is theirs and not
// advertised. Both are recognition, which is cheaper than discount and worth
// more in a market of 308 followers where relationships, not scale, are the
// channel.
// Depth note: 12%. Rewards should feel generous, not cheap.
// RISK: never publish a customer's birth date. The mechanic checks the birth
// month at the counter; it is never stored in marketing copy.

const MECHANIC_BIRTHDAY: PromotionSeed = {
  slug: "mechanic-birthday-special",
  title: "Mechanic of the Month Special",
  subtitle: "For EYG customers and their kids — a birthday month perk, not a coupon.",
  description:
    "Every month we pick one mechanic and one customer to feature. The customer's child " +
    "gets to help mount a tyre, hold the light, or run the impact wrench with a mechanic " +
    "standing right next to them. The customer's birthday-month service gets a discount. " +
    "It is not a raffle — we will ask you at the counter, and if the month is taken, we " +
    "will tell you honestly and move you to next month.",
  kind: "PERCENT_OFF",
  badge: "Birthday Perk",
  code: "BDAYEYG",
  // SUGGESTED — REQUIRES OWNER CONFIRMATION (12% off, birthday month only)
  valuePct: 12,
  valueOff: null,
  terms: [
    "For registered EYG customers only. Registration is free at the counter.",
    "Applies in the customer's birthday month. We verify the month at the counter — please do not post your birth date publicly.",
    "One vehicle per customer per year. Cannot be combined with any other offer.",
    "The mechanic-of-the-month slot is one per month, first-come, first-served at the counter.",
    "Valid until 30 September 2027.",
  ],
  imageUrl: null,
  isActive: true,
  startsAt: at("2026-10-01"),
  endsAt: at("2027-09-30", "23:59"),
  priority: 70,
};

// ============================================================================
// 6. REFERRAL OFFER
// ============================================================================
// MARKETING RATIONALE:
// Word of mouth is the primary growth engine in Balanga/Bataan, and Facebook
// is second. A referral offer is simply the mechanic's existing behaviour, made
// legible and rewarded. It costs two small fixed amounts rather than a
// percentage, which protects margin on both jobs and — importantly — keeps the
// referred friend's *first impression* of the price intact. A referred customer
// who gets 15% off arrives primed to think they were overcharged anyway.
//
// Fixed-amount note: ₱300 is a round, social, non-embarrassing number. Bigger
// looks like a bounty; smaller feels like a rounding error nobody bothers
// with. The mechanic is the one who actually hands it over, so it has to be
// worth them mentioning.

const BRING_A_NEIGHBOUR: PromotionSeed = {
  slug: "bring-a-neighbour",
  title: "Bring a Neighbour — ₱300 Off, Both Sides",
  subtitle: "You bring the referral. We bring you both ₱300 off any service over ₱1,500.",
  description:
    "You already know someone who needs tyres, oil or brakes. Send them our way. " +
    "They get ₱300 off, and so do you on your next visit. It works both ways — you can also " +
    "claim it when somebody refers *you*, no referral form needed, just mention their name " +
    "at the counter. We keep it this simple on purpose.",
  kind: "FIXED_OFF",
  badge: "Refer a Friend",
  code: "NEIGHBOUR",
  valuePct: null,
  // SUGGESTED — REQUIRES OWNER CONFIRMATION (₱300 off, paid out on both sides)
  valueOff: 300,
  terms: [
    "₱300 off a service with a value of ₱1,500 or more, before parts.",
    "New customer to EYG only. One referral discount per person per year.",
    "Mention the referring name at the counter. No forms, no codes to remember.",
    "Cannot be combined with any other offer, and applies after any other pricing is agreed.",
    "Valid until 31 March 2027.",
  ],
  imageUrl: null,
  isActive: true,
  startsAt: at("2026-10-01"),
  endsAt: at("2027-03-31", "23:59"),
  priority: 60,
};

/**
 * All seed promotions, highest `priority` first (matches the `/deals` order).
 *
 * USAGE NOTE for `prisma/seed.ts`:
 * `startsAt` / `endsAt` are ISO strings with a `+08:00` offset. Convert with
 * `new Date(p.startsAt)` before writing. A listing query should filter
 * `isActive AND (startsAt <= now OR startsAt IS NULL) AND (endsAt >= now OR
 * endsAt IS NULL)` — otherwise the pre-armed mid-year promo shows early.
 *
 * ⚠️  `imageUrl` is null on every record. Do not ship `/deals` with an
 *     `<img>` that has no source; the frontend must render a brand placeholder
 *     until the owner supplies real photography. See docs/marketing/GBP-LISTING.md
 *     §Photo plan for the shoot list.
 */
export const PROMOTIONS: readonly PromotionSeed[] = [
  RAINY_SEASON_SAFETY,
  TYRE_CLEARANCE,
  FIRST_TIME_PMS,
  MECHANIC_BIRTHDAY,
  BRING_A_NEIGHBOUR,
  MID_YEAR_CHECKUP,
] as const;

/** Lookup helper for `promoCode` application in the booking flow. */
export const PROMOTIONS_BY_SLUG: Readonly<Record<string, PromotionSeed>> = Object.freeze(
  Object.fromEntries(PROMOTIONS.map((p) => [p.slug, p])),
);

/** Codes are `Promotion.code @unique`. Keep this list for the booking UI. */
export const PROMO_CODES: readonly string[] = PROMOTIONS.map((p) => p.code).filter(
  (c): c is string => c !== null,
);