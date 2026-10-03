/**
 * EYG TIRE & AUTO CARE — SINGLE SOURCE OF TRUTH FOR BUSINESS FACTS
 * ============================================================================
 * Every page, schema, CTA, map link and SEO tag reads from here.
 * DO NOT hardcode the phone number, address or hours anywhere else in the app.
 *
 * ── PROVENANCE ──────────────────────────────────────────────────────────────
 * Every value is tagged:
 *   [CONFIRMED]   verified against a primary source — see docs/research/facebook-intel.md
 *   [UNVERIFIED]  a placeholder the shop owner must confirm before launch
 *   [CONTRADICTED] sources disagree; claim nothing
 *
 * An `[UNVERIFIED]` phone renders its CTA disabled rather than dialling a dead
 * number. A rating with a zero count renders no stars at all — a fabricated
 * AggregateRating is both a Google manual-action risk and a Consumer Act exposure.
 * ============================================================================
 */

export const BUSINESS = {
  legalName: "EYG Tire & Auto Care",
  shortName: "EYG",
  tagline: "Balanga's tyre & auto care pit stop.",
  descriptor: "Tire & Auto Care",

  // ── Contact ───────────────────────────────────────────────────────────────
  /**
   * [CONFIRMED] The shop's own Facebook hiring post quotes this number with the
   * EGSA Fourlanes address. E.164 format, safe for a `tel:` link.
   */
  phoneE164: "+639627176894",
  /** [CONFIRMED] Same number, PH 3-3-4 grouping (QA DEF-004). */
  phoneDisplay: "+63 962 717 6894",
  /**
   * [CONFIRMED] Second line, from the City of Balanga official business
   * directory (`schema.org` `telephone`), listed against the "EYG Tire Trading"
   * arm: 0998 532 3508. See the two-entity note in docs/research/facebook-intel.md.
   */
  phoneSecondary: "+639985323508" as string | null,
  phoneLandline: null as string | null,
  /** [UNVERIFIED] No public WhatsApp Business number was found. Owner to confirm. */
  whatsappNumber: "639627176894",
  /** [CONFIRMED] The only email address published anywhere. */
  email: "lgguillermo3@gmail.com",
  /** [UNVERIFIED] No domain-based address confirmed. */
  emailSupport: "lgguillermo3@gmail.com",

  // ── Location (NAP — must match Google Business Profile exactly) ───────────
  address: {
    street: "EGSA Fourlanes, Tuyo",
    district: "Balanga City",
    province: "Bataan",
    region: "Region III (Central Luzon)",
    postalCode: "2100",
    country: "PH",
    countryName: "Philippines",
    /** [CONFIRMED] from the official Facebook page. */
    landmark:
      "Right along the EGSA Fourlanes expressway stretch in Tuyo, Balanga City — easy to spot from the main road.",
    /** [UNVERIFIED] Approximate — Balanga City centre is 14.676, 120.511. */
    lat: 14.6761,
    lng: 120.5112,
    /** [UNVERIFIED] */
    plusCode: "",
  },

  // ── Social ───────────────────────────────────────────────────────────────
  social: {
    /** [CONFIRMED] */
    facebook: "https://www.facebook.com/people/EYG-Tire-Auto-Care/61582418828014/",
    /** [CONFIRMED] */
    facebookShort: "https://www.facebook.com/p/EYG-Tire-Auto-Care-61582418828014",
    instagram: null as string | null,
    tiktok: null as string | null,
    /** [UNVERIFIED] Google Business Profile not yet claimed. */
    googleBusiness: null as string | null,
    /**
     * [CONFIRMED usable] Facebook serves Messenger threads for a numeric page id
     * via `m.me/<id>`, so this needs no username guess.
     */
    messenger: "https://m.me/61582418828014",
  },

  // ── Trust / proof ────────────────────────────────────────────────────────
  /**
   * Every field here is a claim a customer, Google or a regulator can hold us to.
   * `ratingCount: 0` is deliberate and must stay 0 until real reviews exist —
   * `Rating` / `SocialProof` / `localBusinessJsonLd` render nothing at count 0.
   */
  trust: {
    /** [UNVERIFIED] No workmanship warranty has been agreed. Rendered as policy
      /**
       * [UNVERIFIED] The OWNER's own warranty policy is not agreed yet, so this
       *  is 0 — which means "not yet decided", NOT "no warranty".
       *
       * [STATUTORY — NOT A BUSINESS CHOICE] RA 7394 (Consumer Act) Article 71:
       * "Service firms shall guarantee workmanship and replacement of spare
       *  parts for a period not less than ninety (90) days which shall be
       *  indicated in the pertinent invoices."
       *
       * CONSEQUENCE: a 0 must never be rendered on a customer surface as a
       * warranty of zero. The statutory floor is
       * `STATUTORY_WORKMANSHIP_GUARANTEE_DAYS` and applies whatever the owner
       * chooses to offer above it. Confirmed against the statute text by the
       * research agent; still TODO-VERIFY whether the shop's invoices carry it.
       */
      workmanshipGuaranteeDays: 0,
    /** [UNVERIFIED] Never published until real, collected reviews exist. */
    ratingValue: 0,
    ratingCount: 0,
    /** [CONTRADICTED] Four years circulate (2021, and three variants of 2025). Claim none. */
    yearsServing: 0,
    bays: 0,
    technicians: 0,
  },

  /**
   * [CONFIRMED] EYG is listed as a retailer on michelin.com.ph and
   * bfgoodrich.com.ph — the only two brands with any evidence, so the only two
   * claimed. Owner action item: both locators currently file EYG under *Batangas*
   * with Batangas coordinates ~130 km away and omit it from the Bataan index.
   */
  tireBrands: ["Michelin", "BFGoodrich"],

  /**
   * [UNVERIFIED] No payment method is stated anywhere public. Deliberately empty
   * so the site prints nothing rather than guessing. Owner must fill this in.
   */
  paymentMethods: [] as ReadonlyArray<{ id: string; label: string; icon: string }>,

  /** [CONTRADICTED] Four candidate years exist; claim none. */
  foundedYear: 0,

  /**
   * [CONFIRMED] The service list published on the official Facebook page,
   * verbatim. The catalogue may widen this, but must never contradict it.
   */
  confirmedServices: [
    "Preventive Maintenance Service",
    "Change Oil",
    "Brake Cleaning and Maintenance",
    "Underchassis Maintenance and Repair",
    "Wheel Alignment and Camber Correction",
    "Wheel Balancing",
    "Tire Mounting and Repair",
    "Nitrogen Tire Inflation",
    "Battery Replacement",
    "OBD Scanning and Resetting",
  ],

  /**
   * [UNVERIFIED — HIGH RISK] There is no evidence the shop operates a 24/7
   * roadside or towing service. The site's emergency lane must not promise one.
   * The shipped copy is the honest version: call during shop hours, and the shop
   * will say straight if it cannot help.
   */
  roadsideAssured: false,
} as const;

/**
 * True when a phone value is still a placeholder.
 * Repeated-digit national numbers (+639000000000, +639999999999 …) are the shape
 * a placeholder always takes, so they can be detected generically.
 */
export function isUnverifiedPhone(phone: string | null | undefined): boolean {
  if (!phone) return true;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return true;
  // Ten or more identical trailing digits.
  return /(\d)\1{9,}$/.test(digits);
}

export const CONTACT_VERIFIED = !isUnverifiedPhone(BUSINESS.phoneE164);
export const WHATSAPP_VERIFIED = !isUnverifiedPhone(BUSINESS.whatsappNumber);
/** A rating may only be published once a non-zero count stands behind it. */
export const RATING_CLAIMABLE = BUSINESS.trust.ratingCount > 0 && BUSINESS.trust.ratingValue > 0;
/**
 * RA 7394 Article 71 — the statutory floor for a Philippine service firm's
 * workmanship guarantee, which must be indicated on the invoice.
 *
 * This is LAW, not a marketing decision, and it applies whether or not the owner
 * has agreed a policy of their own. Keep it separate from
 * `BUSINESS.trust.workmanshipGuaranteeDays` so that "the owner has not decided"
 * (0) can never be mistaken for "this shop offers no warranty".
 *
 * Verified by the research agent against the full text of RA 7394. Still
 * TO-VERIFY with the owner whether the shop's actual invoices carry it.
 */
export const STATUTORY_WORKMANSHIP_GUARANTEE_DAYS = 90;

export const WARRANTY_CLAIMABLE = BUSINESS.trust.workmanshipGuaranteeDays > 0;
export const TIRE_BRANDS_CLAIMABLE = BUSINESS.tireBrands.length > 0;

// ── Business hours ─────────────────────────────────────────────────────────
/** [CONFIRMED] Mon–Sat 08:00–17:00, Sunday closed — verified in the page's own
 *  post footer and corroborated on the tyre-brand locator. */
export const BUSINESS_HOURS: ReadonlyArray<{
  day: number;
  label: string;
  opens: number;
  closes: number;
  closed?: boolean;
}> = [
  { day: 0, label: "Sunday", opens: 8 * 60, closes: 17 * 60, closed: true },
  { day: 1, label: "Monday", opens: 8 * 60, closes: 17 * 60 },
  { day: 2, label: "Tuesday", opens: 8 * 60, closes: 17 * 60 },
  { day: 3, label: "Wednesday", opens: 8 * 60, closes: 17 * 60 },
  { day: 4, label: "Thursday", opens: 8 * 60, closes: 17 * 60 },
  { day: 5, label: "Friday", opens: 8 * 60, closes: 17 * 60 },
  { day: 6, label: "Saturday", opens: 8 * 60, closes: 17 * 60 },
];

export const TIMEZONE = "Asia/Manila";
export const LOCALE = "en-PH";
export const CURRENCY = "PHP";

/** Booking slot configuration. */
export const BOOKING = {
  slotMinutes: 60,
  /** How far ahead a customer may book. */
  horizonDays: 60,
  /** Minimum lead time before the next slot. */
  minLeadMinutes: 90,
  /** [UNVERIFIED] Number of service bays. This single number parameterises the
   *  entire slot-race invariant, so the owner must confirm it before launch. */
  capacityPerSlot: 1,
  /** Slots not offered (lunch). */
  breakWindows: [{ start: 12 * 60, end: 13 * 60 }],
  holdMinutes: 10,
  maxServicesPerBooking: 8,
  referencePrefix: "EYG-",
} as const;

// ── URL helpers ────────────────────────────────────────────────────────────
/** Single-line, human-readable address used for every map query. */
export const ADDRESS_ONE_LINE = `${BUSINESS.address.street}, ${BUSINESS.address.district}, ${BUSINESS.address.province} ${BUSINESS.address.postalCode}`;

const mapDirections = (mode: "driving" | "walking") =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ADDRESS_ONE_LINE)}&travelmode=${mode}`;

export const LINKS = {
  call: `tel:${BUSINESS.phoneE164}`,
  callSecondary: BUSINESS.phoneSecondary ? `tel:${BUSINESS.phoneSecondary}` : null,
  whatsapp: `https://wa.me/${BUSINESS.whatsappNumber}?text=${encodeURIComponent(
    "Hi EYG Tire & Auto Care! I'd like to ask about a service.",
  )}`,
  messenger: BUSINESS.social.messenger,
  email: `mailto:${BUSINESS.email}`,
  directionsGoogle: mapDirections("driving"),
  directionsWaze: `https://waze.com/ul?q=${encodeURIComponent(ADDRESS_ONE_LINE)}`,
  mapsSearch: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS_ONE_LINE)}`,
  mapsEmbed: `https://www.google.com/maps?q=${encodeURIComponent(ADDRESS_ONE_LINE)}&hl=en&z=16&output=embed`,
} as const;

export const SITE = {
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://eygtireautocare.ph",
  locale: LOCALE,
  /** [UNVERIFIED] No X/Twitter account found. */
  twitter: null as string | null,
  themeColorLight: "#ffffff",
  themeColorDark: "#06060a",
  brandYellow: "#FCC605",
  ink: "#06060A",
} as const;