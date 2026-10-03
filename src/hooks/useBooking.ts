"use client";

/**
 * BOOKING FLOW STATE — the four-step scheduler.
 * ============================================================================
 * ENDPOINTS
 * ---------------------------------------------------------------------------
 *   GET  /api/availability?date=YYYY-MM-DD   → ApiResult<SlotAvailabilityDto>
 *   POST /api/booking                        CreateBookingInput → ApiResult<BookingDto>
 *
 * ENDPOINT CONTRACT (expected from backend-core)
 *   400 → error.fields keyed by CreateBookingInput path, e.g.
 *          { "name": ["..."], "phone": ["..."], "startAt": ["..."], "serviceIds": ["..."] }
 *          Field keys also accept the DOM `name` attributes this form uses:
 *          name, phone, email, vehicleYear, vehicleMake, vehicleModel, startAt,
 *          consentSms, notes.
 *   409 CONFLICT / SLOT_UNAVAILABLE → the slot was taken. `meta` may carry the
 *          replacement slot. The form MUST refresh availability and keep every
 *          other value the customer typed.
 *   429 → meta.retryAfter (seconds)
 *   5xx / offline → designed retry state + the phone number
 *
 * PERSISTENCE
 *   An in-progress draft is mirrored into `sessionStorage` under a versioned key
 *   and restored on mount. It is cleared on success. `sessionStorage` (not
 *   `localStorage`) so it never follows the customer to another device, and so it
 *   dies with the tab.
 *
 * DEEP LINKS  → see `BOOK_PARAM` in `@/components/widgets/internal/quote-engine`.
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiResult, BookingDto, CreateBookingInput, PackageDto, ServiceDto } from "@/lib/types";
import { apiFetch } from "@/components/widgets/internal/api";
import { useIdempotentSubmit } from "@/hooks/useIdempotentSubmit";
import {
  DEFAULT_CATALOGUE,
  durationOf,
  indexCatalogue,
  priceBand,
  type WidgetCatalogue,
} from "@/components/widgets/internal/catalogue";
import { parseServiceParam } from "@/components/widgets/internal/quote-engine";
import { normalisePhone } from "@/lib/utils";

export type BookingStep = 1 | 2 | 3 | 4;

export const BOOKING_STEPS: readonly { step: BookingStep; name: string; blurb: string }[] = [
  { step: 1, name: "Your vehicle", blurb: "So we know what parts fit." },
  { step: 2, name: "Services", blurb: "Pick what you need. Nothing is charged now." },
  { step: 3, name: "Date & time", blurb: "Choose a bay." },
  { step: 4, name: "Confirm", blurb: "Your name, number, and you are booked." },
] as const;

export interface VehicleDraft {
  year: string;
  make: string;
  model: string;
  variant: string;
  plate: string;
  mileageKm: string;
  /** Escape hatch. Must NEVER block progress. */
  notListed: boolean;
  freeText: string;
}

export const EMPTY_VEHICLE: VehicleDraft = {
  year: "",
  make: "",
  model: "",
  variant: "",
  plate: "",
  mileageKm: "",
  notListed: false,
  freeText: "",
};

export interface ContactDraft {
  name: string;
  phone: string;
  email: string;
  notes: string;
  /** Unticked by default. Never pre-ticked. */
  consentSms: boolean;
  consentMarketing: boolean;
  /** Honeypot — must stay empty for humans. */
  website: string;
}

export const EMPTY_CONTACT: ContactDraft = {
  name: "",
  phone: "",
  email: "",
  notes: "",
  consentSms: false,
  consentMarketing: false,
  website: "",
};

export interface BookingDraft {
  step: BookingStep;
  vehicle: VehicleDraft;
  serviceIds: string[];
  packageId: string;
  promoCode: string;
  date: string;
  /** ISO start time of the chosen slot. */
  startAt: string;
  slotLabel: string;
  contact: ContactDraft;
  /** Arithmetic-challenge answer, when `/api/captcha` is available. */
  captchaAnswer: string;
  captchaToken: string;
}

export type SubmitPhase =
  | "idle"
  | "submitting"
  | "confirmed"
  | "field-error"
  | "conflict"
  | "rate-limited"
  | "offline"
  | "error";

export interface BookingTotals {
  min: number;
  max: number;
  durationMin: number;
  itemCount: number;
  hasVariable: boolean;
  packageName: string | null;
  savings: { amount: number; compareAt: number } | null;
}

export interface BookingErrors {
  [field: string]: string | undefined;
}

export interface UseBookingOptions {
  /**
   * Optional. `services` / `packages` below are the ergonomic form; passing
   * `catalogue` directly is equivalent. Omit all three and the widget uses its
   * own conservative `DEFAULT_CATALOGUE`.
   */
  catalogue?: WidgetCatalogue | undefined;
  services?: readonly ServiceDto[] | undefined;
  packages?: readonly PackageDto[] | undefined;
  /** Initial deep-link values (already read from `useSearchParams` by the page). */
  initial?: Partial<BookingDraft> | undefined;
  /** Persist a draft to sessionStorage under this key. */
  storageKey?: string | undefined;
  /** Maximum services per booking, from `BOOKING.maxServicesPerBooking`. */
  maxServices?: number | undefined;
}

const STORAGE_VERSION = "v1";
export const DEFAULT_DRAFT_KEY = `eyg.booking.draft.${STORAGE_VERSION}`;

const VEHICLE_MIN_YEAR = 1950;

function currentYearPlusOne(): number {
  return new Date().getUTCFullYear() + 1;
}

export const VEHICLE_YEAR_MIN = VEHICLE_MIN_YEAR;
export const VEHICLE_YEAR_MAX = currentYearPlusOne();

/** Year options for the vehicle step, newest first. Always includes a classic. */
export function vehicleYears(limit = VEHICLE_YEAR_MAX - VEHICLE_MIN_YEAR + 1): number[] {
  const max = currentYearPlusOne();
  const min = Math.max(VEHICLE_MIN_YEAR, max - limit + 1);
  const out: number[] = [];
  for (let y = max; y >= min; y -= 1) out.push(y);
  return out;
}

/** Merges deep-link + restored draft + defaults, in that priority order. */
export function buildInitialDraft(
  initial?: Partial<BookingDraft>,
  restored?: Partial<BookingDraft> | null,
): BookingDraft {
  const merge = <K extends keyof BookingDraft>(key: K, fallback: BookingDraft[K]): BookingDraft[K] => {
    const fromInitial = initial?.[key];
    if (fromInitial !== undefined && fromInitial !== null) return fromInitial;
    const fromRestored = restored?.[key];
    if (fromRestored !== undefined && fromRestored !== null) return fromRestored;
    return fallback;
  };

  return {
    step: clampStep(merge("step", 1)),
    vehicle: { ...EMPTY_VEHICLE, ...(initial?.vehicle ?? {}), ...(restored?.vehicle ?? {}) },
    serviceIds: [
      ...new Set([...(initial?.serviceIds ?? []), ...(restored?.serviceIds ?? [])].filter(Boolean)),
    ],
    packageId: initial?.packageId ?? restored?.packageId ?? "",
    promoCode: initial?.promoCode ?? restored?.promoCode ?? "",
    date: initial?.date ?? restored?.date ?? "",
    startAt: initial?.startAt ?? restored?.startAt ?? "",
    slotLabel: initial?.slotLabel ?? restored?.slotLabel ?? "",
    contact: { ...EMPTY_CONTACT, ...(initial?.contact ?? {}), ...(restored?.contact ?? {}) },
    captchaAnswer: initial?.captchaAnswer ?? restored?.captchaAnswer ?? "",
    captchaToken: initial?.captchaToken ?? restored?.captchaToken ?? "",
  };
}

export function clampStep(step: unknown): BookingStep {
  const n = Number(step);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return 1;
}

/** Parses the documented `/book` search params into draft values. */
export function draftFromSearchParams(params: URLSearchParams): Partial<BookingDraft> {
  const serviceIds = parseServiceParam(params.get("service"));
  const step = clampStep(params.get("step"));
  const tyres = Number(params.get("tyres"));
  const year = Number(params.get("year"));
  const draft: Partial<BookingDraft> = {
    serviceIds,
    packageId: params.get("package") ?? "",
    promoCode: params.get("promo") ?? "",
    step,
  };
  const vehicle: Partial<VehicleDraft> = {};
  if (Number.isFinite(year) && year >= VEHICLE_MIN_YEAR && year <= VEHICLE_YEAR_MAX) {
    vehicle.year = String(year);
  }
  if (params.get("make")) vehicle.make = params.get("make") ?? "";
  if (params.get("model")) vehicle.model = params.get("model") ?? "";
  if (params.get("variant")) vehicle.variant = params.get("variant") ?? "";
  const notListed = !vehicle.make && !vehicle.model;
  if (notListed && (vehicle.year !== undefined || params.has("make") || params.has("model"))) {
    vehicle.notListed = true;
  }
  if (Object.keys(vehicle).length > 0) draft.vehicle = vehicle as VehicleDraft;
  // `tyres` / `size` are estimator-only params; when they arrive with a booking
  // link we keep the size as a note so nothing the customer typed is lost.
  const size = params.get("size");
  if (size) {
    draft.contact = {
      ...EMPTY_CONTACT,
      notes: `Tyres requested: ${size}${Number.isFinite(tyres) && tyres > 0 ? ` × ${tyres}` : ""}`,
    };
  }
  return draft;
}

// ── The hook ────────────────────────────────────────────────────────────────

export interface UseBookingResult {
  draft: BookingDraft;
  setVehicle: (patch: Partial<VehicleDraft>) => void;
  setContact: (patch: Partial<ContactDraft>) => void;
  toggleService: (id: string) => void;
  setServiceIds: (ids: string[]) => void;
  setPackageId: (id: string) => void;
  setPromoCode: (code: string) => void;
  setDate: (ymd: string) => void;
  setSlot: (startAt: string, label: string) => void;
  goToStep: (step: BookingStep) => void;
  next: () => void;
  back: () => void;

  totals: BookingTotals;
  selectedServices: readonly ServiceDto[];
  selectedPackage: PackageDto | null;
  errors: BookingErrors;
  /** Which step should own focus after a step change. */
  focusedStep: BookingStep;

  /** True while a POST is in flight (drives `aria-busy` and the disabled state). */
  isPending: boolean;
  /** The created booking, or null. Non-null means the wizard is done. */
  booking: BookingDto | null;
  phase: SubmitPhase;
  errorsByStatus: Record<number, string>;
  serverMessage: string | null;
  retryAfter: number | null;
  /** Clears the draft, errors and phase — also used after a confirmation. */
  reset: () => void;
  /** `reset` but keeps the confirmed booking (used by "Book another job"). */
  clearDraft: () => void;
  /** Lets a component clear a transient phase (e.g. when a countdown ends). */
  setPhase: (phase: SubmitPhase) => void;
  submit: () => Promise<ApiResult<BookingDto> | null>;

  /** True once a draft was restored from sessionStorage. */
  wasRestored: boolean;
  /** True when step 4 can be sent: contact + slot + at least one service. */
  canSubmit: boolean;
  totalDurationLabel: string;
  resolvedCatalogue: WidgetCatalogue;
  /** `SlotPicker` registers a "reload availability" callback here so a 409 can
   *  refresh the grid without the parent having to own the date. */
  registerConflictRefresh: (fn: (() => void) | null) => void;
  /** Stores the arithmetic-challenge answer, when `/api/captcha` answered. */
  setCaptcha: (patch: { answer?: string; token?: string }) => void;
}

export function useBooking(options: UseBookingOptions): UseBookingResult {
  const {
    services,
    packages,
    catalogue: catalogueProp,
    initial,
    storageKey = DEFAULT_DRAFT_KEY,
    maxServices = 8,
  } = options;

  const resolvedCatalogue = useMemo<WidgetCatalogue>(() => {
    if (catalogueProp) return catalogueProp;
    if (services && services.length > 0) return { services, packages: packages ?? [] };
    if (packages && packages.length > 0) return { services: [], packages };
    return DEFAULT_CATALOGUE;
  }, [catalogueProp, services, packages]);

  const view = useMemo(() => indexCatalogue(resolvedCatalogue), [resolvedCatalogue]);

  // ── Draft state ──────────────────────────────────────────────────────────
  const [draft, setDraft] = useState<BookingDraft>(() => buildInitialDraft(initial, null));
  const [errors, setErrors] = useState<BookingErrors>({});
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [focusedStep, setFocusedStep] = useState<BookingStep>(() =>
    clampStep(initial?.step),
  );
  const [wasRestored, setWasRestored] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // The in-flight lock is owned by `useIdempotentSubmit`; this ref only carries
  // the "reload availability" callback that `SlotPicker` registers.
  const conflictRefreshRef = useRef<(() => void) | null>(null);
  // Deep-link values are read once. Keeping them in a ref lets the restore
  // effect depend on `storageKey` alone, with no dependency-array suppression.
  const initialRef = useRef(initial);
  const idem = useIdempotentSubmit<BookingDto>();

  // ── Restore from sessionStorage, once, after mount ───────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    setHydrated(true);
    if (!storageKey) return;
    const deepLink = initialRef.current;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const restored = parsed as Partial<BookingDraft>;
      setDraft(() => buildInitialDraft(deepLink, restored));
      setWasRestored(true);
      // Only auto-jump to a restored step when the URL did not ask for one.
      if (deepLink?.step === undefined && restored.step !== undefined) {
        setFocusedStep(clampStep(restored.step));
      }
    } catch {
      /* A corrupt draft must never block the page. */
    }
  }, [storageKey]);

  // ── Persist ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated || !storageKey) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      /* Private mode / quota exceeded: persistence is a nicety, not a need. */
    }
  }, [draft, hydrated, storageKey]);

  // ── Mutators ─────────────────────────────────────────────────────────────
  const setVehicle = useCallback((patch: Partial<VehicleDraft>) => {
    setDraft((prev) => ({ ...prev, vehicle: { ...prev.vehicle, ...patch } }));
    setErrors((prev) => stripKeys(prev, ["vehicleYear", "vehicleMake", "vehicleModel", "vehicle"]));
  }, []);

  const setContact = useCallback((patch: Partial<ContactDraft>) => {
    setDraft((prev) => ({ ...prev, contact: { ...prev.contact, ...patch } }));
    const keys = Object.keys(patch);
    setErrors((prev) => stripKeys(prev, keys));
  }, []);

  const toggleService = useCallback(
    (id: string) => {
      setDraft((prev) => {
        const has = prev.serviceIds.includes(id);
        if (has) {
          return {
            ...prev,
            serviceIds: prev.serviceIds.filter((s) => s !== id),
            packageId: prev.packageId,
          };
        }
        if (prev.serviceIds.length >= maxServices) return prev;
        return { ...prev, serviceIds: [...prev.serviceIds, id] };
      });
      setErrors((prev) => stripKeys(prev, ["serviceIds", "service"]));
    },
    [maxServices],
  );

  const setServiceIds = useCallback((ids: string[]) => {
    setDraft((prev) => ({ ...prev, serviceIds: [...new Set(ids.filter(Boolean))].slice(0, maxServices) }));
    setErrors((prev) => stripKeys(prev, ["serviceIds", "service"]));
  }, [maxServices]);

  const setCaptcha = useCallback((patch: { answer?: string; token?: string }) => {
    setDraft((prev) => ({
      ...prev,
      captchaAnswer: patch.answer ?? prev.captchaAnswer,
      captchaToken: patch.token ?? prev.captchaToken,
    }));
  }, []);

  const setPackageId = useCallback((id: string) => {
    setDraft((prev) => ({ ...prev, packageId: prev.packageId === id ? "" : id }));
  }, []);

  const setPromoCode = useCallback((code: string) => {
    setDraft((prev) => ({ ...prev, promoCode: code.toUpperCase().slice(0, 24) }));
  }, []);

  const setDate = useCallback((ymd: string) => {
    setDraft((prev) => ({ ...prev, date: ymd, startAt: "", slotLabel: "" }));
    setErrors((prev) => stripKeys(prev, ["startAt", "date"]));
  }, []);

  const setSlot = useCallback((startAt: string, label: string) => {
    setDraft((prev) => ({ ...prev, startAt, slotLabel: label }));
    setErrors((prev) => stripKeys(prev, ["startAt"]));
  }, []);

  const goToStep = useCallback((step: BookingStep) => {
    setDraft((prev) => ({ ...prev, step: clampStep(step) }));
    setFocusedStep(clampStep(step));
  }, []);

  const next = useCallback(() => {
    setDraft((prev) => {
      const target = clampStep(prev.step + 1);
      setFocusedStep(target);
      return { ...prev, step: target };
    });
  }, []);

  const back = useCallback(() => {
    setDraft((prev) => {
      const target = clampStep(prev.step - 1);
      setFocusedStep(target);
      return { ...prev, step: target };
    });
  }, []);

  /** Clears the draft, errors and phase, and forgets the restored confirmation. */
  const clearDraft = useCallback(() => {
    idem.reset();
    setDraft(buildInitialDraft({ ...initialRef.current, step: 1 }, null));
    setErrors({});
    setPhase("idle");
    setServerMessage(null);
    setRetryAfter(null);
    setFocusedStep(1);
    setWasRestored(false);
    if (storageKey) {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  }, [idem, storageKey]);

  /**
   * Same as `clearDraft`, but ALSO forgets the confirmed booking — which is what
   * the customer wants when they press "Book another job".
   */
  const reset = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  // ── Derived totals ───────────────────────────────────────────────────────
  const selectedServices = useMemo(
    () =>
      draft.serviceIds
        .map((id) => view.byId.get(id))
        .filter((s): s is ServiceDto => s !== undefined),
    [draft.serviceIds, view.byId],
  );

  const selectedPackage = useMemo(
    () => (draft.packageId ? (view.byPackageId.get(draft.packageId) ?? null) : null),
    [draft.packageId, view.byPackageId],
  );

  const totals = useMemo<BookingTotals>(() => {
    if (selectedPackage && selectedServices.length === 0) {
      return {
        min: Math.max(0, selectedPackage.priceMin),
        max: selectedPackage.priceMax ?? Math.max(0, selectedPackage.priceMin),
        durationMin: 90,
        itemCount: selectedPackage.items.length,
        hasVariable: selectedPackage.priceMax === null || selectedPackage.priceMax > selectedPackage.priceMin,
        packageName: selectedPackage.name,
        savings: null,
      };
    }

    let min = 0;
    let max = 0;
    let durationMin = 0;
    let hasVariable = false;
    for (const service of selectedServices) {
      const band = priceBand(service);
      if (band.isVariable) hasVariable = true;
      min += band.min;
      max += band.max;
      durationMin += durationOf(service);
    }

    let savings: BookingTotals["savings"] = null;
    if (selectedPackage && selectedPackage.savingsPct && max > 0) {
      const cut = Math.round((max * selectedPackage.savingsPct) / 100 / 10) * 10;
      savings = { amount: cut, compareAt: max };
      max -= cut;
    }

    return {
      min: Math.max(0, Math.round(min)),
      max: Math.max(0, Math.round(max)),
      durationMin,
      itemCount: selectedServices.length,
      hasVariable,
      packageName: selectedPackage?.name ?? null,
      savings,
    };
  }, [selectedServices, selectedPackage]);

  const totalDurationLabel = useMemo(() => {
    const m = totals.durationMin;
    if (m <= 0) return "—";
    const h = Math.floor(m / 60);
    const rest = m % 60;
    if (h === 0) return `${rest} min`;
    if (rest === 0) return `${h} hr`;
    return `${h} hr ${rest} min`;
  }, [totals.durationMin]);

  // ── Validation ───────────────────────────────────────────────────────────
  const validateStep = useCallback(
    (step: BookingStep): BookingErrors => {
      const next: BookingErrors = {};
      if (step === 1) {
        const v = draft.vehicle;
        const hasFreeText = v.notListed && v.freeText.trim().length >= 2;
        if (v.notListed && !hasFreeText) {
          next.vehicleNotListed = "Tell us what you are driving, in your own words — that is enough.";
        }
        if (!v.notListed) {
          if (!v.year) next.vehicleYear = "Pick the year.";
          else if (Number(v.year) < VEHICLE_MIN_YEAR || Number(v.year) > VEHICLE_YEAR_MAX) {
            next.vehicleYear = `Enter a year between ${VEHICLE_MIN_YEAR} and ${VEHICLE_YEAR_MAX}.`;
          }
          if (v.make.trim().length < 2) next.vehicleMake = "Pick or type the make.";
          if (v.model.trim().length < 1) next.vehicleModel = "Pick or type the model.";
        }
      }
      if (step === 2 && draft.serviceIds.length === 0 && !draft.packageId) {
        next.serviceIds = "Pick at least one service, or call us and we will work it out with you.";
      }
      if (step === 3 && !draft.startAt) {
        next.startAt = "Choose a time slot.";
      }
      if (step === 4) {
        const c = draft.contact;
        if (c.name.trim().length < 2) next.name = "Please tell us your name.";
        const digits = c.phone.replace(/\D/g, "");
        if (digits.length === 0) next.phone = "We need a mobile number to text you the confirmation.";
        if (!c.consentSms) {
          next.consentSms = "Please tick the box so we can text you the confirmation.";
        }
        if (c.email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email.trim())) {
          next.email = "That email address does not look right. Leave it blank if you prefer.";
        }
      }
      return next;
    },
    [draft],
  );

  const canSubmit = useMemo(
    () =>
      draft.contact.name.trim().length >= 2 &&
      draft.contact.consentSms &&
      draft.startAt !== "" &&
      (draft.serviceIds.length > 0 || draft.packageId !== ""),
    [draft.contact.name, draft.contact.consentSms, draft.startAt, draft.serviceIds.length, draft.packageId],
  );

  // ── Submit ───────────────────────────────────────────────────────────────
  //
  // The double-submit lock lives in `useIdempotentSubmit`, which is the single
  // owner of the in-flight state. `booking.isPending` re-exports it so a caller
  // never has to instantiate a second, competing lock.
  const submit = useCallback(async (): Promise<ApiResult<BookingDto> | null> => {
    const all = {
      ...validateStep(1),
      ...validateStep(2),
      ...validateStep(3),
      ...validateStep(4),
    };
    if (Object.keys(all).length > 0) {
      setErrors(all);
      setPhase("field-error");
      setServerMessage("Please fix the highlighted fields.");
      return null;
    }

    const payload = buildBookingPayload(draft);
    setPhase("submitting");
    setServerMessage(null);
    setRetryAfter(null);
    setErrors({});

    const result = await idem.submit((signal) => postBooking(payload, signal));
    if (!result) return null; // duplicate click, or unmounted mid-flight

    if (result.ok) {
      setPhase("confirmed");
      setServerMessage(null);
      if (storageKey) {
        try {
          window.sessionStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
      }
      return result;
    }

    // ── Each failure gets its own designed state ──────────────────────────
    const code = result.error.code;
    if (code === "CONFLICT" || code === "SLOT_UNAVAILABLE") {
      setPhase("conflict");
      setServerMessage(result.error.message);
      // Every other input stays exactly as the customer left it.
      conflictRefreshRef.current?.();
      return result;
    }

    if (code === "VALIDATION_ERROR" || code === "CAPTCHA_FAILED" || code === "SPAM_REJECTED") {
      const fields = result.error.fields ?? {};
      const mapped: BookingErrors = {};
      for (const [key, messages] of Object.entries(fields)) {
        const first = messages[0];
        if (first) mapped[normaliseFieldKey(key)] = first;
      }
      setErrors(mapped);
      setServerMessage(result.error.message);
      setPhase("field-error");
      return result;
    }

    if (code === "RATE_LIMITED") {
      const seconds =
        typeof result.meta?.retryAfter === "number" && Number.isFinite(result.meta.retryAfter)
          ? Math.max(0, Math.round(result.meta.retryAfter))
          : 60;
      setRetryAfter(seconds);
      setServerMessage(result.error.message);
      setPhase("rate-limited");
      return result;
    }

    setServerMessage(result.error.message);
    setPhase("error");
    return result;
  }, [validateStep, draft, idem, storageKey]);

  /** Lets `SlotPicker` register a "reload availability" callback. */
  const registerConflictRefresh = useCallback((fn: (() => void) | null) => {
    conflictRefreshRef.current = fn;
  }, []);

  const errorsByStatus = useMemo<Record<number, string>>(
    () => ({
      400: "Some details did not pass. We highlighted the fields above — please check and send again.",
      409: "Someone just took that bay. Your details are all still here. Pick another time and send again.",
      429: "Too many attempts from this connection. Wait a moment, then try once more.",
      500: "Our booking system is having trouble. Please try again, or call the shop and we will book you by hand.",
    }),
    [],
  );

  return {
    draft,
    setVehicle,
    setContact,
    toggleService,
    setServiceIds,
    setPackageId,
    setPromoCode,
    setDate,
    setSlot,
    setCaptcha,
    goToStep,
    next,
    back,
    totals,
    selectedServices,
    selectedPackage,
    errors,
    focusedStep,
    isPending: idem.isPending,
    booking: idem.data,
    phase,
    errorsByStatus,
    serverMessage,
    retryAfter,
    reset,
    clearDraft,
    setPhase,
    submit,
    wasRestored,
    canSubmit,
    totalDurationLabel,
    resolvedCatalogue,
    registerConflictRefresh,
  };
}

// ── Pure helpers, exported for tests and for the widget's own copies ────────

/** Turns a draft into the exact `CreateBookingInput` the API expects. */
export function buildBookingPayload(draft: BookingDraft): CreateBookingInput {
  const v = draft.vehicle;
  const vehicle: NonNullable<CreateBookingInput["vehicle"]> = v.notListed
    ? {
        year: Number(v.year) || new Date().getUTCFullYear(),
        make: v.freeText.trim().slice(0, 60) || "Unlisted vehicle",
        model: v.freeText.trim().slice(0, 60) || "Unlisted model",
        ...(v.plate.trim() ? { plate: v.plate.trim().toUpperCase() } : {}),
        ...(v.mileageKm.trim() ? { mileageKm: Number(v.mileageKm) } : {}),
      }
    : {
        year: Number(v.year),
        make: v.make.trim(),
        model: v.model.trim(),
        ...(v.variant.trim() ? { variant: v.variant.trim() } : {}),
        ...(v.plate.trim() ? { plate: v.plate.trim().toUpperCase() } : {}),
        ...(v.mileageKm.trim() ? { mileageKm: Number(v.mileageKm) } : {}),
      };

  return {
    name: draft.contact.name.trim(),
    phone: normalisePhone(draft.contact.phone),
    ...(draft.contact.email.trim() ? { email: draft.contact.email.trim() } : {}),
    startAt: draft.startAt,
    serviceIds: [...draft.serviceIds],
    ...(draft.packageId ? { packageId: draft.packageId } : {}),
    ...(draft.promoCode.trim() ? { promoCode: draft.promoCode.trim() } : {}),
    vehicle,
    ...(draft.contact.notes.trim() ? { notes: draft.contact.notes.trim() } : {}),
    consentSms: draft.contact.consentSms,
    consentMarketing: draft.contact.consentMarketing,
    website: draft.contact.website,
    ...(draft.captchaAnswer.trim() !== ""
      ? { captchaAnswer: Number(draft.captchaAnswer) }
      : {}),
    ...(draft.captchaToken.trim() !== "" ? { captchaToken: draft.captchaToken.trim() } : {}),
  };
}

/** The one network call the booking form makes. Pure: draft in, envelope out. */
export function postBooking(
  payload: CreateBookingInput,
  signal: AbortSignal,
): Promise<ApiResult<BookingDto>> {
  return apiFetch<BookingDto>("/api/booking", { method: "POST", body: payload, signal });
}

function stripKeys(errors: BookingErrors, keys: string[]): BookingErrors {
  const next: BookingErrors = { ...errors };
  for (const key of keys) delete next[key];
  return next;
}

/**
 * Maps an API `error.fields` key onto the input name this form uses.
 * Accepts the contract path (`vehicle.year`, `startAt`) or a DOM name.
 */
export function normaliseFieldKey(key: string): string {
  const map: Record<string, string> = {
    "vehicle.year": "vehicleYear",
    "vehicle.make": "vehicleMake",
    "vehicle.model": "vehicleModel",
    "vehicle.variant": "vehicleVariant",
    "vehicle.plate": "vehiclePlate",
    service: "serviceIds",
    services: "serviceIds",
    package: "packageId",
    promo: "promoCode",
    slot: "startAt",
    "consent.sms": "consentSms",
    "consent.marketing": "consentMarketing",
  };
  if (map[key]) return map[key] as string;
  return key.replace(/[.[\]]/g, "").replace(/([a-z])([A-Z])/g, "$1$2");
}