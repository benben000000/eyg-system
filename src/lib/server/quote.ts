/**
 * INSTANT QUOTE ENGINE
 * ============================================================================
 * Turns a service selection into an honest price band.
 *
 * The honesty rules, which are the whole point of this file:
 *
 *  - **A `CALL_FOR_PRICE` service widens the band and sets `isVariable` on its
 *    line item.** We never invent a number for work that genuinely depends on
 *    the vehicle.
 *  - **When the spread is wider than 60 % of the midpoint, `isApproximate` is
 *    `true`** and the `disclaimer` says plainly that it is an indicative range,
 *    not a quote. A wide band shown without a caveat is how a shop earns a
 *    reputation for bait-and-switch; the same band shown *with* the caveat is
 *    how it earns trust.
 *  - **An invalid promo code is never silently ignored.** `promoStatus` is
 *    returned machine-readably so the UI can warn instead of pretending the
 *    discount applied.
 *  - Quotes expire after 7 days — long enough to book, short enough that a
 *    price change does not produce an argument at the counter.
 */
import "server-only";

import { prisma } from "@/lib/server/db";
import { ApiError } from "@/lib/errors";
import type { PackageDto, QuoteEstimateDto, ServiceDto } from "@/lib/types";
import { formatSlotLabel, dateKeyOf, isoWithOffset, localMinutesToUtc, SHOP_TIMEZONE } from "@/lib/server/time";
import type { PromoStatus } from "@/lib/server/validation/quote";

export const QUOTE_TTL_DAYS = 7;

/** Above this spread the estimate is flagged approximate. */
export const APPROXIMATE_SPREAD_RATIO = 0.6;

export const VARIABLE_NOTE =
  "Final price depends on the vehicle. We confirm after a quick inspection.";

export const DEFAULT_DISCLAIMER =
  "Indicative range only. Final price depends on your vehicle and what we find during the check.";

// ── Catalogue reading ───────────────────────────────────────────────────────

type ServiceRow = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  summary: string;
  pricing: "FIXED" | "RANGE" | "CALL_FOR_PRICE";
  priceMin: number | null;
  priceMax: number | null;
  priceNote: string | null;
  durationMin: number | null;
  isPopular: boolean;
  isFeatured: boolean;
  includes: string[];
  category: { slug: string; name: string; icon: string | null };
};

const serviceSelect = {
  id: true,
  slug: true,
  name: true,
  shortName: true,
  summary: true,
  pricing: true,
  priceMin: true,
  priceMax: true,
  priceNote: true,
  durationMin: true,
  isPopular: true,
  isFeatured: true,
  includes: true,
  category: { select: { slug: true, name: true, icon: true } },
} as const;

export async function listServices(): Promise<ServiceDto[]> {
  const rows = await prisma.service.findMany({
    where: { isActive: true },
    select: serviceSelect,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(toServiceDto);
}

export function toServiceDto(row: ServiceRow): ServiceDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.shortName,
    summary: row.summary,
    pricing: row.pricing,
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    priceNote: row.priceNote,
    durationMin: row.durationMin,
    isPopular: row.isPopular,
    isFeatured: row.isFeatured,
    includes: row.includes,
    category: row.category,
  };
}

export async function listPackages(): Promise<PackageDto[]> {
  const rows = await prisma.package.findMany({
    where: { isActive: true },
    include: { items: { include: { service: { select: { name: true } } } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    compareAtMin: row.compareAtMin,
    savingsPct: row.savingsPct,
    badge: row.badge,
    items: row.items.map((i) => ({ name: i.service.name, quantity: i.quantity })),
  }));
}

// ── Promo ───────────────────────────────────────────────────────────────────

export interface PromoEvaluation {
  status: PromoStatus;
  percentOff: number;
  fixedOff: number;
  title: string | null;
}

/** Resolves a promo code. Never throws — the caller decides how to warn. */
export async function evaluatePromo(code: string | undefined, now: Date = new Date()): Promise<PromoEvaluation> {
  const none = { status: "NO_CODE", percentOff: 0, fixedOff: 0, title: null } as const;
  if (!code) return none;

  const promo = await prisma.promotion.findFirst({
    where: { code, isActive: true },
    select: { title: true, kind: true, valuePct: true, valueOff: true, startsAt: true, endsAt: true },
  });
  if (!promo) return { ...none, status: "NOT_FOUND" };
  if (promo.startsAt && promo.startsAt.getTime() > now.getTime()) return { ...none, status: "NOT_STARTED", title: promo.title };
  if (promo.endsAt && promo.endsAt.getTime() < now.getTime()) return { ...none, status: "EXPIRED", title: promo.title };

  // The value is read from whichever field is populated, NOT from the `kind`.
  // `BUNDLE`, `CLEARANCE` and `SEASONAL` all carry their arithmetic in
  // `valueOff`/`valuePct` — the seed uses all six kinds — and gating on the kind
  // silently returned NOT_ELIGIBLE for the hero promotion, so a customer who
  // typed a code the /deals page advertises got no discount at all (DEF-007).
  const percentOff = Math.min(90, Math.max(0, Number.isFinite(promo.valuePct) ? promo.valuePct! : 0));
  const fixedOff = Math.max(0, Number.isFinite(promo.valueOff) ? promo.valueOff! : 0);
  if (percentOff === 0 && fixedOff === 0) {
    // A code that exists and is live but carries no arithmetic value: usable as
    // a tracking tag (it lands on the Booking) but nothing to discount.
    return { status: "NOT_ELIGIBLE", percentOff: 0, fixedOff: 0, title: promo.title };
  }
  return { status: "APPLIED", percentOff, fixedOff, title: promo.title };
}

// ── Line items ──────────────────────────────────────────────────────────────

/** `true` when the value is a usable, finite peso amount. */
function isFiniteNum(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Coerce anything into a finite, non-negative peso amount. */
function finite(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

/**
 * Indicative ceiling for a service with no published price, per unit. Wide
 * enough that the band carries meaning, narrow enough not to anchor a customer
 * on a number the shop will not honour. The owning service must publish a real
 * `priceMax`; until then this keeps the UI honest instead of quoting zero.
 */
export const UNPRICED_BAND_MAX = 5_000;

export interface EstimateLineItem {
  id: string;
  name: string;
  quantity: number;
  min: number;
  max: number;
  isVariable: boolean;
  variableNote?: string;
}

export interface EstimateInput {
  serviceIds: string[];
  packageId?: string;
  promoCode?: string;
  tyreCount?: number;
  engine?: "gasoline" | "diesel" | "hybrid" | "electric" | "unknown";
  /** Set by `POST /api/quote` when the quote becomes a lead. */
  now?: Date;
}

export interface EstimateResult {
  dto: QuoteEstimateDto;
  promoStatus: PromoStatus;
  promoTitle: string | null;
}

/**
 * The `/book` deep-link contract. Frontend agents wire these exact params:
 *
 *   /book?service=<slug>&service=<slug>&package=<slug>&promo=<CODE>&engine=<e>
 *
 * `service` may repeat; `/book` reads them in order and pre-checks the
 * corresponding catalogue cards.
 */
export function buildBookHref(input: {
  serviceSlugs: string[];
  packageSlug?: string | undefined;
  promoCode?: string | undefined;
  engine?: string | undefined;
}): string {
  const params = new URLSearchParams();
  for (const slug of input.serviceSlugs) params.append("service", slug);
  if (input.packageSlug) params.set("package", input.packageSlug);
  if (input.promoCode) params.set("promo", input.promoCode);
  if (input.engine && input.engine !== "unknown") params.set("engine", input.engine);
  return `/book?${params.toString()}`;
}

/**
 * Compute the estimate. Pure with respect to the catalogue rows it is given,
 * so `tests/quote.test.ts` (QA) can drive it with fixtures.
 */
export async function estimate(input: EstimateInput): Promise<EstimateResult> {
  const now = input.now ?? new Date();

  const services = await prisma.service.findMany({
    where: { id: { in: input.serviceIds }, isActive: true },
    select: { ...serviceSelect, shortName: true },
  });

  // A selected service that does not exist or is inactive is a client bug or
  // tampering — 400, never a silent zero-priced line item.
  const foundIds = new Set(services.map((s) => s.id));
  const missing = input.serviceIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new ApiError("VALIDATION_ERROR", "One of the selected services is no longer offered.", {
      fields: { serviceIds: ["Please pick from the current list."] },
    });
  }

  const lineItems: EstimateLineItem[] = [];
  const slugs: string[] = [];
  let hasVariable = false;

  for (const svc of services) {
    slugs.push(svc.slug);
    // Per-tyre services multiply by `tyreCount`; everything else is per-vehicle.
    const perTyre = svc.slug.includes("tire") || svc.slug.includes("tyre");
    const quantity = perTyre && input.tyreCount ? Math.min(4, Math.max(1, input.tyreCount)) : 1;

    // A `CALL_FOR_PRICE` service has no published number. It must never be
    // coerced into a zero price — "₱0–₱0" on a quote is a number the shop would
    // not honour, and it is the exact bait-and-switch this site exists to oppose
    // (QA DEF-005). It contributes a zero *floor* (honest: we do not know yet)
    // plus a wide indicative ceiling, and flips the honesty gate below so the
    // result is labelled approximate with the disclaimer attached.
    const rawMin: number | null | undefined = svc.priceMin;
    const rawMax: number | null | undefined = svc.priceMax;
    const hasFloor: boolean = isFiniteNum(rawMin) && rawMin > 0;
    const unpriced = svc.pricing === "CALL_FOR_PRICE" || !hasFloor;
    if (unpriced) hasVariable = true;

    const unitMin: number = hasFloor ? (rawMin as number) : 0;
    // An unpriced job needs a real ceiling, not a second zero: "₱0–₱0" tells a
    // customer the undercoating is free, which is the exact bait-and-switch this
    // site exists to oppose (DEF-005). A zero floor is honest — we genuinely do
    // not know yet — but the band must be wide enough to mean something.
    //
    // A service that DOES carry a floor keeps its own arithmetic: a `FIXED`
    // service with only `priceMin` stays a single figure, not an invented range.
    const unitMax: number =
      isFiniteNum(rawMax) && rawMax > unitMin
        ? rawMax
        : hasFloor
          ? unitMin
          : UNPRICED_BAND_MAX;

    lineItems.push({
      id: svc.id,
      name: svc.shortName ?? svc.name,
      quantity,
      // DEF-008: sanitise at the source so no NaN/Infinity can reach the wire in
      // any nested field. `JSON.stringify` turns them into `null`, which a client
      // cannot distinguish from "we don't know".
      min: finite(unitMin * quantity),
      max: finite(unitMax * quantity),
      isVariable: unpriced,
      ...(unpriced ? { variableNote: svc.priceNote ?? VARIABLE_NOTE } : {}),
    });
  }

  let packageSlug: string | undefined;
  if (input.packageId) {
    const pkg = await prisma.package.findFirst({
      where: { id: input.packageId, isActive: true },
      select: { slug: true, name: true, priceMin: true, priceMax: true, compareAtMin: true, items: { select: { quantity: true } } },
    });
    if (!pkg) {
      throw new ApiError("VALIDATION_ERROR", "That package is no longer offered.", {
        fields: { packageId: ["Please pick from the current list."] },
      });
    }
    packageSlug = pkg.slug;
    // A package replaces the individual lines: it is one bundled price. The
    // bundled items are still listed so the customer sees what is included.
    lineItems.length = 0;
    lineItems.push({
      id: pkg.slug,
      name: pkg.name,
      quantity: 1,
      min: pkg.priceMin,
      max: pkg.priceMax ?? pkg.priceMin,
      isVariable: pkg.priceMax === null,
      ...(pkg.priceMax === null ? { variableNote: VARIABLE_NOTE } : {}),
    });
  }

  const subtotalMin = lineItems.reduce((sum, i) => sum + i.min, 0);
  const subtotalMax = lineItems.reduce((sum, i) => sum + i.max, 0);

  const promo = await evaluatePromo(input.promoCode, now);

  /**
   * A percentage discount must scale BOTH ends of the range. Discounting only the
   * floor leaves the ceiling untouched, so the customer is quoted a maximum the
   * promotion does not actually authorise — a bait-and-switch exposure on DTI
   * fair-advertising grounds (DEF-006).
   */
  const applyDiscount = (value: number): number => {
    if (promo.percentOff > 0) return value - (value * promo.percentOff) / 100;
    if (promo.fixedOff > 0) return value - promo.fixedOff;
    return value;
  };

  const discountedMin = Math.max(0, applyDiscount(subtotalMin));
  // The ceiling is floored at the discounted minimum so the band can never invert.
  const discountedMax = Math.max(discountedMin, applyDiscount(subtotalMax));

  // What the customer actually saves, measured against the undiscounted floor.
  const cappedDiscount = Math.max(0, Math.min(subtotalMin, subtotalMin - discountedMin));

  // DEF-008: never let NaN/Infinity reach the wire. `JSON.stringify` silently
  // turns them into `null`, which is indistinguishable from "we don't know" —
  // the exact information a quote exists to remove.
  const safe = (n: number, fallback = 0): number => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback);

  const min = safe(discountedMin);
  const max = Math.max(min, safe(discountedMax, min));

  // ── Honesty gate ──────────────────────────────────────────────────────────
  const midpoint = (min + max) / 2;
  const spread = max - min;
  const isApproximate =
    hasVariable ||
    subtotalMin === 0 ||
    (midpoint > 0 && spread / midpoint > APPROXIMATE_SPREAD_RATIO);

  const expiresAt = new Date(now.getTime() + QUOTE_TTL_DAYS * 86_400_000);

  const dto: QuoteEstimateDto = {
    min,
    max,
    currency: "PHP",
    isApproximate,
    lineItems,
    ...(promo.status === "APPLIED" && cappedDiscount > 0 ? { savings: { amount: cappedDiscount, compareAt: subtotalMin } } : {}),
    expiresAt: expiresAt.toISOString(),
    disclaimer: isApproximate
      ? `${DEFAULT_DISCLAIMER} This estimate is a range because some of the work depends on your vehicle.`
      : "Range covers the usual cases. Final price is confirmed after the inspection.",
    nextStep: {
      label: "Book a bay",
      href: buildBookHref({
        serviceSlugs: packageSlug ? [] : slugs,
        packageSlug,
        promoCode: promo.status === "APPLIED" ? input.promoCode : undefined,
        engine: input.engine,
      }),
    },
  };

  return { dto, promoStatus: promo.status, promoTitle: promo.title };
}

/** Machine-readable promo outcome the client needs to warn the user. */
export interface QuoteEnvelope extends QuoteEstimateDto {
  promoStatus: PromoStatus;
  promoTitle: string | null;
}

/**
 * Estimate plus the promo outcome and the first bookable slot, so the client
 * can go straight from "what will it cost" to "pick a time".
 *
 * `nextSlotIso` lets the caller pin the board to the date it already has open.
 * With no pin we look at tomorrow in Manila — the safest day to assume has
 * capacity, and it keeps the estimator a single cheap round trip.
 */
export async function estimateWithNextStep(input: EstimateInput & { nextSlotIso?: string | null }): Promise<QuoteEnvelope> {
  const result = await estimate(input);
  const dateKey = input.nextSlotIso?.slice(0, 10) ?? dateKeyOf(new Date(Date.now() + 86_400_000));

  const { getAvailability } = await import("@/lib/server/availability");
  const board = await getAvailability({ date: dateKey, serviceIds: input.serviceIds }).catch(() => null);
  const best = board?.slots.find((s) => s.isBest) ?? board?.slots[0] ?? null;

  return {
    ...result.dto,
    promoStatus: result.promoStatus,
    promoTitle: result.promoTitle,
    ...(best
      ? {
          nextStep: {
            label: `Book ${best.label} on ${best.startAt.slice(0, 10)}`,
            href: `${result.dto.nextStep.href}&slot=${encodeURIComponent(best.startAt)}`,
          },
        }
      : {}),
  };
}

/** Re-exported helpers so routes do not need two imports. */
export { formatSlotLabel, isoWithOffset, localMinutesToUtc, SHOP_TIMEZONE };
