/**
 * EYG — NO-JS BOOKING FALLBACK — STATE TYPES
 * ============================================================================
 * A `"use server"` module may only export **async functions**. Anything else —
 * a plain object, a type, a constant — is compiled into a server reference and
 * arrives on the client as a proxy rather than the value, which blows up on the
 * first render. So the shape and the initial value live here, in a plain module.
 *
 * The action itself is in `NoJsBookingAction.ts`.
 * ============================================================================
 */

export type FallbackOutcome = "sent" | "ratelimited" | "invalid" | "error";

export interface SubmitFallbackState {
  outcome: FallbackOutcome;
  /** Only populated for `invalid`, so the customer can see what needs fixing. */
  fields: Record<string, string>;
  name: string;
  phone: string;
  day: string;
  message: string;
}

export const INITIAL_FALLBACK_STATE: SubmitFallbackState = {
  outcome: "error",
  fields: {},
  name: "",
  phone: "",
  day: "",
  message: "",
};
