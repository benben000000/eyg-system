/**
 * SHARED CLIENT-SIDE ANALYTICS + FUNNEL TYPES
 * ============================================================================
 * Owned by the *widgets* agent. This module is deliberately dependency-free and
 * safe to import from BOTH Server and Client Components — it contains no
 * `"use client"` directive and touches no browser global at module scope.
 *
 * The brief requires that `window.dataLayer` / `gtag` have exactly ONE shared
 * type in the codebase. That type lives here so no other agent has to guess it.
 *
 * GUARANTEES
 *  - Calling any `track*` helper is always safe: if the analytics tag has not
 *    loaded (ad blocker, no consent yet, static export) the event is dropped.
 *    It never throws and it never logs — analytics must not break a page.
 *  - No personally identifying values are ever put in an event payload by this
 *    layer. Never pass a name, phone number, email or plate number.
 *
 * The *server* analytics surface lives in `src/lib/analytics.ts` (backend-core).
 * This file is the browser-side mirror of the same event vocabulary.
 */

/** Every funnel event name the site is allowed to emit. */
export const FUNNEL_EVENTS = [
  "instant_quote_viewed",
  "instant_quote_changed",
  "instant_quote_requested",
  "instant_quote_request_failed",
  "booking_started",
  "booking_step_completed",
  "booking_slot_selected",
  "booking_submitted",
  "booking_failed",
  "booking_abandoned",
  "booking_confirmed",
  "captcha_failed",
  "directions_clicked",
  "call_clicked",
  "whatsapp_clicked",
  "sms_requested",
  "calendar_downloaded",
  "promo_viewed",
  "promo_expired",
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/**
 * Event properties. Values must be low-cardinality and non-identifying:
 * counts, slugs, boolean flags, provider names, error codes.
 */
export type FunnelProps = Record<string, string | number | boolean | null | undefined>;

/** Minimal gtag surface we rely on. */
export type GtagFn = (
  command: "event" | "config" | "js" | string,
  target: string,
  params?: Record<string, unknown>,
) => void;

/** dataLayer entry pushed for GA4 when gtag is unavailable. */
export interface DataLayerEvent {
  event: string;
  [key: string]: unknown;
}

/**
 * NOTE ON `window.dataLayer` / `window.gtag`
 * ---------------------------------------------------------------------------
 * The brief asks for ONE shared type for these two globals. Declaring them with
 * `declare global` here would collide with any other module that does the same,
 * and TypeScript resolves duplicate `Window` augmentations as an error, not a
 * merge. So this file owns the *read* of the globals through the narrow views
 * below, and exposes the canonical types (`GtagFn`, `DataLayerEvent`) for other
 * modules to reuse. If another module has already augmented `Window`, this file
 * stays valid; if it has not, this file never needs to.
 */
interface AnalyticsWindow {
  dataLayer?: DataLayerEvent[] | undefined;
  gtag?: GtagFn | undefined;
}

function analyticsWindow(): AnalyticsWindow | null {
  if (typeof window === "undefined") return null;
  return window as unknown as AnalyticsWindow;
}

/** True only in the browser. Safe to call during render. */
function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function sink(): DataLayerEvent[] | null {
  if (!hasWindow()) return null;
  const w = analyticsWindow();
  if (!w) return null;
  if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
  return w.dataLayer;
}

/**
 * Pushes one funnel event. Returns `true` if it reached the data layer.
 * Never throws — a broken analytics tag must never break a booking.
 */
export function trackFunnel(event: FunnelEvent, props: FunnelProps = {}): boolean {
  const layer = sink();
  if (!layer) return false;

  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    cleaned[key] = value;
  }

  try {
    const gtag = analyticsWindow()?.gtag;
    if (typeof gtag === "function") {
      gtag("event", event, cleaned);
      return true;
    }
    layer.push({ event, ...cleaned });
    return true;
  } catch {
    /* Swallowed on purpose: see the doc comment. */
    return false;
  }
}

/** Fire-and-forget navigation intent. Call from the click handler of a CTA. */
export function trackAndNavigate(event: FunnelEvent, props: FunnelProps, href: string): void {
  trackFunnel(event, props);
  if (!hasWindow()) return;
  try {
    window.location.assign(href);
  } catch {
    /* An <a href> in the markup remains the accessible fallback. */
  }
}

/** Specific funnel events, typed, so call sites cannot invent names. */
export const events = {
  quoteViewed: (source?: string) => trackFunnel("instant_quote_viewed", { source }),
  quoteChanged: (services: number, min: number, max: number, isApproximate: boolean) =>
    trackFunnel("instant_quote_changed", {
      service_count: services,
      estimate_min: min,
      estimate_max: max,
      is_approximate: isApproximate,
    }),
  quoteRequested: (reference: string, min: number, max: number) =>
    trackFunnel("instant_quote_requested", { reference, estimate_min: min, estimate_max: max }),
  quoteRequestFailed: (reason: string) => trackFunnel("instant_quote_request_failed", { reason }),
  bookingStarted: (source?: string) => trackFunnel("booking_started", { source }),
  bookingStep: (step: number, stepName: string) =>
    trackFunnel("booking_step_completed", { step, step_name: stepName }),
  bookingSlot: (date: string, slotLabel: string, isBest: boolean) =>
    trackFunnel("booking_slot_selected", { date, slot_label: slotLabel, is_recommended: isBest }),
  bookingSubmitted: (serviceCount: number) =>
    trackFunnel("booking_submitted", { service_count: serviceCount }),
  bookingFailed: (status: number, code: string) =>
    trackFunnel("booking_failed", { http_status: status, error_code: code }),
  bookingAbandoned: (step: number) => trackFunnel("booking_abandoned", { step }),
  bookingConfirmed: (reference: string, serviceCount: number, estimateMin: number, estimateMax: number) =>
    trackFunnel("booking_confirmed", {
      reference,
      service_count: serviceCount,
      estimate_min: estimateMin,
      estimate_max: estimateMax,
    }),
  directions: (provider: "google" | "waze" | "maps") =>
    trackFunnel("directions_clicked", { provider }),
  call: (source?: string) => trackFunnel("call_clicked", { source }),
  whatsapp: (source?: string) => trackFunnel("whatsapp_clicked", { source }),
  sms: (kind: "quote" | "booking") => trackFunnel("sms_requested", { kind }),
  calendar: (kind: "booking" | "promo") => trackFunnel("calendar_downloaded", { kind }),
  promoViewed: (slug: string) => trackFunnel("promo_viewed", { promo_slug: slug }),
  promoExpired: (slug: string) => trackFunnel("promo_expired", { promo_slug: slug }),
} as const;