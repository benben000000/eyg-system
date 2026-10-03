/**
 * HOMEPAGE SERVICE CATALOGUE — LOCAL FALLBACK
 * ============================================================================
 * SWAP POINT: the Prisma catalogue is the source of truth. Once the backend
 * data layer is published, replace `HOMEPAGE_CATEGORIES` with a fetch of
 * `ServiceDto[]` (see `src/lib/types.ts`) and map `category.slug`,
 * `category.name`, `summary`, `icon`, `priceMin`, `priceMax` straight through.
 * The shape below already matches that contract, so the components do not care.
 *
 * PRICES ARE `null` ON PURPOSE. `docs/AGENT-BRIEF.md` §5 forbids inventing
 * prices, and `src/config/site.ts` carries none. `formatPesoRange(null, …)`
 * renders "Ask us", which is the honest answer — every card deep-links into
 * `/services#<slug>` where the real seeded range appears.
 *
 * Slugs match the `ServiceCategory.slug` values the seed is expected to use,
 * so the `/services#<slug>` deep links resolve.
 */
import type { ServiceDto } from "@/lib/types";

export interface HomeCategory {
  /** Matches `ServiceCategory.slug` on the services page anchor. */
  slug: string;
  name: string;
  /** One line, plain language, Taglish-friendly. */
  summary: string;
  /** lucide-react icon name. Resolved in <ServiceMenu />. */
  icon: string;
  priceMin: number | null;
  priceMax: number | null;
  /** A typical length, used for expectation-setting. */
  duration: string;
  /** Two or three things included. */
  highlights: readonly string[];
}

export const HOMEPAGE_CATEGORIES: ReadonlyArray<HomeCategory> = [
  {
    slug: "tires",
    name: "Tires & Tire Change",
    summary: "New tire fitting, puncture repair, balancing and tire rotation.",
    icon: "CircleDot",
    priceMin: null,
    priceMax: null,
    duration: "30–60 min",
    highlights: ["Puncture / vulcanizing", "Tire rotation", "Balancing"],
  },
  {
    slug: "pms",
    name: "Preventive Maintenance (PMS)",
    summary: "PMS A and PMS B packages — oil, filters, brakes check, full inspection.",
    icon: "Wrench",
    priceMin: null,
    priceMax: null,
    duration: "1–3 hours",
    highlights: ["Oil + oil filter", "Air & fuel filter", "Brake and battery check"],
  },
  {
    slug: "wheel-alignment",
    name: "Wheel Alignment",
    summary: "Computerised alignment so your tires wear straight and stop pulling.",
    icon: "MoveDiagonal",
    priceMin: null,
    priceMax: null,
    duration: "45–60 min",
    highlights: ["Front & rear", "Steering check", "Post-alignment road test"],
  },
  {
    slug: "brakes",
    name: "Brakes & Suspension",
    summary: "Brake pads, brake shoes, disc resurfacing, shocks and CVL/bushings.",
    icon: "Disc3",
    priceMin: null,
    priceMax: null,
    duration: "1–3 hours",
    highlights: ["Brake pad change", "Disc / drum service", "Shock absorbers"],
  },
  {
    slug: "undercoating",
    name: "Undercoating",
    summary: "Rust protection for the underside — useful year-round, essential in the wet season.",
    icon: "ShieldCheck",
    priceMin: null,
    priceMax: null,
    duration: "2–4 hours",
    highlights: ["Chassis clean", "Rustproof coating", "Before/after photos"],
  },
  {
    slug: "aircon",
    name: "Car Aircon",
    summary: "Aircon regas, compressor and cooling repairs for a cold cabin again.",
    icon: "Snowflake",
    priceMin: null,
    priceMax: null,
    duration: "1–3 hours",
    highlights: ["Aircon regas", "Compressor check", "Cabin filter"],
  },
];

/** Narrow a `ServiceDto` from the API down to what a menu card needs. */
export function toHomeCategory(dto: ServiceDto): HomeCategory {
  return {
    slug: dto.category.slug,
    name: dto.category.name,
    summary: dto.summary,
    icon: dto.category.icon ?? "Wrench",
    priceMin: dto.priceMin,
    priceMax: dto.priceMax,
    duration: dto.durationMin ? `${dto.durationMin} min` : "Ask us",
    highlights: dto.includes.slice(0, 3),
  };
}
