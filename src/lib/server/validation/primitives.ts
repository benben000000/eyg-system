/**
 * SHARED ZOD PRIMITIVES — string hygiene applied to every public input.
 * ============================================================================
 * Public forms are filled in on cheap Android phones over 3G, by people who are
 * often in a car park about to be towed. That shapes the rules:
 *  - Trim everything. Nobody means to submit trailing whitespace.
 *  - Collapse internal runs of whitespace in names (mobile keyboards love to
 *    double-space after autocomplete).
 *  - **Reject control characters** (including zero-width joiners and RTL
 *    overrides) in names and notes — they are invisible, they break search and
 *    reports, and they are the standard trick for impersonating a name.
 *  - Cap every free-text field. There is no field on this site where 5 000
 *    characters is legitimate.
 *
 * Every schema in this folder is `.strict()` (rejects unknown keys) so a typo in
 * a field name is a loud 400 rather than silently dropped customer data.
 */
import "server-only";

import { z } from "zod";

import { normalisePhone } from "@/lib/utils";

/** C0/C1 control chars, zero-width chars and bidi overrides. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/;

/** Phone digits only, PH shape after normalisation. */
export const PH_PHONE_RE = /^(\+?63|0)9\d{9}$/;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Strips control characters and collapses whitespace runs. */
export function cleanText(input: string): string {
  return input.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
}

/** Control-character check used after cleaning, for names. */
export function hasControlChars(input: string): boolean {
  return CONTROL_CHARS.test(input);
}

/** "John  Smith " → "John Smith". */
export const cleanedName = (min: number, max: number) =>
  z
    .string({ required_error: "Name is required." })
    .transform((v) => cleanText(v))
    .refine((v) => v.length >= min, { message: `Please enter at least ${min} characters.` })
    .refine((v) => v.length <= max, { message: `Please keep this under ${max} characters.` })
    .refine((v) => !hasControlChars(v), { message: "Please remove any special hidden characters." });

/** Free-text field with a hard cap. Cleaning only — no control-char reject. */
export const cappedText = (label: string, max: number, { required = false } = {}) => {
  const base = z.string({ required_error: `${label} is required.` });
  const withOptional = required ? base : base.optional().default("");
  return withOptional
    .transform((v) => cleanText(v ?? ""))
    .refine((v) => v.length <= max, { message: `Please keep this under ${max} characters.` });
};

/** Free text that may contain newlines (notes, staff comments). */
export const multilineText = (label: string, max: number) =>
  z
    .string()
    .optional()
    .default("")
    .transform((v) => (v ?? "").replace(CONTROL_CHARS, " ").replace(/\r\n/g, "\n").trim())
    .refine((v) => v.length <= max, { message: `Please keep this under ${max} characters.` });

/**
 * PH mobile number → E.164 (`+639XXXXXXXXX`).
 * Accepts what a human actually types: `0917 123 4567`, `+639171234567`,
 * `9171234567`, `63 917 123 4567`.
 */
export const phPhone = (label = "Mobile number") =>
  z
    .string({ required_error: `${label} is required.` })
    .transform((v) => normalisePhone(cleanText(v)))
    .refine((v) => PH_PHONE_RE.test(v), { message: "Enter a valid Philippine mobile number (09XX XXX XXXX)." });

export const email = z
  .string()
  .optional()
  .transform((v) => (v ? cleanText(v).toLowerCase() : undefined))
  .refine((v) => v === undefined || v.length <= 160, { message: "Email is too long." })
  .refine((v) => v === undefined || EMAIL_RE.test(v), { message: "Enter a valid email address." });

/**
 * `website` honeypot. Must be absent or *completely* empty — a whitespace-only
 * value is rejected too, because no human ever types into a hidden field.
 * Lives on every public form, and `verifyCaptcha()` re-checks it server-side.
 */
export const honeypot = z
  .union([z.string(), z.undefined()])
  .optional()
  .refine((v) => v === undefined || v.length === 0, { message: "Submission rejected." });

export const captchaFields = {
  captchaAnswer: z.number().int().min(0).max(200).optional(),
  captchaToken: z.string().max(400).optional(),
};

export const consentSms = z.boolean({
  required_error: "We need your consent to text you about this booking.",
});

/** Slug-ish identifier (category slug, service slug). */
export const slug = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => /^[a-z0-9-]{1,80}$/.test(v), { message: "Invalid identifier." });

/** CUID / id field from the database. */
export const cuid = z.string().trim().min(8).max(40).refine((v) => /^[a-z0-9]+$/i.test(v), { message: "Invalid identifier." });

export const promoCode = z
  .union([z.string(), z.undefined()])
  .optional()
  .transform((v) => (typeof v === "string" ? v.trim().toUpperCase() : undefined))
  .refine((v) => v === undefined || (v.length > 0 && v.length <= 24 && /^[A-Z0-9-]+$/.test(v)), {
    message: "Invalid promo code.",
  })
  .transform((v) => (v === "" ? undefined : v));

export const currentYear = new Date().getUTCFullYear();

/** Vehicle year: 1950 → next model year. */
export const vehicleYear = z
  .number({ required_error: "Enter the vehicle year." })
  .int()
  .min(1950, "Year must be 1950 or later.")
  .max(currentYear + 1, `Year must be ${currentYear + 1} or earlier.`);

export const isoInstant = z
  .string()
  .trim()
  .max(40)
  .refine((v) => /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?/.test(v), { message: "Invalid date/time." });

export { z };
