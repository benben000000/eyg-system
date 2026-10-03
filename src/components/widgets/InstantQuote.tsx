"use client";

/**
 * INSTANT QUOTE — the interactive package estimator (the client island).
 * ============================================================================
 * The Server-Component shell lives in `./InstantQuote.server.tsx`. This file is
 * the interactive half only, so the section heading, the section copy and the
 * JSON-LD stay on the server and nothing here inflates the initial HTML.
 *
 * THE RULE THAT MATTERS
 *  This widget is a RANGE, never a promise. The `disclaimer` and every
 *  `variableNote` are rendered VERBATIM, so the honesty treatment cannot be
 *  bypassed by a different code path.
 *
 * THE ONE ASYNC SURFACE ("text me this estimate") — all four states
 *   loading  → button reads "Sending…", `aria-busy`, disabled
 *   success  → the reference from `QuoteRequestDto`
 *   empty    → the resting state (nothing submitted yet)
 *   error    → a designed notice with retry, plus the call/WhatsApp path
 *
 * LOCAL FALLBACK
 *  `POST /api/quote` failing never blanks the number. The estimate is computed
 *  locally from the same catalogue, so the widget labels it as an on-site
 *  estimate and offers the human path instead of a dead form.
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Phone, Send } from "lucide-react";
import type { PackageDto, QuoteEstimateInput, ServiceDto } from "@/lib/types";
import { BUSINESS, LINKS } from "@/config/site";
import { cn, formatPhPhone, formatPesoRange } from "@/lib/utils";
import { events } from "@/lib/hooks";
import { useQuote } from "@/hooks/useQuote";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { priceBand } from "@/components/widgets/internal/catalogue";
import {
  Button,
  Notice,
  Pill,
  TextField,
  WidgetCard,
  controlClass,
} from "@/components/widgets/internal/ui";
import QuoteResult from "@/components/widgets/QuoteResult";

export type EngineType = QuoteEstimateInput["engine"];

export const ENGINE_OPTIONS: ReadonlyArray<{ value: EngineType; label: string }> = [
  { value: "unknown", label: "Not sure" },
  { value: "gasoline", label: "Gasoline / petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybrid" },
  { value: "electric", label: "Electric" },
] as const;

/** Common sidewall sizes, for the datalist hint only. Never a restriction. */
export const TYRE_SIZES: readonly string[] = Object.freeze([
  "155/65 R13",
  "155/70 R14",
  "165/65 R14",
  "165/70 R14",
  "175/65 R14",
  "185/65 R15",
  "195/65 R15",
  "205/45 R17",
  "205/55 R16",
  "215/45 R17",
  "225/35 R19",
  "225/45 R18",
]);

export interface InstantQuoteProps {
  services?: readonly ServiceDto[] | undefined;
  packages?: readonly PackageDto[] | undefined;
  /** Deep-link / server-provided initial selection. */
  initial?: Partial<QuoteEstimateInput> | undefined;
  /** `Date.now()` from the server render. Keeps the estimate expiry honest. */
  serverNowMs?: number | undefined;
  className?: string;
  /** Render the "text me this estimate" capture. Off for very tight embeds. */
  showCaptureForm?: boolean;
  headingId?: string;
  /** Analytic origin, e.g. "homepage-estimator". */
  source?: string | undefined;
}

export default function InstantQuote({
  services,
  packages,
  initial,
  serverNowMs,
  className,
  showCaptureForm = true,
  headingId = "instant-quote",
  source,
}: InstantQuoteProps) {
  const uid = headingId;

  const [engine, setEngine] = useState<EngineType>(initial?.engine ?? "unknown");
  const [serviceIds, setServiceIds] = useState<string[]>(initial?.serviceIds ?? []);
  const [packageId, setPackageId] = useState<string | undefined>(initial?.packageId);
  const [tyreCount, setTyreCount] = useState<number>(initial?.tyreCount ?? 0);
  const [tyreSize, setTyreSize] = useState<string>(initial?.tyreSize ?? "");
  const [promoCode, setPromoCode] = useState<string>(initial?.promoCode ?? "");
  const [vehicleYear, setVehicleYear] = useState<string>(
    initial?.vehicleYear ? String(initial.vehicleYear) : "",
  );
  const [vehicleMake, setVehicleMake] = useState<string>(initial?.vehicleMake ?? "");
  const [vehicleModel, setVehicleModel] = useState<string>(initial?.vehicleModel ?? "");

  const catalogueInput = useMemo<QuoteEstimateInput>(
    () => ({
      engine,
      serviceIds,
      ...(packageId ? { packageId } : {}),
      ...(tyreCount > 0 ? { tyreCount } : {}),
      ...(tyreSize.trim() !== "" ? { tyreSize } : {}),
      ...(promoCode.trim() !== "" ? { promoCode } : {}),
      ...(vehicleYear ? { vehicleYear: Number(vehicleYear) } : {}),
      ...(vehicleMake.trim() !== "" ? { vehicleMake } : {}),
      ...(vehicleModel.trim() !== "" ? { vehicleModel } : {}),
    }),
    [
      engine,
      serviceIds,
      packageId,
      tyreCount,
      tyreSize,
      promoCode,
      vehicleYear,
      vehicleMake,
      vehicleModel,
    ],
  );

  const quote = useQuote(catalogueInput, {
    catalogue: { services: services ?? [], packages: packages ?? [] },
    ...(source ? { source } : {}),
    ...(serverNowMs !== undefined ? { serverNowMs } : {}),
  });

  const online = useOnlineStatus();
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    events.quoteViewed(source);
  }, [source]);

  const toggle = useCallback((id: string) => {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }, []);

  return (
    <div className={cn("grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]", className)}>
      {/* ── Inputs ─────────────────────────────────────────────────────── */}
      <WidgetCard className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-bold text-foreground">
            What kind of engine does it have?
          </legend>
          <p className="text-xs text-muted-foreground">
            Not sure is fine. Choosing &ldquo;not sure&rdquo; widens the range instead of blocking
            you.
          </p>
          <div className="flex flex-wrap gap-2">
            {ENGINE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-card border px-3 py-2 text-sm font-semibold",
                  engine === opt.value
                    ? "border-brand-500 bg-brand-50 text-brand-900"
                    : "border-border-strong bg-surface text-foreground hover:bg-surface-muted",
                )}
              >
                <input
                  type="radio"
                  name={`${uid}-engine`}
                  value={opt.value}
                  checked={engine === opt.value}
                  onChange={() => setEngine(opt.value)}
                  className="size-4 accent-[var(--color-brand-500)]"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-bold text-foreground">Which services do you need?</legend>
          {(services ?? []).length === 0 ? (
            <Notice tone="warning" title="Our service list did not load">
              <p>
                That is our problem, not yours. Call the shop and we will price it for you while you
                are on the line — it takes a minute.
              </p>
            </Notice>
          ) : (
            <ul className="flex flex-col gap-2">
              {(services ?? []).map((service) => {
                const checked = serviceIds.includes(service.id);
                const band = priceBand(service);
                return (
                  <li key={service.id}>
                    <label
                      className={cn(
                        "flex min-h-11 cursor-pointer items-start gap-3 rounded-card border p-3",
                        checked
                          ? "border-brand-500 bg-brand-50"
                          : "border-border-strong bg-surface hover:bg-surface-muted",
                      )}
                    >
                      <input
                        type="checkbox"
                        name="quoteServices"
                        value={service.id}
                        checked={checked}
                        onChange={() => toggle(service.id)}
                        className="mt-1 size-5 shrink-0 accent-[var(--color-brand-500)]"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-bold text-foreground">{service.name}</span>
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {service.summary}
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="tabular font-bold text-foreground">
                            {service.pricing === "CALL_FOR_PRICE"
                              ? "Confirmed on inspection"
                              : formatPesoRange(band.min, band.max)}
                          </span>
                          {band.isVariable ? <Pill tone="warning">Varies</Pill> : null}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        {(packages ?? []).length > 0 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-bold text-foreground">Or take a package</legend>
            <ul className="flex flex-col gap-2">
              {(packages ?? []).map((pkg) => {
                const active = packageId === pkg.id;
                return (
                  <li key={pkg.id}>
                    <label
                      className={cn(
                        "flex min-h-11 cursor-pointer items-start gap-3 rounded-card border p-3",
                        active
                          ? "border-brand-500 bg-brand-50"
                          : "border-border-strong bg-surface hover:bg-surface-muted",
                      )}
                    >
                      <input
                        type="radio"
                        name={`${uid}-package`}
                        value={pkg.id}
                        checked={active}
                        onChange={() => setPackageId(active ? undefined : pkg.id)}
                        className="mt-1 size-5 shrink-0 accent-[var(--color-brand-500)]"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-bold text-foreground">{pkg.name}</span>
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {pkg.tagline}
                        </span>
                        {pkg.savingsPct ? (
                          <span className="text-xs font-bold text-pit-700">
                            {pkg.savingsPct}% off the PMS line
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {packageId ? (
              <button
                type="button"
                onClick={() => setPackageId(undefined)}
                className="self-start text-xs font-semibold text-brand-700 underline underline-offset-4"
              >
                Clear the package
              </button>
            ) : null}
          </fieldset>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-bold text-foreground">New tyres?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span id={`${uid}-tyres-label`} className="text-sm font-bold text-foreground">
                How many?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTyreCount((n) => Math.max(0, n - 1))}
                  disabled={tyreCount === 0}
                  aria-label="One fewer tyre"
                  className="grid size-11 shrink-0 place-items-center rounded-card border border-border-strong bg-surface text-lg font-bold hover:bg-surface-muted disabled:opacity-50"
                >
                  −
                </button>
                <output
                  aria-labelledby={`${uid}-tyres-label`}
                  className={cn(controlClass, "text-center tabular font-bold")}
                >
                  {tyreCount}
                </output>
                <button
                  type="button"
                  onClick={() => setTyreCount((n) => Math.min(8, n + 1))}
                  disabled={tyreCount >= 8}
                  aria-label="One more tyre"
                  className="grid size-11 shrink-0 place-items-center rounded-card border border-border-strong bg-surface text-lg font-bold hover:bg-surface-muted disabled:opacity-50"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-size`} className="text-sm font-bold text-foreground">
                Tyre size
              </label>
              <input
                id={`${uid}-size`}
                name="tyreSize"
                list={`${uid}-sizes`}
                value={tyreSize}
                onChange={(e) => setTyreSize(e.target.value)}
                className={controlClass}
                placeholder="e.g. 205/55 R16"
                autoComplete="off"
                aria-describedby={`${uid}-size-hint`}
              />
              <datalist id={`${uid}-sizes`}>
                {TYRE_SIZES.map((size) => (
                  <option key={size} value={size} />
                ))}
              </datalist>
              <p id={`${uid}-size-hint`} className="text-xs text-muted-foreground">
                It is printed on the sidewall. If you cannot find it, leave it blank — we will read
                it off the tyre.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-bold text-foreground">
            Your car
            <span className="ml-1 text-xs font-medium text-muted-foreground">
              (optional — it makes the range tighter)
            </span>
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField
              label="Year"
              name="vehicleYear"
              id={`${uid}-year`}
              inputMode="numeric"
              value={vehicleYear}
              onChange={(e) => setVehicleYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="2018"
            />
            <TextField
              label="Make"
              name="vehicleMake"
              id={`${uid}-make`}
              value={vehicleMake}
              onChange={(e) => setVehicleMake(e.target.value)}
              placeholder="Toyota"
            />
            <TextField
              label="Model"
              name="vehicleModel"
              id={`${uid}-model`}
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
              placeholder="Innova"
            />
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-promo`} className="text-sm font-bold text-foreground">
            Promo code
            <span className="ml-1 text-xs font-medium text-muted-foreground">(optional)</span>
          </label>
          <input
            id={`${uid}-promo`}
            name="promoCode"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase().slice(0, 24))}
            className={cn(controlClass, "uppercase")}
            placeholder="FIRSTPMS"
            aria-describedby={`${uid}-promo-hint`}
          />
          <p id={`${uid}-promo-hint`} className="text-xs leading-relaxed text-muted-foreground">
            We check every code against the shop&apos;s live list. An unknown code simply carries no
            discount — it never makes your price worse.
          </p>
        </div>
      </WidgetCard>

      {/* ── Result + capture ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <QuoteResult
          estimate={quote.estimate}
          input={catalogueInput}
          /* Only flagged as "on this device" once we actually know the API is
             unreachable — otherwise the estimate reads as a normal range and the
             disclaimer does the honest work. */
          isLocalEstimate={quote.isOffline}
          headingId={`${uid}-result`}
          reference={quote.reference}
        />

        {showCaptureForm && !quote.reference ? (
          <CaptureForm uid={uid} quote={quote} online={online.isOnline} />
        ) : null}

        {showCaptureForm && quote.reference ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            We have your request. If you change the services above, press{" "}
            <button
              type="button"
              onClick={quote.reset}
              className="font-semibold underline underline-offset-4"
            >
              send again
            </button>{" "}
            — we do not spam you.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── The capture form ────────────────────────────────────────────────────────

type QuoteHook = ReturnType<typeof useQuote>;

function CaptureForm({ uid, quote, online }: { uid: string; quote: QuoteHook; online: boolean }) {
  const r = quote.request;
  const submitting = quote.requestStatus === "submitting";

  return (
    <WidgetCard className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="eyg-eyebrow text-muted-foreground">Optional</p>
        <h3 className="text-h3 text-foreground">Text me this estimate</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          One text message with the range and a reference. Nothing else, no marketing list.
        </p>
      </div>

      {quote.requestStatus === "error" ? (
        <Notice
          tone={quote.isOffline ? "warning" : "danger"}
          title={quote.isOffline ? "We could not send that just now" : "We could not send your request"}
          actions={
            <>
              <Button
                variant="secondary"
                disabled={submitting}
                onClick={() => void quote.submitRequest()}
              >
                Try again
              </Button>
              <a
                href={LINKS.call}
                onClick={() => events.call("quote-capture-error")}
                className="inline-flex min-h-11 items-center gap-2 rounded-card border border-border-strong bg-surface px-3 py-2 text-sm font-bold text-foreground"
              >
                <Phone aria-hidden="true" className="size-4" focusable="false" />
                Call instead
              </a>
              <a
                href={LINKS.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => events.whatsapp("quote-capture-error")}
                className="inline-flex min-h-11 items-center gap-2 rounded-card border border-border-strong bg-surface px-3 py-2 text-sm font-bold text-foreground"
              >
                <MessageCircle aria-hidden="true" className="size-4" focusable="false" />
                WhatsApp
              </a>
            </>
          }
        >
          <p>{quote.requestError ?? "Something went wrong on our side. Nothing was stored."}</p>
          {quote.isOffline ? (
            <p className="mt-1 text-xs leading-relaxed">
              Your range above is still correct — it was worked out on your own device. For the
              exact price, a phone call is the fastest route.
            </p>
          ) : null}
        </Notice>
      ) : null}

      {!online ? (
        <Notice tone="warning" title="You are offline">
          <p>We cannot send the text until your connection is back. The range above still stands.</p>
        </Notice>
      ) : null}

      <form
        noValidate
        aria-busy={submitting}
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void quote.submitRequest().then((reference) => {
            if (reference) {
              events.quoteRequested(reference.reference, reference.estimateMin, reference.estimateMax);
            } else {
              events.quoteRequestFailed(quote.requestError ?? "invalid");
            }
          });
        }}
      >
        <TextField
          label="Your name"
          name="quoteName"
          id={`${uid}-name`}
          required
          autoComplete="name"
          value={r.name}
          error={quote.requestFieldErrors.name}
          onChange={(e) => quote.setRequest({ name: e.target.value })}
          placeholder="Juan Dela Cruz"
        />

        <TextField
          label="Mobile number"
          name="quotePhone"
          id={`${uid}-phone`}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          required
          value={r.phone}
          error={quote.requestFieldErrors.phone}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
            quote.setRequest({ phone: digits.length > 0 ? formatPhPhone(digits) : "" });
          }}
          placeholder="09XX XXX XXXX"
          hint="We text once. Reply STOP any time to stop."
        />

        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="quoteConsentSms"
            checked={r.consentSms}
            aria-invalid={quote.requestFieldErrors.consentSms ? true : undefined}
            aria-describedby={
              quote.requestFieldErrors.consentSms ? `${uid}-consent-error` : undefined
            }
            onChange={(e) => quote.setRequest({ consentSms: e.target.checked })}
            className="mt-1 size-5 shrink-0 accent-[var(--color-brand-500)]"
          />
          <span className="text-sm leading-relaxed text-foreground">
            Yes, EYG may text me this estimate once. I understand message rates may apply and I can
            reply STOP at any time.
          </span>
        </label>
        {quote.requestFieldErrors.consentSms ? (
          <p id={`${uid}-consent-error`} className="text-xs font-semibold text-racing-700">
            ⚠ {quote.requestFieldErrors.consentSms}
          </p>
        ) : null}

        {/* Honeypot. Untouched by humans, sent in the payload. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute h-px w-px opacity-0"
          value={r.website}
          readOnly
        />

        <Button type="submit" disabled={submitting || !online} aria-busy={submitting}>
          <Send aria-hidden="true" className="size-4" focusable="false" />
          {submitting ? "Sending…" : "Text me this estimate"}
        </Button>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Prefer to just talk to someone? Call {BUSINESS.phoneDisplay} — a person answers during
          opening hours.
        </p>
      </form>
    </WidgetCard>
  );
}

export { InstantQuote };