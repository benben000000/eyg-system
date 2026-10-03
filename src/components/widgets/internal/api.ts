/**
 * CLIENT-SIDE API ACCESS — shared by every interactive widget.
 * ============================================================================
 * Owned by the *widgets* agent. Lives inside `src/components/widgets/internal/`
 * so it is not confused with the server data layer (`src/lib/server/**`).
 *
 * RULES ENFORCED HERE
 *  - Every call returns the shared `ApiResult<T>` envelope. A non-2xx response,
 *    a thrown network error and an unreachable server are all normalised into
 *    an `ApiFailure` so a widget NEVER has to try/catch a fetch itself.
 *  - No raw response body, stack trace or thrown object ever escapes. Errors
 *    carry a short `message` and a stable `code`.
 *  - Every request is abortable and every widget aborts on unmount.
 * ============================================================================
 */
import type { ApiFailure, ApiMeta, ApiResult } from "@/lib/types";
import { API_ERROR_CODES } from "@/lib/types";

export type { ApiMeta };

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body. `undefined` sends no body. */
  body?: unknown;
  signal?: AbortSignal;
  /** Extra headers. `If-None-Match` is honoured by the caller for reviews. */
  headers?: Record<string, string>;
  /** Client-side cap so a hanging request never spins forever. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 12_000;

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException ? e.name === "AbortError" : e instanceof Error && e.name === "AbortError";
}

/** Coerces an unknown thrown value into a short, human-safe sentence. */
export function safeErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof TypeError) {
    // `fetch` rejects with TypeError for DNS / offline / CORS / bad host.
    return "We could not reach the website. Check your connection, or call the shop instead.";
  }
  if (e instanceof Error && e.message.trim() !== "") return e.message.trim();
  return fallback;
}

function failure(
  code: ApiFailure["error"]["code"],
  message: string,
  meta?: ApiMeta,
  fields?: Record<string, string[]>,
): ApiFailure {
  return meta
    ? { ok: false, error: fields ? { code, message, fields } : { code, message }, meta }
    : { ok: false, error: fields ? { code, message, fields } : { code, message } };
}

function isApiCode(value: unknown): value is ApiFailure["error"]["code"] {
  return typeof value === "string" && (API_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * One HTTP round trip against the app's own API. Never throws.
 */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<ApiResult<T>> {
  const { method = "GET", body, signal, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      return failure("SERVICE_UNAVAILABLE", "That request was cancelled.");
    }
    signal.addEventListener("abort", onOuterAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const init: RequestInit = {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      // Send no cookies cross-origin; same-origin fetch is credential-free here
      // because nothing in the public funnel is session-authenticated.
      credentials: "same-origin",
      cache: "no-store",
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    const response = await fetch(path, init);

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const obj =
      typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : null;
    const meta =
      obj && typeof obj.meta === "object" && obj.meta !== null
        ? (obj.meta as ApiMeta)
        : { requestId: response.headers.get("x-request-id") ?? "" };

    if (response.ok && obj && obj.ok === true) {
      return { ok: true, data: obj.data as T, meta };
    }

    const rawError =
      obj && typeof obj.error === "object" && obj.error !== null
        ? (obj.error as Record<string, unknown>)
        : undefined;
    const code = isApiCode(rawError?.code)
      ? rawError.code
      : response.status === 404
        ? "NOT_FOUND"
        : response.status === 429
          ? "RATE_LIMITED"
          : response.status >= 500
            ? "INTERNAL_ERROR"
            : "VALIDATION_ERROR";
    const message =
      typeof rawError?.message === "string" && rawError.message.trim() !== ""
        ? rawError.message
        : `The shop system replied with an unexpected answer (HTTP ${response.status}). Please try again, or call us.`;
    const fields =
      typeof rawError?.fields === "object" && rawError.fields !== null
        ? (rawError.fields as Record<string, string[]>)
        : undefined;

    return failure(code, message, meta, fields);
  } catch (e) {
    if (isAbortError(e) && !signal?.aborted) {
      return failure(
        "SERVICE_UNAVAILABLE",
        "That took too long to answer. Check your connection, or call the shop.",
      );
    }
    if (isAbortError(e)) return failure("SERVICE_UNAVAILABLE", "That request was cancelled.");
    return failure("SERVICE_UNAVAILABLE", safeErrorMessage(e, "We could not reach the website."));
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onOuterAbort);
  }
}

/**
 * Same normalisation as `apiFetch`, but also surfaces the response `ETag` and
 * HTTP status so a cache-aware caller (reviews) can do stale-while-revalidate.
 */
export async function apiFetchWithMeta<T>(
  path: string,
  options: ApiOptions = {},
): Promise<{ result: ApiResult<T>; etag: string | null; status: number }> {
  const { method = "GET", body, signal, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  let etag: string | null = null;
  let status = 0;
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  if (signal) signal.addEventListener("abort", onOuterAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const init: RequestInit = {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      credentials: "same-origin",
      cache: "no-store",
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    const response = await fetch(path, init);
    status = response.status;
    etag = response.headers.get("etag");

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const obj =
      typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : null;

    if (response.ok && obj && obj.ok === true) {
      const meta =
        obj.meta && typeof obj.meta === "object" ? (obj.meta as ApiMeta) : ({ requestId: etag ?? "" } as ApiMeta);
      return { result: { ok: true, data: obj.data as T, meta }, etag, status };
    }
    const rawError =
      obj && typeof obj.error === "object" && obj.error !== null
        ? (obj.error as Record<string, unknown>)
        : undefined;
    const code = isApiCode(rawError?.code)
      ? rawError.code
      : response.status === 404
        ? "NOT_FOUND"
        : response.status === 429
          ? "RATE_LIMITED"
          : response.status >= 500
            ? "INTERNAL_ERROR"
            : "VALIDATION_ERROR";
    const message =
      typeof rawError?.message === "string" && rawError.message.trim() !== ""
        ? rawError.message
        : "The shop system sent back something we could not read. Please try again, or call us.";
    const fields =
      typeof rawError?.fields === "object" && rawError.fields !== null
        ? (rawError.fields as Record<string, string[]>)
        : undefined;
    return { result: failure(code, message, undefined, fields), etag, status };
  } catch (e) {
    if (isAbortError(e)) return { result: failure("SERVICE_UNAVAILABLE", "That request was cancelled."), etag, status };
    return {
      result: failure("SERVICE_UNAVAILABLE", safeErrorMessage(e, "We could not reach the website.")),
      etag,
      status,
    };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onOuterAbort);
  }
}

/** `ApiResult` → a short, safe sentence. Used for inline error copy. */
export function errorMessage(result: ApiResult<unknown>, fallback: string): string {
  return result.ok ? fallback : result.error.message || fallback;
}

export const api = {
  get: <T,>(path: string, signal?: AbortSignal, headers?: Record<string, string>) =>
    apiFetch<T>(path, { method: "GET", ...(signal ? { signal } : {}), ...(headers ? { headers } : {}) }),
  post: <T,>(path: string, body: unknown, signal?: AbortSignal) =>
    apiFetch<T>(path, { method: "POST", body, ...(signal ? { signal } : {}) }),
} as const;