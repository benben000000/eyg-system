"use client";

/**
 * AVAILABILITY — `GET /api/availability?date=YYYY-MM-DD`
 * ============================================================================
 * ENDPOINT CONTRACT (expected from backend-core)
 * ---------------------------------------------------------------------------
 *   GET /api/availability?date=2026-10-04&serviceIds=a&serviceIds=b
 *   200 → ApiResult<SlotAvailabilityDto>   (from @/lib/types)
 *   404 → the shop has no schedule for that date (treated as "closed")
 *   429 → ApiFailure with meta.retryAfter
 *
 * GUARANTEES
 *  - One in-flight request per date; a date change aborts the previous one.
 *  - A 404/`NOT_FOUND` is NOT an error — it renders the designed closed-day
 *    state, because a closed day is a real answer, not a failure.
 *  - Any other failure renders the designed error state with retry, and the
 *    phone number, never a raw error.
 *  - `400` on a bad date string renders the same error state (defensive).
 * ============================================================================
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/components/widgets/internal/api";
import { addDaysYmd, ymdWeekday } from "@/components/widgets/internal/time-ph";
import type { SlotAvailabilityDto } from "@/lib/types";

export type AvailabilityStatus = "idle" | "loading" | "success" | "empty" | "error";

export interface AvailabilityState {
  status: AvailabilityStatus;
  data: SlotAvailabilityDto | null;
  error: string | null;
  /** Seconds until retry is allowed, from `meta.retryAfter`. */
  retryAfter: number | null;
  /** Increments on every successful load — lets a conflict force a refresh. */
  version: number;
  retry: () => void;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateParam(date: string | null | undefined): date is string {
  return typeof date === "string" && DATE_RE.test(date);
}

export interface UseAvailabilityOptions {
  /**
   * Optional service ids, sent as repeated `serviceIds=` params so the server can
   * size the bay window to the work that was selected.
   */
  serviceIds?: readonly string[] | undefined;
}

/** `?date=2026-10-04&serviceIds=a&serviceIds=b` */
export function buildAvailabilityPath(date: string, serviceIds: readonly string[] = []): string {
  const params = new URLSearchParams({ date });
  for (const id of serviceIds) {
    if (id) params.append("serviceIds", id);
  }
  return `/api/availability?${params.toString()}`;
}

export function useAvailability(
  date: string | null,
  options: UseAvailabilityOptions = {},
): AvailabilityState {
  const { serviceIds } = options;
  const serviceKey = (serviceIds ?? []).join(",");
  const [state, setState] = useState<AvailabilityState>({
    status: "idle",
    data: null,
    error: null,
    retryAfter: null,
    version: 0,
    retry: () => {},
  });
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isValidDateParam(date)) return;
    if (typeof window === "undefined") return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, status: "loading", error: null, retryAfter: null }));

    void (async () => {
      const result = await apiFetch<SlotAvailabilityDto>(
        buildAvailabilityPath(date, serviceIds),
        {
          signal: controller.signal,
          timeoutMs: 10_000,
        },
      );
      if (controller.signal.aborted) return;

      if (result.ok) {
        const data = result.data;
        const bookable = data.slots.filter((s) => s.capacityLeft > 0).length;
        setState((prev) => ({
          status: data.isClosed || bookable === 0 ? "empty" : "success",
          data,
          error: null,
          retryAfter: null,
          version: prev.version + 1,
          retry,
        }));
        return;
      }

      // A closed day is a valid answer, not a failure.
      if (result.error.code === "NOT_FOUND") {
        setState((prev) => ({
          status: "empty",
          data: {
            date,
            timezone: "Asia/Manila",
            totalCapacity: 0,
            slots: [],
            isClosed: true,
            closedReason: "No bays are scheduled on this date.",
          },
          error: null,
          retryAfter: null,
          version: prev.version + 1,
          retry,
        }));
        return;
      }

      setState((prev) => ({
        status: "error",
        data: null,
        error: result.error.message,
        retryAfter:
          typeof result.meta?.retryAfter === "number" && Number.isFinite(result.meta.retryAfter)
            ? Math.max(0, result.meta.retryAfter)
            : null,
        version: prev.version,
        retry,
      }));
    })();

    return () => {
      controller.abort();
      if (abortRef.current === controller) abortRef.current = null;
    };
  }, [date, serviceKey, serviceIds, nonce, retry]);

  return state;
}

/**
 * First open day within `horizon` days, used by the zero-availability state to
 * offer "try Tuesday instead" without forcing the customer to hunt.
 *
 * Pure and synchronous: the caller supplies the daily `isClosed` truth it
 * already has (from `BUSINESS_HOURS` + the API), so this never guesses.
 *
 * TIMEZONE NOTE: a `YYYY-MM-DD` string has no time component, so parsing it at
 * UTC midnight and reading `getUTCDay()` yields the correct weekday for that
 * calendar date regardless of the viewer's timezone. No offset arithmetic is
 * needed or wanted here.
 */
export function firstOpenDate(
  fromYmd: string,
  horizonDays: number,
  isClosedDay: (dayOfWeek: number) => boolean,
): string | null {
  for (let offset = 1; offset <= horizonDays; offset += 1) {
    const candidate = addDaysYmd(fromYmd, offset);
    const day = ymdWeekday(candidate);
    if (day === null) continue;
    if (!isClosedDay(day)) return candidate;
  }
  return null;
}

/** Turns `hour + hour` capacity into honest, non-alarming copy. */
export function capacityCopy(capacityLeft: number): string {
  if (capacityLeft <= 0) return "Fully booked";
  if (capacityLeft === 1) return "Last bay";
  if (capacityLeft <= 3) return `${capacityLeft} bays left`;
  return `${capacityLeft} bays open`;
}