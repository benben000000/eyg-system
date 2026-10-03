/**
 * EYG — CONTACT FORM — STATE TYPES
 * ============================================================================
 * A `"use server"` module may export ONLY async functions. Types and constants
 * live here, in a plain module, so they survive the client boundary as values.
 * The action itself is in `ContactAction.ts`.
 * ============================================================================
 */

export type ContactOutcome = "sent" | "ratelimited" | "invalid" | "error" | "offline";

export interface ContactFormState {
  outcome: ContactOutcome;
  fields: Record<string, string>;
  name: string;
  phone: string;
  email: string;
  topic: string;
  message: string;
}

export const INITIAL_CONTACT_STATE: ContactFormState = {
  outcome: "error",
  fields: {},
  name: "",
  phone: "",
  email: "",
  topic: "",
  message: "",
};
