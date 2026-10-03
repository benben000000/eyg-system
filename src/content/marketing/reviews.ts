/**
 * EYG TIRE & AUTO CARE — MARKETING SEED: TESTIMONIALS
 * ============================================================================
 * Consumed by `prisma/seed.ts` (backend agent).
 * Structurally mirrors `prisma/schema.prisma` → `model Testimonial`.
 *
 * ############################################################################
 * #                                                                        #
 * #   THE ENTIRE CONTENTS OF THIS FILE ARE ILLUSTRATIVE PLACEHOLDERS.       #
 * #                                                                        #
 * #   THERE ARE NO REAL CUSTOMERS IN THIS FILE. THERE ARE NO REAL REVIEWS.  #
 * #   THERE ARE NO REAL PEOPLE.                                           #
 * #                                                                        #
 * #   Every entry below is a layout template written by a marketer so the    #
 * #   design can be built and reviewed with something in the slots.          #
 * #                                                                        #
 * #   ⚠️  SHIPPING THESE WOULD BE:                                         #
 * #     • A false statement of fact under the Consumer Act / Data Privacy   #
 * #       Act of 2012 (fabricated testimonials).                            #
 * #     • A Google/Facebook policy violation that can get the profile       #
 * #       removed — which would cost the shop its entire local search        #
 * #       position overnight.                                               #
 * #     • A direct insult to the 308 real people who follow this page.      #
 * #                                                                        #
 * #   THIS IS ENFORCED IN CODE, NOT JUST IN A COMMENT:                      #
 * #     • `isPublished: false` on every record — the seed can never render. #
 * #     • Names are obviously synthetic ("Sample Customer 01"). A plausible  #
 * #       Filipino name here could be mistaken for a real person's         #
 * #       endorsement, so we deliberately do not use realistic names.        #
 * #     • `QUOTE_SENTINEL` is exported so a runtime assertion can verify a #
 * #       live testimonial table contains zero placeholder rows.            #
 * #                                                                        #
 * #   TO GO LIVE: collect real reviews (see docs/marketing/GBP-LISTING.md §6 #
 *   and docs/marketing/GEO-LOCAL-SEO.md §5), replace the entries with the   #
 *   consented real quotes, set `isPublished: true`, then delete this file   #
 *   from the seed. Do not "tidy" the placeholders into real-sounding names. #
 * ############################################################################
 *
 * HOW REAL REVIEWS MUST BE COLLECTED (non-negotiable)
 * ----------------------------------------------------
 *   1. Ask at handover, on a paper card or by SMS, never by a QR code the
 *      customer has to scan while their car is being worked on.
 *   2. Ask for the review in the customer's own words. Do not draft it for them.
 *   3. Never offer anything in exchange — not a discount, not a free wipe.
 *   4. Log the name, date, service and the exact words. Keep the raw source.
 *   5. Permission must be explicit if the shop intends to republish the review
 *      on the website and Facebook. A Google review is public by default;
 *      republishing it on our own properties is a second act of consent.
 *   6. If a customer asks to be removed, delete it and stop asking.
 * ============================================================================
 */

/** Mirror of `prisma/schema.prisma` → `model Testimonial` (create-input shape). */
export interface TestimonialSeed {
  name: string;
  vehicle: string | null;
  quote: string;
  rating: number;
  isPublished: boolean;
  sortOrder: number;
}

/**
 * Every placeholder body contains this string. Used by
 * `containsPlaceholderTestimonials()` so a live database can be asserted clean.
 * Do not remove it until the placeholders are gone.
 */
export const QUOTE_SENTINEL = "Sample copy for layout only — replace with a real consented review.";

// ── ILLUSTRATIVE PLACEHOLDER — replace with a real, consented review before launch ──
// Each block is one layout shape the frontend must handle. The `quote` shows the
// TONE we want from real customers (specific, plain, about their own experience)
// — it does not claim to be anything that happened.
const PLACEHOLDERS: readonly TestimonialSeed[] = [
  {
    // ILLUSTRATIVE PLACEHOLDER — replace with a real, consented review before launch
    name: "Sample Customer 01",
    vehicle: "Sample vehicle — common commuter sedan",
    quote: `${QUOTE_SENTINEL} Shape 1, long-form: the customer was specific about what the shop explained, what they were shown, and what it cost.`,
    rating: 5,
    isPublished: false,
    sortOrder: 10,
  },
  {
    // ILLUSTRATIVE PLACEHOLDER — replace with a real, consented review before launch
    name: "Sample Customer 02",
    vehicle: "Sample vehicle — midsize SUV",
    quote: `${QUOTE_SENTINEL} Shape 2, short-form: two lines. Use these for the small cards — a real two-line quote carries more weight than a long one.`,
    rating: 5,
    isPublished: false,
    sortOrder: 20,
  },
  {
    // ILLUSTRATIVE PLACEHOLDER — replace with a real, consented review before launch
    name: "Sample Customer 03",
    vehicle: "Sample vehicle — hatchback, daily commuter",
    quote: `${QUOTE_SENTINEL} Shape 3, price-transparency quote: the single most valuable review to own, because price fear is the objection this market has. Aim for one of these per month.`,
    rating: 5,
    isPublished: false,
    sortOrder: 30,
  },
  {
    // ILLUSTRATIVE PLACEHOLDER — replace with a real, consented review before launch
    name: "Sample Customer 04",
    vehicle: "Sample vehicle — light commercial / work truck",
    quote: `${QUOTE_SENTINEL} Shape 4, roadside quote: short, unglamorous, factual. A real one of these is worth more than any ad we can buy.`,
    rating: 5,
    isPublished: false,
    sortOrder: 40,
  },
  {
    // ILLUSTRATIVE PLACEHOLDER — replace with a real, consented review before launch
    // NOTE: this slot exists to prove the 3-star layout renders. A shop that only
    // publishes 5-star reviews reads as suspicious. Do not seed a fake 3-star
    // review — wait for a real one.
    name: "Sample Customer 05",
    vehicle: "Sample vehicle — older model, second-hand",
    quote: `${QUOTE_SENTINEL} Shape 5, mixed-rating slot. Reserve it for a genuine 3- or 4-star review and publish the owner's words unedited, including the complaint.`,
    rating: 4,
    isPublished: false,
    sortOrder: 50,
  },
  {
    // ILLUSTRATIVE PLACEHOLDER — replace with a real, consented review before launch
    name: "Sample Customer 06",
    vehicle: "Sample vehicle — MPV, seven seats",
    quote: `${QUOTE_SENTINEL} Shape 6, repeat-customer quote: the customer has been here more than once. Repeat business is the whole business model — one of these is worth more than three first-timers.`,
    rating: 5,
    isPublished: false,
    sortOrder: 60,
  },
] as const;

/**
 * Seed testimonials. Every record ships with `isPublished: false`, so seeding
 * this file cannot put a fabricated quote on a public page.
 *
 * WHEN YOU REPLACE THEM: set `isPublished: true` only on rows whose
 * `quote` no longer contains `QUOTE_SENTINEL`.
 */
export const TESTIMONIALS: readonly TestimonialSeed[] = PLACEHOLDERS;

/**
 * True if any testimonial is still placeholder copy or still unpublished.
 * Call this against a live database in CI / on the admin dashboard:
 *
 *   if (containsPlaceholderTestimonials(dbTestimonials)) { /* block *\/ }
 *
 * Pure function so QA can unit-test it without a database.
 */
export function containsPlaceholderTestimonials(
  rows: ReadonlyArray<Pick<TestimonialSeed, "quote" | "isPublished">>,
): boolean {
  return rows.some((r) => r.quote.includes(QUOTE_SENTINEL) || !r.isPublished);
}

// ── Review-request copy ─────────────────────────────────────────────────────
// The ask. Kept next to the placeholders so the moment real reviews are needed,
// the exact wording to use is already written and consent-safe.

/**
 * Asked at handover, once, by a human, with the invoice in hand.
 * ⚠️ SUGGESTED — REQUIRES OWNER CONFIRMATION: the shop must be genuinely
 * willing to send this to every single customer, including the ones who
 * complained. Selective review requests are a policy violation.
 */
export const REVIEW_REQUEST_HANDOVER = {
  cardFront:
    "Kumusta? Kung Okay sa amin, tulong lang kami sa isang maliit na review sa Google. " +
    "Kung hindi Okay, sabihin mo lang — ayos lang namin. Salamat!",
  cardBack:
    "Scan or search for our shop on Google, and tap 'Write a review'. " +
    "No filter, no script — whatever you actually experienced. Thank you.",
  spokenScript:
    "Salamat sa pagbisita. Kung maganda ang experience mo, isang maliit na review lang " +
    "ang tulong para makita kami ng mga kapitbahay namin. Kung may kulang, sabihin mo " +
    "lang dito — ayos lang kami. Walang pressure.",
  qrLabel: "Scan to find us on Google Maps",
} as const;

/** Post-purchase SMS / FB message version. One ask, no incentive, no chasing. */
export const REVIEW_REQUEST_MESSAGE =
  "EYG Tire: salamat sa pagbisita sa amin. Kung may minute ka, isang Google review " +
  "ang malaking tulong para sa amin: {{url}} {{optout}}";