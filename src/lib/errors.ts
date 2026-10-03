/**
 * API ERRORS — the one error type the HTTP layer understands.
 * ============================================================================
 * Every failure that leaves the server as a response body is an `ApiError`:
 * a stable machine code from `API_ERROR_CODES` plus a message that is safe to
 * show a customer. Anything that is *not* an `ApiError` is treated as an
 * internal fault, logged with its `requestId`, and reported as a generic
 * `INTERNAL_ERROR` so no stack/SQL/Prisma internals ever reach the client.
 */
import type { ApiErrorCode } from "@/lib/types";

export interface ApiErrorOptions {
  /** HTTP status. Defaults to the canonical status for `code`. */
  status?: number;
  /** Per-field validation messages, surfaced on 400/422 responses. */
  fields?: Record<string, string[]>;
  /** Machine-readable detail for the client (e.g. `promoStatus`). */
  details?: Record<string, unknown>;
  /** Seconds the client should wait. Drives `Retry-After`. */
  retryAfter?: number;
  /** Log-only context. Never serialised into the response body. */
  logMeta?: Record<string, unknown>;
  cause?: unknown;
}

/** Canonical status per error code. Single source of truth for status mapping. */
export const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  CAPTCHA_FAILED: 422,
  SPAM_REJECTED: 422,
  SLOT_UNAVAILABLE: 409,
  SERVICE_UNAVAILABLE: 503,
  MAINTENANCE: 503,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields: Record<string, string[]> | undefined;
  readonly details: Record<string, unknown> | undefined;
  readonly retryAfter: number | undefined;
  readonly logMeta: Record<string, unknown> | undefined;

  constructor(code: ApiErrorCode, message: string, options: ApiErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ApiError";
    this.code = code;
    this.status = options.status ?? STATUS_BY_CODE[code];
    this.fields = options.fields;
    this.details = options.details;
    this.retryAfter = options.retryAfter;
    this.logMeta = options.logMeta;
  }

  /** Narrowing helper — works across module/serialisation boundaries. */
  static is(value: unknown): value is ApiError {
    if (value instanceof ApiError) return true;
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as { name?: unknown; code?: unknown; status?: unknown; message?: unknown };
    return (
      candidate.name === "ApiError" &&
      typeof candidate.code === "string" &&
      typeof candidate.status === "number" &&
      typeof candidate.message === "string"
    );
  }
}

export const validationError = (message: string, fields?: Record<string, string[]>) =>
  new ApiError("VALIDATION_ERROR", message, { fields });

export const unauthenticated = (message = "Please sign in to continue.") =>
  new ApiError("UNAUTHENTICATED", message);

export const forbidden = (message = "You do not have access to this resource.") =>
  new ApiError("FORBIDDEN", message);

export const notFound = (message = "Not found.") => new ApiError("NOT_FOUND", message);

export const conflict = (message: string, options?: Omit<ApiErrorOptions, "status">) =>
  new ApiError("CONFLICT", message, options);

export const rateLimited = (message: string, retryAfter: number) =>
  new ApiError("RATE_LIMITED", message, { retryAfter, status: 429 });

export const captchaFailed = (message = "Please solve the quick math check again.") =>
  new ApiError("CAPTCHA_FAILED", message);

export const spamRejected = (message = "Your submission looked automated. Please try again.") =>
  new ApiError("SPAM_REJECTED", message);

export const slotUnavailable = (message: string, options?: Omit<ApiErrorOptions, "status" | "code">) =>
  new ApiError("SLOT_UNAVAILABLE", message, { status: 409, ...options });

export const serviceUnavailable = (message: string, retryAfter?: number) =>
  new ApiError("SERVICE_UNAVAILABLE", message, { retryAfter, status: 503 });

export const maintenance = (message = "We are doing maintenance. Please try again shortly.", retryAfter = 900) =>
  new ApiError("MAINTENANCE", message, { retryAfter, status: 503 });

export const internalError = (message = "Something went wrong on our side. Please try again.") =>
  new ApiError("INTERNAL_ERROR", message, { status: 500 });
