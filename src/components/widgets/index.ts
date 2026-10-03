/**
 * EYG WIDGETS — barrel export.
 * ============================================================================
 * Import surface for the conversion features. Owned by the *widgets* agent.
 *
 * Every widget is self-contained: it renders its own section chrome, its own
 * four async states, and its own honest degradation. A page can drop any one of
 * these onto a route without wiring anything else.
 *
 * SERVER vs CLIENT
 *  - `InstantQuoteSection` is a Server Component shell (no `"use client"`), so
 *    it is exported first and preferred on marketing pages.
 *  - `InstantQuote` is the bare client island.
 *  - `BookingWidget`, `SlotPicker`, etc. are client components — wrap them in a
 *    Server Component and pass `serverNowMs={Date.now()}` where relevant so the
 *    first paint and hydration agree.
 *
 * DEEP-LINK CONTRACT (published — the pages agent must match these names)
 *  Estimator → `/book`:
 *    ?service=<id,id>   ?package=<id>   ?promo=<CODE>   ?engine=<engine>
 *    ?tyres=<n>        ?size=<size>    ?year=<y>       ?make=<m>
 *    ?model=<mo>       ?variant=<v>    ?step=<1|2|3|4>
 *  Parse them with `draftFromSearchParams()` from `@/hooks/useBooking`.
 * ============================================================================
 */

// ── Instant quote ───────────────────────────────────────────────────────────
export { default as InstantQuoteSection } from "@/components/widgets/InstantQuote.server";
export { default as InstantQuote, ENGINE_OPTIONS, TYRE_SIZES } from "@/components/widgets/InstantQuote";
export type { InstantQuoteProps, EngineType } from "@/components/widgets/InstantQuote";
export type { InstantQuoteSectionProps } from "@/components/widgets/InstantQuote.server";
export { default as QuoteResult } from "@/components/widgets/QuoteResult";
export type { QuoteResultProps } from "@/components/widgets/QuoteResult";

// ── Booking ─────────────────────────────────────────────────────────────────
export { default as BookingWidget } from "@/components/widgets/BookingWidget";
export type { BookingWidgetProps } from "@/components/widgets/BookingWidget";
export { default as SlotPicker, formatFriendlyDate } from "@/components/widgets/SlotPicker";
export type { SlotPickerProps } from "@/components/widgets/SlotPicker";
export { default as BookingSummary } from "@/components/widgets/BookingSummary";
export type { BookingSummaryProps } from "@/components/widgets/BookingSummary";
export { default as BookingConfirmation } from "@/components/widgets/BookingConfirmation";
export type { BookingConfirmationProps } from "@/components/widgets/BookingConfirmation";
export { default as ServicePicker } from "@/components/widgets/ServicePicker";
export type { ServicePickerProps, ServicePickerTotals } from "@/components/widgets/ServicePicker";
export {
  default as VehiclePicker,
  DEFAULT_MAKES,
  DEFAULT_MODELS,
} from "@/components/widgets/VehiclePicker";
export type { VehiclePickerProps } from "@/components/widgets/VehiclePicker";

// ── Social proof ────────────────────────────────────────────────────────────
export { default as ReviewsFeed } from "@/components/widgets/ReviewsFeed";
export type { ReviewsFeedProps } from "@/components/widgets/ReviewsFeed";
export { default as RatingSummary } from "@/components/widgets/RatingSummary";
export type { RatingSummaryProps } from "@/components/widgets/RatingSummary";

// ── Gallery ─────────────────────────────────────────────────────────────────
export { default as BeforeAfterSlider } from "@/components/widgets/BeforeAfterSlider";
export type {
  BeforeAfterSliderProps,
  BeforeAfterImage,
} from "@/components/widgets/BeforeAfterSlider";
export { default as Lightbox, LightboxTrigger } from "@/components/widgets/Lightbox";
export type { LightboxProps, LightboxImage, LightboxTriggerProps } from "@/components/widgets/Lightbox";

// ── Location ────────────────────────────────────────────────────────────────
export { default as MapEmbed } from "@/components/widgets/MapEmbed";
export type { MapEmbedProps } from "@/components/widgets/MapEmbed";
export { default as OpeningHours } from "@/components/widgets/OpeningHours";
export type { OpeningHoursProps } from "@/components/widgets/OpeningHours";

// ── Trust & payment ─────────────────────────────────────────────────────────
export { default as TrustStrip } from "@/components/widgets/TrustStrip";
export type { TrustStripProps } from "@/components/widgets/TrustStrip";
export { default as PaymentMethods } from "@/components/widgets/PaymentMethods";
export type { PaymentMethodsProps, PaymentMethodItem } from "@/components/widgets/PaymentMethods";

// ── Promo ───────────────────────────────────────────────────────────────────
export { default as PromoCountdown } from "@/components/widgets/PromoCountdown";
export type { PromoCountdownProps } from "@/components/widgets/PromoCountdown";

// ── Hooks (convenience re-exports; the canonical home is `@/hooks/*`) ───────
export { useBooking, draftFromSearchParams, BOOKING_STEPS } from "@/hooks/useBooking";
export type { BookingStep, BookingDraft, VehicleDraft, ContactDraft } from "@/hooks/useBooking";
export { useAvailability, capacityCopy } from "@/hooks/useAvailability";
export { useQuote } from "@/hooks/useQuote";
export { useReviews } from "@/hooks/useReviews";
export { useOpenStatus, buildWeek } from "@/hooks/useOpenStatus";
export { useCountdown, formatCountdown, speakCountdown } from "@/hooks/useCountdown";
export { useFocusTrap, useScrollLock } from "@/hooks/useFocusTrap";
export { useMediaQuery, usePrefersReducedMotion, MEDIA } from "@/hooks/useMediaQuery";
export { useOnlineStatus } from "@/hooks/useOnlineStatus";
export { useIdempotentSubmit } from "@/hooks/useIdempotentSubmit";
export type { IdempotentSubmit } from "@/hooks/useIdempotentSubmit";

// ── Deep-link + estimate helpers ────────────────────────────────────────────
export { buildBookHref, parseServiceParam, BOOK_PARAM, computeLocalEstimate } from "@/components/widgets/internal/quote-engine";
export { ESTIMATE_DISCLAIMER, ON_SITE_LABEL, DEFAULT_CATALOGUE } from "@/components/widgets/internal/catalogue";
export type { WidgetCatalogue } from "@/components/widgets/internal/catalogue";

// ── Shared analytics types + funnel helpers (`src/lib/hooks.ts`) ────────────
export { trackFunnel, events, FUNNEL_EVENTS } from "@/lib/hooks";
export type { FunnelEvent, FunnelProps, GtagFn, DataLayerEvent } from "@/lib/hooks";