"use client";

/**
 * GENUINELY DOUBLE-SUBMIT-PROOF FORM SUBMIT
 * ============================================================================
 * A booking that fires twice books two bays. This hook makes that impossible:
 *
 *  - A synchronous in-flight lock (`lockRef`), taken BEFORE the first `await`,
 *    so two clicks in the same tick cannot both pass the guard.
 *  - An in-flight `AbortController`, so a duplicate never even leaves the browser.
 *  - `submit` returns `null` when it is a duplicate, so callers can ignore it.
 *  - The previous request is aborted when a new submit starts, so an abandoned
 *    slow response can never overwrite a fresh success.
 *
 * `T` is the API envelope. Callers narrow on `result.ok`; the hook never renders
 * an error object itself.
 * ============================================================================
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResult } from "@/lib/types";

export interface IdempotentSubmit<T> {
  submit: (run: (signal: AbortSignal) => Promise<ApiResult<T>>) => Promise<ApiResult<T> | null>;
  isPending: boolean;
  error: string | null;
  errorCode: string | null;
  /** `error.fields` from a 400, ready to map onto inputs. */
  fieldErrors: Record<string, string[]> | null;
  /** HTTP-ish status: the transport status, or the status implied by the code. */
  status: number | null;
  data: T | null;
  meta: ApiResult<T> extends { meta?: infer M } ? M : never;
  /** Seconds until retry is allowed, from `meta.retryAfter`. */
  retryAfter: number | null;
  reset: () => void;
}

/** Best-effort mapping from an API error code to the HTTP status the UI shows. */
function statusFor(code: string, fields?: Record<string, string[]>): number {
  switch (code) {
    case "VALIDATION_ERROR":
    case "CAPTCHA_FAILED":
    case "SPAM_REJECTED":
      return 400;
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
    case "SLOT_UNAVAILABLE":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "SERVICE_UNAVAILABLE":
    case "MAINTENANCE":
      return 503;
    case "INTERNAL_ERROR":
      return 500;
    default:
      return fields ? 400 : 500;
  }
}

export function useIdempotentSubmit<T>(): IdempotentSubmit<T> {
  const lockRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const aliveRef = useRef(true);

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<unknown>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    aliveRef.current = true;
    return () => {
      mountedRef.current = false;
      aliveRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setErrorCode(null);
    setFieldErrors(null);
    setStatus(null);
    setData(null);
    setMeta(null);
    setRetryAfter(null);
    setIsPending(false);
  }, []);

  const submit = useCallback(
    async (run: (signal: AbortSignal) => Promise<ApiResult<T>>): Promise<ApiResult<T> | null> => {
      // ── The lock. Synchronous, before any await. ────────────────────────
      if (lockRef.current) return null;
      lockRef.current = true;

      // A previous, abandoned request must not be able to land late.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      if (mountedRef.current) {
        setIsPending(true);
        setError(null);
        setErrorCode(null);
        setFieldErrors(null);
        setStatus(null);
        setRetryAfter(null);
      }

      try {
        const result = await run(controller.signal);

        // A duplicate/aborted call: discard silently.
        if (controller.signal.aborted) return null;
        if (!aliveRef.current) return result;

        if (result.ok) {
          setData(result.data);
          setMeta(result.meta ?? null);
          setRetryAfter(null);
        } else {
          const fields = result.error.fields ?? null;
          setError(result.error.message);
          setErrorCode(result.error.code);
          setFieldErrors(fields);
          setStatus(statusFor(result.error.code, fields ?? undefined));
          setRetryAfter(
            typeof result.meta?.retryAfter === "number" && Number.isFinite(result.meta.retryAfter)
              ? Math.max(0, result.meta.retryAfter)
              : null,
          );
        }
        return result;
      } catch (e) {
        // A bug in `run` must still leave the form usable.
        if (!aliveRef.current || controller.signal.aborted) return null;
        setError(
          e instanceof Error && e.message.trim() !== ""
            ? "Something went wrong on our side. Please try again, or call the shop."
            : "Something went wrong on our side. Please try again, or call the shop.",
        );
        setErrorCode("INTERNAL_ERROR");
        setFieldErrors(null);
        setStatus(500);
        return null;
      } finally {
        lockRef.current = false;
        if (controllerRef.current === controller) controllerRef.current = null;
        if (aliveRef.current) setIsPending(false);
      }
    },
    [],
  );

  return {
    submit,
    isPending,
    error,
    errorCode,
    fieldErrors,
    status,
    data,
    meta: meta as IdempotentSubmit<T>["meta"],
    retryAfter,
    reset,
  };
}