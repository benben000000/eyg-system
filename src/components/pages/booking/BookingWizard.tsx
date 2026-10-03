/**
 * EYG — BOOKING WIZARD (4 STEPS)
 * ============================================================================
 * Vehicle → Services → Date & time → Contact & confirm.
 *
 * DESIGN RULES THIS FILE ENFORCES
 *   • the current step lives in `?step=`, written with `history.pushState`, so
 *     Back/Forward move between steps and a refresh lands on the same step
 *   • the draft never resets — a failure, a Back, or a step change cannot lose
 *     what the customer typed
 *   • the submit button is disabled while pending, carries `aria-busy`, and the
 *     handler ignores repeat clicks
 *   • a 409 clears the selected slot, refreshes the grid, and explains itself
 *   • a 429 starts a REAL countdown from `meta.retryAfter` and blocks the submit
 *     until it reaches zero
 *   • funnel events are dispatched after every state change, never blocking
 *
 * Progressive enhancement: this component is the enhanced path. With JavaScript
 * disabled, `<noscript>` inside it shows a styled panel with the phone number,
 * and the server-rendered `<NoJsBookingForm>` on the page provides a genuine
 * `<form method="post">` submission. A customer with JS off is never stranded.
 * ============================================================================
 */

"use client";

import * as React from "react";
import type { BookingDto, PackageDto, SlotDto } from "@/lib/types";
import type { CatalogService } from "@/content/catalog";
import { SERVICE_CATEGORIES, getPackageBySlug } from "@/content/catalog";
import { Alert, Section } from "@/components/pages/_shims";
import { Spinner } from "@/components/ui/Spinner";
import {
  BOOKING_STEPS,
  isBookingStepId,
  toCreateBookingInput,
  type BookingDraft,
  type BookingFailure,
  type BookingStepId,
  type SubmitPhase,
} from "@/components/pages/booking/types";
import { fetchAvailability, submitBooking } from "@/components/pages/booking/api";
import { StepNav, Stepper } from "@/components/pages/booking/Stepper";
import { OrderSummary, formatDateLabel } from "@/components/pages/booking/OrderSummary";
import {
  VehicleStep,
  validateVehicleStep,
  vehicleSummaryOf,
} from "@/components/pages/booking/VehicleStep";
import { ServicesStep, validateServicesStep } from "@/components/pages/booking/ServicesStep";
import {
  DateTimeStep,
  validateDateTimeStep,
  type AvailabilityPhase,
  type DateStripDayView,
} from "@/components/pages/booking/DateTimeStep";
import { ContactStep, validateContactStep } from "@/components/pages/booking/ContactStep";
import { BookingConfirmation, type ConfirmationView } from "@/components/pages/booking/BookingConfirmation";
import { BookingFailurePanel } from "@/components/pages/booking/BookingFailurePanel";
import { FUNNEL_EVENTS, trackFunnel } from "@/components/pages/_telemetry";

export interface BookingWizardProps {
  services: readonly CatalogService[];
  packages: readonly PackageDto[];
  strip: readonly DateStripDayView[];
  maxServices: number;
  /** Pre-selected from `?service=` / `?package=` / `?promo=`. */
  initialServiceSlug: string | null;
  initialPackageSlug: string | null;
  initialPromoCode: string | null;
  initialStep: BookingStepId;
}

interface AvailabilityState {
  phase: AvailabilityPhase;
  slots: SlotDto[];
  isClosed: boolean;
  closedReason: string | null;
  totalCapacity: number;
  errorTitle: string | null;
  errorMessage: string | null;
}

const IDLE_AVAILABILITY: AvailabilityState = {
  phase: "idle",
  slots: [],
  isClosed: false,
  closedReason: null,
  totalCapacity: 0,
  errorTitle: null,
  errorMessage: null,
};

export function BookingWizard({
  services,
  packages,
  strip,
  maxServices,
  initialServiceSlug,
  initialPackageSlug,
  initialPromoCode,
  initialStep,
}: BookingWizardProps): React.ReactElement {
  // ── URL-synced step ──────────────────────────────────────────────────────
  const [step, setStep] = React.useState<BookingStepId>(initialStep);
  const firstRender = React.useRef(true);

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    trackFunnel(FUNNEL_EVENTS.bookStepView, { step });
  }, [step]);

  React.useEffect(() => {
    const onPop = () => {
      const next = new URLSearchParams(window.location.search).get("step");
      setStep(isBookingStepId(next) ? next : "vehicle");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const goTo = React.useCallback((next: BookingStepId) => {
    setStep(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("step", next);
      window.history.pushState({ step: next }, "", url.toString());
    } catch {
      // A history write failure must never stop the customer moving on.
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ── Draft ────────────────────────────────────────────────────────────────
  const [draft, setDraft] = React.useState<BookingDraft>(() => {
    const slugs = initialServiceSlug ? [initialServiceSlug] : [];
    const pkgSlug = initialPackageSlug && getPackageBySlug(initialPackageSlug) ? initialPackageSlug : null;
    if (pkgSlug) {
      const bundleServices = bundleServiceSlugs(pkgSlug, services);
      return {
        vehicle: {
          mode: "known",
          year: "",
          make: "",
          model: "",
          variant: "",
          plate: "",
          freeText: "",
        },
        serviceSlugs: Array.from(new Set([...slugs, ...bundleServices])).slice(0, maxServices),
        packageSlug: pkgSlug,
        promoCode: initialPromoCode,
        date: null,
        startAt: null,
        contact: {
          name: "",
          phone: "",
          email: "",
          notes: "",
          consentSms: false,
          consentMarketing: false,
        },
      };
    }
    return {
      vehicle: { mode: "known", year: "", make: "", model: "", variant: "", plate: "", freeText: "" },
      serviceSlugs: slugs,
      packageSlug: null,
      promoCode: initialPromoCode,
      date: null,
      startAt: null,
      contact: { name: "", phone: "", email: "", notes: "", consentSms: false, consentMarketing: false },
    };
  });

  // ── Submission state ─────────────────────────────────────────────────────
  const [website, setWebsite] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState<ConfirmationView | null>(null);
  const [failure, setFailure] = React.useState<BookingFailure | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [retryAt, setRetryAt] = React.useState<number | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = React.useState<number | null>(null);
  const [slotJustTaken, setSlotJustTaken] = React.useState(false);
  const [stepError, setStepError] = React.useState<string | null>(null);
  const submitLock = React.useRef(false);

  // ── Availability ─────────────────────────────────────────────────────────
  const [availability, setAvailability] = React.useState<AvailabilityState>(IDLE_AVAILABILITY);
  const abortRef = React.useRef<AbortController | null>(null);
  const loadAvailability = React.useCallback(
    async (date: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setAvailability((s) => ({ ...s, phase: "loading", errorTitle: null, errorMessage: null }));

      const outcome = await fetchAvailability(date, draft.serviceSlugs, controller.signal);
      if (controller.signal.aborted) return;

      if (outcome.kind === "ok") {
        setAvailability({
          phase: "ready",
          slots: outcome.data.slots,
          isClosed: outcome.data.isClosed,
          closedReason: outcome.data.closedReason ?? null,
          totalCapacity: outcome.data.totalCapacity,
          errorTitle: null,
          errorMessage: null,
        });
        return;
      }
      if (outcome.kind === "offline") {
        setAvailability({ ...IDLE_AVAILABILITY, phase: "offline" });
        return;
      }
      setAvailability({
        ...IDLE_AVAILABILITY,
        phase: "error",
        errorTitle: outcome.title,
        errorMessage: outcome.message,
      });
    },
    [draft.serviceSlugs],
  );

  // Load the slot list whenever a date is chosen.
  React.useEffect(() => {
    if (!draft.date) {
      setAvailability(IDLE_AVAILABILITY);
      return;
    }
    void loadAvailability(draft.date);
  }, [draft.date, loadAvailability]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  // ── 429 countdown ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (retryAt === null) return;
    const tick = () => {
      const remaining = Math.ceil((retryAt - Date.now()) / 1000);
      setRetryAfterSeconds(Math.max(0, remaining));
      if (remaining <= 0) setRetryAt(null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [retryAt]);

  // ── Step validation ──────────────────────────────────────────────────────
  const vehicleError = validateVehicleStep(draft.vehicle);
  const servicesError = validateServicesStep(draft.serviceSlugs, maxServices);
  const slotError = validateDateTimeStep(draft.date, draft.startAt);
  const contactErrors = validateContactStep(draft.contact);

  const canAdvance: Record<BookingStepId, boolean> = {
    vehicle: vehicleError === null,
    services: servicesError === null,
    slot: slotError === null,
    contact: Object.keys(contactErrors).length === 0,
  };

  const stepIndex = BOOKING_STEPS.findIndex((s) => s.id === step);
  const firstBlockingStep = ((): BookingStepId => {
    if (!canAdvance.vehicle) return "vehicle";
    if (!canAdvance.services) return "services";
    if (!canAdvance.slot) return "slot";
    return "contact";
  })();
  const reachable = stepIndex >= BOOKING_STEPS.findIndex((s) => s.id === firstBlockingStep) ? step : firstBlockingStep;

  // ── Actions ──────────────────────────────────────────────────────────────
  const toggleService = React.useCallback(
    (slug: string) => {
      setDraft((d) => {
        const has = d.serviceSlugs.includes(slug);
        if (has) {
          const remaining = d.serviceSlugs.filter((s) => s !== slug);
          // If the customer has now removed a service the bundle depends on, the
          // bundle price no longer applies — drop the package rather than quote a
          // bundle for a basket that is missing part of it.
          const keepPackage =
            d.packageSlug !== null && bundleStillIntact(d.packageSlug, remaining, services);
          return { ...d, serviceSlugs: remaining, packageSlug: keepPackage ? d.packageSlug : null };
        }
        if (d.serviceSlugs.length >= maxServices) return d;
        return { ...d, serviceSlugs: [...d.serviceSlugs, slug] };
      });
    },
    [maxServices, services],
  );

  const selectPackage = React.useCallback(
    (slug: string) => {
      setDraft((d) => {
        const bundle = bundleServiceSlugs(slug, services);
        const merged = Array.from(new Set([...d.serviceSlugs.filter((s) => !bundle.includes(s)), ...bundle]));
        return { ...d, packageSlug: slug, serviceSlugs: merged.slice(0, maxServices) };
      });
      trackFunnel(FUNNEL_EVENTS.servicesPackageCta, { package: slug });
    },
    [maxServices, services],
  );

  const clearPackage = React.useCallback(() => setDraft((d) => ({ ...d, packageSlug: null })), []);

  const onSubmit = React.useCallback(async () => {
    // Double-submit protection: a ref guard survives re-renders and the `disabled`
    // attribute alone does not.
    if (submitLock.current) return;
    const local = validateContactStep(draft.contact);
    if (Object.keys(local).length > 0) {
      setFieldErrors(toFieldErrorShape(local));
      setStepError("We need a couple of details before we can send this booking.");
      return;
    }
    if (!draft.startAt || !draft.date) {
      setStepError("Your time slot is missing. Go back to step 3 and pick one.");
      goTo("slot");
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setFailure(null);
    setFieldErrors({});
    setStepError(null);
    trackFunnel(FUNNEL_EVENTS.bookSubmitted, {
      services: draft.serviceSlugs.length,
      hasPackage: draft.packageSlug !== null,
      vehicleKnown: draft.vehicle.mode === "known",
    });

    const payload = toCreateBookingInput(draft);
    if (website) payload.website = website;
    payload.phone = normaliseForWireLocal(payload.phone);

    const outcome = await submitBooking(payload);
    submitLock.current = false;
    setSubmitting(false);

    if (outcome.kind === "ok") {
      setConfirmation(toConfirmationView(outcome.data, draft, services));
      setFailure(null);
      trackFunnel(FUNNEL_EVENTS.bookSucceeded, { reference: outcome.data.reference });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (outcome.kind === "offline") {
      setFailure({
        kind: "offline",
        title: "You appear to be offline",
        message:
          "We could not send your booking. If you are on the road with a problem, calling is much faster than waiting for a connection — tap below.",
        fields: {},
        retryAfterSeconds: null,
        requestId: null,
      });
      trackFunnel(FUNNEL_EVENTS.bookFailed, { kind: "offline" });
      return;
    }

    setFailure(outcome.failure);
    trackFunnel(FUNNEL_EVENTS.bookFailed, { kind: outcome.failure.kind });

    if (outcome.failure.kind === "conflict") {
      // The slot is gone. Clear the selection, keep EVERYTHING else, refresh.
      setSlotJustTaken(true);
      setDraft((d) => ({ ...d, startAt: null }));
      setStep("slot");
      if (draft.date) void loadAvailability(draft.date);
    }
    if (outcome.failure.kind === "rate-limited" && outcome.failure.retryAfterSeconds !== null) {
      setRetryAt(Date.now() + outcome.failure.retryAfterSeconds * 1000);
      setRetryAfterSeconds(outcome.failure.retryAfterSeconds);
    }
    if (outcome.failure.kind === "validation") {
      setFieldErrors(outcome.failure.fields);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    // `services` is required: `toConfirmationView` reads it to label the booked
    // services. Omitting it let the confirmation screen render a stale catalogue
    // if the prop changed between renders.
  }, [draft, goTo, loadAvailability, services, website]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const startOver = React.useCallback(() => {
    setConfirmation(null);
    setFailure(null);
    setFieldErrors({});
    setStepError(null);
    setSlotJustTaken(false);
    setDraft((d) => ({
      ...d,
      serviceSlugs: initialServiceSlug ? [initialServiceSlug] : [],
      packageSlug: null,
      date: null,
      startAt: null,
      contact: { name: "", phone: "", email: "", notes: "", consentSms: false, consentMarketing: false },
    }));
    goTo("vehicle");
  }, [goTo, initialServiceSlug]);

  React.useEffect(() => {
    trackFunnel(FUNNEL_EVENTS.bookStart, {
      hasService: initialServiceSlug !== null,
      hasPackage: initialPackageSlug !== null,
      hasPromo: initialPromoCode !== null,
    });
  }, [initialServiceSlug, initialPackageSlug, initialPromoCode]);

  // ── Confirmation takes over the whole page region ────────────────────────
  // `SubmitPhase` is a required value rather than three loose booleans, so a
  // form can never be shipped without a pending and an error state.
  const phase: SubmitPhase = submitting
    ? "pending"
    : confirmation !== null
      ? "success"
      : failure !== null
        ? "error"
        : "idle";

  if (confirmation) {
    return (
      <Section labelledBy="confirmation-heading" space="md">
        <div className="mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8">
          <BookingConfirmation booking={confirmation} onStartOver={startOver} />
        </div>
      </Section>
    );
  }

  const nextStep = BOOKING_STEPS[stepIndex + 1];
  const prevStep = BOOKING_STEPS[stepIndex - 1];
  const vehicleSummary = vehicleSummaryOf(draft.vehicle);
  const selectedSlot = availability.slots.find((s) => s.startAt === draft.startAt) ?? null;
  const groups = SERVICE_CATEGORIES.map((c) => ({ slug: c.slug, name: c.name, blurb: c.blurb }));
  const nextOpenDate = nextOpenDateFrom(strip, draft.date);
  const activeDate = draft.date;

  return (
    <Section labelledBy="wizard-heading" space="md">
      <div className="mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8">
        <h2 id="wizard-heading" className="sr-only">
          Book an appointment in four steps
        </h2>

        {/* Mobile summary, above the steps. */}
        <OrderSummary
          className="mb-6 lg:hidden"
          collapsible
          serviceSlugs={draft.serviceSlugs}
          catalogue={services}
          packageSlug={draft.packageSlug}
          date={draft.date}
          slotLabel={selectedSlot?.label ?? null}
          vehicleSummary={vehicleSummary}
          promoCode={draft.promoCode}
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="space-y-8">
            <Stepper current={step} reachable={reachable} onGo={goTo} />

            {stepError ? (
              <Alert tone="danger" title="Almost there" live>
                {stepError}
              </Alert>
            ) : null}

            {failure ? (
              <BookingFailurePanel
                failure={failure}
                retryAfterSeconds={retryAfterSeconds}
                onRetry={() => void onSubmit()}
                retrying={submitting}
                onRefreshSlots={
                  activeDate !== null
                    ? () => {
                        void loadAvailability(activeDate);
                      }
                    : undefined
                }
                onGoToStep={goTo}
              />
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void onSubmit();
              }}
              noValidate
            >
              {step === "vehicle" ? (
                <VehicleStep
                  value={draft.vehicle}
                  onChange={(vehicle) => setDraft((d) => ({ ...d, vehicle }))}
                  fieldErrors={fieldErrors}
                  disabled={submitting}
                />
              ) : null}

              {step === "services" ? (
                <ServicesStep
                  services={services}
                  packages={packages}
                  groups={groups}
                  selectedSlugs={draft.serviceSlugs}
                  packageSlug={draft.packageSlug}
                  onToggle={toggleService}
                  onSelectPackage={selectPackage}
                  onClearPackage={clearPackage}
                  fieldErrors={fieldErrors}
                  disabled={submitting}
                  maxServices={maxServices}
                />
              ) : null}

              {step === "slot" ? (
                <DateTimeStep
                  strip={strip}
                  selectedDate={draft.date}
                  onSelectDate={(isoDate) => {
                    setSlotJustTaken(false);
                    setDraft((d) => ({ ...d, date: isoDate, startAt: null }));
                    trackFunnel(FUNNEL_EVENTS.bookSlotSelected, { date: isoDate });
                  }}
                  phase={availability.phase}
                  availability={
                    availability.phase === "ready"
                      ? {
                          date: draft.date ?? "",
                          timezone: "Asia/Manila",
                          totalCapacity: availability.totalCapacity,
                          slots: availability.slots,
                          isClosed: availability.isClosed,
                          ...(availability.closedReason ? { closedReason: availability.closedReason } : {}),
                        }
                      : null
                  }
                  errorTitle={availability.errorTitle}
                  errorMessage={availability.errorMessage}
                  onRetry={() => {
                    if (draft.date) void loadAvailability(draft.date);
                  }}
                  selectedStartAt={draft.startAt}
                  onSelectSlot={(slot) => setDraft((d) => ({ ...d, startAt: slot.startAt }))}
                  slotJustTaken={slotJustTaken}
                  nextOpenDate={nextOpenDate}
                  disabled={submitting}
                />
              ) : null}

              {step === "contact" ? (
                <ContactStep
                  contact={draft.contact}
                  onChange={(contact) => setDraft((d) => ({ ...d, contact }))}
                  vehicle={draft.vehicle}
                  slotLabel={selectedSlot?.label ?? null}
                  dateLabel={draft.date ? formatDateLabel(draft.date) : null}
                  website={website}
                  onWebsiteChange={setWebsite}
                  fieldErrors={fieldErrors}
                  pending={submitting}
                  locked={(retryAfterSeconds ?? 0) > 0}
                />
              ) : null}

              <div className="mt-8">
                <StepNav
                  onBack={prevStep ? () => goTo(prevStep.id) : undefined}
                  onNext={
                    nextStep && step !== "contact"
                      ? () => {
                          setStepError(null);
                          goTo(nextStep.id);
                        }
                      : undefined
                  }
                  backLabel={prevStep ? `Back to ${prevStep.short}` : undefined}
                  nextLabel={nextStep ? `Continue to ${nextStep.short}` : undefined}
                  canGoBack={prevStep !== undefined}
                  canGoNext={step === "contact" ? true : canAdvance[step]}
                  nextBusy={submitting}
                />
                {step !== "contact" && !canAdvance[step] ? (
                  <p className="mt-3 text-sm font-bold text-destructive">
                    {step === "vehicle" ? vehicleError : step === "services" ? servicesError : slotError}
                  </p>
                ) : null}
                {step === "contact" && !submitting ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Pressing Confirm sends the booking request. No payment is taken.
                  </p>
                ) : null}
                {submitting ? (
                  <p className="mt-3 flex items-center gap-2 text-sm font-bold" aria-live="polite">
                    <Spinner size="sm" />
                    Sending — please do not close this page.
                  </p>
                ) : null}
              </div>
            </form>
          </div>

          {/* Desktop summary, sticky. */}
          <OrderSummary
            className="sticky top-[calc(var(--header-height)+1.5rem)] hidden lg:block"
            serviceSlugs={draft.serviceSlugs}
            catalogue={services}
            packageSlug={draft.packageSlug}
            date={draft.date}
            slotLabel={selectedSlot?.label ?? null}
            vehicleSummary={vehicleSummary}
            promoCode={draft.promoCode}
          />

          <p className="sr-only" aria-live="polite">
            {phase === "pending"
              ? "Sending your booking. Please wait."
              : phase === "error"
                ? "The booking could not be sent. See the message above the form."
                : ""}
          </p>
        </div>
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Local validation returns a single message per field; the API returns an array.
 * Normalising here keeps `fieldErrors` one shape across both sources.
 */
function toFieldErrorShape(errors: Record<string, string>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, [v]]));
}

/** Normalises a PH mobile to E.164 locally so the wire format is unambiguous. */
function normaliseForWireLocal(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("63")) return `+${digits}`;
  if (digits.startsWith("0")) return `+63${digits.slice(1)}`;
  if (digits.length === 10) return `+63${digits}`;
  return `+${digits}`;
}

/**
 * Which services a package contains.
 *
 * The mapping is derived from the package's item list by slug where possible,
 * and falls back to matching the package's `id` against the service catalogue.
 * ⇄ ORCHESTRATOR / BACKEND: once `Package` ↔ `Service` is a real join table,
 *   this should come from the API instead of being inferred on the client.
 */
function bundleServiceSlugs(
  packageSlug: string,
  services: readonly CatalogService[],
): string[] {
  const slugified = packageSlug
    .replace(/-package$/, "")
    .split("-")
    .filter((w) => w.length > 2);
  const scored = services
    .map((s) => {
      const haystack = `${s.slug} ${s.name}`.toLowerCase();
      const hits = slugified.filter((w) => haystack.includes(w)).length;
      return { slug: s.slug, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  return scored.slice(0, 4).map((x) => x.slug);
}

function bundleStillIntact(
  packageSlug: string,
  serviceSlugs: readonly string[],
  services: readonly CatalogService[],
): boolean {
  const bundle = bundleServiceSlugs(packageSlug, services);
  return bundle.length > 0 && bundle.every((s) => serviceSlugs.includes(s));
}

/** The first open day in the strip after `fromDate`. */
function nextOpenDateFrom(
  strip: readonly DateStripDayView[],
  fromDate: string | null,
): string | null {
  const from = fromDate ?? strip[0]?.isoDate ?? null;
  if (!from) return null;
  for (const day of strip) {
    if (day.isoDate > from && !day.closed) return day.isoDate;
  }
  return null;
}

/** Flattens a `BookingDto` plus the local draft into the confirmation view. */
function toConfirmationView(
  dto: BookingDto,
  draft: BookingDraft,
  services: readonly CatalogService[],
): ConfirmationView {
  const chosen = services.filter((s) => draft.serviceSlugs.includes(s.slug));
  const items: Array<{ name: string; quantity: number }> =
    dto.items.length > 0
      ? dto.items.map((i) => ({ name: i.name, quantity: i.quantity }))
      : chosen.map((s) => ({ name: s.shortName ?? s.name, quantity: 1 }));

  return {
    reference: dto.reference,
    status: dto.status,
    startAt: dto.startAt,
    customerName: dto.customerName,
    customerPhone: dto.customerPhone,
    vehicleSummary: vehicleSummaryOf(draft.vehicle),
    items,
    estimateMin: dto.estimateMin,
    estimateMax: dto.estimateMax,
  };
}

export type { DateStripDayView, ConfirmationView };
