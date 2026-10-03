/**
 * PRISMA SEED — idempotent. `npm run db:seed` (i.e. `tsx prisma/seed.ts`)
 * ============================================================================
 * Safe to run repeatedly: every write is an `upsert` on a natural key
 * (`slug`, `email`, `code`, `reference`) or a `deleteMany` + re-insert of a set
 * that this file owns entirely. Running it twice changes nothing the second
 * time.
 *
 * ── WHERE THE DATA COMES FROM ────────────────────────────────────────────────
 * This file does NOT duplicate the catalogue. It imports the marketing agent's
 * content modules, which are already the single source of truth:
 *
 *   `src/content/catalog.ts`             categories + ~34 services
 *   `src/content/marketing/packages.ts`  bundles, with per-item service slugs
 *   `src/content/marketing/promotions.ts` promos + claimable codes
 *   `src/content/marketing/faq.ts`        FAQ rows
 *   `src/content/marketing/reviews.ts`    testimonial placeholders
 *
 * ── ⚠️  PRICES ARE OWNER-UNCONFIRMED ─────────────────────────────────────────
 * Every peso figure in `src/content/catalog.ts` is flagged inline as
 * "SUGGESTED — REQUIRES OWNER CONFIRMATION". Seeding does not confirm anything;
 * it makes the numbers visible so the owner can correct them in `/admin`. The
 * public UI carries the same caveat (`CATALOG_PRICING_NOTICE`).
 *
 * ── ⚠️  TESTIMONIALS ARE PLACEHOLDERS ────────────────────────────────────────
 * `TESTIMONIALS` contains `QUOTE_SENTINEL` in every quote and every row has
 * `isPublished: false`. They are seeded so the layout has realistic shapes to
 * render. **They must never be published.** The marketing agent's
 * `containsPlaceholderTestimonials()` asserts this.
 *
 * ── ENV SWITCHES ────────────────────────────────────────────────────────────
 *   ADMIN_EMAIL / ADMIN_PASSWORD   the seeded OWNER. Without ADMIN_PASSWORD the
 *                                  seed generates one and PRINTS it in
 *                                  development — and REFUSES in production.
 *   SEED_HOLIDAYS=true             also seed the 2027 Philippine holiday list.
 *                                  Off by default: a wrong holiday closes a bay.
 *   SEED_SAMPLE_BOOKINGS=false     skip the demo bookings spread over 14 days.
 */
import { randomBytes } from "node:crypto";

import type { Prisma} from "@prisma/client";
import { PrismaClient, type BookingStatus, type PromoKind } from "@prisma/client";
import argon2 from "argon2";

import { BUSINESS, BUSINESS_HOURS, BOOKING } from "../src/config/site";
import { LOCAL_SERVICES, SERVICE_CATEGORIES } from "../src/content/catalog";
import { FAQS } from "../src/content/marketing/faq";
import { PACKAGES } from "../src/content/marketing/packages";
import { PROMOTIONS } from "../src/content/marketing/promotions";
import { TESTIMONIALS } from "../src/content/marketing/reviews";

const prisma = new PrismaClient();

const log = (msg: string): void => {
  process.stdout.write(`  ${msg}\n`);
};
const step = (msg: string): void => {
  process.stdout.write(`\n▸ ${msg}\n`);
};

/** Reads an env var without importing `env.ts` (which requires full config). */
function readEnv(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Business hours
// ─────────────────────────────────────────────────────────────────────────────

async function seedBusinessHours(): Promise<void> {
  step("Business hours");
  // This table is entirely owned by this seed: replace, never merge, so a deleted
  // day in `site.ts` cannot leave an orphan row behind.
  await prisma.businessHours.deleteMany();
  await prisma.businessHours.createMany({
    data: BUSINESS_HOURS.map((h) => ({
      dayOfWeek: h.day,
      opensAt: hhmm(h.opens),
      closesAt: hhmm(h.closes),
      isClosed: h.closed === true,
      label: h.label,
    })),
  });
  const open = BUSINESS_HOURS.filter((h) => !h.closed).length;
  log(`${open} open days, ${BUSINESS_HOURS.length - open} closed. Sundays are closed in BUSINESS_HOURS.`);
}

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue
// ─────────────────────────────────────────────────────────────────────────────

async function seedCategories(): Promise<Map<string, string>> {
  step("Service categories");
  const ids = new Map<string, string>();
  for (const [index, cat] of SERVICE_CATEGORIES.entries()) {
    const row = await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      create: {
        slug: cat.slug,
        name: cat.name,
        blurb: cat.blurb,
        icon: cat.icon,
        sortOrder: index * 10,
        isActive: true,
      },
      update: {
        name: cat.name,
        blurb: cat.blurb,
        icon: cat.icon,
        sortOrder: index * 10,
        isActive: true,
      },
      select: { id: true },
    });
    ids.set(cat.slug, row.id);
  }
  log(`${SERVICE_CATEGORIES.length} categories upserted.`);
  return ids;
}

async function seedServices(categoryIds: Map<string, string>): Promise<Map<string, string>> {
  step("Services");
  const ids = new Map<string, string>();
  for (const [index, svc] of LOCAL_SERVICES.entries()) {
    const categoryId = categoryIds.get(svc.category.slug);
    if (!categoryId) {
      log(`! skipped "${svc.slug}" — unknown category "${svc.category.slug}"`);
      continue;
    }
    const isCallForPrice = svc.pricing === "CALL_FOR_PRICE";
    const row = await prisma.service.upsert({
      where: { slug: svc.slug },
      create: {
        categoryId,
        slug: svc.slug,
        name: svc.name,
        shortName: svc.shortName,
        summary: svc.summary,
        // `ServiceDto` has no long description; the summary is the honest
        // source. `includes`/`excluded` carry the detail.
        description: svc.summary,
        pricing: svc.pricing,
        priceMin: isCallForPrice ? null : svc.priceMin,
        priceMax: isCallForPrice ? null : svc.priceMax,
        priceNote: svc.priceNote,
        durationMin: svc.durationMin,
        isPopular: svc.isPopular,
        isFeatured: svc.isFeatured,
        requiresVehicle: false,
        includes: svc.includes,
        excludes: svc.excluded,
        sortOrder: index * 5,
        isActive: true,
      },
      update: {
        categoryId,
        name: svc.name,
        shortName: svc.shortName,
        summary: svc.summary,
        description: svc.summary,
        pricing: svc.pricing,
        priceMin: isCallForPrice ? null : svc.priceMin,
        priceMax: isCallForPrice ? null : svc.priceMax,
        priceNote: svc.priceNote,
        durationMin: svc.durationMin,
        isPopular: svc.isPopular,
        isFeatured: svc.isFeatured,
        includes: svc.includes,
        excludes: svc.excluded,
        sortOrder: index * 5,
        isActive: true,
      },
      select: { id: true },
    });
    ids.set(svc.slug, row.id);
  }
  const callForPrice = LOCAL_SERVICES.filter((s) => s.pricing === "CALL_FOR_PRICE").length;
  log(`${LOCAL_SERVICES.length} services upserted (${callForPrice} call-for-price).`);
  log("⚠ prices are OWNER-UNCONFIRMED — correct them in /admin before launch.");
  return ids;
}

async function seedPackages(serviceIds: Map<string, string>): Promise<void> {
  step("Packages");
  const categoryIds = new Map<string, string>();
  for (const c of await prisma.serviceCategory.findMany({ select: { id: true, slug: true } })) {
    categoryIds.set(c.slug, c.id);
  }

  for (const [index, pkg] of PACKAGES.entries()) {
    const categoryId = pkg.categorySlug ? (categoryIds.get(pkg.categorySlug) ?? null) : null;
    await prisma.package.upsert({
      where: { slug: pkg.slug },
      create: {
        categoryId,
        slug: pkg.slug,
        name: pkg.name,
        tagline: pkg.tagline,
        description: pkg.description,
        priceMin: pkg.priceMin,
        priceMax: pkg.priceMax,
        compareAtMin: pkg.compareAtMin,
        savingsPct: pkg.savingsPct,
        badge: pkg.badge,
        isSeasonal: pkg.isSeasonal,
        seasonKey: pkg.seasonKey,
        validFrom: pkg.validFrom ? new Date(pkg.validFrom) : null,
        validUntil: pkg.validUntil ? new Date(pkg.validUntil) : null,
        isFeatured: pkg.isFeatured,
        isActive: true,
        sortOrder: index * 5,
      },
      update: {
        categoryId,
        name: pkg.name,
        tagline: pkg.tagline,
        description: pkg.description,
        priceMin: pkg.priceMin,
        priceMax: pkg.priceMax,
        compareAtMin: pkg.compareAtMin,
        savingsPct: pkg.savingsPct,
        badge: pkg.badge,
        isSeasonal: pkg.isSeasonal,
        seasonKey: pkg.seasonKey,
        validFrom: pkg.validFrom ? new Date(pkg.validFrom) : null,
        validUntil: pkg.validUntil ? new Date(pkg.validUntil) : null,
        isFeatured: pkg.isFeatured,
        isActive: true,
        sortOrder: index * 5,
      },
      select: { id: true },
    });

    // PackageItems are rewritten wholesale: this seed owns the bundle contents.
    await prisma.packageItem.deleteMany({ where: { packageId: (await prisma.package.findUniqueOrThrow({ where: { slug: pkg.slug }, select: { id: true } })).id } });
    const resolved = pkg.items
      .map((item) => ({ serviceSlug: item.serviceSlug, serviceId: serviceIds.get(item.serviceSlug), quantity: item.quantity }))
      .filter((i): i is { serviceSlug: string; serviceId: string; quantity: number } => Boolean(i.serviceId));
    const packageId = (await prisma.package.findUniqueOrThrow({ where: { slug: pkg.slug }, select: { id: true } })).id;
    if (resolved.length > 0) {
      await prisma.packageItem.createMany({ data: resolved.map((i) => ({ packageId, serviceId: i.serviceId, quantity: i.quantity })) });
    }
    const missing = pkg.items.length - resolved.length;
    if (missing > 0) log(`! "${pkg.slug}" is missing ${missing} service(s) from the catalogue seed.`);
  }
  log(`${PACKAGES.length} packages upserted.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tyre brands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TODO-VERIFY: `site.ts` lists these six brands as "sold", explicitly NOT as
 * authorised distributors. `isPartner` is `false` for every row so nothing on the
 * site can imply an authorisation that has not been confirmed.
 */
const TIRE_BRANDS: ReadonlyArray<{ slug: string; name: string; tier: string; website: string }> = [
  { slug: "michelin", name: "Michelin", tier: "Premium", website: "https://www.michelin.com.ph" },
  { slug: "bridgestone", name: "Bridgestone", tier: "Premium", website: "https://www.bridgestone.com.ph" },
  { slug: "goodyear", name: "Goodyear", tier: "Premium", website: "https://www.goodyear.com.ph" },
  { slug: "dunlop", name: "Dunlop", tier: "Mid", website: "https://www.dunlop.com.ph" },
  { slug: "maxxis", name: "Maxxis", tier: "Value", website: "https://www.maxxis.com" },
  { slug: "yokohama", name: "Yokohama", tier: "Premium", website: "https://www.yokohama.com.ph" },
];

async function seedTyreBrands(): Promise<void> {
  step("Tyre brands");
  for (const [index, brand] of TIRE_BRANDS.entries()) {
    await prisma.tireBrand.upsert({
      where: { slug: brand.slug },
      create: { slug: brand.slug, name: brand.name, tier: brand.tier, isPartner: false, website: brand.website, sortOrder: index * 10 },
      update: { name: brand.name, tier: brand.tier, website: brand.website, sortOrder: index * 10 },
    });
  }
  log(`${TIRE_BRANDS.length} brands upserted (isPartner: false — no authorisation is implied).`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Promotions
// ─────────────────────────────────────────────────────────────────────────────

async function seedPromotions(): Promise<void> {
  step("Promotions");
  for (const promo of PROMOTIONS) {
    await prisma.promotion.upsert({
      where: { slug: promo.slug },
      create: {
        slug: promo.slug,
        title: promo.title,
        subtitle: promo.subtitle,
        description: promo.description,
        kind: promo.kind as PromoKind,
        badge: promo.badge,
        code: promo.code,
        valuePct: promo.valuePct,
        valueOff: promo.valueOff,
        terms: promo.terms,
        imageUrl: promo.imageUrl,
        isActive: promo.isActive,
        startsAt: promo.startsAt ? new Date(promo.startsAt) : null,
        endsAt: promo.endsAt ? new Date(promo.endsAt) : null,
        priority: promo.priority,
      },
      update: {
        title: promo.title,
        subtitle: promo.subtitle,
        description: promo.description,
        kind: promo.kind as PromoKind,
        badge: promo.badge,
        code: promo.code,
        valuePct: promo.valuePct,
        valueOff: promo.valueOff,
        terms: promo.terms,
        imageUrl: promo.imageUrl,
        isActive: promo.isActive,
        startsAt: promo.startsAt ? new Date(promo.startsAt) : null,
        endsAt: promo.endsAt ? new Date(promo.endsAt) : null,
        priority: promo.priority,
      },
    });
  }
  const withCode = PROMOTIONS.filter((p) => p.code).length;
  log(`${PROMOTIONS.length} promotions upserted (${withCode} claimable codes).`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────────

async function seedFaqs(): Promise<void> {
  step("FAQs");
  await prisma.faq.deleteMany();
  await prisma.faq.createMany({
    data: FAQS.map((f) => ({
      question: f.question,
      answer: f.answer,
      category: f.category,
      sortOrder: f.sortOrder,
      isPublished: f.isPublished,
    })),
  });
  log(`${FAQS.length} FAQs inserted (rows this seed owns; re-running replaces them).`);
}

async function seedTestimonials(): Promise<void> {
  step("Testimonials");
  await prisma.testimonial.deleteMany();
  await prisma.testimonial.createMany({
    data: TESTIMONIALS.map((t) => ({
      name: t.name,
      vehicle: t.vehicle,
      quote: t.quote,
      rating: t.rating,
      isPublished: t.isPublished,
      sortOrder: t.sortOrder,
    })),
  });
  const published = TESTIMONIALS.filter((t) => t.isPublished).length;
  log(`${TESTIMONIALS.length} PLACEHOLDER testimonials inserted, ${published} published.`);
  log("⚠ every quote contains QUOTE_SENTINEL. Replace with real consented reviews before launch.");
}

async function seedSettings(): Promise<void> {
  step("Settings");
  const settings: Array<{ key: string; value: Prisma.InputJsonValue; updatedBy: string }> = [
    { key: "bayCount", value: BOOKING.capacityPerSlot, updatedBy: "seed" },
    { key: "slotMinutes", value: BOOKING.slotMinutes, updatedBy: "seed" },
    { key: "minLeadMinutes", value: BOOKING.minLeadMinutes, updatedBy: "seed" },
    { key: "horizonDays", value: BOOKING.horizonDays, updatedBy: "seed" },
    { key: "referencePrefix", value: BOOKING.referencePrefix, updatedBy: "seed" },
    {
      key: "pricingNotice",
      // Rendered verbatim under every price. Must stay a hedge, never a promise.
      value:
        "Every peso figure on this site is an estimate. The final price is confirmed with you after the technician inspects the vehicle, before any work starts.",
      updatedBy: "seed",
    },
    { key: "businessName", value: BUSINESS.legalName, updatedBy: "seed" },
    { key: "timezone", value: "Asia/Manila", updatedBy: "seed" },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, create: s, update: { value: s.value, updatedBy: s.updatedBy } });
  }
  log(`${settings.length} settings upserted.`);
}

/** Opt-in: 2027 Philippine non-working days. Off by default. */
const HOLIDAYS_2027: ReadonlyArray<{ name: string; date: string; note: string }> = [
  { name: "New Year's Day", date: "2027-01-01", note: "Regular holiday." },
  { name: "Maundy Thursday", date: "2027-04-01", note: "Maundy Thursday." },
  { name: "Good Friday", date: "2027-04-02", note: "Good Friday." },
  { name: "Araw ng Kagitingan", date: "2027-04-09", note: "Araw ng Kagitingan." },
  { name: "Labor Day", date: "2027-05-01", note: "Labor Day." },
  { name: "Independence Day", date: "2027-06-12", note: "Independence Day." },
  { name: "National Heroes Day", date: "2027-08-30", note: "National Heroes Day (last Monday of August)." },
  { name: "Bonifacio Day", date: "2027-11-30", note: "Bonifacio Day." },
  { name: "Christmas Day", date: "2027-12-25", note: "Regular holiday." },
  { name: "Rizal Day", date: "2027-12-30", note: "Rizal Day." },
  { name: "New Year's Eve", date: "2027-12-31", note: "Optional — confirm with the owner." },
];

async function seedHolidays(): Promise<void> {
  if (readEnv("SEED_HOLIDAYS") !== "true") {
    step("Holidays");
    log("skipped (set SEED_HOLIDAYS=true to insert the 2027 list).");
    return;
  }
  step("Holidays (SEED_HOLIDAYS=true)");
  for (const h of HOLIDAYS_2027) {
    await prisma.holiday.upsert({
      where: { id: `holiday_${h.date}` },
      create: { id: `holiday_${h.date}`, name: h.name, date: new Date(`${h.date}T00:00:00.000Z`), isClosed: true, note: h.note },
      update: { name: h.name, isClosed: true, note: h.note },
    });
  }
  log(`${HOLIDAYS_2027.length} holidays upserted.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin user
// ─────────────────────────────────────────────────────────────────────────────

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
} as const;

const FALLBACK_ADMIN_EMAIL = "admin@eygtireautocare.local";

/**
 * Resolves the admin credentials.
 *
 * Refuses to invent a password in production: a known default on a live shop's
 * admin panel is how you get a stranger reading customer phone numbers. In
 * development a random password is generated and printed once, because a
 * developer should not have to hand-edit `.env.local` to look at `/admin`.
 */
async function resolveAdminPassword(): Promise<{ email: string; password: string; generated: boolean }> {
  const email = (readEnv("ADMIN_EMAIL") ?? FALLBACK_ADMIN_EMAIL).toLowerCase();
  const fromEnv = readEnv("ADMIN_PASSWORD");

  if (fromEnv) {
    if (fromEnv.length < 12) {
      throw new Error("ADMIN_PASSWORD must be at least 12 characters. Refusing to seed a weak admin password.");
    }
    return { email, password: fromEnv, generated: false };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      [
        "ADMIN_PASSWORD is not set and NODE_ENV=production.",
        "Refusing to seed an admin account with a default or generated password.",
        "Generate one with:  openssl rand -base64 24",
        "Then add to your environment:",
        "  ADMIN_EMAIL=owner@yourdomain.ph",
        "  ADMIN_PASSWORD=<the generated value>",
      ].join("\n"),
    );
  }

  const password = `eyg-${randomBytes(12).toString("base64url")}`;
  return { email, password, generated: true };
}

async function seedAdminUser(): Promise<void> {
  step("Admin user");
  const { email, password, generated } = await resolveAdminPassword();
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: "Shop Owner", passwordHash, role: "OWNER", isActive: true },
    // The hash is only rewritten when the seeded password is generated, so a
    // re-run cannot lock the owner out by re-hashing an existing password.
    update: generated ? { passwordHash, role: "OWNER", isActive: true } : { role: "OWNER" },
    select: { email: true, role: true },
  });

  log(`OWNER: ${user.email}`);
  if (generated) {
    log("");
    log("  ┌───────────────────────────────────────────────────────────┐");
    log("  │  Generated development password — shown ONCE. Copy it now.│");
    log("  ├───────────────────────────────────────────────────────────┤");
    log(`  │  ${password.padEnd(57)}│`);
    log("  └───────────────────────────────────────────────────────────┘");
    log(`  Sign in at /admin/login with ${email}`);
    log("");
  } else {
    log("password taken from ADMIN_PASSWORD (unchanged).");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sample bookings
// ─────────────────────────────────────────────────────────────────────────────

const PH_OFFSET_MINUTES = 8 * 60;

/** Local `YYYY-MM-DD` + minutes-from-midnight → a UTC `Date`. */
function manilaInstant(dateKey: string, minutes: number): Date {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) + (minutes - PH_OFFSET_MINUTES) * 60_000);
}

function localDateKey(instant: Date): string {
  const shifted = new Date(instant.getTime() + PH_OFFSET_MINUTES * 60_000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

interface DemoBooking {
  reference: string;
  name: string;
  phone: string;
  email: string | null;
  dayOffset: number;
  /** Minutes from local midnight. */
  minutes: number;
  serviceSlugs: string[];
  status: BookingStatus;
  channel: "WEB" | "PHONE" | "WALK_IN" | "MESSENGER" | "WHATSAPP";
  vehicle: { year: number; make: string; model: string; variant?: string; plate?: string };
  notes?: string;
}

/**
 * Deterministic demo data spread across the next 14 days, so `/admin` has
 * something to look at on a fresh database and QA can exercise the board.
 *
 * ⚠ These are FICTIONAL customers. They exist only in a development or test
 * database. The phone numbers are in the reserved `+6391700…` test block and must
 * never be exported anywhere.
 */
const DEMO_BOOKINGS: readonly DemoBooking[] = [
  { reference: "EYG-DEMO1", name: "Demo One", phone: "+639170000001", email: "demo1@example.test", dayOffset: 1, minutes: 9 * 60, serviceSlugs: ["tire-change", "wheel-alignment"], status: "CONFIRMED", channel: "WEB", vehicle: { year: 2019, make: "Toyota", model: "Vios", plate: "ABC 123" } },
  { reference: "EYG-DEMO2", name: "Demo Two", phone: "+639170000002", email: null, dayOffset: 1, minutes: 11 * 60, serviceSlugs: ["change-oil"], status: "PENDING", channel: "PHONE", vehicle: { year: 2015, make: "Honda", model: "City", plate: "DEF 456" }, notes: "Also asked about the brakes making a noise when turning." },
  { reference: "EYG-DEMO3", name: "Demo Three", phone: "+639170000003", email: "demo3@example.test", dayOffset: 2, minutes: 10 * 60, serviceSlugs: ["brake-pad-replacement"], status: "CHECKED_IN", channel: "MESSENGER", vehicle: { year: 2021, make: "Mitsubishi", model: "Xpander", variant: "GLS", plate: "GHI 789" } },
  { reference: "EYG-DEMO4", name: "Demo Four", phone: "+639170000004", email: null, dayOffset: 3, minutes: 13 * 60, serviceSlugs: ["ac-regas"], status: "COMPLETED", channel: "WALK_IN", vehicle: { year: 2017, make: "Ford", model: "Ranger", plate: "JKL 012" } },
  { reference: "EYG-DEMO5", name: "Demo Five", phone: "+639170000005", email: "demo5@example.test", dayOffset: 4, minutes: 8 * 60, serviceSlugs: ["battery-replacement"], status: "CONFIRMED", channel: "WHATSAPP", vehicle: { year: 2013, make: "Suzuki", model: "Ertiga", plate: "MNO 345" } },
  { reference: "EYG-DEMO6", name: "Demo Six", phone: "+639170000006", email: null, dayOffset: 6, minutes: 14 * 60, serviceSlugs: ["undercoating"], status: "PENDING", channel: "WEB", vehicle: { year: 2020, make: "Nissan", model: "Navara", plate: "PQR 678" }, notes: "Truck. Please quote the extra for the bed." },
  { reference: "EYG-DEMO7", name: "Demo Seven", phone: "+639170000007", email: "demo7@example.test", dayOffset: 8, minutes: 9 * 60, serviceSlugs: ["change-oil", "tire-rotation"], status: "CANCELLED", channel: "PHONE", vehicle: { year: 2018, make: "Mazda", model: "CX-5", plate: "STU 901" }, notes: "Cancelled — customer had to go out of town." },
  { reference: "EYG-DEMO8", name: "Demo Eight", phone: "+639170000008", email: null, dayOffset: 11, minutes: 15 * 60, serviceSlugs: ["engine-tune-up"], status: "CONFIRMED", channel: "WEB", vehicle: { year: 2012, make: "Hyundai", model: "Accent", plate: "VWX 234" } },
];

async function seedSampleBookings(): Promise<void> {
  step("Sample bookings");
  if (readEnv("SEED_SAMPLE_BOOKINGS") === "false") {
    log("skipped (SEED_SAMPLE_BOOKINGS=false).");
    return;
  }
  if (process.env.NODE_ENV === "production") {
    log("skipped (never seeded into production).");
    return;
  }

  const serviceIds = new Map<string, { id: string; name: string; priceMin: number | null; priceMax: number | null }>();
  for (const s of await prisma.service.findMany({ select: { id: true, slug: true, name: true, priceMin: true, priceMax: true } })) {
    serviceIds.set(s.slug, s);
  }

  const todayKey = localDateKey(new Date());
  let created = 0;

  for (const demo of DEMO_BOOKINGS) {
    const rows = demo.serviceSlugs
      .map((slug) => serviceIds.get(slug))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    if (rows.length === 0) {
      log(`! ${demo.reference}: services not in the catalogue, skipped.`);
      continue;
    }

    const [y, m, d] = todayKey.split("-").map(Number) as [number, number, number];
    const dateKey = localDateKey(new Date(Date.UTC(y, m - 1, d + demo.dayOffset)));
    const startAt = manilaInstant(dateKey, demo.minutes);
    const endAt = new Date(startAt.getTime() + BOOKING.slotMinutes * 60_000);

    const subtotalMin = rows.reduce((sum, s) => sum + (s.priceMin ?? 0), 0);
    const anyVariable = rows.some((s) => s.priceMin === null);
    const subtotalMax = anyVariable ? null : rows.reduce((sum, s) => sum + (s.priceMax ?? s.priceMin ?? 0), 0);

    const existing = await prisma.booking.findUnique({ where: { reference: demo.reference }, select: { id: true } });
    if (existing) continue;

    // Customer is upserted by phone first, because `Vehicle` belongs to a
    // customer and `Booking.vehicle` is a one-to-one onto it.
    const customer = await prisma.customer.upsert({
      where: { phone: demo.phone },
      create: { name: demo.name, phone: demo.phone, email: demo.email },
      update: {},
      select: { id: true },
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        customerId: customer.id,
        year: demo.vehicle.year,
        make: demo.vehicle.make,
        model: demo.vehicle.model,
        variant: demo.vehicle.variant ?? null,
        plate: demo.vehicle.plate ?? null,
      },
      select: { id: true },
    });

    await prisma.booking.create({
      data: {
        reference: demo.reference,
        vehicleId: vehicle.id,
        customerId: customer.id,
        channel: demo.channel,
        customerName: demo.name,
        customerPhone: demo.phone,
        customerEmail: demo.email,
        startAt,
        endAt,
        status: demo.status,
        serviceNotes: demo.notes ?? null,
        subtotalMin,
        subtotalMax,
        consentSms: true,
        consentMarketing: false,
        source: "seed",
        confirmedAt: demo.status === "PENDING" ? null : new Date(),
        cancelledAt: demo.status === "CANCELLED" ? new Date() : null,
        cancelReason: demo.status === "CANCELLED" ? (demo.notes ?? null) : null,
        items: { create: rows.map((s) => ({ serviceId: s.id, name: s.name, quantity: 1, priceMin: s.priceMin, priceMax: s.priceMax })) },
        history: {
          create: {
            from: null,
            to: "PENDING",
            actor: "seed",
            note: "Demo booking created by prisma/seed.ts",
          },
        },
      },
    });
    created += 1;
  }

  log(`${created} of ${DEMO_BOOKINGS.length} demo bookings inserted (existing references skipped).`);
  log("⚠ fictional customers in the +6391700 test block. Development only.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  process.stdout.write("════════════════════════════════════════════════════════════\n");
  process.stdout.write(" EYG Tire & Auto Care — database seed\n");
  process.stdout.write("════════════════════════════════════════════════════════════\n");

  await seedBusinessHours();
  const categoryIds = await seedCategories();
  const serviceIds = await seedServices(categoryIds);
  await seedPackages(serviceIds);
  await seedTyreBrands();
  await seedPromotions();
  await seedFaqs();
  await seedTestimonials();
  await seedSettings();
  await seedHolidays();
  await seedAdminUser();
  await seedSampleBookings();

  process.stdout.write("\n✓ seed complete.\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err: unknown) => {
    process.stderr.write(`\n✗ seed failed: ${err instanceof Error ? err.message : String(err)}\n`);
    if (err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
