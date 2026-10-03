/**
 * EYG TIRE & AUTO CARE — LOCAL CATALOGUE (FALLBACK DATA)
 * ============================================================================
 * ⚠️  READ THIS BEFORE PUBLISHING.
 *
 * THERE IS NO DATABASE-DRIVEN CATALOGUE YET.
 * `prisma/schema.prisma` defines `Service`, `ServiceCategory`, `Package` and
 * `GalleryImage`, and the backend agent will expose them. Until that lands, the
 * public pages need *something* to render, so this module holds a hand-written,
 * fully-typed stand-in.
 *
 * ⚠️  EVERY PESO FIGURE BELOW IS A PLACEHOLDER.
 *     No price here has been confirmed by the shop owner. Each one is flagged
 *     inline with `SUGGESTED — REQUIRES OWNER CONFIRMATION`, exactly as
 *     `src/content/marketing/promotions.ts` does. `CATALOG_PRICING_NOTICE` is
 *     rendered visibly on `/services` and inside `/book` so a customer is never
 *     shown a number the shop has not agreed to.
 *
 * ⚠️  EVERY GALLERY IMAGE HAS `src: null`.
 *     There is no owned photography in the repo and stock photos must never be
 *     presented as this shop's work. Each record therefore carries a real,
 *     descriptive `alt` (written for the *intended* photo, so the swap is
 *     mechanical) and `needsOwnerPhoto: true`.
 *
 * ── HOW TO SWAP ────────────────────────────────────────────────────────────
 * Replace the bodies of `getServices()`, `getPackages()` and `getGalleryImages()`
 * with a `prisma` query (server-only) and delete the `LOCAL_*` consts. The
 * exported *shapes* are the contract:
 *   - services  -> `CatalogService[]`  (`ServiceDto` + `excluded`)
 *   - packages  -> `PackageDto[]`
 *   - gallery   -> `GalleryImage[]`
 * Nothing outside this file imports the `LOCAL_*` consts directly.
 * ============================================================================
 */

import type { PackageDto, ServiceDto } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// NOTICE (rendered in the UI — this is the honest hedge, not a code comment)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The single sentence that sits under every price on the site. It is the
 * promise that makes an indicative range acceptable to a customer.
 */
export const CATALOG_PRICING_NOTICE =
  "Every peso figure on this page is an estimate. The final price is confirmed with you " +
  "after the technician inspects your car — before any work starts.";

/** `true` while the catalogue above is still owner-unconfirmed. Drives the banner. */
export const CATALOG_NEEDS_OWNER_CONFIRMATION = true as const;

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

export interface ServiceCategory {
  slug: string;
  name: string;
  /** Key into `CATEGORY_ICON_KEYS` in `@/components/pages/_icons`. */
  icon: string;
  blurb: string;
}

export const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  {
    slug: "tires-alignment",
    name: "Tires & Alignment",
    icon: "tire",
    blurb:
      "Changeovers, mounting, balancing, rotation and wheel alignment. We patch properly — from the inside, with a demount plug.",
  },
  {
    slug: "preventive-maintenance",
    name: "Preventive Maintenance Service",
    icon: "droplet",
    blurb:
      "PMS A, B and C. Change oil, fresh filter, and the check list that stops a small problem becoming a big one.",
  },
  {
    slug: "engine-tune-up",
    name: "Engine Tune-Up",
    icon: "settings",
    blurb:
      "Spark plugs, belts, throttle body, engine mounts. For the car that idles rough, hesitates, or drinks fuel.",
  },
  {
    slug: "undercoating",
    name: "Undercoating",
    icon: "shield",
    blurb:
      "Anti-rust undercoating for cars that live on the coastal roads and the talahiban, not for show.",
  },
  {
    slug: "ac-repair",
    name: "AC Repair",
    icon: "snowflake",
    blurb:
      "Car aircon that stopped cooling. Regas, compressor, belt, thermostat — diagnosed before anything is replaced.",
  },
  {
    slug: "brakes-suspension",
    name: "Brakes & Suspension",
    icon: "disc",
    blurb:
      "Brake pads, discs, fluid, shock absorbers, CVL and bushings. The parts that keep the car pointing where you steer it.",
  },
  {
    slug: "battery",
    name: "Battery",
    icon: "battery",
    blurb:
      "Battery testing, replacement and terminal cleaning. Most 'the car won't start' mornings end here.",
  },
  {
    slug: "roadside",
    name: "Roadside",
    icon: "lifebuoy",
    blurb:
      "Stuck on EGSA? Jump start, mobile tire change and on-the-spot help anywhere in Bataan.",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `ServiceDto` plus the fields the UI needs that the public DTO does not carry
 * yet. When the Prisma model gains `excluded`, this intersection collapses into
 * `ServiceDto` and can be deleted.
 */
export type CatalogService = ServiceDto & {
  /** Plain-English "what this does NOT cover". Rendered in the disclosure. */
  excluded: string[];
  /** Per-service caveat about the price. Never a substitute for a real number. */
  priceNote: string | null;
};

type Cat = (typeof SERVICE_CATEGORIES)[number]["slug"];

const svc = (
  id: string,
  slug: string,
  name: string,
  category: Cat,
  summary: string,
  durationMin: number,
  pricing: ServiceDto["pricing"],
  priceMin: number | null,
  priceMax: number | null,
  extras: {
    shortName?: string;
    isPopular?: boolean;
    isFeatured?: boolean;
    priceNote?: string | null;
    includes?: string[];
    excluded: string[];
  },
): CatalogService => {
  const cat = SERVICE_CATEGORIES.find((c) => c.slug === category);
  if (!cat) throw new Error(`catalog: unknown category "${category}"`);
  return {
    id,
    slug,
    name,
    shortName: extras.shortName ?? null,
    summary,
    pricing,
    priceMin,
    priceMax,
    priceNote: extras.priceNote ?? null,
    durationMin,
    isPopular: extras.isPopular ?? false,
    isFeatured: extras.isFeatured ?? false,
    includes: extras.includes ?? [],
    excluded: extras.excluded,
    category: { slug: cat.slug, name: cat.name, icon: cat.icon },
  };
};

export const LOCAL_SERVICES: readonly CatalogService[] = [
  // ── Tires & Alignment ────────────────────────────────────────────────────
  svc(
    "svc_tire_change",
    "tire-change",
    "Tire Change & Balancing",
    "tires-alignment",
    "Take the old tyres off, mount the new ones, balance all four. Bay time, not a parking-lot job.",
    45,
    "RANGE",
    500, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    1200, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "Tire change",
      isPopular: true,
      priceNote: "Labour only. Tyres and valve stems are charged separately.",
      includes: [
        "Remove and refit all four wheels",
        "New valve stems where the old ones are worn",
        "Dynamic balance on each wheel",
        "Torquing to the manufacturer's spec",
        "Pressure set cold, to the sticker on the door frame",
      ],
      excluded: [
        "The tyres themselves",
        "Wheel alignment — that is a separate job, ask for it",
        "Wheel nuts or studs that need replacing",
      ],
    },
  ),
  svc(
    "svc_new_tires",
    "new-tyres",
    "New Tire Supply & Mounting",
    "tires-alignment",
    "Tyres supplied and fitted in one visit. We show you the size on the sidewall before anything is bought.",
    60,
    "CALL_FOR_PRICE",
    null,
    null,
    {
      shortName: "New tyres",
      priceNote:
        "Priced by size, brand and price band. We confirm the size and the total before ordering — nothing is bought without your yes.",
      includes: [
        "Read the size, load and speed rating off your current tyre",
        "Show you the options we carry in that size",
        "Supply, mount and balance",
        "Old tyres returned to you on request",
      ],
      excluded: [
        "Old-tyre disposal, unless you ask us to take them",
        "Wheel alignment",
        "Balance weights beyond the first set, on badly worn rims",
      ],
    },
  ),
  svc(
    "svc_wheel_alignment",
    "wheel-alignment",
    "Wheel Alignment",
    "tires-alignment",
    "Front and rear alignment on a computerized rack. For a car that pulls to one side, or a steering wheel that no longer centers.",
    60,
    "RANGE",
    800, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    1500, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "Alignment",
      isPopular: true,
      isFeatured: true,
      priceNote:
        "SUVs, light commercial vans and cars with modified ride height sit at the top of the range.",
      includes: [
        "Pre-alignment check of tyre pressure and tread wear",
        "Front and rear alignment",
        "Before-and-after printout of camber, caster and toe",
        "Reset of the steering angle sensor where the car needs it",
      ],
      excluded: [
        "Replacement parts — tie rods, ball joints, rack ends, bushings",
        "A second alignment if the car needs parts fitted first",
      ],
    },
  ),
  svc(
    "svc_tire_rotation",
    "tire-rotation",
    "Tire Rotation & Pressure Check",
    "tires-alignment",
    "Cheapest wear insurance there is. Rotates the tyres so they wear evenly, and sets the pressures cold.",
    30,
    "FIXED",
    400, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    400, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "Rotation",
      priceNote: "Before the service, not after — the pressures get set cold.",
      includes: [
        "Cross rotation of all four tyres (or straight rotation on directional tyres)",
        "Cold pressure check and adjustment on every wheel",
        "Tread depth reading on each tyre",
        "Visual check for cuts, bulges and uneven wear",
      ],
      excluded: ["Balancing", "Any repair or replacement"],
    },
  ),
  svc(
    "svc_puncture_repair",
    "puncture-repair",
    "Puncture Repair — Patch, Not Plug",
    "tires-alignment",
    "The nail is out, the hole is plugged from the inside, and the tyre is tested for leaks. A string plug is not a repair.",
    30,
    "RANGE",
    250, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    500, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "Puncture repair",
      priceNote:
        "If the hole is in the sidewall or the shoulder, we tell you — those are not safely repairable.",
      includes: [
        "Tyre demounted and the object removed",
        "Internal patch-plug repair from the inside",
        "Rebalance after the repair",
        "Water-bath leak test before the tyre goes back on",
      ],
      excluded: [
        "Tyres damaged in the sidewall or shoulder — we do not repair those",
        "A spare tyre purchase",
        "Mobile call-out (see the Roadside category)",
      ],
    },
  ),

  // ── Preventive Maintenance Service ────────────────────────────────────────
  svc(
    "svc_pms_a",
    "pms-a",
    "PMS A — Change Oil & Filter",
    "preventive-maintenance",
    "The baseline service. Oil and a fresh oil filter, plus a look at the rest of the car while it is up.",
    60,
    "RANGE",
    1200, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    2400, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "PMS A",
      isPopular: true,
      isFeatured: true,
      priceNote:
        "The range is mostly the oil you choose. Fully synthetic and a bigger engine sit at the top.",
      includes: [
        "Drain and replace engine oil to the manufacturer's interval and viscosity",
        "New oil filter",
        "Fluid top-ups: coolant, brake fluid, washer fluid",
        "Tyre pressure, tread depth and battery terminal check",
        "A written list of anything that needs attention soon",
      ],
      excluded: [
        "Air filter and spark plugs — that is PMS B",
        "Any repair, part or fluid change found during the check",
      ],
    },
  ),
  svc(
    "svc_pms_b",
    "pms-b",
    "PMS B — Oil, Filter & Full Check",
    "preventive-maintenance",
    "PMS A plus the consumables the car is due. The one most drivers should be booking.",
    90,
    "RANGE",
    2000, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    4500, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "PMS B",
      isPopular: true,
      isFeatured: true,
      priceNote:
        "Spare parts, if you want us to add them, are quoted and approved before fitting.",
      includes: [
        "Everything in PMS A",
        "Air filter element replaced",
        "Spark plugs replaced on petrol engines",
        "Brake pad and disc thickness measured and written down",
        "Belts, hoses and fluid condition inspected",
        "Battery load-tested, not just voltage-read",
      ],
      excluded: [
        "Brake pads, discs, batteries and any other part — quoted first",
        "Engine overhaul or major repair work",
      ],
    },
  ),
  svc(
    "svc_pms_c",
    "pms-c",
    "PMS C — Oil, Filter, Brakes & Alignment",
    "preventive-maintenance",
    "PMS B plus brake pads and a wheel alignment, done in one visit. Popular on a car that has never been serviced properly.",
    150,
    "RANGE",
    3500, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    6500, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "PMS C",
      priceNote:
        "Assumes front brake pads. Discs, rear pads or fluid change are quoted on top.",
      includes: [
        "Everything in PMS B",
        "Front brake pads replaced",
        "Pad friction material measured and written down",
        "Front and rear wheel alignment",
        "Brake fluid level and condition checked",
      ],
      excluded: [
        "Brake discs, calipers, brake hoses",
        "Brake fluid change — ask, it is usually worth doing",
        "Tyres, if they need replacing",
      ],
    },
  ),

  // ── Engine Tune-Up ───────────────────────────────────────────────────────
  svc(
    "svc_engine_tune_up",
    "engine-tune-up",
    "Engine Tune-Up",
    "engine-tune-up",
    "For the car that idles rough, hesitates on throttle, or has lost its appetite. Diagnosed first, parts replaced only after you agree.",
    120,
    "RANGE",
    2500, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    5000, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "Engine tune-up",
      priceNote:
        "Diagnostic time is included. Parts are quoted separately before fitting.",
      includes: [
        "Full diagnostic scan and fault-code read",
        "Throttle body cleaned and idle re-tuned",
        "Spark plug inspection and replacement",
        "Drive belt condition check, serpentine and timing where accessible",
        "Engine mounts checked for oil seepage",
        "Air and fuel filter inspection",
      ],
      excluded: [
        "Turbocharger, injectors, coils or head work",
        "Head gasket and compression tests — quoted if the scan points there",
      ],
    },
  ),
  svc(
    "svc_spark_plugs",
    "spark-plugs",
    "Spark Plug Change",
    "engine-tune-up",
    "Plugs out, sockets cleaned, new plugs in, idle and timing reset. The cheapest way to fix a stumble.",
    60,
    "RANGE",
    900, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    2000, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "Spark plugs",
      priceNote:
        "Platinum and iridium cost more than copper. We fit whatever the engine asks for.",
      includes: [
        "All spark plugs removed, sockets and threads cleaned",
        "New plugs fitted to the manufacturer's torque",
        "Ignition timing and idle reset where the car needs it",
        "Coil pack and plug-wire inspection",
      ],
      excluded: ["Ignition coils, unless a test shows they have failed", "Injector cleaning"],
    },
  ),

  // ── Undercoating ─────────────────────────────────────────────────────────
  svc(
    "svc_undercoating",
    "undercoating",
    "Undercoating — Rust Protection",
    "undercoating",
    "Anti-rust coating for the underbody, wheel wells and sills. For a car that lives on coastal roads, flood-prone streets and the talahiban.",
    240,
    "RANGE",
    4500, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    9000, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "Undercoating",
      priceNote:
        "Size of the vehicle and how much of the underbody is accessible change the price.",
      includes: [
        "Pressure wash and degrease of the underbody",
        "Rust-penetrating primer on bare and previously coated metal",
        "Anti-rust coating on the underbody, sills and wheel arches",
        "Drip-free, road-noise-neutral finish",
        "Re-coat interval advice for your driving pattern",
      ],
      excluded: [
        "Body panels and paintwork — this is not rustproofing for the outside",
        "Repair of existing structural rust perforation",
      ],
    },
  ),

  // ── AC Repair ────────────────────────────────────────────────────────────
  svc(
    "svc_ac_regas",
    "ac-regas",
    "Aircon Regas & Freon Top-up",
    "ac-repair",
    "Your car aircon is blowing warm. We evacuate the system, leak-test it, and recharge it to the correct weight — not more.",
    60,
    "RANGE",
    1500, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    2500, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "AC regas",
      isPopular: true,
      priceNote:
        "If the system leaks, we show you the leak. A regas without fixing the leak is money wasted.",
      includes: [
        "Recovery of the existing refrigerant — environmentally correct, not vented",
        "Vacuum and pressure leak test",
        "Cabin filter replaced",
        "Recharge to the manufacturer's specified weight",
        "Vent temperature measured at the centre and both side vents",
      ],
      excluded: [
        "Compressor, condenser or expansion valve replacement",
        "Refrigerant oil and dye beyond what the job needs",
      ],
    },
  ),
  svc(
    "svc_ac_repair",
    "ac-repair",
    "Car Aircon Repair",
    "ac-repair",
    "AC that stopped completely, or blows cold on one side only. Diagnosis before parts.",
    90,
    "RANGE",
    1200, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    4000, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "AC repair",
      priceNote:
        "Diagnostic fee is credited against the repair if you go ahead with us.",
      includes: [
        "Full AC diagnostic: compressor, clutch, sensors, blend door",
        "Belt and pulley inspection",
        "Electrical check on the compressor clutch and pressure sensors",
        "Written finding and a quote before any part is ordered",
      ],
      excluded: [
        "Compressor, condenser, evaporator or receiver-drier replacement — quoted separately",
        "R-1234y retrofit on a car that is not designed for it",
      ],
    },
  ),

  // ── Brakes & Suspension ──────────────────────────────────────────────────
  svc(
    "svc_brake_pads",
    "brake-pads",
    "Brake Pad Replacement",
    "brakes-suspension",
    "Front or rear pads, measured and written down before removal so you can see how much material was actually left.",
    120,
    "RANGE",
    2500, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    6000, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "Brake pads",
      isFeatured: true,
      priceNote:
        "Disc and hardware costs change this a lot. We quote pads and discs together, in writing, before fitting.",
      includes: [
        "Old pads removed, caliper cleaned and lubricated",
        "New pads fitted with new friction material",
        "Brake disc thickness measured and reported",
        "Caliper slide pins cleaned and greased",
        "Brake fluid level checked after the wheels are off",
      ],
      excluded: [
        "Brake discs, unless you approve them after seeing the measurement",
        "Brake fluid change, calipers, hoses or master cylinder",
      ],
    },
  ),
  svc(
    "svc_brake_fluid",
    "brake-fluid",
    "Brake Fluid Change",
    "brakes-suspension",
    "Fluid absorbs water long before it looks old. A flush, not a top-up.",
    60,
    "RANGE",
    1200, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    2000, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "Brake fluid",
      priceNote:
        "Fluid grade must match the manufacturer's specification. We check the label on your cap.",
      includes: [
        "Old fluid drained from the lines and reservoir",
        "New fluid of the specified DOT grade",
        "Bleed at all four wheels until air is out",
        "Fluid crystal-content and moisture check reported",
        "Pedal feel and firming test after the flush",
      ],
      excluded: [
        "ABS bleed on cars that need a scan tool for it — quoted separately",
        "Brake lines, calipers or master cylinder",
      ],
    },
  ),
  svc(
    "svc_shock_absorber",
    "shock-absorber",
    "Shock Absorber Replacement",
    "brakes-suspension",
    "Bouncing over the bumps on the way home from Manila. Front or rear, one side or both.",
    180,
    "CALL_FOR_PRICE",
    null,
    null,
    {
      shortName: "Shock absorbers",
      priceNote:
        "Priced per shock and by brand. We show you the failed one, explain the difference, and quote fitted price.",
      includes: [
        "Bounce and road-noise test before removal",
        "One side measured against the other on the lift",
        "Replacement shock fitted and torqued",
        "Wheel alignment check after the work, quoted if the ride height changed",
      ],
      excluded: [
        "Springs, upper mounts and strut bearings unless quoted",
        "Wheel alignment",
      ],
    },
  ),

  // ── Battery ──────────────────────────────────────────────────────────────
  svc(
    "svc_battery_test",
    "battery-test",
    "Battery & Charging System Test",
    "battery",
    "Load test the battery, check the alternator output and the starter draw. Three numbers, written down for you.",
    20,
    "FIXED",
    300, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    300, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "Battery test",
      priceNote:
        "Tested while you wait. If you have the car up for a PMS, the test is included.",
      includes: [
        "Battery load test and state-of-health reading",
        "Alternator charging output at idle and at revs",
        "Starter current draw",
        "Terminal and hold-down clamp inspection",
        "Parasitic drain check on older cars",
      ],
      excluded: ["Battery or alternator replacement — quoted after the test"],
    },
  ),
  svc(
    "svc_battery_replacement",
    "battery-replacement",
    "Battery Replacement",
    "battery",
    "Battery swapped, terminals cleaned and protected, old battery disposed of properly. Your alarm and radio settings are noted first.",
    30,
    "CALL_FOR_PRICE",
    null,
    null,
    {
      shortName: "Battery",
      priceNote:
        "Priced by the battery's size, type and warranty. We quote the unit and the fitting separately, and we do not fit a battery we would not put in our own car.",
      includes: [
        "Old battery disconnected and terminals cleaned",
        "New battery fitted and secured",
        "Terminal protector applied",
        "Vehicle systems checked after fitting",
        "Old battery taken for proper disposal",
      ],
      excluded: ["Charging system repairs — diagnosed and quoted separately"],
    },
  ),

  // ── Roadside ─────────────────────────────────────────────────────────────
  svc(
    "svc_roadside_assist",
    "roadside-assist",
    "Roadside Assistance — Bataan",
    "roadside",
    "Stuck anywhere in Bataan and on the EGSA stretch. We come to you. No membership, no annual fee.",
    60,
    "RANGE",
    800, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    1500, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "Roadside assist",
      priceNote:
        "Travel outside Balanga City is charged per kilometre. We tell you the rate on the phone before setting off.",
      includes: [
        "Call-out to your location in Bataan",
        "Jump start or on-the-spot battery boost",
        "On-the-spot tire change with the spare, where there is a serviceable spare",
        "Basic diagnosis if the car will not move and will not start",
        "Safe positioning advice while we are on the way",
      ],
      excluded: [
        "Towing, when the car cannot be driven safely",
        "Parts fitted on the roadside beyond consumables",
      ],
    },
  ),
  svc(
    "svc_mobile_tire_change",
    "mobile-tire-change",
    "Mobile Tire Change",
    "roadside",
    "A flat on the way to Manila. We come to you and fit your spare so you can keep moving.",
    60,
    "RANGE",
    800, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    1500, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    {
      shortName: "Mobile tire change",
      priceNote: "Charged per kilometre outside Balanga City.",
      includes: [
        "Call-out to your location",
        "Spare tire fitted and torqued",
        "Roadside pressure set on the remaining wheels",
        "Advice on the damaged tire and whether it is repairable",
      ],
      excluded: ["A replacement tire purchase", "Removal of the damaged tire for repair at the shop"],
    },
  ),
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// PACKAGES
// ─────────────────────────────────────────────────────────────────────────────

export const LOCAL_PACKAGES: readonly PackageDto[] = [
  {
    id: "pkg_rainy_season_safety",
    // MANDATED by the brief. Do not rename without orchestrator sign-off.
    slug: "rainy-season-safety-package",
    name: "Rainy Season Safety Package",
    tagline: "Tyres, wipers and brakes checked in one bay visit — before the rains get serious.",
    // SUGGESTED — REQUIRES OWNER CONFIRMATION (anchored to a 3,350 a-la-carte total)
    priceMin: 2700,
    priceMax: 3350,
    compareAtMin: 3350,
    savingsPct: 19,
    badge: "Rainy Season Pick",
    items: [
      { name: "Tyre pressure, tread depth and sidewall check on all four", quantity: 4 },
      { name: "New wiper blades, fitted", quantity: 2 },
      { name: "Brake check on the lift — pads, discs, fluid level", quantity: 1 },
      {
        name: "Written findings sorted into 'do now', 'watch it', 'nothing to worry about'",
        quantity: 1,
      },
    ],
  },
  {
    id: "pkg_full_service_refresh",
    slug: "full-service-refresh",
    name: "Full Service Refresh — PMS B",
    tagline: "The complete service on a car that has not been looked at in a while.",
    priceMin: 4200, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    priceMax: 5900,
    compareAtMin: 5900,
    savingsPct: 29,
    badge: "Most booked",
    items: [
      { name: "Engine oil drained and replaced, plus a new oil filter", quantity: 1 },
      { name: "Air filter element replaced", quantity: 1 },
      { name: "Spark plugs replaced", quantity: 1 },
      { name: "Brake pad and disc thickness measured and written down", quantity: 1 },
      { name: "Battery load test", quantity: 1 },
      { name: "Written service record you can keep", quantity: 1 },
    ],
  },
  {
    id: "pkg_commuter_tyre_combo",
    slug: "commuter-tyre-combo",
    name: "Commuter Tyre + Alignment Combo",
    tagline: "Four new tyres, mounted, balanced and aligned in a single visit.",
    priceMin: 3200, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    priceMax: 4500,
    compareAtMin: 4500,
    savingsPct: 29,
    badge: null,
    items: [
      { name: "Tyre change and dynamic balancing on all four wheels", quantity: 4 },
      { name: "New valve stems", quantity: 4 },
      { name: "Front and rear wheel alignment", quantity: 1 },
      { name: "Before-and-after alignment printout", quantity: 1 },
    ],
  },
  {
    id: "pkg_aircon_ready",
    slug: "aircon-ready-pack",
    name: "Aircon Ready Pack",
    tagline: "Cooling again, and a filter that is not choking the evaporator.",
    priceMin: 2400, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    priceMax: 3400,
    compareAtMin: 3400,
    savingsPct: 29,
    badge: null,
    items: [
      { name: "Refrigerant recovery, vacuum and leak test", quantity: 1 },
      { name: "Recharge to the specified weight", quantity: 1 },
      { name: "Cabin / evaporator filter replaced", quantity: 1 },
      { name: "Drive belt and pulley inspection", quantity: 1 },
      { name: "Vent temperature measured and reported", quantity: 1 },
    ],
  },
  {
    id: "pkg_pre_trip_check",
    slug: "pre-trip-check",
    name: "Pre-Trip Check — Bataan Long Drive",
    tagline: "Before you take the car to Manila or Tagaytay. One hour, one written list.",
    priceMin: 1100, // SUGGESTED — REQUIRES OWNER CONFIRMATION
    priceMax: 1500,
    compareAtMin: 1500,
    savingsPct: 27,
    badge: null,
    items: [
      { name: "Full tyre check — pressure, tread, sidewall, balance", quantity: 4 },
      { name: "Brake measurement — pad and disc thickness", quantity: 1 },
      { name: "Battery load test and charging check", quantity: 1 },
      { name: "All fluid levels and condition", quantity: 1 },
      { name: "Belts, hoses and exhaust integrity check", quantity: 1 },
      { name: "Written list: do now, watch it, nothing to worry about", quantity: 1 },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// GALLERY
// ─────────────────────────────────────────────────────────────────────────────

export const GALLERY_CATEGORIES = [
  { slug: "all", name: "All" },
  { slug: "before-after", name: "Before & After" },
  { slug: "tyres", name: "Tyres" },
  { slug: "alignment", name: "Alignment" },
  { slug: "engine-bay", name: "Engine Bay" },
  { slug: "bay-and-team", name: "Bay & Team" },
  { slug: "diagnostics", name: "Diagnostics" },
] as const;

export type GalleryCategorySlug = (typeof GALLERY_CATEGORIES)[number]["slug"];
export type GalleryFilterSlug = Exclude<GalleryCategorySlug, "all">;

export interface GallerySide {
  /** `null` until the owner uploads the photograph. */
  src: string | null;
  /** MANDATORY, descriptive, written for the intended photo. */
  alt: string;
  caption: string;
}

export interface GalleryImage {
  id: string;
  /**
   * Path to the real photograph, or `null` until the owner uploads it.
   * A missing file never reaches the DOM — the UI renders a designed plate at the
   * same aspect ratio instead, so nothing shifts when the photo arrives.
   */
  src: string | null;
  /** MANDATORY, descriptive, written for the intended photo. */
  alt: string;
  caption: string;
  /** Intrinsic size of the real photograph. Used for the `<Image>` width/height. */
  width: number;
  height: number;
  categories: GalleryFilterSlug[];
  /** Present only on comparison pairs. */
  pair?: { before: GallerySide; after: GallerySide };
  /** `true` until the owner's own photograph is uploaded. */
  needsOwnerPhoto: boolean;
}

/**
 * PLACEHOLDER RECORDS — no `src` anywhere, on purpose.
 *
 * The `alt` text is written for the photograph the owner is expected to shoot
 * (see the marketing photo plan), so the swap is: upload the file, set `src`,
 * set `needsOwnerPhoto: false`. Nothing else in the UI changes.
 */
export const LOCAL_GALLERY: readonly GalleryImage[] = [
  {
    id: "gal_aa_alignment",
    src: null,
    alt: "Printout of a wheel-alignment report for a silver sedan, showing front and rear camber, caster and toe before and after adjustment on EYG's alignment rack.",
    caption:
      "Alignment report — front toe corrected after a worn tie-rod end was replaced.",
    width: 1600,
    height: 1200,
    categories: ["before-after", "alignment"],
    needsOwnerPhoto: true,
    pair: {
      before: {
        src: null,
        alt: "Side view of a silver sedan sitting crooked on the alignment rack, front wheels visibly splayed outward before adjustment.",
        caption: "Before — front wheels out of alignment.",
      },
      after: {
        src: null,
        alt: "The same silver sedan on the alignment rack after adjustment, all four wheels sitting square and even.",
        caption: "After — wheels squared, printout attached.",
      },
    },
  },
  {
    id: "gal_aa_tread",
    src: null,
    alt: "Two close-up photographs of the same tyre tread side by side, the first worn almost to the wear bars and the second with full tread depth after replacement.",
    caption: "A tyre that was on its last few millimetres, and its replacement.",
    width: 1600,
    height: 1200,
    categories: ["before-after", "tyres"],
    needsOwnerPhoto: true,
    pair: {
      before: {
        src: null,
        alt: "Close-up of a worn tyre tread with the wear bars nearly flush with the surface, showing a bald strip across the centre.",
        caption: "Before — worn past the point of comfort in the rain.",
      },
      after: {
        src: null,
        alt: "Close-up of a brand new tyre tread with deep, evenly spaced grooves across the full width of the tyre.",
        caption: "After — new tyre, same size, mounted and balanced.",
      },
    },
  },
  {
    id: "gal_aa_brakes",
    src: null,
    alt: "Front brake caliper and disc photographed on a lift, the worn brake pad shown next to its new replacement.",
    caption:
      "Worn pad against the new one. The thickness measurement is written on the job card.",
    width: 1600,
    height: 1200,
    categories: ["before-after", "diagnostics"],
    needsOwnerPhoto: true,
    pair: {
      before: {
        src: null,
        alt: "A removed brake pad held up in a mechanic's gloved hand, its friction material worn down close to the backing plate.",
        caption: "Before — this is the pad that came off.",
      },
      after: {
        src: null,
        alt: "A new brake pad installed in the caliper, friction material at full depth against a clean disc surface.",
        caption: "After — new pad fitted, disc measured and reported.",
      },
    },
  },
  {
    id: "gal_tyre_mount",
    src: null,
    alt: "A tyre being mounted on a steel rim with a tyre-changing machine, the mechanic's gloved hands holding the tyre bead.",
    caption:
      "Tyre change and balance. Every wheel goes on the balancer before it goes on the car.",
    width: 1600,
    height: 1200,
    categories: ["tyres"],
    needsOwnerPhoto: true,
  },
  {
    id: "gal_alignment_rack",
    src: null,
    alt: "A four-wheel alignment rack inside the service bay with sensor heads clamped to all four rims of a hatchback.",
    caption:
      "Four-wheel alignment rack — front and rear, with a printed report for the customer.",
    width: 1600,
    height: 1200,
    categories: ["alignment"],
    needsOwnerPhoto: true,
  },
  {
    id: "gal_engine_bay",
    src: null,
    alt: "A clean engine bay of a common four-cylinder petrol car, oil filter freshly replaced, with the oil filler cap closed.",
    caption:
      "A tidy engine bay after a PMS. We photograph the filter date so the next service is not a guess.",
    width: 1600,
    height: 1200,
    categories: ["engine-bay", "diagnostics"],
    needsOwnerPhoto: true,
  },
  {
    id: "gal_oil_drain",
    src: null,
    alt: "Used engine oil draining from a sump pan into a catch container underneath a raised car.",
    caption: "Draining used oil for proper disposal. We never pour it into the drain.",
    width: 1600,
    height: 1200,
    categories: ["engine-bay"],
    needsOwnerPhoto: true,
  },
  {
    id: "gal_diagnostics",
    src: null,
    alt: "A diagnostic tablet connected to a car's OBD port, showing a live data screen with engine parameters and fault codes.",
    caption: "Fault codes read before parts are ordered — not after the bill is prepared.",
    width: 1600,
    height: 1200,
    categories: ["diagnostics"],
    needsOwnerPhoto: true,
  },
  {
    id: "gal_bay",
    src: null,
    alt: "Interior view of the EYG service bay with the lift lowered, tools on the wall and the tyre rack visible in the background.",
    caption: "The bay. Small, but it has the equipment the work actually needs.",
    width: 1600,
    height: 1200,
    categories: ["bay-and-team"],
    needsOwnerPhoto: true,
  },
  {
    id: "gal_written_report",
    src: null,
    alt: "A printed service checklist on a clipboard resting on the car's front wing, with items ticked off in pen.",
    caption:
      "The written list. It is yours to keep, and it is the honest record of what we found.",
    width: 1600,
    height: 1200,
    categories: ["bay-and-team", "diagnostics"],
    needsOwnerPhoto: true,
  },
  {
    id: "gal_undercoating",
    src: null,
    alt: "The underside of a raised car after undercoating, showing an even anti-rust coating across the floor pan and sills.",
    caption: "Undercoating after application. It is for corrosion protection, not for looks.",
    width: 1600,
    height: 1200,
    categories: ["bay-and-team", "before-after"],
    needsOwnerPhoto: true,
  },
  {
    id: "gal_battery",
    src: null,
    alt: "A car battery being load-tested on a bench tester, the digital display showing the measured result.",
    caption:
      "Battery load test. A voltage reading alone does not tell you whether it will start tomorrow morning.",
    width: 1600,
    height: 1200,
    categories: ["diagnostics"],
    needsOwnerPhoto: true,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ACCESSORS — the only surface the pages are allowed to use
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SWAP POINT -> replace with a Prisma query:
 *   prisma.service.findMany({ where: { isActive: true }, include: { category: true } })
 * and drop the `.map()` that fills in `excluded` if the column lands.
 */
export async function getServices(): Promise<readonly CatalogService[]> {
  return LOCAL_SERVICES;
}

/** SWAP POINT -> `prisma.package.findMany({ where: { isActive: true } })`. */
export async function getPackages(): Promise<readonly PackageDto[]> {
  return LOCAL_PACKAGES;
}

/** SWAP POINT -> `prisma.galleryImage.findMany({ where: { isPublished: true } })`. */
export async function getGalleryImages(): Promise<readonly GalleryImage[]> {
  return LOCAL_GALLERY;
}

export function getServiceBySlug(slug: string): CatalogService | null {
  return LOCAL_SERVICES.find((s) => s.slug === slug) ?? null;
}

export function getPackageBySlug(slug: string): PackageDto | null {
  return LOCAL_PACKAGES.find((p) => p.slug === slug) ?? null;
}

export function getServicesByCategory(categorySlug: string): readonly CatalogService[] {
  return LOCAL_SERVICES.filter((s) => s.category.slug === categorySlug);
}

export function getPopularServices(): readonly CatalogService[] {
  return LOCAL_SERVICES.filter((s) => s.isPopular);
}

export function getServiceDurationMinutes(slug: string): number | null {
  return LOCAL_SERVICES.find((s) => s.slug === slug)?.durationMin ?? null;
}

/** A service is only bookable if it is in the catalogue. Used by `/book`. */
export function isKnownServiceSlug(slug: string): boolean {
  return LOCAL_SERVICES.some((s) => s.slug === slug);
}

/** Compact, non-throwing lookup for a list of slugs (used by the wizard). */
export function pickServices(slugs: readonly string[]): CatalogService[] {
  const out: CatalogService[] = [];
  for (const slug of slugs) {
    const found = LOCAL_SERVICES.find((s) => s.slug === slug);
    if (found) out.push(found);
  }
  return out;
}

/**
 * Sum of the indicative price ranges for a set of services.
 * `isIndicative` is true whenever any leg of the range is missing or uneven —
 * that flag drives the "prices are estimates" note inside `/book`.
 */
export function estimateFor(
  services: readonly Pick<CatalogService, "priceMin" | "priceMax" | "pricing">[],
): { min: number; max: number; isIndicative: boolean } {
  let min = 0;
  let max = 0;
  let isIndicative = false;
  for (const s of services) {
    if (s.pricing === "CALL_FOR_PRICE" || s.priceMin === null) {
      isIndicative = true;
      continue;
    }
    min += s.priceMin;
    max += s.priceMax ?? s.priceMin;
    if ((s.priceMax ?? s.priceMin) !== s.priceMin) isIndicative = true;
  }
  return { min, max, isIndicative };
}

/** Total bay minutes for a set of services (used for the duration estimate). */
export function totalDurationMinutes(
  services: readonly Pick<CatalogService, "durationMin">[],
): number | null {
  if (services.length === 0) return null;
  let total = 0;
  for (const s of services) {
    if (s.durationMin === null) return null;
    total += s.durationMin;
  }
  return total;
}
