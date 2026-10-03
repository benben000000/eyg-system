/**
 * AVAILABILITY — the promise check.
 * ============================================================================
 * This module answers one question: **may we tell a customer we can do this job
 * on this day?** `getServiceAvailability().canFulfil` is that answer.
 *
 * It is deliberately pessimistic. `canFulfil` is `false` if ANY *blocking* part
 * is short. There is no "probably fine", no partial-true, and no averaging
 * across parts: a brake pad we do not have is a car that cannot leave the bay,
 * and optimism here is the single most expensive thing this system could do.
 *
 * ── WHY `available`, NEVER `onHand` ────────────────────────────────────────
 * Four filters that are all promised to four bookings are not four filters the
 * shop can sell. Every number here is `onHand − reserved`, read from the same
 * `StockLevel` row the engine's conditional UPDATE guards against, so the
 * promise and the guard are looking at the same figure.
 *
 * ── AGEING NEVER GATES ─────────────────────────────────────────────────────
 * An old tyre or a near-expiry oil is *information* for the counter. It is never
 * part of `canFulfil`. Refusing a customer whose car is already on the lift
 * because of a sell-by date would be a worse failure than selling one oil a
 * month early, and it is exactly the "block a sale for a non-blocking part"
 * mistake the brief forbids.
 *
 * ── COST ────────────────────────────────────────────────────────────────────
 * `ServiceAvailabilityDto` and `PartAvailabilityDto` have no cost fields at all,
 * so the public mapper physically cannot emit `costPrice`. Cost is attached only
 * by `toStaffAvailability`, behind an authenticated staff role.
 * ============================================================================
 */
import "server-only";

import { ApiError, notFound } from "@/lib/errors";
import type {
  PartAvailabilityDto,
  ProductKindValue,
  ServiceAvailabilityDto,
  UnitValue,
} from "@/lib/inventory-types";
import { prisma } from "@/lib/server/db";

import { lastReceivedMap, productAgeDays } from "./products";

/** A part with cost attached. Staff surfaces only. */
export interface StaffPartAvailability extends PartAvailabilityDto {
  costPrice: number;
  marginPct: number | null;
}

// ── Read ceilings ───────────────────────────────────────────────────────────
//
// Every `findMany` below carries an explicit `take`. An unbounded read on a
// catalogue table is the enumeration primitive, and the caller-visible ceilings
// (20 services per check) are far below anything a real request needs.

/** Services per availability check. Mirrors the zod cap on `serviceIds`. */
const MAX_SERVICES_PER_CHECK = 20;
/** Distinct products whose cost may be attached in one staff read. */
const MAX_PARTS_PER_CHECK = 200;
/** Booking line items considered when folding in `BookingItem.quantity`. */
const MAX_BOOKING_ITEMS = 100;
/** Holds read in one pass. Matches the reservation list page ceiling. */
const MAX_HOLDS_PER_BOOKING = 200;

export interface StaffServiceAvailability extends Omit<ServiceAvailabilityDto, "parts"> {
  parts: StaffPartAvailability[];
}

// ── Resolution ──────────────────────────────────────────────────────────────

/**
 * One `include` for every requirement read, so the shape the mapper expects can
 * never drift from the shape the query actually returns.
 */
const requirementSelect = {
  qtyPerService: true,
  isBlocking: true,
  product: { include: { level: { select: { onHand: true, reserved: true } } } },
} as const;

function rawAvailable(product: { level: { onHand: number; reserved: number } | null }): number {
  return (product.level?.onHand ?? 0) - (product.level?.reserved ?? 0);
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface AvailabilityOptions {
  /**
   * A booking id whose OWN holds should not count against it. See the note in
   * `resolve()`.
   */
  ignoreReservationsForBookingId?: string | null;
  /** How many times each service is needed. Defaults to 1 per service. */
  occurrences?: Map<string, number> | null;
}

/**
 * THE PROMISE CHECK.
 *
 * `canFulfil` is `true` only when every *blocking* part has at least
 * `qtyNeeded` available. A short non-blocking part is reported in `parts` (with
 * `isShort: true`) and never blocks — that is the "do not block a customer for a
 * nice-to-have" rule, made mechanical.
 */
export async function getServiceAvailability(
  serviceIds: string[],
  options: AvailabilityOptions = {},
): Promise<ServiceAvailabilityDto[]> {
  const ids = [...new Set(serviceIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) return [];
  if (ids.length > 20) {
    throw new ApiError("VALIDATION_ERROR", "Too many services in one availability check.", {
      fields: { serviceIds: ["Twenty at a time, please."] },
    });
  }

  const services = await prisma.service.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, name: true, partRequirements: { select: requirementSelect } },
    take: MAX_SERVICES_PER_CHECK,
  });
  const ownHolds = await ownHoldMap(options.ignoreReservationsForBookingId ?? null);
  const occurrences = options.occurrences ?? null;

  const found = new Set(services.map((s) => s.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new ApiError("VALIDATION_ERROR", "One of those services is not on the list.", {
      fields: { serviceIds: ["Please pick from the current services."] },
    });
  }

  return services.map((service) => {
    const times = occurrences?.get(service.id) ?? 1;
    const parts: PartAvailabilityDto[] = [];
    const blockers: ServiceAvailabilityDto["blockers"] = [];

    for (const requirement of service.partRequirements) {
      const product = requirement.product;
      // The booking's own hold is added back: those units ARE promised to it.
      const ownHold = ownHolds.get(product.id) ?? 0;
      const available = (product.isActive ? rawAvailable(product) : 0) + ownHold;
      const qtyNeeded = requirement.qtyPerService * times;
      const isShort = available < qtyNeeded;
      parts.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        size: product.size,
        kind: product.kind,
        unit: product.unit,
        qtyPerService: requirement.qtyPerService,
        qtyNeeded,
        available,
        isBlocking: requirement.isBlocking,
        isShort,
        sellPrice: product.sellPrice,
      });
      if (isShort && requirement.isBlocking) {
        blockers.push({ productId: product.id, name: product.name, short: qtyNeeded - available });
      }
    }

    return {
      serviceId: service.id,
      serviceSlug: service.slug,
      name: service.name,
      canFulfil: blockers.length === 0,
      parts,
      blockers,
    } satisfies ServiceAvailabilityDto;
  });
}

/**
 * The same shape with cost attached, for a signed-in staff member. The public
 * endpoint must never call this.
 */
export async function getStaffServiceAvailability(
  serviceIds: string[],
  options: AvailabilityOptions = {},
): Promise<StaffServiceAvailability[]> {
  const publicRows = await getServiceAvailability(serviceIds, options);
  if (publicRows.length === 0) return [];
  const ids = [...new Set(publicRows.flatMap((r) => r.parts.map((p) => p.productId)))];
  const products = ids.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, costPrice: true, marginPct: true },
        take: MAX_PARTS_PER_CHECK,
      })
    : [];
  const costById = new Map(products.map((p) => [p.id, p]));

  return publicRows.map((row) => ({
    ...row,
    parts: row.parts.map((part) => {
      const product = costById.get(part.productId);
      return { ...part, costPrice: product?.costPrice ?? 0, marginPct: product?.marginPct ?? null };
    }),
  }));
}

/**
 * Availability for a whole booking, with `BookingItem.quantity` folded in.
 *
 * Exported for the booking integration: it is the honest "can we promise this
 * customer?" answer for a specific basket of services.
 */
export async function getBookingPartsAvailability(
  bookingId: string,
): Promise<{ canFulfil: boolean; services: ServiceAvailabilityDto[]; blockers: Array<{ productId: string; name: string; short: number }> }> {
  const items = await prisma.bookingItem.findMany({
    where: { bookingId },
    select: { serviceId: true, quantity: true },
    take: MAX_BOOKING_ITEMS,
  });
  const serviceIds = [...new Set(items.flatMap((i) => (i.serviceId ? [i.serviceId] : [])))];
  if (serviceIds.length === 0) return { canFulfil: true, services: [], blockers: [] };

  const occurrences = new Map<string, number>();
  for (const item of items) {
    if (!item.serviceId) continue;
    occurrences.set(item.serviceId, (occurrences.get(item.serviceId) ?? 0) + Math.max(1, item.quantity));
  }

  const services = await getServiceAvailability(serviceIds, {
    occurrences,
    ignoreReservationsForBookingId: bookingId,
  });
  const blockers = services.flatMap((s) => s.blockers);
  return { canFulfil: blockers.length === 0, services, blockers };
}

/**
 * A single product's promise figure, including its ageing. Powers the
 * tyre-size finder: "we have your size" must come from `available`, never from
 * `onHand`.
 *
 * `canPromise` EQUALS `available` — the contract keeps the two fields apart so a
 * customer-facing claim can later shrink without the stock number moving. Today
 * they are the same figure, and inventing a difference would be a lie.
 */
export async function canPromise(
  input: { productId?: string; sku?: string },
): Promise<{
  productId: string;
  sku: string;
  name: string;
  size: string | null;
  kind: ProductKindValue;
  unit: UnitValue;
  available: number;
  canPromise: number;
  isLow: boolean;
  reorderPoint: number;
  sellPrice: number;
  ageDays: number | null;
  isNearExpiry: boolean;
}> {
  const product = input.productId
    ? await prisma.product.findUnique({ where: { id: input.productId }, include: { level: { select: { onHand: true, reserved: true } } } })
    : await prisma.product.findUnique({
        where: { sku: (input.sku ?? "").trim().toUpperCase() },
        include: { level: { select: { onHand: true, reserved: true } } },
      });
  if (!product) throw notFound("Product not found.");

  const available = rawAvailable(product);
  const received = await lastReceivedMap([product.id]);
  const age = productAgeDays({ ...product, lastReceivedAt: received.get(product.id) ?? null }, new Date());

  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    size: product.size,
    kind: product.kind,
    unit: product.unit,
    available,
    canPromise: available,
    isLow: available <= product.reorderPoint,
    reorderPoint: product.reorderPoint,
    sellPrice: product.sellPrice,
    ageDays: age.ageDays,
    isNearExpiry: age.isNearExpiry,
  };
}

// ── Internals ───────────────────────────────────────────────────────────────

async function ownHoldMap(bookingId: string | null): Promise<Map<string, number>> {
  if (!bookingId) return new Map();
  const rows = await prisma.reservation.findMany({
    where: { bookingId, status: "HELD" },
    select: { productId: true, qty: true },
    take: MAX_HOLDS_PER_BOOKING,
  });
  return new Map(rows.map((r) => [r.productId, r.qty]));
}
