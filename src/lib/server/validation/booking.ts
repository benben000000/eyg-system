/**
 * BOOKING INPUT VALIDATION — `POST /api/booking`
 * ============================================================================
 * Everything the customer can influence is validated here, before a single
 * database call. The zod schema *is* the contract: `types.ts` declares the
 * TypeScript shape, this declares the runtime one, and the route hands the
 * parsed result to `booking.createBooking` typed as `CreateBookingInput`.
 */
import "server-only";

import { z } from "zod";

import { BOOKING } from "@/config/site";
import {
  captchaFields,
  cappedText,
  cleanedName,
  consentSms,
  email,
  honeypot,
  multilineText,
  phPhone,
  promoCode,
  vehicleYear,
} from "@/lib/server/validation/primitives";

/** How long a customer's note may be. 500 chars is already generous. */
const NOTES_MAX = 500;
const PLATE_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/;
export const TYRE_SIZE_RE = /^\d{2,3}\/\d{2,3}(R\d{1,2}(\s?XL?)?)?(\s?\d{2,3}\s?H\d{2})?$/i;

export const vehicleShape = {
  year: vehicleYear,
  make: cappedText("Make", 40, { required: true }).refine((v) => v.length >= 2, "Enter the vehicle make."),
  model: cappedText("Model", 40, { required: true }).refine((v) => v.length >= 1, "Enter the vehicle model."),
  variant: cappedText("Variant", 40),
  plate: cappedText("Plate", 12)
    .refine((v) => v === "" || PLATE_RE.test(v), "Enter a valid plate number."),
  mileageKm: z
    .number()
    .int()
    .min(0, "Mileage cannot be negative.")
    .max(2_000_000, "Mileage looks wrong.")
    .optional(),
} as const;

export const createBookingShape = {
  name: cleanedName(2, 80),
  phone: phPhone(),
  email,

  /**
   * Must be one of the slots the availability board offered. Re-interpreted as
   * a Manila wall-clock instant server-side (see `time.ts#isoToManilaInstant`)
   * and then checked against a freshly computed board inside the transaction.
   */
  startAt: z
    .string()
    .trim()
    .min(10, "Pick a time slot.")
    .max(40)
    .refine(
      (v) => /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?/.test(v),
      "Pick a time slot from the list.",
    ),

  /**
   * May legitimately be empty when `packageId` is supplied — the bundle *is*
   * the selection. The cross-field check lives in the schema's `superRefine`.
   */
  serviceIds: z
    .array(z.string().trim().min(4).max(40))
    .max(BOOKING.maxServicesPerBooking, `You can book up to ${BOOKING.maxServicesPerBooking} services at once.`)
    .default([])
    .transform((ids) => [...new Set(ids)]),

  packageId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().min(4).max(40).optional(),
  ),
  promoCode,

  vehicle: z.object(vehicleShape).strict().optional(),

  /** Customer-visible note. Stored in `Booking.serviceNotes`. */
  notes: multilineText("Notes", NOTES_MAX),

  consentSms,
  consentMarketing: z.boolean().optional().default(false),

  // Anti-bot. All three are always checked by `verifyCaptcha`.
  website: honeypot,
  ...captchaFields,
} as const;

export const createBookingSchema = z
  .object(createBookingShape)
  .strict()
  .superRefine((val, ctx) => {
    // A booking must be for *something*. Services alone, a package alone, or
    // both — never neither.
    if (val.serviceIds.length === 0 && !val.packageId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["serviceIds"], message: "Choose at least one service." });
    }
  });

export type CreateBookingInputParsed = z.input<typeof createBookingSchema>;
export type CreateBookingParsed = z.output<typeof createBookingSchema>;

// ── Cancellation ────────────────────────────────────────────────────────────

export const cancelBookingShape = {
  /** Customer-supplied reason. Kept short and printable. */
  reason: cappedText("Reason", 200),
  /** Explicit acknowledgement; guards against a stray double-click. */
  confirm: z.literal(true, {
    errorMap: () => ({ message: "Please confirm the cancellation." }),
  }),
  website: honeypot,
} as const;

export const cancelBookingSchema = z.object(cancelBookingShape).strict();
export type CancelBookingInput = z.output<typeof cancelBookingSchema>;

// ── Reference lookup ────────────────────────────────────────────────────────

/**
 * Booking references are `EYG-XXXXXX` with an ambiguity-free alphabet
 * (`utils.ts#makeReference` excludes I/O/0/1). Accept 4–12 chars after the
 * prefix so future prefix changes do not break the URL.
 */
export const bookingReferenceSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(24)
  .refine((v) => /^[A-Z0-9-]{6,24}$/.test(v), "Invalid booking reference.");

export const quoteReferenceSchema = bookingReferenceSchema;
