/**
 * EYG TIRE & AUTO CARE — MARKETING SEED: PACKAGES / BUNDLES
 * ============================================================================
 * Consumed by `prisma/seed.ts` (backend agent).
 * Structurally mirrors `prisma/schema.prisma` → `model Package` and
 * `model PackageItem`.
 *
 * THE PUBLIC SHAPE IS THE API CONTRACT
 * ------------------------------------
 * `PackageSeed` extends `PackageDto` from `@/lib/types`, so whatever ships in
 * the database renders on `/services` and `/deals` without a translation layer.
 * The only fields added over the DTO are the ones the Prisma model needs for
 * seeding (`description`, `categorySlug`, `items[].serviceSlug`, dates).
 *
 * ⚠️  EVERY PESO FIGURE IS A PLACEHOLDER — `SUGGESTED — REQUIRES OWNER
 *     CONFIRMATION`. No bundle price here has been seen by the owner. Also
 *     note `priceMin`/`priceMax` are a RANGE by design: a wiper blade pair
 *     costs more than a tyre inspection, and a 4-wheel balance costs more than
 *     a 2-wheel one. A single number would be a lie.
 *
 * ⚠️  CROSS-AGENT DEPENDENCY (important for backend-core)
 *     `items[].serviceSlug` must exist in the `Service` catalogue seed, or the
 *     `PackageItem` insert fails its FK. `SERVICE_SLUGS_REQUIRED` below is the
 *     exact contract. Every slug listed there MUST exist. Any slug not listed
 *     is optional and the insert should skip it if missing.
 *
 * ANCHOR PSYCHOLOGY (full version in docs/marketing/PROMO-PLAYBOOK.md §5)
 * -----------------------------------------------------------------------
 * `compareAtMin` is the à-la-carte total of the same items bought separately.
 * It exists to make the bundle legible, not to trick anyone: we always show
 * the à-la-carte line, so a customer can check the arithmetic. Every anchor
 * below is a real sum of the real line prices.
 * ============================================================================
 */

import type { PackageDto } from "@/lib/types";

/** Mirror of `prisma/schema.prisma` → `model PackageItem`, minus the ids. */
export interface PackageItemSeed {
  /**
   * Stable `Service.slug` from the catalogue seed. Resolved to `serviceId` by
   * `prisma/seed.ts`. See `SERVICE_SLUGS_REQUIRED`.
   */
  serviceSlug: string;
  /** Denormalised display name so the bundle renders even before resolution. */
  name: string;
  quantity: number;
}

/**
 * A seedable package. Extends the shipped DTO so there is one shape end-to-end.
 * `id` is omitted (Prisma generates a cuid); `items` is widened with
 * `serviceSlug` so the FK can be resolved at seed time.
 */
export type PackageSeed = Omit<PackageDto, "id" | "items"> & {
  description: string;
  /** `ServiceCategory.slug` — null means "general / uncategorised". */
  categorySlug: string | null;
  isSeasonal: boolean;
  /** "rainy" | "summer" | "holiday" | null. Drives seasonal surfacing. */
  seasonKey: string | null;
  /** ISO 8601 with +08:00. Null = running as long as `isActive` is true. */
  validFrom: string | null;
  validUntil: string | null;
  isFeatured: boolean;
  sortOrder: number;
  /**
   * Disclosures a bundle genuinely owes the customer. These go under the
   * price, not buried. A bundle that hides what is excluded is a dark pattern.
   */
  notes: string[];
  items: PackageItemSeed[];
};

/** Draft shape before `savingsPct` is computed. */
type PackageDraft = Omit<PackageSeed, "savingsPct">;

const PH_OFFSET = "+08:00";
const at = (isoDate: string, hhmm = "00:00") => `${isoDate}T${hhmm}:00${PH_OFFSET}`;

/**
 * Percentage saved, rounded to the nearest whole percent.
 * Computed against the *entry* price (`priceMin`), so the number we publish is
 * always the smallest saving we could honestly claim. Computing it against
 * `priceMax` would advertise the best case for every bundle — that is the
 * trick this shop does not do.
 */
const savingsPctOf = (priceMin: number, compareAtMin: number | null): number | null =>
  compareAtMin === null || compareAtMin <= priceMin
    ? null
    : Math.round(((compareAtMin - priceMin) / compareAtMin) * 100);

const buildPackage = (draft: PackageDraft): PackageSeed => ({
  ...draft,
  savingsPct: savingsPctOf(draft.priceMin, draft.compareAtMin),
});

// ============================================================================
// 1. RAINY SEASON SAFETY PACKAGE  (the mandated bundle)
// ============================================================================
// ANCHOR PSYCHOLOGY: `compareAtMin` ₱3,350 is the honest à-la-carte sum
// (inspection ₱350 + wipers ₱1,200 + brake check ₱1,800). The customer can add
// it up on a napkin, and it still wins. Why a bundle and not three separate
// offers: three separate offers make the customer choose, and the choice is the
// enemy. Bundling converts "which of these do I need" into "yes or no", which
// is a question people can actually answer.
//
// SAVINGS MATH: (3350 − 2400) / 3350 = 28.4% → 28%.

const RAINY_SEASON_PACKAGE = buildPackage({
  slug: "rainy-season-safety-package",
  name: "Rainy Season Safety Package",
  tagline: "Tire Inspection + Wiper Replacement + Brake Check",
  description:
    "The three checks that matter most between June and November, done in one visit. " +
    "We check every tyre for pressure, tread depth and sidewall damage, fit a fresh pair of " +
    "wiper blades so the windscreen actually clears in a downpour, and lift the car to " +
    "inspect the pads, discs and lines. You get a written report sorted into what to do now, " +
    "what to watch, and what is fine.",
  priceMin: 2400, // SUGGESTED — REQUIRES OWNER CONFIRMATION (entry price, excl. parts)
  priceMax: 3200, // SUGGESTED — REQUIRES OWNER CONFIRMATION (ceiling with premium wiper blades)
  compareAtMin: 3350, // SUGGESTED — REQUIRES OWNER CONFIRMATION (à-la-carte sum: 350 + 1200 + 1800)
  badge: "Rainy Season Pick",
  isSeasonal: true,
  seasonKey: "rainy",
  validFrom: at("2026-06-01"),
  validUntil: at("2026-11-30", "23:59"),
  isFeatured: true,
  sortOrder: 10,
  notes: [
    "Wiper blades are charged at the brand and size you choose, within the range shown.",
    "Brake pads, discs or fluid are not included. Quoted and approved by you first.",
    "Final price is confirmed after the technician inspects the vehicle.",
    "Cannot be combined with another offer or with the Rainy Season Safety Bundle promo.",
  ],
  categorySlug: "safety-checks",
  items: [
    { serviceSlug: "tire-inspection", name: "Tire Inspection (pressure, tread, sidewall)", quantity: 1 },
    { serviceSlug: "wiper-replacement", name: "Wiper Blade Replacement (pair, front)", quantity: 1 },
    { serviceSlug: "brake-check", name: "Brake Check (pads, discs, lines)", quantity: 1 },
  ],
});

// ============================================================================
// 2. COMMUTER EXPRESS PMS
// ============================================================================
// ANCHOR PSYCHOLOGY: the classic commuter job — PMS A plus rotation and a
// pressure check. The à-la-carte anchor (₱2,300) is only ₱550 above the bundle.
// Deliberately modest: this is the shop's most repeated purchase and the one
// where an inflated "SAVE 24%" banner would feel cynical by the third visit.
// A small, boring, repeatable saving beats a big number you have to walk back.

const COMMUTER_EXPRESS_PMS = buildPackage({
  slug: "commuter-express-pms",
  name: "Commuter Express PMS",
  tagline: "PMS A + tire rotation + tire pressure check",
  description:
    "Built for the car that does the EGSA run five days a week. Oil and filter, tyres " +
    "rotated front-to-back so they wear evenly, and every pressure checked against " +
    "the door-jamb sticker — not a round number we guessed. Quick in, quick out, " +
    "and you leave knowing what the next oil change is.",
  priceMin: 1750, // SUGGESTED — REQUIRES OWNER CONFIRMATION (entry price; oil grade varies)
  priceMax: 1950, // SUGGESTED — REQUIRES OWNER CONFIRMATION (ceiling with full synthetic)
  compareAtMin: 2300, // SUGGESTED — REQUIRES OWNER CONFIRMATION (à-la-carte: PMS A 1750 + rotation 400 + pressure check 150)
  badge: null,
  isSeasonal: false,
  seasonKey: null,
  validFrom: null,
  validUntil: null,
  isFeatured: true,
  sortOrder: 20,
  notes: [
    "Oil grade is chosen with you. We will not put full synthetic in without asking.",
    "Rotation is skipped if the tyres are a mismatched or one-directional set.",
    "Filter is included. Additional items found during the check are quoted before we touch anything.",
  ],
  categorySlug: "preventive-maintenance",
  items: [
    { serviceSlug: "pms-a", name: "PMS A (oil + oil filter)", quantity: 1 },
    { serviceSlug: "tire-rotation", name: "Tire Rotation", quantity: 1 },
    { serviceSlug: "tire-pressure-check", name: "Tire Pressure Check & Top-Up", quantity: 1 },
  ],
});

// ============================================================================
// 3. BALANGA BREEZE FULL SERVICE
// ============================================================================
// ANCHOR PSYCHOLOGY: the "big one" bundle — the one a customer is proud of
// having done. Four-wheel balancing is where the perceived value of a tyre
// shop is highest (you can *feel* the difference), so it carries the anchor.
// Priced at a round ₱3,900 entry because round numbers are remembered and
// quoted back to us on Facebook messages — and the upper end absorbs the
// range without looking padded.
// This is also the highest-margin bundle, which is why it is `isFeatured`.

const BALANGA_BREEZE = buildPackage({
  slug: "balanga-breeze-full-service",
  name: "Balanga Breeze Full Service",
  tagline: "PMS B + 2D wheel alignment + 4-wheel balancing",
  description:
    "The full reset. PMS B — oil, filter, and a proper multi-point inspection with the " +
    "car on the lift — then a 2D wheel alignment so it stops pulling, and all four " +
    "wheels balanced so the steering wheel stops buzzing on the Fourlanes. " +
    "Best done together: alignment throws your balance out, so doing them apart " +
    "costs you the second job twice.",
  priceMin: 3900, // SUGGESTED — REQUIRES OWNER CONFIRMATION (round entry price, easy to quote back to us)
  priceMax: 4600, // SUGGESTED — REQUIRES OWNER CONFIRMATION (ceiling incl. higher-grade oil)
  compareAtMin: 5200, // SUGGESTED — REQUIRES OWNER CONFIRMATION (à-la-carte: PMS B 2600 + alignment 1100 + balancing 4 × 375)
  badge: "Best Value",
  isSeasonal: false,
  seasonKey: null,
  validFrom: null,
  validUntil: null,
  isFeatured: true,
  sortOrder: 30,
  notes: [
    "Brake pads, discs, shocks and CVL kits are excluded and quoted separately.",
    "If the car needs a brake job first, we will tell you — alignment on a dragging brake is wasted money.",
    "We show you the before and after alignment printout if the machine produces one.",
  ],
  categorySlug: "preventive-maintenance",
  items: [
    { serviceSlug: "pms-b", name: "PMS B (oil, filter, multi-point inspection)", quantity: 1 },
    { serviceSlug: "wheel-alignment-2d", name: "2D Wheel Alignment", quantity: 1 },
    { serviceSlug: "wheel-balancing", name: "Wheel Balancing (per wheel)", quantity: 4 },
  ],
});

// ============================================================================
// 4. BRAKE & BALANCE SAFETY
// ============================================================================
// ANCHOR PSYCHOLOGY: brakes are the highest-anxiety line item in this market —
// customers assume they are being overcharged and cannot verify the price.
// The anchor is built mostly from balancing (a visible, repeatable, four-times
// -counted job) rather than from brakes, so the bundle does not look like a
// way to bundle a frightening job cheaply. The brake *check* is included free
// in spirit: it is priced as part of the bundle and it is what converts the
// anxious question into a specific answer.

const BRAKE_BALANCE_SAFETY = buildPackage({
  slug: "brake-and-balance-safety",
  name: "Brake & Balance Safety",
  tagline: "Brake inspection + 4-wheel balancing + tire rotation",
  description:
    "For the car that is starting to feel different on the brakes. We measure pad " +
    "thickness instead of guessing from the pedal feel, check the discs and lines, then " +
    "balance all four wheels and rotate the tyres so the next set wears flat instead " +
    "of feathering on one side. If the pads are fine, we tell you they are fine.",
  priceMin: 2200, // SUGGESTED — REQUIRES OWNER CONFIRMATION (entry price)
  priceMax: 2600, // SUGGESTED — REQUIRES OWNER CONFIRMATION (ceiling)
  compareAtMin: 3000, // SUGGESTED — REQUIRES OWNER CONFIRMATION (à-la-carte: brake check 1000 + balancing 4 × 350 + rotation 400)
  badge: null,
  isSeasonal: false,
  seasonKey: null,
  validFrom: null,
  validUntil: null,
  isFeatured: false,
  sortOrder: 40,
  notes: [
    "Brake pads and discs are not included. Quoted separately, and only after you say yes.",
    "Brake fluid replacement is recommended but never bundled silently.",
    "If a safety-critical fault is found, we stop and call you before continuing.",
  ],
  categorySlug: "brakes",
  items: [
    { serviceSlug: "brake-check", name: "Brake Check (pads, discs, lines, fluid)", quantity: 1 },
    { serviceSlug: "wheel-balancing", name: "Wheel Balancing (per wheel)", quantity: 4 },
    { serviceSlug: "tire-rotation", name: "Tire Rotation", quantity: 1 },
  ],
});

// ============================================================================
// 5. TYRE CHANGEOVER PACKAGE
// ============================================================================
// ANCHOR PSYCHOLOGY: the smallest real discount here — 20%. Tyres are a big
// enough spend that 20% off a four-wheel changeover is already several
// thousand pesos, and tyre buyers are brand-loyal, so an inflated percentage
// would read as "these must be seconds". We would rather sell the fitting
// accurately: mounted, balanced, rotated, new valve stems, and torqued to spec.

const TYRE_CHANGEOVER = buildPackage({
  slug: "tyre-changeover-package",
  name: "Tyre Changeover Package",
  tagline: "Mount + balance 4 wheels + rotation + valve stems",
  description:
    "New tyres in, old ones out, done properly. We fit and balance all four wheels, " +
    "rotate the set to even out the wear, replace the valve stems (the cheap little " +
    "part that causes slow leaks), and torque to the manufacturer's spec rather than " +
    "by feel. Your old tyres stay here if you want to compare them to the new set.",
  priceMin: 1600, // SUGGESTED — REQUIRES OWNER CONFIRMATION (fitting labour only; tyres not included)
  priceMax: 1900, // SUGGESTED — REQUIRES OWNER CONFIRMATION (ceiling incl. TPMS sensor swap)
  compareAtMin: 2000, // SUGGESTED — REQUIRES OWNER CONFIRMATION (à-la-carte: mounting 4 × 300 + balancing 4 × 150 + valve stems 4 × 50)
  badge: null,
  isSeasonal: false,
  seasonKey: null,
  validFrom: null,
  validUntil: null,
  isFeatured: false,
  sortOrder: 50,
  notes: [
    "Tyres themselves are priced separately. This package is fitting labour.",
    "Old tyres can be disposed of for a small fee, or returned to you on request.",
    "If a wheel is damaged or a stud is stripped, we stop and tell you before continuing.",
  ],
  categorySlug: "tires",
  items: [
    { serviceSlug: "tire-mounting", name: "Tire Mounting (per wheel)", quantity: 4 },
    { serviceSlug: "wheel-balancing", name: "Wheel Balancing (per wheel)", quantity: 4 },
    { serviceSlug: "tire-rotation", name: "Tire Rotation", quantity: 1 },
    { serviceSlug: "valve-stem-replacement", name: "Valve Stem Replacement (per wheel)", quantity: 4 },
  ],
});

// ============================================================================
// 6. UNDERCOAT & RUST GUARD
// ============================================================================
// ANCHOR PSYCHOLOGY: the widest anchor (₱7,400 à-la-carte) and the widest true
// range (₱5,600–₱6,400). Undercoating is a medium-ticket, low-frequency, "is it
// worth it" purchase — the customer needs to see the *hours of bay time* broken
// out, which is why the notes are specific about surface preparation. A bundle
// here is not about saving money, it is about making an unfamiliar service
// legible. No seasonal flag: undercoating is correct on Bataan's roads in the
// rains and in the dry season, and pretending otherwise would be dishonest.

const UNDERCOAT_RUST_GUARD = buildPackage({
  slug: "undercoat-and-rust-guard",
  name: "Undercoat & Rust Guard",
  tagline: "Undercoating + tire inspection + fluid top-up + suspension check",
  description:
    "Bataan roads — salt, mud, gravel shoulders and standing flood water — do their work " +
    "from underneath, where you never look. We wash down, dry, sand where needed, and " +
    "apply the coating to the chassis and wheel arches, then check your tyres and " +
    "top up the fluids while the car is up. This is the job that protects the car you " +
    "will want to sell in four years.",
  priceMin: 5600, // SUGGESTED — REQUIRES OWNER CONFIRMATION (entry price, single coat)
  priceMax: 6400, // SUGGESTED — REQUIRES OWNER CONFIRMATION (ceiling, full pre-wash + touch-ups)
  compareAtMin: 7400, // SUGGESTED — REQUIRES OWNER CONFIRMATION (à-la-carte: undercoat 5200 + inspection 350 + fluids 850 + suspension check 1000)
  badge: "Protect It",
  isSeasonal: false,
  seasonKey: null,
  validFrom: null,
  validUntil: null,
  isFeatured: false,
  sortOrder: 60,
  notes: [
    "Estimated hours: one full day. We do not rush a coating — rushed coating flakes off in months.",
    "Rust already through the metal is repair, not coating. We will show you and quote separately.",
    "We will tell you honestly if your car does not need it yet.",
  ],
  categorySlug: "protection",
  items: [
    { serviceSlug: "undercoating", name: "Undercoating (chassis + wheel arches)", quantity: 1 },
    { serviceSlug: "tire-inspection", name: "Tire Inspection", quantity: 1 },
    { serviceSlug: "fluid-top-up", name: "Fluid Top-Up (brake, coolant, washer)", quantity: 1 },
    { serviceSlug: "suspension-check", name: "Suspension Check (shocks, CVL, bushings)", quantity: 1 },
  ],
});

/**
 * Draft list (pre-computation). Kept private — consumers use `PACKAGES`.
 * Declared here so `SERVICE_SLUGS_REQUIRED` and `PACKAGE_CATEGORY_SLUGS` can be
 * derived from the real data instead of a hand-maintained list that drifts.
 */
const PACKAGES_DRAFT: readonly PackageDraft[] = [
  RAINY_SEASON_PACKAGE,
  COMMUTER_EXPRESS_PMS,
  BALANGA_BREEZE,
  BRAKE_BALANCE_SAFETY,
  TYRE_CHANGEOVER,
  UNDERCOAT_RUST_GUARD,
];

/**
 * Every `Service.slug` this file needs to exist in the catalogue seed.
 * Derived from the real package list above, so it can never drift.
 */
export const SERVICE_SLUGS_REQUIRED: readonly string[] = Array.from(
  new Set(PACKAGES_DRAFT.flatMap((p) => p.items.map((i) => i.serviceSlug))),
).sort();

/** Seed-friendly `ServiceCategory` slugs referenced by `categorySlug`. */
export const PACKAGE_CATEGORY_SLUGS: readonly string[] = Array.from(
  new Set(PACKAGES_DRAFT.map((p) => p.categorySlug).filter((s): s is string => s !== null)),
).sort();

/** All seed packages, in `sortOrder`. Ready for `prisma.package.createMany`. */
export const PACKAGES: readonly PackageSeed[] = PACKAGES_DRAFT.map((p) => buildPackage(p));

/** Convenience lookup for `/services` and `/deals?package=`. */
export const PACKAGES_BY_SLUG: Readonly<Record<string, PackageSeed>> = Object.freeze(
  Object.fromEntries(PACKAGES.map((p) => [p.slug, p])),
);

/** Seasonal bundles only — used by the homepage "rainy season" module. */
export const SEASONAL_PACKAGES: readonly PackageSeed[] = PACKAGES.filter((p) => p.isSeasonal);

/**
 * Runtime guard for `prisma/seed.ts`: every required slug is referenced by a
 * package item. Throws with the missing list rather than failing later with a
 * cryptic Prisma FK error. Pure function — safe to call in a script or a test.
 */
export function assertPackageServiceCoverage(availableServiceSlugs: readonly string[]): void {
  const have = new Set(availableServiceSlugs);
  const missing = SERVICE_SLUGS_REQUIRED.filter((slug) => !have.has(slug));
  if (missing.length > 0) {
    throw new Error(
      `packages.ts references Service.slug values that do not exist in the catalogue seed:\n` +
        missing.map((m) => `  - ${m}`).join("\n") +
        `\n\nAdd these to the Service seed (owned by backend-core) or remove the ` +
        `corresponding PackageItem.`,
    );
  }
}