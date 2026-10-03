/**
 * STAFF AUTH VALIDATION — `POST /api/admin/session/login` + admin list queries.
 */
import "server-only";

import { z } from "zod";

import { BOOKING_STATUSES } from "@/lib/types";
import { cappedText, cleanText } from "@/lib/server/validation/primitives";

export const loginShape = {
  email: z
    .string({ required_error: "Enter your work email." })
    .trim()
    .toLowerCase()
    .min(3, "Enter your work email.")
    .max(160, "Email is too long.")
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Enter a valid work email."),
  password: z
    .string({ required_error: "Enter your password." })
    .min(1, "Enter your password.")
    .max(200, "Password is too long.")
    // Never echoed into a log line or an error message.
    .transform((v) => v.trim()),
} as const;

export const loginSchema = z.object(loginShape).strict();
export type LoginInput = z.output<typeof loginSchema>;

export const ADMIN_PAGE_SIZES = [25, 50, 100] as const;

export const bookingListQueryShape = {
  status: z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((v) => (v ? v.trim().toUpperCase() : undefined))
    .refine((v) => v === undefined || (BOOKING_STATUSES as readonly string[]).includes(v), "Unknown status."),
  /** ISO `YYYY-MM-DD` local-day filter on `startAt`. */
  date: z
    .union([z.string(), z.undefined()])
    .optional()
    .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use YYYY-MM-DD."),
  /** Free-text search across reference and the *denormalised* contact fields. */
  q: z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((v) => (v ? cleanText(v) : undefined))
    .refine((v) => v === undefined || v.length <= 80, "Search is too long."),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50),
} as const;

export const bookingListQuerySchema = z.object(bookingListQueryShape).strict();

export const bookingStatusUpdateShape = {
  status: z.enum(BOOKING_STATUSES, {
    errorMap: () => ({ message: "Unknown status." }),
  }),
  /** Optional staff note. Never surfaced to the customer. */
  staffNotes: cappedText("Staff note", 1000),
  /** Refuse the work — only meaningful for `CANCELLED`/`NO_SHOW`. */
  reason: cappedText("Reason", 300),
} as const;

export const bookingStatusUpdateSchema = z.object(bookingStatusUpdateShape).strict();
export type BookingStatusUpdateInput = z.output<typeof bookingStatusUpdateSchema>;

export const categoryUpsertShape = {
  id: z.string().trim().min(4).max(40).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only."),
  name: z.string().trim().min(2).max(60),
  blurb: cappedText("Blurb", 200),
  icon: cappedText("Icon", 40),
  accentFrom: cappedText("Accent", 20),
  accentTo: cappedText("Accent", 20),
  sortOrder: z.number().int().min(0).max(999).optional().default(0),
  isActive: z.boolean().optional().default(true),
} as const;

export const categoryUpsertSchema = z.object(categoryUpsertShape).strict();
export type CategoryUpsertInput = z.output<typeof categoryUpsertSchema>;

const pricingValues = ["FIXED", "RANGE", "CALL_FOR_PRICE"] as const;

export const serviceUpsertShape = {
  id: z.string().trim().min(4).max(40).optional(),
  categoryId: z.string().trim().min(4).max(40),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only."),
  name: z.string().trim().min(2).max(80),
  shortName: cappedText("Short name", 30),
  summary: z.string().trim().min(5).max(200),
  description: z.string().trim().min(5).max(2000),
  pricing: z.enum(pricingValues).default("RANGE"),
  priceMin: z.number().int().min(0).max(10_000_000).nullable().optional(),
  priceMax: z.number().int().min(0).max(10_000_000).nullable().optional(),
  priceNote: cappedText("Price note", 120),
  durationMin: z.number().int().min(5).max(1440).nullable().optional(),
  isPopular: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),
  requiresVehicle: z.boolean().optional().default(false),
  includes: z.array(z.string().trim().min(1).max(120)).max(20).optional().default([]),
  excludes: z.array(z.string().trim().min(1).max(120)).max(20).optional().default([]),
  sortOrder: z.number().int().min(0).max(999).optional().default(0),
  isActive: z.boolean().optional().default(true),
} as const;

export const serviceUpsertSchema = z
  .object(serviceUpsertShape)
  .strict()
  .superRefine((val, ctx) => {
    // A FIXED service with a range is a lie. Enforce the invariant here so the
    // booking/quote engines can trust the pricing column.
    if (val.pricing === "CALL_FOR_PRICE") {
      if (val.priceMin !== null && val.priceMin !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["priceMin"], message: "Leave blank for call-for-price." });
      }
    } else {
      if (val.priceMin === null || val.priceMin === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["priceMin"], message: "A starting price is required." });
      }
      if (val.priceMax !== null && val.priceMax !== undefined && val.priceMin !== null && val.priceMin !== undefined) {
        if (val.priceMax < val.priceMin) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["priceMax"], message: "Maximum must be at least the minimum." });
        }
      }
    }
  });

export type ServiceUpsertInput = z.output<typeof serviceUpsertSchema>;

export const packageUpsertShape = {
  id: z.string().trim().min(4).max(40).optional(),
  categoryId: z.string().trim().min(4).max(40).nullable().optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only."),
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().min(2).max(140),
  description: z.string().trim().min(5).max(2000),
  priceMin: z.number().int().min(0).max(10_000_000),
  priceMax: z.number().int().min(0).max(10_000_000).nullable().optional(),
  compareAtMin: z.number().int().min(0).max(10_000_000).nullable().optional(),
  savingsPct: z.number().int().min(0).max(95).nullable().optional(),
  badge: cappedText("Badge", 40),
  isSeasonal: z.boolean().optional().default(false),
  seasonKey: cappedText("Season", 20),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(999).optional().default(0),
  /** Service ids that make up the bundle. */
  itemServiceIds: z.array(z.string().trim().min(4).max(40)).min(1).max(20),
} as const;

export const packageUpsertSchema = z.object(packageUpsertShape).strict();
export type PackageUpsertInput = z.output<typeof packageUpsertSchema>;

export const promotionUpsertShape = {
  id: z.string().trim().min(4).max(40).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only."),
  title: z.string().trim().min(2).max(100),
  subtitle: z.string().trim().min(2).max(160),
  description: z.string().trim().min(5).max(2000),
  kind: z.enum(["PERCENT_OFF", "FIXED_OFF", "BUNDLE", "CLEARANCE", "SEASONAL", "TIRES"]),
  badge: cappedText("Badge", 40),
  /** Promotable code the quote/booking engines can apply. */
  code: z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((v) => (v ? v.trim().toUpperCase() : undefined))
    .refine((v) => v === undefined || /^[A-Z0-9-]{3,24}$/.test(v), "Codes are 3–24 letters, numbers or dashes."),
  valuePct: z.number().int().min(1).max(90).nullable().optional(),
  valueOff: z.number().int().min(1).max(1_000_000).nullable().optional(),
  terms: z.array(z.string().trim().min(1).max(200)).max(12).optional().default([]),
  imageUrl: z.string().trim().url().max(300).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  priority: z.number().int().min(0).max(999).optional().default(0),
} as const;

export const promotionUpsertSchema = z
  .object(promotionUpsertShape)
  .strict()
  .superRefine((val, ctx) => {
    const pct = val.valuePct ?? null;
    const off = val.valueOff ?? null;
    if (val.kind === "PERCENT_OFF" && (pct === null || pct === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["valuePct"], message: "Percent promos need a percentage." });
    }
    if (val.kind === "FIXED_OFF" && (off === null || off === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["valueOff"], message: "Fixed promos need an amount." });
    }
    if (val.startsAt && val.endsAt && new Date(val.endsAt) <= new Date(val.startsAt)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "End date must be after the start date." });
    }
  });

export type PromotionUpsertInput = z.output<typeof promotionUpsertSchema>;

export const leadListQueryShape = {
  kind: z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((v) => (v ? v.trim().slice(0, 40) : undefined)),
  status: z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((v) => (v ? v.trim().slice(0, 40) : undefined)),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
} as const;

export const leadListQuerySchema = z.object(leadListQueryShape).strict();

export const leadStatusUpdateSchema = z
  .object({
    id: z.string().trim().min(4).max(40).regex(/^[a-z0-9]+$/i, "Invalid lead id."),
    status: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .refine((v) => /^[a-z0-9_-]+$/.test(v), "Invalid status."),
  })
  .strict();

export type LeadStatusUpdateInput = z.output<typeof leadStatusUpdateSchema>;

export const closureUpsertShape = {
  id: z.string().trim().min(4).max(40).optional(),
  title: z.string().trim().min(2).max(120),
  /** ISO instants; `allDay` is expressed by making them span the local day. */
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: cappedText("Reason", 300),
  isActive: z.boolean().optional().default(true),
} as const;

export const closureUpsertSchema = z
  .object(closureUpsertShape)
  .strict()
  .superRefine((val, ctx) => {
    if (new Date(val.endsAt) <= new Date(val.startsAt)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "End must be after the start." });
    }
    if (new Date(val.endsAt).getTime() - new Date(val.startsAt).getTime() > 90 * 86_400_000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "Closures longer than 90 days are not supported here." });
    }
  });

export type ClosureUpsertInput = z.output<typeof closureUpsertSchema>;
