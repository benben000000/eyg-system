/**
 * ZOD SCHEMAS — every inventory request body and query string.
 * ============================================================================
 * Two rules that hold for all of them:
 *
 *  1. **`.strict()` everywhere.** An unknown key is a typo in a caller, and a
 *     silently dropped `qty` is how a movement ends up applying the wrong
 *     amount. A loud 400 beats a quiet mistake.
 *  2. **Free text is capped and control-stripped.** A reason is a sentence, a
 *     note is a paragraph, and neither needs a megabyte.
 *
 * This module is pure (no database, no clock) so the QA agent can validate a
 * payload without a connection, which is also why it carries no `server-only`.
 * ============================================================================
 */
import { z } from "zod";

import { ApiError } from "@/lib/errors";
import {
  MOVEMENT_KINDS,
  PRODUCT_KINDS,
  RESERVATION_STATUSES,
  UNITS,
} from "@/lib/inventory-types";
import {
  MAX_IDEMPOTENCY_KEY_LENGTH,
  MAX_MOVEMENT_QTY,
  MAX_REASON_LENGTH,
  MAX_REFERENCE_LENGTH,
} from "./stock-engine.test-support";

export { z };

/** C0/C1 control chars, zero-width chars and bidi overrides. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/;

const cleaned = (max: number, label: string) =>
  z
    .string()
    .max(max * 2, `${label} is too long.`)
    .transform((v) => v.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim())
    .refine((v) => v.length <= max, { message: `${label} is too long.` });

/** Optional free text that normalises to `""` rather than `undefined`. */
const optionalCleaned = (max: number, label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim() : ""))
    .refine((v) => v.length <= max, { message: `${label} is too long.` });

/**
 * The reason is mandatory and must survive cleaning. "Because" is not a reason;
 * a whitespace-only string is not a reason.
 */
export const reasonSchema = z
  .string()
  .max(MAX_REASON_LENGTH * 2, "Reason is too long.")
  .transform((v) => v.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim())
  .refine((v) => v.length > 0, { message: "Please give a reason for this stock change." })
  .refine((v) => v.length <= MAX_REASON_LENGTH, { message: `Please keep the reason under ${MAX_REASON_LENGTH} characters.` });

export const optionalReferenceSchema = optionalCleaned(MAX_REFERENCE_LENGTH, "Reference");

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "Idempotency key is too short.")
  .max(MAX_IDEMPOTENCY_KEY_LENGTH, "Idempotency key is too long.")
  .regex(/^[A-Za-z0-9._:-]+$/, "Idempotency key may only contain letters, numbers, . _ : -");

/** A whole-unit magnitude. Zero and negatives are refused by the engine, not here. */
const qtySchema = z.number().int().refine((v) => v !== 0, { message: "Enter a quantity greater than zero." });

const cuidSchema = z.string().trim().min(8).max(40).regex(/^[a-z0-9]+$/i, "Invalid identifier.");

// ── Products ────────────────────────────────────────────────────────────────

export const productKindSchema = z.enum(PRODUCT_KINDS);
export const unitSchema = z.enum(UNITS);

/** SKU: upper-case, dash/underscore/space only. Printed on a shelf label. */
export const skuSchema = z
  .string()
  .trim()
  .min(2, "SKU is required.")
  .max(40, "SKU is too long.")
  .transform((v) => v.toUpperCase().replace(/\s+/g, "-"))
  .refine((v) => /^[A-Z0-9][A-Z0-9._/-]*$/.test(v), {
    message: "Use letters, numbers, dash, dot, slash or underscore.",
  });

export const createProductSchema = z
  .object({
    sku: skuSchema,
    name: cleaned(120, "Name").refine((v) => v.length > 0, { message: "Name is required." }),
    kind: productKindSchema,
    unit: unitSchema,
    brand: optionalCleaned(60, "Brand"),
    supplierId: cuidSchema.nullish(),
    barcode: optionalCleaned(40, "Barcode"),
    size: optionalCleaned(24, "Size"),
    aspectRatio: z.number().int().min(10).max(95).nullish(),
    rimSizeIn: z.number().int().min(10).max(32).nullish(),
    loadIndex: optionalCleaned(8, "Load index"),
    speedRating: optionalCleaned(8, "Speed rating"),
    pattern: optionalCleaned(60, "Pattern"),
    // DOT (`WKYY`) is constrained to week 01–53 on the WRITE side, not merely
    // "four digits". `parseDotCode` is the reader and it rejects anything
    // outside 1..53; a writer looser than its reader accepts a DOT code that has
    // no age at all, and the ageing report must treat that as UNKNOWN — never as
    // fresh, because the clearance campaign is DOT-driven.
    dotCode: optionalCleaned(8, "DOT code").refine(
      (v) => v === "" || /^(?:0[1-9]|[1-4]\d|5[0-3])\d{2}$/.test(v.replace(/\s+/g, "")),
      { message: "DOT code must be week 01-53 plus a two-digit year, e.g. 2418 for week 18 of 2024." },
    ),
    costPrice: z.number().int().min(0).max(10_000_000).optional(),
    sellPrice: z.number().int().min(0).max(10_000_000).optional(),
    reorderPoint: z.number().int().min(0).max(1_000_000).optional(),
    reorderQty: z.number().int().min(0).max(1_000_000).optional(),
    shelfLifeDays: z.number().int().min(0).max(3_650).nullish(),
    cycleCountDays: z.number().int().min(0).max(3_650).optional(),
    isActive: z.boolean().optional(),
    notes: optionalCleaned(1_000, "Notes"),
  })
  .strict();

/**
 * PATCH is `createProductSchema.partial()` with `sku` still immutable: changing
 * a SKU would break the shelf label, the reorder list and every printed PO in
 * the shop's filing. Stock is deliberately absent — there is exactly one way to
 * change stock and it is `postMovement`.
 */
export const updateProductSchema = createProductSchema
  .omit({ sku: true })
  .partial()
  .strict();

export interface ProductListQuery {
  q?: string;
  kind?: string;
  size?: string;
  brand?: string;
  supplierId?: string;
  barcode?: string;
  lowStock?: boolean;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}

export const productListQuerySchema = z
  .object({
    q: optionalCleaned(80, "Search").optional(),
    kind: z.enum(PRODUCT_KINDS).optional(),
    size: optionalCleaned(24, "Size").optional(),
    brand: optionalCleaned(60, "Brand").optional(),
    supplierId: cuidSchema.optional(),
    barcode: optionalCleaned(40, "Barcode").optional(),
    lowStock: z
      .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      .transform((v) => v === true || v === "true" || v === "1")
      .optional(),
    includeInactive: z
      .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      .transform((v) => v === true || v === "true" || v === "1")
      .optional(),
    page: z.coerce.number().int().min(1).max(100_000).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

// ── Movements (the single write path) ───────────────────────────────────────

/**
 * A lot's tyre DOT code, on the WRITE side. Constrained to week 01-53 rather
 * than merely "four digits", because `parseDotCode` (the reader) rejects anything
 * outside that range: a writer looser than its reader accepts a code that has no
 * age at all, and the ageing report must treat that as UNKNOWN, never as fresh.
 */
export const dotCodeSchema = z
  .string()
  .trim()
  .regex(/^(?:0[1-9]|[1-4]\d|5[0-3])\d{2}$/, "DOT code must be week 01-53 plus a two-digit year, e.g. 2418.");

export const postMovementSchema = z
  .object({
    productId: cuidSchema,
    kind: z.enum(MOVEMENT_KINDS),
    qty: qtySchema,
    reason: reasonSchema,
    reference: optionalReferenceSchema.optional(),
    bookingId: cuidSchema.optional(),
    idempotencyKey: idempotencyKeySchema.optional(),
    /**
     * Lot fields. Only meaningful on a RECEIVE / OPENING (a delivery opens a
     * batch) and accepted on any kind so a caller does not have to branch before
     * submitting.
     */
    dotCode: dotCodeSchema.optional(),
    unitCost: z.number().int().min(0).max(10_000_000).optional(),
  })
  .strict()
  // A delivery may arrive with no readable DOT. An absent lot code is honest; an
  // invented one is not, so it is optional — but it must be PRESENT-AND-VALID or
  // ABSENT, never present-and-garbage.
  .refine((v) => v.kind === "RECEIVE" || v.kind === "OPENING" || v.dotCode === undefined, {
    message: "A DOT code belongs on a receive, not on this movement.",
    path: ["dotCode"],
  });

export const movementListQuerySchema = z
  .object({
    productId: cuidSchema.optional(),
    bookingId: cuidSchema.optional(),
    kind: z.enum(MOVEMENT_KINDS).optional(),
    from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").optional(),
    to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").optional(),
    page: z.coerce.number().int().min(1).max(100_000).optional(),
    pageSize: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

// ── Reservations ────────────────────────────────────────────────────────────

/** A hold longer than 30 days is a leak, not a hold. */
export const RESERVE_TTL_MIN_MINUTES = 5;
export const RESERVE_TTL_MAX_MINUTES = 4_320;
export const RESERVE_TTL_DEFAULT_MINUTES = 1_440;

export const reserveSchema = z
  .object({
    bookingId: cuidSchema,
    items: z
      .array(
        z
          .object({ productId: cuidSchema, qty: qtySchema })
          .strict(),
      )
      .max(50, "Too many items in one hold.")
      .optional(),
    fromServices: z.boolean().optional(),
    ttlMinutes: z.number().int().min(RESERVE_TTL_MIN_MINUTES).max(RESERVE_TTL_MAX_MINUTES).optional(),
  })
  .strict()
  .refine((v) => (v.items !== undefined) !== (v.fromServices === true), {
    message: "Send either an item list or fromServices: true — not both.",
    path: ["items"],
  });

export const releaseReservationsSchema = z
  .object({
    bookingId: cuidSchema,
    reason: reasonSchema,
    statuses: z.array(z.enum(RESERVATION_STATUSES)).max(4).optional(),
  })
  .strict();

export const reservationListQuerySchema = z
  .object({
    bookingId: cuidSchema.optional(),
    productId: cuidSchema.optional(),
    status: z.enum(RESERVATION_STATUSES).optional(),
    page: z.coerce.number().int().min(1).max(100_000).optional(),
    pageSize: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

/**
 * Consuming a hold. `qty` is optional so the whole held quantity is used by
 * default; a partial consume is legitimate when a bay only used part of a kit.
 */
export const consumeReservationsSchema = z
  .object({
    bookingId: cuidSchema,
    reference: optionalReferenceSchema.optional(),
    reason: reasonSchema.optional(),
    items: z
      .array(
        z
          .object({ productId: cuidSchema, qty: qtySchema })
          .strict(),
      )
      .max(50)
      .optional(),
  })
  .strict();

// ── Availability ────────────────────────────────────────────────────────────

export const availabilityQuerySchema = z
  .object({
    serviceIds: z
      .union([z.string(), z.array(z.string())])
      .transform((v) => (Array.isArray(v) ? v : v.split(",")))
      .pipe(z.array(cuidSchema).min(1, "Pick at least one service.").max(20, "Too many services in one check.")),
  })
  .strict();

/** One-product promise check used by the tyre-size finder. */
export const productAvailabilityQuerySchema = z
  .object({
    productId: cuidSchema.optional(),
    sku: skuSchema.optional(),
    qty: z.coerce.number().int().min(1).max(1000).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.productId || v.sku), {
    message: "Send a productId or a sku.",
    path: ["productId"],
  });

// ── Cycle counts ────────────────────────────────────────────────────────────

export const createCountSchema = z
  .object({
    scope: z.union([productKindSchema, cuidSchema, z.literal("all")]).optional(),
    note: optionalCleaned(500, "Note").optional(),
  })
  .strict();

export const recordCountLineSchema = z
  .object({
    productId: cuidSchema,
    counted: z.number().int().min(0).max(MAX_MOVEMENT_QTY),
    note: optionalCleaned(300, "Note").optional(),
  })
  .strict();

export const countListQuerySchema = z
  .object({
    status: z.enum(["DRAFT", "COUNTING", "REVIEW", "POSTED", "CANCELLED"]).optional(),
    page: z.coerce.number().int().min(1).max(100_000).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

// ── Reports ─────────────────────────────────────────────────────────────────

export const reorderQuerySchema = z
  .object({
    kind: z.enum(PRODUCT_KINDS).optional(),
    supplierId: cuidSchema.optional(),
    includeInactive: z
      .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      .transform((v) => v === true || v === "true" || v === "1")
      .optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();

export const valuationQuerySchema = z
  .object({
    kind: z.enum(PRODUCT_KINDS).optional(),
    includeInactive: z
      .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      .transform((v) => v === true || v === "true" || v === "1")
      .optional(),
  })
  .strict();

export const agingQuerySchema = z
  .object({
    kind: z.enum(PRODUCT_KINDS).optional(),
    /** Only items currently on the shelf — expired/zero stock is noise here. */
    inStockOnly: z
      .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      .transform((v) => v === true || v === "true" || v === "1")
      .optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();

// ── Query parsing ───────────────────────────────────────────────────────────

/**
 * The minimum a zod schema has to expose for this module to infer its OUTPUT
 * type.
 *
 * It is deliberately not typed as `z.ZodType<T>`: that declaration fixes the
 * *input* generic to `T` as well, so TypeScript infers `T` from
 * `ZodObject<…, Output, Input>`'s **input** shape and every transformed query
 * parameter comes out as its pre-transform union (`"true" | "false" | …`
 * instead of `boolean`). Naming the return type directly is what makes
 * `parseQuery(…, schema)` hand back the schema's real output.
 */
export interface SafeParser<T> {
  safeParse(data: unknown): z.SafeParseReturnType<unknown, T>;
}

/**
 * Validates a URL's query string against a `.strict()` schema.
 *
 * Strict on purpose: a mistyped filter (`?prodcutId=…`) that is silently ignored
 * is how someone concludes the low-stock view is broken. Unknown keys are a 400.
 */
export function parseQuery<T>(search: URLSearchParams | string, schema: SafeParser<T>): T {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const raw: Record<string, string> = {};
  for (const key of new Set(params.keys())) {
    const value = params.get(key);
    if (value !== null) raw[key] = value;
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const fields: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    (fields[key] ??= []).push(issue.message);
  }
  throw new ApiError("VALIDATION_ERROR", "Please check the filters.", { fields });
}

/**
 * Validates a JSON request body against a `.strict()` schema. Mirrors
 * `@/lib/http`'s `parseBody` but keeps this module free of `server-only` so the
 * QA agent can drive it directly.
 */
export function parseJson<T>(raw: unknown, schema: SafeParser<T>): T {
  if (raw === null || raw === undefined) {
    throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const fields: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    (fields[key] ??= []).push(issue.message);
  }
  throw new ApiError("VALIDATION_ERROR", "Please check the highlighted fields.", { fields });
}

// ── Cron ────────────────────────────────────────────────────────────────────

export const inventoryExpiryQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(1_000).optional(),
  })
  .partial()
  .strict();
