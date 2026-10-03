/**
 * EYG — FUNNEL TELEMETRY HOOK
 * ============================================================================
 * `docs/funnel/` and `src/components/widgets/**` belong to other agents, and the
 * analytics client does not exist yet. Rather than hard-depend on a module that
 * is not written, every conversion event on the content pages is dispatched as
 * a DOM `CustomEvent` on `window`.
 *
 * That gives the funnel/analytics agent a single, stable, dependency-free
 * contract:
 *
 *   window.addEventListener("eyg:funnel", (e) => track(e.detail));
 *   // e.detail === { event: string, props: Record<string, …>, at: ISO string }
 *
 * The canonical event names are exported as `FUNNEL_EVENTS` so a consumer can
 * type them without guessing.
 *
 * RULES OBSERVED BY EVERY CALL SITE
 *   • never throws (analytics must not break a booking)
 *   • never runs on the server
 *   • never carries personal data (no names, phone numbers, plates, notes)
 * ============================================================================
 */

export const FUNNEL_EVENTS = {
  servicesView: "services_view",
  servicesCategoryFilter: "services_category_filter",
  servicesServiceCta: "services_service_cta",
  servicesPackageCta: "services_package_cta",
  bookStart: "book_start",
  bookStepView: "book_step_view",
  bookSlotSelected: "book_slot_selected",
  bookSubmitted: "book_submitted",
  bookSucceeded: "book_succeeded",
  bookFailed: "book_failed",
  bookFallbackSubmit: "book_fallback_submit",
  dealView: "deal_view",
  dealClaimStarted: "deal_claim_started",
  dealClaimSucceeded: "deal_claim_succeeded",
  dealClaimFailed: "deal_claim_failed",
  contactFormSubmitted: "contact_form_submitted",
  contactFormSucceeded: "contact_form_succeeded",
  contactFormFailed: "contact_form_failed",
  galleryFilter: "gallery_filter",
  galleryLightboxOpen: "gallery_lightbox_open",
  galleryCompare: "gallery_compare",
} as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS];

export type FunnelProps = Record<string, string | number | boolean | null | undefined>;

export const FUNNEL_EVENT_NAME = "eyg:funnel";

export function trackFunnel(event: FunnelEventName | string, props?: FunnelProps): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(FUNNEL_EVENT_NAME, {
        detail: { event, props: props ?? {}, at: new Date().toISOString() },
      }),
    );
  } catch {
    /* An analytics failure must never surface to a customer mid-booking. */
  }
}
