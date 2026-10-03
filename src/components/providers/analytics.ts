/**
 * ANALYTICS EVENT BUS
 * ============================================================================
 * A tiny, dependency-free façade over `window.gtag`. Safe to import from Server
 * Components (it no-ops on the server) and safe to call from any client leaf.
 *
 * Nothing loads in development, so a dev machine never pollutes the property.
 */
export type AnalyticsEvent =
  | "cta_clicked"
  | "call_clicked"
  | "whatsapp_clicked"
  | "messenger_clicked"
  | "directions_clicked"
  | "booking_started"
  | "booking_completed"
  | "quote_requested"
  | "promo_claimed"
  | "emergency_tapped";

type Params = Record<string, string | number | boolean | undefined>;

/**
 * `gtag` is reached through a local cast rather than a `declare global`
 * augmentation on `Window`. `src/lib/hooks.ts` (backend-core) already augments
 * `Window.dataLayer` / `Window.gtag` with its own narrower types, and two
 * conflicting global declarations are a hard TypeScript error. A local view of
 * the same shape costs nothing and keeps the two agents' files independent.
 */
type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
export const ANALYTICS_ENABLED =
  GA_MEASUREMENT_ID.length > 0 && process.env.NODE_ENV === "production";

/** Fire a GA event. No-op in development, when GA is unset, or on the server. */
export function track(event: AnalyticsEvent, params: Params = {}): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  const gtag = (window as GtagWindow).gtag;
  if (typeof gtag !== "function") return;
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
  );
  gtag("event", event, clean);
}
