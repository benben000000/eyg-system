/**
 * EYG — BOOKING API CLIENT
 * ============================================================================
 * The only place in the app that talks to `/api/availability` or
 * `/api/booking`. Every branch of the network is named, because a booking flow
 * that shows a raw JSON dump to a customer standing next to a broken car is the
 * single worst outcome this page can have.
 *
 * Contract (from `src/lib/types.ts`):
 *   GET  /api/availability?date=YYYY-MM-DD      → ApiResult<SlotAvailabilityDto>
 *   POST /api/booking      CreateBookingInput   → ApiResult<BookingDto>
 *
 * Outcomes are discriminated so the caller cannot accidentally treat a network
 * error as a valid empty slot list.
 * ============================================================================
 */

import type {
  ApiMeta,
  BookingDto,
  CreateBookingInput,
  SlotAvailabilityDto,
} from "@/lib/types";
import type { BookingFailure, BookingFailureKind } from "@/components/pages/booking/types";

export type Outcome<T> =
  | { kind: "ok"; data: T; meta: ApiMeta | null }
  | {
      kind: "http-error";
      status: number;
      code: string;
      message: string;
      fields: Record<string, string[]>;
      meta: ApiMeta | null;
      /** `Retry-After` header in seconds, if the server sent one. */
      retryAfter: number | null;
    };

interface RawResponse {
  httpStatus: number;
  /** `null` when the body was not JSON at all. */
  body: unknown;
  /** `Retry-After` in seconds, if the server sent a usable one. */
  retryAfter: number | null;
  isJson: boolean;
}

function readRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * `fetch` with every failure mode converted into a value.
 * A thrown `fetch` here means the request never completed — no response at all.
 */
async function request(
  input: string,
  init?: RequestInit,
): Promise<RawResponse | { kind: "network"; offline: boolean; message: string }> {
  try {
    const res = await fetch(input, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      // Session cookies only; nothing secret is sent from the browser.
      credentials: "same-origin",
    });

    const raw = await res.text();
    let parsed: unknown = null;
    let isJson = false;
    if (raw.length > 0) {
      try {
        parsed = JSON.parse(raw);
        isJson = true;
      } catch {
        isJson = false;
      }
    }

    return {
      httpStatus: res.status,
      body: parsed,
      retryAfter: readRetryAfter(res.headers.get("retry-after")),
      isJson,
    };
  } catch (err) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return {
      kind: "network",
      offline,
      message:
        err instanceof Error && err.message
          ? err.message
          : "The request could not be sent.",
    };
  }
}

function readMeta(body: unknown): ApiMeta | null {
  if (!isRecord(body)) return null;
  const meta = body["meta"];
  if (!isRecord(meta) || typeof meta["requestId"] !== "string") return null;
  return meta as unknown as ApiMeta;
}

function readEnvelope<T>(raw: RawResponse): Outcome<T> {
  if (raw.isJson && isRecord(raw.body)) {
    const body = raw.body;
    const meta = readMeta(body);
    if (body["ok"] === true && "data" in body) {
      return { kind: "ok", data: body["data"] as T, meta };
    }
    const error = isRecord(body["error"]) ? body["error"] : null;
    const code = error && typeof error["code"] === "string" ? error["code"] : "INTERNAL_ERROR";
    const message =
      error && typeof error["message"] === "string" && error["message"].length > 0
        ? error["message"]
        : `The server returned ${raw.httpStatus}.`;
    const fields =
      error && isRecord(error["fields"])
        ? (Object.fromEntries(
            Object.entries(error["fields"]).filter(
              (entry): entry is [string, string[]] => Array.isArray(entry[1]),
            ),
          ) as Record<string, string[]>)
        : {};
    return {
      kind: "http-error",
      status: raw.httpStatus,
      code,
      message,
      fields,
      meta,
      retryAfter: raw.retryAfter,
    };
  }

  // Non-JSON body. Do not surface it — a 502 HTML page is not an explanation.
  return {
    kind: "http-error",
    status: raw.httpStatus,
    code: "SERVICE_UNAVAILABLE",
    message: `We could not read the server's response (HTTP ${raw.httpStatus}).`,
    fields: {},
    meta: null,
    retryAfter: raw.retryAfter,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY
// ─────────────────────────────────────────────────────────────────────────────

export type AvailabilityOutcome =
  | { kind: "ok"; data: SlotAvailabilityDto }
  | { kind: "offline" }
  | { kind: "error"; title: string; message: string; retryable: boolean };

export async function fetchAvailability(
  date: string,
  serviceSlugs: readonly string[],
  signal?: AbortSignal,
): Promise<AvailabilityOutcome> {
  const params = new URLSearchParams({ date });
  for (const slug of serviceSlugs) params.append("serviceIds", slug);

  const raw = await request(`/api/availability?${params.toString()}`, {
    method: "GET",
    signal,
    // The slot list is live data. Never serve this from the router cache.
    cache: "no-store",
  });

  if ("kind" in raw) {
    return raw.offline
      ? { kind: "offline" }
      : {
          kind: "error",
          title: "We could not load the slot list",
          message:
            "The booking system did not answer. Everything else on this page still works — call the shop and we will fit you in.",
          retryable: true,
        };
  }

  const outcome = readEnvelope<SlotAvailabilityDto>(raw);
  if (outcome.kind === "ok") return { kind: "ok", data: outcome.data };

  if (outcome.status === 503 || outcome.code === "SERVICE_UNAVAILABLE" || outcome.code === "MAINTENANCE") {
    return {
      kind: "error",
      title: "The booking system is briefly down",
      message:
        "This is on us, not on you. Calling the shop works right now — someone will note your slot down for you.",
      retryable: true,
    };
  }

  return {
    kind: "error",
    title: "We could not load the slot list",
    message: "Try again in a moment, or call the shop and we will take the booking.",
    retryable: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE BOOKING
// ─────────────────────────────────────────────────────────────────────────────

export type SubmitOutcome =
  | { kind: "ok"; data: BookingDto }
  | { kind: "offline" }
  | { kind: "failure"; failure: BookingFailure };

function classify(
  outcome: Extract<Outcome<BookingDto>, { kind: "http-error" }>,
): BookingFailureKind {
  if (outcome.status === 409 || outcome.code === "CONFLICT" || outcome.code === "SLOT_UNAVAILABLE") {
    return "conflict";
  }
  if (outcome.status === 429 || outcome.code === "RATE_LIMITED") return "rate-limited";
  if (outcome.status === 400 || outcome.code === "VALIDATION_ERROR" || outcome.code === "SPAM_REJECTED" || outcome.code === "CAPTCHA_FAILED") {
    return "validation";
  }
  if (outcome.status >= 500) return "server";
  return "unknown";
}

/** Turns a failure into a headline + explanation written for a customer. */
function toFailure(
  kind: BookingFailureKind,
  outcome: Extract<Outcome<BookingDto>, { kind: "http-error" }>,
): BookingFailure {
  const retryAfter = outcome.meta?.retryAfter ?? outcome.retryAfter;

  switch (kind) {
    case "conflict":
      return {
        kind,
        title: "That slot was just taken",
        message:
          "Someone booked it a moment before you. Your vehicle, services and details are all still here — pick another time on the same date, or try the next day.",
        fields: {},
        retryAfterSeconds: null,
        requestId: outcome.meta?.requestId ?? null,
      };
    case "rate-limited":
      return {
        kind,
        title: "Too many attempts from this device",
        message:
          "We have paused new bookings for a moment to stop anyone else being locked out. Wait for the timer, then try once more — everything you typed is still saved.",
        fields: {},
        retryAfterSeconds: retryAfter !== null && retryAfter !== undefined ? retryAfter : 60,
        requestId: outcome.meta?.requestId ?? null,
      };
    case "validation": {
      const hasFields = Object.keys(outcome.fields).length > 0;
      return {
        kind,
        title: hasFields ? "Check the highlighted details" : "We could not accept that booking",
        message: hasFields
          ? "The fields below need a change. Everything else you entered is still here."
          : outcome.message,
        fields: outcome.fields,
        retryAfterSeconds: null,
        requestId: outcome.meta?.requestId ?? null,
      };
    }
    case "server":
      return {
        kind,
        title: "Something went wrong at our end",
        message:
          "The booking was not saved, so no bay is being held for you. Please try once more — and if it fails again, call the shop and we will take it down for you.",
        fields: {},
        retryAfterSeconds: null,
        requestId: outcome.meta?.requestId ?? null,
      };
    default:
      return {
        kind: "unknown",
        title: "That booking did not go through",
        message:
          "We are not sure why, and we would rather say so than guess. Nothing has been charged and nothing has been booked. Call the shop, or try again.",
        fields: outcome.fields,
        retryAfterSeconds: null,
        requestId: outcome.meta?.requestId ?? null,
      };
  }
}

export async function submitBooking(input: CreateBookingInput): Promise<SubmitOutcome> {
  const raw = await request("/api/booking", {
    method: "POST",
    body: JSON.stringify(input),
  });

  if ("kind" in raw) {
    if (raw.offline) return { kind: "offline" };
    return {
      kind: "failure",
      failure: {
        kind: "server",
        title: "We could not reach the booking system",
        message:
          "Your connection dropped before the booking could be sent. Nothing was saved and nothing was charged. Check your signal and press Confirm again, or call the shop.",
        fields: {},
        retryAfterSeconds: null,
        requestId: null,
      },
    };
  }

  const outcome = readEnvelope<BookingDto>(raw);
  if (outcome.kind === "ok") return { kind: "ok", data: outcome.data };

  const kind = classify(outcome);
  // A 400 from a spam/captcha rejection must not read like a customer mistake.
  if (kind === "validation" && (outcome.code === "SPAM_REJECTED" || outcome.code === "CAPTCHA_FAILED")) {
    return {
      kind: "failure",
      failure: {
        kind: "validation",
        title: "We could not verify that request",
        message:
          "Our systems flagged the submission and stopped it before anything was booked. Please try again, or call the shop and book over the phone.",
        fields: outcome.fields,
        retryAfterSeconds: null,
        requestId: outcome.meta?.requestId ?? null,
      },
    };
  }

  return { kind: "failure", failure: toFailure(kind, outcome) };
}
