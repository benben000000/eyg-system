"use client";

/**
 * INSTANT QUOTE — live estimate + optional "text me this estimate" capture.
 * ============================================================================
 * ENDPOINTS
 * ---------------------------------------------------------------------------
 *   POST /api/quote   CreateQuoteInput  →  ApiResult<QuoteRequestDto>
 *   (the estimate itself is computed locally, so there is NO estimate endpoint
 *    to fail — the widget always has a number on screen)
 *
 * ENDPOINT CONTRACT (expected from backend-core)
 *   export interface QuoteRequestDto {
 *     reference: string;        // "EYG-XXXXXX"
 *     estimateMin: number;
 *     estimateMax: number;
 *     requestedAt: string;      // ISO with +08:00
 *   }
 *   400 → error.fields { name?: string[], phone?: string[] }
 *   409 → rate-limit style conflict (handled as a generic error state)
 *   429 → meta.retryAfter
 *   5xx / offline → the caller falls back to the call/WhatsApp path
 *
 * GUARANTEES
 *  - The estimate never disappears. A failed capture downgrades the form to a
 *    single honest line plus call / WhatsApp — it never shows a raw error.
 *  - Double submission is blocked by `useIdempotentSubmit`.
 *  - Every async surface has all four states: loading, success, empty, error.
 * ============================================================================
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { CreateQuoteInput, QuoteEstimateDto, QuoteEstimateInput, QuoteRequestDto } from "@/lib/types";
import { apiFetch } from "@/components/widgets/internal/api";
import { isValidPhPhone, normalisePhone } from "@/lib/utils";
import { computeLocalEstimate } from "@/components/widgets/internal/quote-engine";
import { indexCatalogue, type WidgetCatalogue } from "@/components/widgets/internal/catalogue";

export type QuoteRequestStatus = "idle" | "submitting" | "success" | "error";

export interface QuoteRequestFormState {
  name: string;
  phone: string;
  email: string;
  consentSms: boolean;
  /** Honeypot. Must stay empty for humans. */
  website: string;
}

export const EMPTY_QUOTE_FORM: QuoteRequestFormState = {
  name: "",
  phone: "",
  email: "",
  consentSms: false,
  website: "",
};

export interface FieldErrors {
  name?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  consentSms?: string | undefined;
}

export interface UseQuoteOptions {
  catalogue: WidgetCatalogue;
  /** Analytic origin, e.g. "homepage-hero". */
  source?: string | undefined;
  /**
   * `Date.now()` from the server render. Anchors `expiresAt` so the estimate does
   * not silently extend itself when the device clock is wrong.
   */
  serverNowMs?: number | undefined;
}

export interface UseQuoteResult {
  estimate: QuoteEstimateDto;
  /** Live-updating line items keyed by service id, for per-line variable markers. */
  isApproximate: boolean;
  request: QuoteRequestFormState;
  setRequest: (patch: Partial<QuoteRequestFormState>) => void;
  requestStatus: QuoteRequestStatus;
  requestError: string | null;
  requestFieldErrors: FieldErrors;
  /** Set when the capture failed AND we could not reach the API at all. */
  isOffline: boolean;
  reference: QuoteRequestDto | null;
  validate: () => boolean;
  reset: () => void;
  submitRequest: () => Promise<QuoteRequestDto | null>;
}

export function useQuote(input: QuoteEstimateInput, options: UseQuoteOptions): UseQuoteResult {
  const { catalogue, serverNowMs } = options;
  const { serviceIds, packageId, tyreCount, tyreSize, promoCode, engine } = input;

  // Anchor the estimate expiry once per mount so changing a selection does not
  // silently extend the "valid until" the customer was shown.
  const mountedAtRef = useRef<number>(serverNowMs ?? Date.now());

  // Recompute the estimate whenever a priced input actually changes. All
  // dependencies are declared; there is no hidden identity to trip over.
  const estimate = useMemo<QuoteEstimateDto>(() => {
    const localInput: QuoteEstimateInput = {
      engine,
      serviceIds,
      ...(packageId ? { packageId } : {}),
      ...(typeof tyreCount === "number" ? { tyreCount } : {}),
      ...(tyreSize && tyreSize.trim() !== "" ? { tyreSize } : {}),
      ...(promoCode && promoCode.trim() !== "" ? { promoCode } : {}),
    };
    return computeLocalEstimate(localInput, {
      catalogue,
      nowMs: mountedAtRef.current,
    });
  }, [serviceIds, packageId, tyreCount, tyreSize, promoCode, engine, catalogue]);

  const [request, setRequestState] = useState<QuoteRequestFormState>(EMPTY_QUOTE_FORM);
  const [requestStatus, setRequestStatus] = useState<QuoteRequestStatus>("idle");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestFieldErrors, setRequestFieldErrors] = useState<FieldErrors>({});
  const [isOffline, setIsOffline] = useState(false);
  const [reference, setReference] = useState<QuoteRequestDto | null>(null);
  const lockRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const setRequest = useCallback((patch: Partial<QuoteRequestFormState>) => {
    setRequestState((prev) => ({ ...prev, ...patch }));
    setRequestFieldErrors({});
    setRequestError(null);
    if (patch.consentSms === true) setRequestFieldErrors((e) => ({ ...e, consentSms: undefined }));
  }, []);

  const validate = useCallback((): boolean => {
    const errors: FieldErrors = {};
    if (request.name.trim().length < 2) errors.name = "Please tell us your name.";
    const digits = request.phone.replace(/\D/g, "");
    if (digits.length === 0) errors.phone = "We need a mobile number to text the estimate.";
    else if (!isValidPhPhone(request.phone)) {
      errors.phone = "That does not look like a PH mobile number. Try 09XX XXX XXXX.";
    }
    if (!request.consentSms) {
      errors.consentSms = "Tick the box so we are allowed to text you this estimate.";
    }
    setRequestFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [request]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    lockRef.current = false;
    setRequestState(EMPTY_QUOTE_FORM);
    setRequestStatus("idle");
    setRequestError(null);
    setRequestFieldErrors({});
    setIsOffline(false);
    setReference(null);
  }, []);

  const submitRequest = useCallback(async (): Promise<QuoteRequestDto | null> => {
    // Synchronous lock — the same tick cannot fire two requests.
    if (lockRef.current) return null;
    if (!validate()) {
      setRequestStatus("error");
      setRequestError("Please fix the highlighted fields.");
      return null;
    }
    lockRef.current = true;
    setRequestStatus("submitting");
    setRequestError(null);
    setIsOffline(false);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const payload: CreateQuoteInput = {
      ...input,
      name: request.name.trim(),
      phone: normalisePhone(request.phone),
      ...(request.email.trim() ? { email: request.email.trim() } : {}),
      consentSms: request.consentSms,
      website: request.website,
    };

    const result = await apiFetch<QuoteRequestDto>("/api/quote", {
      method: "POST",
      body: payload,
      signal: controller.signal,
    });

    lockRef.current = false;
    if (controller.signal.aborted) return null;

    if (result.ok) {
      setReference(result.data);
      setRequestStatus("success");
      return result.data;
    }

    setRequestStatus("error");
    setRequestError(result.error.message);
    setIsOffline(
      result.error.code === "SERVICE_UNAVAILABLE" ||
        result.error.code === "INTERNAL_ERROR" ||
        result.error.code === "MAINTENANCE",
    );
    const fields = result.error.fields ?? {};
    setRequestFieldErrors({
      ...(fields.name ? { name: fields.name[0] } : {}),
      ...(fields.phone ? { phone: fields.phone[0] } : {}),
      ...(fields.email ? { email: fields.email[0] } : {}),
      ...(fields.consentSms ? { consentSms: fields.consentSms[0] } : {}),
    });
    return null;
  }, [input, request, validate]);

  return {
    estimate,
    isApproximate: estimate.isApproximate,
    request,
    setRequest,
    requestStatus,
    requestError,
    requestFieldErrors,
    isOffline,
    reference,
    validate,
    reset,
    submitRequest,
  };
}

/** Catalogue lookup helper shared with `QuoteResult` line items. */
export function useQuoteCatalogueIndex(catalogue: WidgetCatalogue) {
  return useMemo(() => indexCatalogue(catalogue), [catalogue]);
}