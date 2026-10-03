"use client";

/**
 * BOOKING WIDGET — the four-step online service scheduler.
 * ============================================================================
 * Works as a self-contained homepage embed AND as the body of `/book`.
 *
 * ENDPOINTS
 *   GET  /api/availability?date=YYYY-MM-DD   → ApiResult<SlotAvailabilityDto>
 *   POST /api/booking                        CreateBookingInput → ApiResult<BookingDto>
 *   GET  /api/captcha                        → optional arithmetic challenge
 *   All three are optional in practice: the form degrades to a call/WhatsApp
 *   path rather than breaking.
 *
 * STEP MACHINE
 *   1 Vehicle → 2 Services → 3 Slot → 4 Confirm
 *   `aria-current="step"` on the stepper, focus moved to the new step heading,
 *   completable with the keyboard alone.
 *
 * FAILURE MATRIX — every row is a DESIGNED state, never a raw error
 *   400 → `error.fields` mapped onto the right inputs, focus on the first bad one
 *   409 → slots refreshed, every other input preserved, explained in words
 *   429 → a live countdown from `meta.retryAfter`, submit disabled until it ends
 *   500 / network → retry + the phone number + WhatsApp
 *   offline → `useOnlineStatus` state; the phone/WhatsApp path stays open
 *   a captcha failure alone NEVER blocks: the phone path stays open
 *
 * DOUBLE SUBMIT
 *   `useIdempotentSubmit` is instantiated inside `useBooking` (the single owner
 *   of in-flight state) and surfaced here as `booking.isPending`. One lock, not
 *   two competing ones — the button gets `disabled` + `aria-busy` from it.
 *
 * ANTI-DARK-PATTERN NOTES
 *   - The SMS consent box is UNTICKED and says, in full sentences, what we send.
 *   - No pre-ticked marketing box.
 *   - No confirm-dialog trick, no disguised close, no "3 people are viewing".
 *   - The honeypot `website` field is visually and programmatically hidden.
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MessageCircle,
  Phone,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import type { BookingDto, PackageDto, ServiceDto } from "@/lib/types";
import { BOOKING, BUSINESS, LINKS } from "@/config/site";
import { formatPhPhone, vehicleLabel, cn } from "@/lib/utils";
import { apiFetch } from "@/components/widgets/internal/api";
import {
  BOOKING_STEPS,
  draftFromSearchParams,
  useBooking,
  type BookingStep,
  type BookingDraft,
} from "@/hooks/useBooking";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useCountdown } from "@/hooks/useCountdown";
import { events } from "@/lib/hooks";
import { formatShopDateTime } from "@/components/widgets/internal/time-ph";
import {
  Button,
  Notice,
  Pill,
  TextField,
  WidgetCard,
  controlClass,
  controlInvalidClass,
} from "@/components/widgets/internal/ui";
import VehiclePicker from "@/components/widgets/VehiclePicker";
import ServicePicker from "@/components/widgets/ServicePicker";
import SlotPicker from "@/components/widgets/SlotPicker";
import BookingSummary from "@/components/widgets/BookingSummary";
import BookingConfirmation from "@/components/widgets/BookingConfirmation";

interface CaptchaChallenge {
  question: string;
  token?: string;
}

export interface BookingWidgetProps {
  /** Catalogue. Omit to use the widget's own conservative list. */
  services?: readonly ServiceDto[] | undefined;
  packages?: readonly PackageDto[] | undefined;
  /** `Date.now()` from the server render. Keeps "today" and "open now" stable. */
  serverNowMs?: number | undefined;
  /** Deep-link values (already parsed from the URL by the page). */
  initial?: Partial<BookingDraft> | undefined;
  /** Start on a specific step. Overrides `initial.step`. */
  defaultStep?: BookingStep | undefined;
  /** sessionStorage key for the in-progress draft. Pass `null` to disable. */
  storageKey?: string | null | undefined;
  /** Render the outer heading block. */
  showHeading?: boolean;
  /** Analytics origin, e.g. "homepage" or "/book". */
  source?: string | undefined;
  className?: string;
  /** Fired after a successful booking, so the page can add its own events. */
  onConfirmed?: ((booking: BookingDto) => void) | undefined;
  headingId?: string;
}

export default function BookingWidget({
  services,
  packages,
  serverNowMs,
  initial,
  defaultStep,
  storageKey,
  showHeading = true,
  source,
  className,
  onConfirmed,
  headingId,
}: BookingWidgetProps) {
  const uid = headingId ?? "booking-widget";
  const booking = useBooking({
    ...(services ? { services } : {}),
    ...(packages ? { packages } : {}),
    ...(initial ? { initial } : {}),
    ...(defaultStep ? { initial: { ...(initial ?? {}), step: defaultStep } } : {}),
    ...(storageKey === null ? { storageKey: "" } : {}),
  });
  const { draft, phase, errors, reset, registerConflictRefresh } = booking;

  const online = useOnlineStatus();
  const pendingFocusRef = useRef(false);
  const captchaLoadedRef = useRef(false);

  // ── Analytics: once per mount ────────────────────────────────────────────
  useEffect(() => {
    events.bookingStarted(source);
  }, [source]);

  // ── Step change → focus the new step heading, exactly once ────────────────
  useEffect(() => {
    if (phase === "confirmed") return;
    if (!pendingFocusRef.current) return;
    pendingFocusRef.current = false;
    const node = document.getElementById(`${uid}-h${draft.step}`);
    node?.focus({ preventScroll: false });
  }, [draft.step, phase, uid]);

  const goTo = useCallback(
    (step: BookingStep) => {
      pendingFocusRef.current = true;
      booking.goToStep(step);
      events.bookingStep(step, BOOKING_STEPS[step - 1]?.name ?? "unknown");
    },
    [booking],
  );

  // ── Captcha: try once, degrade silently if the endpoint is not there ─────
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaFailed, setCaptchaFailed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // One challenge per widget instance. Re-running it on every render would
    // clear an answer the customer had already typed.
    if (captchaLoadedRef.current) return;
    captchaLoadedRef.current = true;
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      const result = await apiFetch<{ question: string; token?: string }>("/api/captcha", {
        signal: controller.signal,
        timeoutMs: 4000,
      });
      if (cancelled) return;
      if (result.ok && typeof result.data.question === "string" && result.data.question.trim() !== "") {
        setCaptcha({
          question: result.data.question,
          ...(typeof result.data.token === "string" ? { token: result.data.token } : {}),
        });
        booking.setCaptcha({
          answer: "",
          ...(typeof result.data.token === "string" ? { token: result.data.token } : {}),
        });
      } else {
        // No endpoint, blocked, or offline. The form must still work.
        setCaptcha(null);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [booking, uid]);

  const rateLimit = useCountdown(
    booking.retryAfter !== null ? Date.now() + booking.retryAfter * 1000 : null,
  );
  const rateLimited = booking.phase === "rate-limited" && !rateLimit.isExpired;

  const catalogueServices = booking.resolvedCatalogue.services;
  const cataloguePackages = booking.resolvedCatalogue.packages;

  const vehicleText = useMemo(() => {
    const v = draft.vehicle;
    if (v.notListed) return v.freeText.trim() || "Vehicle to be confirmed";
    return (
      vehicleLabel({
        year: Number(v.year) || 0,
        make: v.make,
        model: v.model,
        variant: v.variant,
      }) || "Vehicle to be confirmed"
    );
  }, [draft.vehicle]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = useCallback(async () => {
    if (!online.isOnline) {
      events.bookingFailed(0, "OFFLINE");
      return;
    }
    const result = await booking.submit();
    if (result === null) return; // duplicate click, or the request was aborted
    if (result.ok) {
      events.bookingConfirmed(
        result.data.reference,
        draft.serviceIds.length,
        booking.totals.min,
        booking.totals.max,
      );
      return;
    }
    events.bookingFailed(0, result.error.code);
    if (result.error.code === "CAPTCHA_FAILED") {
      setCaptchaFailed(true);
      booking.setCaptcha({ answer: "" });
    }
  }, [booking, draft.serviceIds.length, online.isOnline]);

  const confirmation = phase === "confirmed" ? booking.booking : null;

  useEffect(() => {
    if (confirmation) onConfirmed?.(confirmation);
  }, [confirmation, onConfirmed]);

  const firstInvalidField = useMemo(() => {
    const keys = Object.keys(errors).filter((k) => errors[k]);
    if (keys.length === 0) return null;
    const stepKeys: Record<BookingStep, string[]> = {
      1: ["vehicleYear", "vehicleMake", "vehicleModel", "vehicleNotListed"],
      2: ["serviceIds"],
      3: ["startAt"],
      4: ["name", "phone", "email", "consentSms"],
    };
    return stepKeys[draft.step].find((k) => keys.includes(k)) ?? keys[0] ?? null;
  }, [errors, draft.step]);

  // Move focus to the first invalid input once the server has spoken.
  useEffect(() => {
    if (phase !== "field-error" || !firstInvalidField) return;
    const node =
      document.getElementById(`${uid}-${firstInvalidField}`) ??
      document.querySelector<HTMLElement>(`[name="${firstInvalidField}"]`);
    node?.focus({ preventScroll: false });
  }, [phase, firstInvalidField, uid]);

  const busy = booking.isPending;

  // ── Confirmation replaces the wizard entirely ────────────────────────────
  if (confirmation) {
    return (
      <div className={className}>
        <BookingConfirmation
          booking={confirmation}
          durationLabel={booking.totalDurationLabel}
          notes={draft.contact.notes.trim() || undefined}
          headingId={`${uid}-confirmation`}
        />
        <div className="mt-3">
          <Button variant="secondary" onClick={reset}>
            <RotateCcw aria-hidden="true" className="size-4" focusable="false" />
            Book another job
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {showHeading ? (
        <div className="flex flex-col gap-1">
          <p className="eyg-eyebrow text-muted-foreground">Online booking</p>
          <h2 id={headingId} className="text-h2 text-foreground">
            Book a bay
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Four short steps. No account, no deposit. We confirm by text message.
          </p>
        </div>
      ) : null}

      {/* ── Restored draft ───────────────────────────────────────────────── */}
      {booking.wasRestored && draft.step > 1 ? (
        <Notice tone="info" title="We kept what you already typed">
          <p>
            Your previous answers were still here. Carry on, or{" "}
            <button
              type="button"
              onClick={reset}
              className="font-semibold underline underline-offset-4"
            >
              start fresh
            </button>
            .
          </p>
        </Notice>
      ) : null}

      {/* ── Offline ──────────────────────────────────────────────────────── */}
      {online.isReady && !online.isOnline ? (
        <Notice tone="warning" title="You appear to be offline">
          <p>
            Your answers are saved on this page, so nothing is lost. We cannot send the booking until
            the connection is back — or just call us and we will book you by hand.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={LINKS.call}
              onClick={() => events.call("booking-offline")}
              className="inline-flex min-h-11 items-center gap-2 rounded-card border border-border-strong bg-surface px-3 py-2 text-sm font-bold text-foreground"
            >
              <Phone aria-hidden="true" className="size-4" focusable="false" />
              Call {BUSINESS.phoneDisplay}
            </a>
            <a
              href={LINKS.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => events.whatsapp("booking-offline")}
              className="inline-flex min-h-11 items-center gap-2 rounded-card border border-border-strong bg-surface px-3 py-2 text-sm font-bold text-foreground"
            >
              <MessageCircle aria-hidden="true" className="size-4" focusable="false" />
              WhatsApp
            </a>
          </div>
        </Notice>
      ) : null}

      {/* ── Stepper ──────────────────────────────────────────────────────── */}
      <nav aria-label="Booking steps">
        <ol className="flex flex-wrap gap-1.5">
          {BOOKING_STEPS.map((s) => {
            const current = draft.step === s.step;
            const done = draft.step > s.step;
            return (
              <li key={s.step} className="min-w-28 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    if (s.step < draft.step) goTo(s.step);
                  }}
                  disabled={s.step > draft.step}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex min-h-11 w-full flex-col items-start gap-0.5 rounded-card border px-2.5 py-2 text-left",
                    current
                      ? "border-brand-500 bg-brand-500 text-accent-foreground"
                      : done
                        ? "border-pit-300 bg-pit-50 text-pit-900"
                        : "border-border bg-surface text-muted-foreground",
                    s.step > draft.step && "cursor-not-allowed opacity-70",
                  )}
                >
                  <span className="flex items-center gap-1 text-[0.625rem] font-extrabold uppercase tracking-widest">
                    {done ? (
                      <Check aria-hidden="true" className="size-3" focusable="false" />
                    ) : (
                      `Step ${s.step}`
                    )}
                  </span>
                  <span className="text-xs font-bold leading-tight">{s.name}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ── Step bodies ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <WidgetCard className="flex flex-col">
          {draft.step === 1 ? (
            <VehiclePicker
              bare
              headingId={`${uid}-h1`}
              value={draft.vehicle}
              onChange={booking.setVehicle}
              errors={errors}
            />
          ) : null}

          {draft.step === 2 ? (
            <ServicePicker
              bare
              headingId={`${uid}-h2`}
              services={catalogueServices}
              packages={cataloguePackages}
              selectedIds={draft.serviceIds}
              packageId={draft.packageId}
              onToggle={booking.toggleService}
              onSelectPackage={booking.setPackageId}
              totals={{
                min: booking.totals.min,
                max: booking.totals.max,
                durationMin: booking.totals.durationMin,
                itemCount: booking.totals.itemCount,
                hasVariable: booking.totals.hasVariable,
                savings: booking.totals.savings,
                durationLabel: booking.totalDurationLabel,
              }}
              errors={errors}
              maxServices={BOOKING.maxServicesPerBooking}
              phoneHref={LINKS.call}
              phoneDisplay={BUSINESS.phoneDisplay}
            />
          ) : null}

          {draft.step === 3 ? (
            <SlotPicker
              bare
              headingId={`${uid}-h3`}
              date={draft.date}
              onDateChange={booking.setDate}
              startAt={draft.startAt}
              slotLabel={draft.slotLabel}
              onSlotChange={booking.setSlot}
              serviceIds={draft.serviceIds}
              serverNowMs={serverNowMs}
              errors={errors}
              registerRefresh={registerConflictRefresh}
            />
          ) : null}

          {draft.step === 4 ? (
            <ContactStep
              uid={uid}
              draft={draft}
              errors={errors}
              captcha={captcha}
              captchaFailed={captchaFailed}
              booking={booking}
              busy={busy}
              rateLimited={rateLimited}
              onSubmit={onSubmit}
            />
          ) : null}

          {/* ── Navigation ────────────────────────────────────────────── */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {draft.step > 1 ? (
              <Button variant="secondary" onClick={() => goTo((draft.step - 1) as BookingStep)} disabled={busy}>
                <ArrowLeft aria-hidden="true" className="size-4" focusable="false" />
                Back
              </Button>
            ) : null}

            {draft.step < 4 ? (
              <Button onClick={() => goTo((draft.step + 1) as BookingStep)}>
                Next: {BOOKING_STEPS[draft.step]?.name}
                <ArrowRight aria-hidden="true" className="size-4" focusable="false" />
              </Button>
            ) : (
              <Button
                onClick={() => void onSubmit()}
                /* `form` points at the step-4 form so pressing Enter in a field
                   and pressing this button take the identical code path. */
                form={draft.step === 4 ? `${uid}-contact-form` : undefined}
                disabled={busy || rateLimited || !online.isOnline || !booking.canSubmit}
                aria-busy={busy}
                className="min-w-48"
              >
                {busy ? "Sending…" : "Confirm booking"}
                {!busy ? <Check aria-hidden="true" className="size-4" focusable="false" /> : null}
              </Button>
            )}

            <p className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">
              {BOOKING_STEPS[draft.step - 1]?.blurb}
            </p>
          </div>
        </WidgetCard>

        {/* ── The rail: what they have chosen so far ─────────────────────── */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <BookingSummary
            compact
            headingId={`${uid}-summary`}
            services={booking.selectedServices}
            packages={cataloguePackages}
            packageId={draft.packageId}
            promoCode={draft.promoCode}
            vehicleLabel={vehicleText}
            date={draft.date}
            startAt={draft.startAt}
            slotLabel={draft.slotLabel}
            estimateMin={booking.totals.min}
            estimateMax={booking.totals.max}
            durationLabel={booking.totalDurationLabel}
            hasVariable={booking.totals.hasVariable}
          />

          {draft.promoCode ? (
            <div className="mt-3">
              <Pill tone="brand">Promo {draft.promoCode} applied</Pill>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Step 4 ──────────────────────────────────────────────────────────────────

interface ContactStepProps {
  uid: string;
  draft: BookingDraft;
  errors: Record<string, string | undefined>;
  captcha: CaptchaChallenge | null;
  captchaFailed: boolean;
  booking: ReturnType<typeof useBooking>;
  busy: boolean;
  rateLimited: boolean;
  onSubmit: () => Promise<void>;
}

function ContactStep({
  uid,
  draft,
  errors,
  captcha,
  captchaFailed,
  booking,
  busy,
  rateLimited,
  onSubmit,
}: ContactStepProps) {
  const c = draft.contact;

  // Format as the customer types. `formatPhPhone` normalises first, so a
  // partially typed number still round-trips through `normalisePhone`.
  const onPhoneChange = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, 13);
      booking.setContact({ phone: digits.length > 0 ? formatPhPhone(digits) : "" });
    },
    [booking],
  );

  return (
    <form
      id={`${uid}-contact-form`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
      className="flex flex-col gap-4"
      aria-busy={busy}
    >
      <div className="flex flex-col gap-1">
        <p className="eyg-eyebrow text-muted-foreground">Step 4 of 4</p>
        <h2 id={`${uid}-h4`} tabIndex={-1} className="text-h3 text-foreground outline-none">
          Confirm your booking
        </h2>
        <p className="text-sm text-muted-foreground">
          We will text you to confirm. No account, no deposit, no card details on this page.
        </p>
      </div>

      {/* ── 409 slot conflict ───────────────────────────────────────────── */}
      {booking.phase === "conflict" ? (
        <Notice tone="warning" title="That bay was just taken">
          <p>
            {booking.serverMessage ?? booking.errorsByStatus[409] ?? ""}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-2">
            <button
              type="button"
              onClick={() => booking.goToStep(3)}
              className="font-bold underline underline-offset-4"
            >
              Choose another time
            </button>
            <span aria-hidden="true">·</span>
            <a href={LINKS.call} className="font-bold underline underline-offset-4">
              call {BUSINESS.phoneDisplay}
            </a>
          </p>
        </Notice>
      ) : null}

      {/* ── 429 rate limited, with a real countdown ──────────────────────── */}
      {booking.phase === "rate-limited" || rateLimited ? (
        <Notice tone="warning" title="Too many attempts from this connection">
          <p>
            We have paused requests from this device for a moment so nobody gets double-booked. The
            button unlocks when the timer below reaches zero.
          </p>
          <RateLimitCountdown
            retryAfter={booking.retryAfter}
            onElapsed={() => booking.setPhase("idle")}
          />
          <p className="mt-2">
            {booking.serverMessage ?? booking.errorsByStatus[429] ?? ""}
          </p>
          <p className="mt-2">
            Or skip the queue:{" "}
            <a href={LINKS.call} onClick={() => events.call("booking-rate-limited")} className="font-bold underline underline-offset-4">
              call {BUSINESS.phoneDisplay}
            </a>{" "}
            and we will book you by hand.
          </p>
        </Notice>
      ) : null}

      {/* ── 400 validation ──────────────────────────────────────────────── */}
      {booking.phase === "field-error" && booking.serverMessage ? (
        <Notice tone="danger" title="We could not send that yet">
          <p>{booking.serverMessage}</p>
          <p className="mt-1 text-xs">{booking.errorsByStatus[400] ?? ""}</p>
        </Notice>
      ) : null}

      {/* ── 500 / network ───────────────────────────────────────────────── */}
      {booking.phase === "error" ? (
        <Notice
          tone="danger"
          title="Our booking system did not answer"
          actions={
            <>
              <Button variant="secondary" onClick={() => void onSubmit()} disabled={busy}>
                <RefreshCw aria-hidden="true" className="size-4" focusable="false" />
                Try again
              </Button>
              <a
                href={LINKS.call}
                onClick={() => events.call("booking-error")}
                className="inline-flex min-h-11 items-center gap-2 rounded-card border border-racing-400 bg-racing-50 px-3 py-2 text-sm font-bold text-racing-900"
              >
                <Phone aria-hidden="true" className="size-4" focusable="false" />
                Call {BUSINESS.phoneDisplay}
              </a>
              <a
                href={LINKS.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => events.whatsapp("booking-error")}
                className="inline-flex min-h-11 items-center gap-2 rounded-card border border-border-strong bg-surface px-3 py-2 text-sm font-bold text-foreground"
              >
                <MessageCircle aria-hidden="true" className="size-4" focusable="false" />
                WhatsApp
              </a>
            </>
          }
        >
          <p>
            {booking.serverMessage ?? booking.errorsByStatus[500] ?? ""}
          </p>
          <p className="mt-1 text-xs">
            Nothing was charged and nothing was booked. Every field you filled in is still here.
          </p>
        </Notice>
      ) : null}

      {/* ── Contact fields ──────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Your name"
          name="name"
          id={`${uid}-name`}
          required
          autoComplete="name"
          value={c.name}
          error={errors.name}
          onChange={(e) => booking.setContact({ name: e.target.value })}
          placeholder="Juan Dela Cruz"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-phone`} className="text-sm font-bold text-foreground">
            Mobile number
            <span className="ml-1 text-racing-700" aria-hidden="true">
              *
            </span>
          </label>
          <p id={`${uid}-phone-hint`} className="text-xs text-muted-foreground">
            Your Philippine mobile. We text you once to confirm.
          </p>
          <input
            id={`${uid}-phone`}
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            required
            value={c.phone}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={`${uid}-phone-hint${errors.phone ? ` ${uid}-phone-error` : ""}`}
            onChange={(e) => onPhoneChange(e.target.value)}
            className={cn(controlClass, errors.phone && controlInvalidClass)}
            placeholder="09XX XXX XXXX"
          />
          {errors.phone ? (
            <p id={`${uid}-phone-error`} className="text-xs font-semibold text-racing-700">
              ⚠ {errors.phone}
            </p>
          ) : null}
        </div>

        <TextField
          label="Email"
          name="email"
          id={`${uid}-email`}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={c.email}
          error={errors.email}
          onChange={(e) => booking.setContact({ email: e.target.value })}
          placeholder="you@example.com"
          hint="Only if you want the confirmation by email too."
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-promo`} className="text-sm font-bold text-foreground">
            Promo code
            <span className="ml-1 text-xs font-medium text-muted-foreground">(optional)</span>
          </label>
          <input
            id={`${uid}-promo`}
            name="promoCode"
            value={draft.promoCode}
            onChange={(e) => booking.setPromoCode(e.target.value)}
            className={cn(controlClass, "uppercase")}
            placeholder="FIRSTPMS"
            aria-describedby={`${uid}-promo-hint`}
          />
          <p id={`${uid}-promo-hint`} className="text-xs text-muted-foreground">
            We check the code at the counter and tell you before anything is charged.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-notes`} className="text-sm font-bold text-foreground">
          Anything we should know?
          <span className="ml-1 text-xs font-medium text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id={`${uid}-notes`}
          name="notes"
          rows={3}
          value={c.notes}
          onChange={(e) => booking.setContact({ notes: e.target.value })}
          className={cn(controlClass, "resize-y")}
          placeholder="e.g. Front left tyre keeps losing pressure. Car makes a noise over 60kph."
          aria-describedby={`${uid}-notes-hint`}
        />
        <p id={`${uid}-notes-hint`} className="text-xs text-muted-foreground">
          A symptom, a noise, a worry — anything helps us prepare.
        </p>
      </div>

      {/* ── Consent. Unticked. Full sentences. No pre-ticked marketing. ──── */}
      <fieldset className="flex flex-col gap-3 rounded-card border border-border-strong bg-surface-muted p-3">
        <legend className="eyg-eyebrow px-1 text-muted-foreground">Permission</legend>

        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            id={`${uid}-consentSms`}
            name="consentSms"
            type="checkbox"
            required
            checked={c.consentSms}
            aria-invalid={errors.consentSms ? true : undefined}
            aria-describedby={errors.consentSms ? `${uid}-consentSms-error` : undefined}
            onChange={(e) => booking.setContact({ consentSms: e.target.checked })}
            className="mt-1 size-5 shrink-0 accent-[var(--color-brand-500)]"
          />
          <span className="text-sm leading-relaxed text-foreground">
            Yes, EYG may send me a text message to confirm this booking, and to tell me if the shop
            needs to move the time. I understand message rates may apply, and I can reply STOP at any
            time to stop.
          </span>
        </label>
        {errors.consentSms ? (
          <p id={`${uid}-consentSms-error`} className="text-xs font-semibold text-racing-700">
            ⚠ {errors.consentSms}
          </p>
        ) : null}

        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            id={`${uid}-consentMarketing`}
            name="consentMarketing"
            type="checkbox"
            checked={c.consentMarketing}
            onChange={(e) => booking.setContact({ consentMarketing: e.target.checked })}
            className="mt-1 size-5 shrink-0 accent-[var(--color-brand-500)]"
          />
          <span className="text-sm leading-relaxed text-foreground">
            Also send me occasional messages about promos and seasonal reminders, like tyre clearance
            before the rainy season. Optional, and unrelated to this booking.
          </span>
        </label>

        <p className="text-xs leading-relaxed text-muted-foreground">
          We will text you to confirm this booking. You can call{" "}
          <a href={LINKS.call} className="font-bold underline underline-offset-4">
            {BUSINESS.phoneDisplay}
          </a>{" "}
          any time instead — you never have to use this form.
        </p>
      </fieldset>

      {/* ── Captcha, only when the endpoint answered ─────────────────────── */}
      {captcha ? (
        <div className="rounded-card border border-border-strong bg-surface p-3">
          <label htmlFor={`${uid}-captcha`} className="text-sm font-bold text-foreground">
            Quick check: {captcha.question}
          </label>
          <p id={`${uid}-captcha-hint`} className="text-xs text-muted-foreground">
            This stops automated spam. If you would rather not answer it, just press the button — we
            will still take your booking by phone or WhatsApp.
          </p>
          <input
            id={`${uid}-captcha`}
            name="captchaAnswer"
            inputMode="numeric"
            value={draft.captchaAnswer}
            onChange={(e) => booking.setCaptcha({ answer: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            className={cn(controlClass, "mt-2 max-w-32", captchaFailed && controlInvalidClass)}
            aria-invalid={captchaFailed ? true : undefined}
            aria-describedby={captchaFailed ? undefined : `${uid}-captcha-hint`}
          />
          {captchaFailed ? (
            <p role="alert" className="mt-1.5 text-xs font-semibold text-racing-700">
              ⚠ That answer was not right. Have another go — or press Confirm and we will confirm by
              phone instead.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── Honeypot. Off-screen, unfocusable, and mirrored into the payload. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-px w-px opacity-0"
        value={c.website}
        readOnly
      />

      <p className="text-xs leading-relaxed text-muted-foreground">
        Slot:{" "}
        <span className="font-bold text-foreground">
          {draft.startAt
            ? `${formatShopDateTime(draft.startAt)}${draft.slotLabel ? ` · ${draft.slotLabel}` : ""}`
            : "not chosen yet"}
        </span>
        {draft.startAt ? null : " — go back to step 3 if that is not right."}
      </p>
    </form>
  );
}

/** A genuine countdown from `meta.retryAfter`, not a static number. */
function RateLimitCountdown({
  retryAfter,
  onElapsed,
}: {
  retryAfter: number | null;
  onElapsed: () => void;
}) {
  const targetMs = retryAfter !== null ? Date.now() + retryAfter * 1000 : null;
  const c = useCountdown(targetMs);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!c.isRunning || c.remainingMs > 0 || firedRef.current) return;
    firedRef.current = true;
    onElapsed();
  }, [c.isRunning, c.remainingMs, onElapsed]);

  useEffect(() => {
    firedRef.current = false;
  }, [targetMs]);

  if (!c.isRunning) return null;

  const seconds = Math.max(0, Math.ceil(c.remainingMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return (
    <p aria-live="off" className="tabular mt-2 font-mono text-sm font-bold text-foreground">
      Retry available in {minutes > 0 ? `${minutes}m ` : ""}
      {rest.toString().padStart(2, "0")}s
    </p>
  );
}

export { BookingWidget };
export { draftFromSearchParams };
export type { BookingStep };