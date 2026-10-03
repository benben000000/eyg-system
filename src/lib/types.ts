/**
 * SHARED API CONTRACT
 * ============================================================================
 * Frontend and backend agents MUST agree on these shapes. If you need to change
 * one, change it here first, then update both sides in the same pass.
 * ============================================================================
 */

// ── Envelope ───────────────────────────────────────────────────────────────

export type ApiSuccess<T> = { ok: true; data: T; meta?: ApiMeta };
export type ApiFailure = {
  ok: false;
  error: { code: ApiErrorCode; message: string; fields?: Record<string, string[]> };
  meta?: ApiMeta;
};
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export interface ApiMeta {
  requestId: string;
  /** Present on paginated list endpoints. */
  page?: number;
  pageSize?: number;
  total?: number;
  /** Seconds until the client may retry (rate limit / maintenance). */
  retryAfter?: number;
}

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "CAPTCHA_FAILED",
  "SPAM_REJECTED",
  "SLOT_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "MAINTENANCE",
  "INTERNAL_ERROR",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

// ── Booking ────────────────────────────────────────────────────────────────

export const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "READY",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULED",
] as const;
export type BookingStatusValue = (typeof BOOKING_STATUSES)[number];

export interface SlotQuery {
  date: string; // YYYY-MM-DD
  serviceIds?: string[];
}

export interface SlotDto {
  /** ISO 8601 with +08:00 offset. */
  startAt: string;
  endAt: string;
  label: string; // "9:00 AM"
  capacityLeft: number;
  isBest: boolean; // the "recommended" slot the funnel nudges toward
}

export interface SlotAvailabilityDto {
  date: string;
  timezone: string;
  totalCapacity: number;
  slots: SlotDto[];
  isClosed: boolean;
  closedReason?: string;
}

export interface CreateBookingInput {
  name: string;
  phone: string;
  email?: string;
  startAt: string; // ISO
  serviceIds: string[];
  packageId?: string;
  promoCode?: string;
  vehicle?: {
    year: number;
    make: string;
    model: string;
    variant?: string;
    plate?: string;
    mileageKm?: number;
  };
  notes?: string;
  consentSms: boolean;
  consentMarketing?: boolean;
  /** Anti-bot: must stay empty for humans. */
  website?: string;
  /** Math challenge answer, produced by GET /api/booking/challenge. */
  captchaAnswer?: number;
  captchaToken?: string;
}

export interface BookingDto {
  id: string;
  reference: string;
  status: BookingStatusValue;
  startAt: string;
  endAt: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  vehicle: {
    year: number;
    make: string;
    model: string;
    variant: string | null;
    plate: string | null;
  } | null;
  items: Array<{ id: string; name: string; quantity: number; priceMin: number | null; priceMax: number | null }>;
  estimateMin: number | null;
  estimateMax: number | null;
  notes: string | null;
  createdAt: string;
}

// ── Instant quote estimator ────────────────────────────────────────────────

export interface QuoteEstimateInput {
  vehicleYear?: number;
  vehicleMake?: string;
  vehicleModel?: string;
  engine: "gasoline" | "diesel" | "hybrid" | "electric" | "unknown";
  serviceIds: string[];
  packageId?: string;
  tyreCount?: number;
  tyreSize?: string;
  promoCode?: string;
}

export interface QuoteEstimateDto {
  min: number;
  max: number;
  currency: "PHP";
  /** True when the range is a guess because a price is unknown. */
  isApproximate: boolean;
  lineItems: Array<{
    id: string;
    name: string;
    quantity: number;
    min: number;
    max: number;
    isVariable: boolean;
    variableNote?: string;
  }>;
  savings?: { amount: number; compareAt: number };
  expiresAt: string;
  disclaimer: string;
  /** What the user should do next — drives the funnel. */
  nextStep: { label: string; href: string };
}

export interface CreateQuoteInput extends QuoteEstimateInput {
  name: string;
  phone: string;
  email?: string;
  consentSms: boolean;
  website?: string;
  captchaAnswer?: number;
  captchaToken?: string;
}

export interface QuoteRequestDto {
  reference: string;
  estimateMin: number;
  estimateMax: number;
  requestedAt: string;
}

// ── Catalogue ──────────────────────────────────────────────────────────────

export interface ServiceDto {
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
}

export interface PackageDto {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  priceMin: number;
  priceMax: number | null;
  compareAtMin: number | null;
  savingsPct: number | null;
  badge: string | null;
  items: Array<{ name: string; quantity: number }>;
}

// ── Generic writes ─────────────────────────────────────────────────────────

export interface LeadInput {
  kind: "roadside" | "contact" | "newsletter" | "tire-size";
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  meta?: Record<string, string | number | boolean>;
  website?: string;
  captchaAnswer?: number;
  captchaToken?: string;
}

export interface PromoClaimInput {
  slug: string;
  name: string;
  phone: string;
  email?: string;
  website?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function isApiError<T>(r: ApiResult<T>): r is ApiFailure {
  return !r.ok;
}
