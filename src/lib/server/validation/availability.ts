/**
 * AVAILABILITY QUERY VALIDATION — `GET /api/availability?date=&serviceIds=`
 */
import "server-only";

import { z } from "zod";

import { BOOKING } from "@/config/site";
import { isValidDateKey } from "@/lib/server/time";

export const availabilityQueryShape = {
  /** `YYYY-MM-DD` in the shop's local calendar (Asia/Manila). */
  date: z
    .string()
    .trim()
    .refine(isValidDateKey, "Use the format YYYY-MM-DD.")
    .refine(
      (v) => {
        // Bound the range so a caller cannot make us compute a date in 2099.
        const [y, m, d] = v.split("-").map(Number) as [number, number, number];
        const dt = Date.UTC(y, m - 1, d);
        const now = Date.now();
        const min = now - 2 * 86_400_000;
        const max = now + (BOOKING.horizonDays + 2) * 86_400_000;
        return dt >= min && dt <= max;
      },
      "That date is outside our booking window.",
    ),
  /**
   * Comma-separated ids. Optional: capacity is per-bay, not per-service, so
   * the board is identical with or without them. Kept for caching granularity
   * and so the UI can pre-highlight services that need a full slot.
   */
  serviceIds: z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((v) => {
      if (!v) return [] as string[];
      return [
        ...new Set(
          v
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        ),
      ].slice(0, BOOKING.maxServicesPerBooking);
    })
    .refine((ids) => ids.every((id) => /^[a-z0-9]{4,40}$/i.test(id)), "Invalid service id."),
} as const;

export const availabilityQuerySchema = z.object(availabilityQueryShape).strict();

export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
