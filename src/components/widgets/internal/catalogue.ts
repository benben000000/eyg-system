/**
 * SERVICE / PACKAGE CATALOGUE ADAPTER
 * ============================================================================
 * Owned by the *widgets* agent.
 *
 * WHY THIS MODULE EXISTS
 *  The widgets need a service + package list to render pickers, run the local
 *  estimate and group items by category. `prisma/seed.ts` (backend-core) owns the
 *  real catalogue, `src/content/**` owns the marketing copy, and neither is
 *  guaranteed to exist when these components are built. So the widgets take the
 *  catalogue as an OPTIONAL PROP typed against `ServiceDto` / `PackageDto` from
 *  `@/lib/types`, and fall back to the conservative built-in list below.
 *
 *  The built-in list is intentionally marked `CALL_FOR_PRICE` wherever the owner
 *  has not confirmed a number (see `src/content/marketing/promotions.ts`, which
 *  flags every peso figure as SUGGESTED). A wrong price is worse than no price,
 *  so anything unconfirmed resolves to "ask us" — never a guess.
 *
 * ============================================================================
 * CONTRACT FOR THE BACKEND SEED + PAGES AGENT
 * ---------------------------------------------------------------------------
 *  Pass `services: ServiceDto[]` and `packages: PackageDto[]` (from
 *  `src/lib/types.ts`). Ids may be either the Prisma `cuid` or the `slug` —
 *  the widgets send whatever you give them straight back in `serviceIds`, so
 *  the API must accept the same identifier it published. Recommendation: publish
 *  `id = slug` so a deep link stays valid across reseeds.
 * ============================================================================
 */
import type { PackageDto, ServiceDto } from "@/lib/types";

export interface WidgetCatalogue {
  services: readonly ServiceDto[];
  packages: readonly PackageDto[];
}

/** Verbatim: this exact sentence ships on every quote and booking summary. */
export const ESTIMATE_DISCLAIMER =
  "This is an estimate, not a quote. We confirm the final price after we see the vehicle and the parts it needs. Nothing here is charged until you approve it.";

export const ON_SITE_LABEL = "On-site estimate";

export const NOT_CONFIRMED_NOTE = "Price not confirmed by the shop yet";

/** Shown on the local (no-backend) estimate path so the number is never mistaken
 *  for a price the shop has committed to. */
export const LOCAL_ESTIMATE_NOTE =
  "Calculated on your phone from our standard price list. We confirm it on site before any work starts.";

/** When a catalogue entry has no confirmed price, the estimator still needs a
 *  defensible number. These are explicitly labelled as "we check the parts".
 *  They exist so the widget can show a *range*, never to invent a quote. */
const UNCONFIRMED_RANGE = { min: 450, max: 1_850 } as const;
const UNCONFIRMED_NOTE = "We check the parts and the condition first, then give you the price.";

const category = (slug: string, name: string, icon: string | null) => ({ slug, name, icon });

/**
 * Conservative built-in catalogue. Only `pricing: "FIXED"` numbers here are
 * figures the shop's own website already implies are stable; everything else is
 * `CALL_FOR_PRICE` with an explicit "we check it" note.
 */
export const FALLBACK_SERVICES: readonly ServiceDto[] = Object.freeze([
  {
    id: "pms",
    slug: "pms",
    name: "Preventive Maintenance Service (PMS)",
    shortName: "PMS",
    summary: "Oil, filter and the full check-up, done in one bay visit.",
    pricing: "CALL_FOR_PRICE",
    priceMin: null,
    priceMax: null,
    priceNote: UNCONFIRMED_NOTE,
    durationMin: 60,
    isPopular: true,
    isFeatured: true,
    includes: ["Engine oil and filter", "Fluid levels", "Brake and tyre check", "Written what-needs-doing list"],
    category: category("maintenance", "Maintenance", "wrench"),
  },
  {
    id: "pms-b",
    slug: "pms-b",
    name: "PMS B — oil, filter and brakes",
    shortName: "PMS B",
    summary: "The bigger service: oil, filters, brake pads and a full check.",
    pricing: "CALL_FOR_PRICE",
    priceMin: null,
    priceMax: null,
    priceNote: UNCONFIRMED_NOTE,
    durationMin: 120,
    isPopular: true,
    isFeatured: false,
    includes: ["Everything in PMS A", "Brake pad inspection", "Air filter check"],
    category: category("maintenance", "Maintenance", "wrench"),
  },
  {
    id: "wheel-alignment",
    slug: "wheel-alignment",
    name: "Wheel alignment",
    shortName: "Alignment",
    summary: "Stops the car pulling to one side and saves your tyres.",
    pricing: "CALL_FOR_PRICE",
    priceMin: null,
    priceMax: null,
    priceNote: UNCONFIRMED_NOTE,
    durationMin: 60,
    isPopular: true,
    isFeatured: true,
    includes: ["4-wheel alignment", "Before/after printout", "Tyre wear report"],
    category: category("tyres", "Tyres & Alignment", "disc"),
  },
  {
    id: "tire-change",
    slug: "tire-change",
    name: "Tire change + balancing",
    shortName: "Tire change",
    summary: "New tyres mounted, balanced and pressure-checked.",
    pricing: "CALL_FOR_PRICE",
    priceMin: null,
    priceMax: null,
    priceNote: "Labour only. Tyres are charged at the price of the brand and size you pick.",
    durationMin: 60,
    isPopular: true,
    isFeatured: false,
    includes: ["Mount and dismount", "Balancing", "New valve stems if needed"],
    category: category("tyres", "Tyres & Alignment", "disc"),
  },
  {
    id: "tire-rotation",
    slug: "tire-rotation",
    name: "Tire rotation",
    shortName: "Rotation",
    summary: "Even out the wear so all four last longer.",
    pricing: "CALL_FOR_PRICE",
    priceMin: null,
    priceMax: null,
    priceNote: UNCONFIRMED_NOTE,
    durationMin: 30,
    isPopular: false,
    isFeatured: false,
    includes: ["Rotate four tyres", "Pressure set to spec", "Tread depth check"],
    category: category("tyres", "Tyres & Alignment", "disc"),
  },
  {
    id: "tire-repair",
    slug: "tire-repair",
    name: "Tire repair / vulcanizing",
    shortName: "Vulcanizing",
    summary: "Plug and patch a small puncture before you replace a whole tyre.",
    pricing: "CALL_FOR_PRICE",
    priceMin: null,
    priceMax: null,
    priceNote: "Only where the damage is safely repairable. We tell you if it is not.",
    durationMin: 30,
    isPopular: false,
    isFeatured: false,
    includes: ["Puncture inspection", "Vulcanizing patch", "Pressure re-check"],
    category: category("tyres", "Tyres & Alignment", "disc"),
  },
  {
    id: "brake-pads",
    slug: "brake-pads",
    name: "Brake pad replacement",
    shortName: "Brake pads",
    summary: "Front or rear pads fitted, with a disc check.",
    pricing: "CALL_FOR_PRICE",
    priceMin: null,
    priceMax: null,
    priceNote: "Parts are quoted before fitting. We do not start without your yes.",
    durationMin: 120,
    isPopular: false,
    isFeatured: false,
    includes: ["Pad replacement", "Disc thickness check", "Brake fluid top-up"],
    category: category("brakes", "Brakes", "shield"),
  },
  {
    id: "brake-check",
    slug: "brake-check",
    name: "Brake check",
    shortName: "Brake check",
    summary: "Put the brakes on the lift so you can see what we see.",
    pricing: "CALL_FOR_PRICE",
    priceMin: null,
    priceMax: null,
    priceNote: UNCONFIRMED_NOTE,
    durationMin: 45,
    isPopular: false,
    isFeatured: false,
    includes: ["Pad and disc measurement", "Fluid check", "Written report"],
    category: category("brakes", "Brakes", "shield"),
  },
  {
    id: "undercoating",
    slug: "undercoating",
    name: "Undercoating",
    shortName: "Undercoating",
    summary: "Rust protection for the underside — good before the rainy season.",
    pricing: "CALL_FOR_PRICE",
    priceMin: null,
    priceMax: null,
    priceNote: "Price depends on the underside condition. We show you first.",
    durationMin: 180,
    isPopular: false,
    isFeatured: true,
    includes: ["Chassis wash", "Rust treatment", "Underbody coating"],
    category: category("protection", "Protection", "umbrella"),
  },
  {
    id: "car-aircon",
    slug: "car-aircon",
    name: "Car aircon service",
    shortName: "Aircon",
    summary: "Regas, clean and check — because a Balanga summer is not optional.",
    pricing: "CALL_FOR_PRICE",
    priceMin: null,
    priceMax: null,
    priceNote: "Freon is charged by the amount the system needs.",
    durationMin: 90,
    isPopular: true,
    isFeatured: false,
    includes: ["Leak check", "Regas to correct level", "Cabin filter check"],
    category: category("protection", "Protection", "umbrella"),
  },
  {
    id: "change-oil",
    slug: "change-oil",
    name: "Change oil",
    shortName: "Change oil",
    summary: "Oil and filter change, old oil drained and taken away.",
    pricing: "CALL_FOR_PRICE",
    priceMin: null,
    priceMax: null,
    priceNote: UNCONFIRMED_NOTE,
    durationMin: 45,
    isPopular: true,
    isFeatured: false,
    includes: ["Drain old oil", "New oil to spec", "New filter"],
    category: category("maintenance", "Maintenance", "wrench"),
  },
  {
    id: "diagnostics",
    slug: "diagnostics",
    name: "Full diagnostics / check-up",
    shortName: "Diagnostics",
    summary: "A written list of what is fine and what is not.",
    pricing: "CALL_FOR_PRICE",
    priceMin: null,
    priceMax: null,
    priceNote: UNCONFIRMED_NOTE,
    durationMin: 60,
    isPopular: false,
    isFeatured: false,
    includes: ["Scan", "Visual inspection", "Written 'do now / watch it / nothing urgent' list"],
    category: category("maintenance", "Maintenance", "wrench"),
  },
]);

export const FALLBACK_PACKAGES: readonly PackageDto[] = Object.freeze([
  {
    id: "rainy-season-safety",
    slug: "rainy-season-safety",
    name: "Rainy Season Safety",
    tagline: "Tyre check, wipers and a brake check before the rains.",
    priceMin: 0,
    priceMax: null,
    compareAtMin: null,
    savingsPct: null,
    badge: "Rainy season pick",
    items: [
      { name: "Tyre pressure, tread and sidewall inspection", quantity: 1 },
      { name: "Brake check", quantity: 1 },
      { name: "Wiper blade fitting", quantity: 1 },
    ],
  },
  {
    id: "first-visit-pms",
    slug: "first-visit-pms",
    name: "First Visit PMS",
    tagline: "Your first preventive maintenance service, 15% off the PMS line.",
    priceMin: 0,
    priceMax: null,
    compareAtMin: null,
    savingsPct: 15,
    badge: "First visit",
    items: [
      { name: "Preventive Maintenance Service (PMS)", quantity: 1 },
      { name: "Oil and filter", quantity: 1 },
    ],
  },
]);

/** The default catalogue used when a page passes no props. */
export const DEFAULT_CATALOGUE: WidgetCatalogue = Object.freeze({
  services: FALLBACK_SERVICES,
  packages: FALLBACK_PACKAGES,
});

/** Merges caller-supplied catalogue over the built-in list. */
export function resolveCatalogue(
  services?: readonly ServiceDto[],
  packages?: readonly PackageDto[],
): WidgetCatalogue {
  return {
    services: services && services.length > 0 ? services : DEFAULT_CATALOGUE.services,
    packages: packages && packages.length > 0 ? packages : DEFAULT_CATALOGUE.packages,
  };
}

export interface CatalogueView {
  byId: ReadonlyMap<string, ServiceDto>;
  byPackageId: ReadonlyMap<string, PackageDto>;
  categories: ReadonlyArray<{ slug: string; name: string; services: readonly ServiceDto[] }>;
}

export function indexCatalogue(catalogue: WidgetCatalogue): CatalogueView {
  const byId = new Map<string, ServiceDto>();
  const groups = new Map<string, { slug: string; name: string; services: ServiceDto[] }>();

  for (const service of catalogue.services) {
    byId.set(service.id, service);
    const key = service.category.slug;
    const existing = groups.get(key);
    if (existing) existing.services.push(service);
    else groups.set(key, { slug: key, name: service.category.name, services: [service] });
  }

  const byPackageId = new Map<string, PackageDto>();
  for (const pkg of catalogue.packages) byPackageId.set(pkg.id, pkg);

  return {
    byId,
    byPackageId,
    categories: Array.from(groups.values()),
  };
}

/** Human label for a service, preferring `shortName` inside dense lists. */
export function serviceLabel(service: ServiceDto, dense = false): string {
  return dense && service.shortName ? service.shortName : service.name;
}

/**
 * The price band a service contributes to an estimate.
 *
 * Honesty rules baked in here:
 *  - `FIXED` → min === max. A firm number, no hedging.
 *  - `RANGE`  → the published band, verbatim.
 *  - `CALL_FOR_PRICE` → a deliberately WIDE band plus `isVariable: true`, so a
 *    picker can never present a guess as a price. The caller renders the
 *    `variableNote` verbatim next to it.
 */
export function priceBand(service: ServiceDto): {
  min: number;
  max: number;
  isVariable: boolean;
  variableNote?: string;
} {
  if (service.pricing === "FIXED" && service.priceMin !== null) {
    return { min: service.priceMin, max: service.priceMin, isVariable: false };
  }
  if (service.pricing === "RANGE" && service.priceMin !== null) {
    const max = service.priceMax ?? service.priceMin;
    return { min: service.priceMin, max, isVariable: max !== service.priceMin };
  }
  return {
    min: UNCONFIRMED_RANGE.min,
    max: UNCONFIRMED_RANGE.max,
    isVariable: true,
    variableNote: service.priceNote ?? UNCONFIRMED_NOTE,
  };
}

/** Duration in minutes; unknown services still reserve 45 min of bay time. */
export function durationOf(service: ServiceDto): number {
  return service.durationMin ?? 45;
}

/**
 * How wide a spread is before we stop calling a number a "price".
 * A range wider than 40% of its lower bound is a conversation, not a quote.
 */
export function isWideSpread(min: number, max: number): boolean {
  if (min <= 0) return max > 0;
  return (max - min) / min > 0.4;
}