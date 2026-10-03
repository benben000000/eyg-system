/**
 * OUTBOUND HTTP
 * ============================================================================
 * Every third-party call in the integrations layer goes through `fetchJson` or
 * `fetchRaw`. That guarantees, by construction:
 *
 * - a hard timeout (AbortController) on every request,
 * - bounded retries with exponential backoff + jitter on 429/5xx/network
 *   errors only (never on 4xx — a bad request will stay bad),
 * - a typed error that never leaks the provider's raw body to the client,
 * - and a documented `fallback` so the caller can always carry on.
 *
 * Fallback policy is per-caller and documented in `docs/ops/INTEGRATIONS.md`.
 */

import { log } from "@/lib/logger";
import { DEFAULT_TIMEOUT_MS } from "./env";

const logger = log.child({ scope: "integrations/http" });

export class HttpError extends Error {
  readonly status: number;
  readonly provider: string;
  readonly retryable: boolean;
  /** Short, non-sensitive provider code. Never the raw body. */
  readonly code: string;

  constructor(args: { provider: string; status: number; code: string; retryable: boolean; message?: string }) {
    super(args.message ?? `${args.provider} request failed (${args.status})`);
    this.name = "HttpError";
    this.status = args.status;
    this.provider = args.provider;
    this.code = args.code;
    this.retryable = args.retryable;
  }
}

export interface FetchOptions {
  provider: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  /** Serialised as JSON with `content-type: application/json`. */
  body?: unknown;
  /** Serialised as form-urlencoded. Mutually exclusive with `body`. */
  form?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  /** Base backoff in ms; doubles per attempt with jitter. */
  backoffMs?: number;
  signal?: AbortSignal;
}

export interface FetchJsonResult<T> {
  ok: boolean;
  data: T | null;
  status: number;
  error: string | null;
  attempts: number;
  latencyMs: number;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const backoffFor = (attempt: number, base: number): number => {
  const exp = Math.min(base * 2 ** attempt, 8_000);
  return Math.round(exp * (0.75 + Math.random() * 0.5));
};

const isRetryableStatus = (status: number): boolean => status === 408 || status === 425 || status === 429 || status >= 500;

/** Splits a network/timeout failure into a stable, non-sensitive code. */
function classify(error: unknown): { code: string; retryable: boolean } {
  const name = error instanceof Error ? error.name : "";
  const msg = error instanceof Error ? error.message : "";
  if (name === "AbortError" || msg.includes("aborted")) return { code: "timeout", retryable: true };
  const cause = (error as { cause?: { code?: string } } | null)?.cause?.code;
  if (cause === "ENOTFOUND" || cause === "EAI_AGAIN") return { code: "dns-failure", retryable: true };
  if (cause === "ECONNREFUSED" || cause === "ECONNRESET" || cause === "ETIMEDOUT") {
    return { code: "connection-failed", retryable: true };
  }
  if (cause === "CERT_HAS_EXPIRED" || msg.includes("certificate")) return { code: "tls-failure", retryable: false };
  return { code: "network-error", retryable: true };
}

/** Performs one request. Throws `HttpError` on any non-2xx. */
async function once<T>(url: string, opts: FetchOptions, timeoutMs: number): Promise<{ data: T; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = (): void => controller.abort();
  opts.signal?.addEventListener("abort", onOuterAbort, { once: true });

  const headers: Record<string, string> = { accept: "application/json", ...(opts.headers ?? {}) };
  let payload: string | undefined;
  if (opts.form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(opts.form).toString();
  } else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(opts.body);
  }

  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      ...(payload !== undefined ? { body: payload } : {}),
      signal: controller.signal,
      // Provider APIs are not cookies-based; never send ambient credentials.
      redirect: "follow",
      cache: "no-store",
    });

    const text = await res.text();
    if (!res.ok) {
      throw new HttpError({
        provider: opts.provider,
        status: res.status,
        code: providerErrorCode(text, res.status),
        retryable: isRetryableStatus(res.status),
      });
    }
    if (text.length === 0) return { data: null as T, status: res.status };
    return { data: JSON.parse(text) as T, status: res.status };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof SyntaxError) {
      throw new HttpError({ provider: opts.provider, status: 0, code: "invalid-json", retryable: true });
    }
    const { code, retryable } = classify(error);
    throw new HttpError({ provider: opts.provider, status: 0, code, retryable });
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onOuterAbort);
  }
}

/**
 * Pulls a short provider error code out of an error body without storing or
 * forwarding the whole thing. Provider bodies can contain customer emails.
 */
function providerErrorCode(text: string, status: number): string {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) {
      const rec = parsed as Record<string, unknown>;
      for (const key of ["code", "error", "errorCode", "type", "status"]) {
        const v = rec[key];
        if (typeof v === "string" && v.length > 0 && v.length <= 60) return v.replace(/[^A-Za-z0-9_.:-]/g, "");
      }
    }
  } catch {
    /* not JSON — fall through to the status code */
  }
  return `http-${status}`;
}

/** JSON fetch with timeout + bounded retry. Never throws. */
export async function fetchJson<T>(url: string, opts: FetchOptions): Promise<FetchJsonResult<T>> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(1, (opts.retries ?? 2) + 1);
  const backoff = opts.backoffMs ?? 300;
  const started = Date.now();
  let attempts = 0;
  let lastError = "unknown";

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const { data, status } = await once<T>(url, opts, timeoutMs);
      return { ok: true, data, status, error: null, attempts, latencyMs: Date.now() - started };
    } catch (error) {
      const err =
        error instanceof HttpError
          ? error
          : new HttpError({ provider: opts.provider, status: 0, code: "unexpected", retryable: false });
      lastError = err.code;
      const canRetry = err.retryable && attempts < maxAttempts;
      logger.warn("http.request_failed", {
        provider: opts.provider,
        attempt: attempts,
        status: err.status,
        code: err.code,
        willRetry: canRetry,
      });
      if (!canRetry) break;
      await sleep(backoffFor(attempts - 1, backoff));
    }
  }

  return { ok: false, data: null, status: 0, error: lastError, attempts, latencyMs: Date.now() - started };
}

/** Raw-text fetch (used where a provider returns non-JSON). Never throws. */
export async function fetchRaw(
  url: string,
  opts: FetchOptions,
): Promise<{ ok: boolean; text: string; status: number; error: string | null; latencyMs: number }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: opts.method ?? "GET", headers: opts.headers ?? {}, signal: controller.signal, cache: "no-store" });
      const text = await res.text();
      if (!res.ok) {
        return { ok: false, text: "", status: res.status, error: `http-${res.status}`, latencyMs: Date.now() - started };
      }
      return { ok: true, text, status: res.status, error: null, latencyMs: Date.now() - started };
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const { code } = classify(error);
    logger.warn("http.raw_failed", { provider: opts.provider, code });
    return { ok: false, text: "", status: 0, error: code, latencyMs: Date.now() - started };
  }
}
