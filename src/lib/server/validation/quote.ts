/**
 * QUOTE VALIDATION — `POST /api/quote` (estimate) and `POST /api/quote/request`.
 * ============================================================================
 * Two schemas share the estimator payload:
 *  - `quoteEstimateSchema` is a *pure* calculation input. It is NOT rate
 *    limited and needs no captcha: it reveals nothing that is not already on
 *    the services page, and putting a challenge in front of every slider drag
 *    would wreck the funnel.
 *  - `createQuoteRequestSchema` adds contact details, so it gets the full
 *    treatment: rate limit + captcha + honeypot + min-time-to-submit.
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
  phPhone,
  promoCode,
  vehicleYear,
} from "@/lib/server/validation/primitives";

export const ENGINE_VALUES = ["gasoline", "diesel", "hybrid", "electric", "unknown"] as const;
export type EngineValue = (typeof ENGINE_VALUES)[number];

export const estimatorShape = {
  vehicleYear: vehicleYear.optional(),
  vehicleMake: cappedText("Make", 40),
  vehicleModel: cappedText("Model", 40),

  /**
   * `unknown` is a first-class answer, not a failure: most customers do not
   * know. The estimator widens the band rather than guessing wrong.
   */
  engine: z
    .enum(ENGINE_VALUES)
    .optional()
    .default("unknown" as EngineValue),

  serviceIds: z
    .array(z.string().trim().min(4).max(40))
    .min(1, "Choose at least one service.")
    .max(BOOKING.maxServicesPerBooking, `Choose up to ${BOOKING.maxServicesPerBooking} services.`)
    .transform((ids) => [...new Set(ids)]),

  packageId: z.string().trim().min(4).max(40).optional(),
  promoCode,

  /** How many tyres, for services priced per tyre. */
  tyreCount: z.number().int().min(1).max(8).optional(),
  /** "205/55 R16" — used only to sanity-check per-tyre pricing. */
  tyreSize: cappedText("Tyre size", 24).optional(),
} as const;

export const quoteEstimateSchema = z.object(estimatorShape).strict();
export type QuoteEstimateInputParsed = z.infer<typeof quoteEstimateSchema>;

export const createQuoteRequestShape = {
  ...estimatorShape,

  name: cleanedName(2, 80),
  phone: phPhone(),
  email,
  consentSms,
  /** Free-text "what's wrong / what do you need". */
  notes: cappedText("Message", 600),

  website: honeypot,
  ...captchaFields,
} as const;

export const createQuoteRequestSchema = z.object(createQuoteRequestShape).strict();
export type CreateQuoteRequestInput = z.infer<typeof createQuoteRequestSchema>;

/**
 * Machine-readable promo outcomes. The client is told exactly what happened so
 * it can show an honest inline message instead of silently dropping the code.
 */
export const PROMO_STATUSES = [
  "APPLIED",
  "NOT_FOUND",
  "INACTIVE",
  "NOT_STARTED",
  "EXPIRED",
  "NO_CODE",
  "NOT_ELIGIBLE",
] as const;
export type PromoStatus = (typeof PROMO_STATUSES)[number];
