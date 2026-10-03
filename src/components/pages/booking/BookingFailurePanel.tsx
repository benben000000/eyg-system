/**
 * EYG — BOOKING FAILURE STATES
 * ============================================================================
 * One designed component per failure mode. Never a raw JSON dump, never a
 * spinner that stops with no explanation.
 *
 *   conflict     (409) — the slot was taken; explain, keep the draft, offer the
 *                          next free slot and a refresh
 *   rate-limited (429) — a REAL countdown driven by `meta.retryAfter`
 *   validation   (400) — field-level messages, mapped onto the right inputs
 *   server       (5xx) — say it was our fault and nothing was saved
 *   offline      (---) — the customer may be standing next to a broken car
 *   unknown      (---) — honest "we do not know why"
 * ============================================================================
 */

"use client";

import { cn } from "@/lib/utils";
import { Alert } from "@/components/pages/_shims";
import { Spinner } from "@/components/ui/Spinner";
import { BUSINESS } from "@/config/site";
import { Phone, RefreshCw, TriangleAlert } from "@/components/pages/_icons";
import { DirectContactLane } from "@/components/pages/booking/ContactStep";
import type { BookingFailure, BookingStepId } from "@/components/pages/booking/types";

const TONE_BY_KIND = {
  conflict: "warning",
  "rate-limited": "warning",
  validation: "danger",
  server: "danger",
  offline: "warning",
  unknown: "danger",
} as const;

export interface BookingFailurePanelProps {
  failure: BookingFailure;
  /** Live seconds remaining for `rate-limited`; `null` for every other kind. */
  retryAfterSeconds: number | null;
  onRetry: () => void;
  /** True while the retry itself is in flight. */
  retrying: boolean;
  /** Wired for `conflict` — pulls a fresh slot list without losing the draft. */
  onRefreshSlots?: (() => void) | undefined;
  onGoToStep?: ((step: BookingStepId) => void) | undefined;
  className?: string;
}

export function BookingFailurePanel({
  failure,
  retryAfterSeconds,
  onRetry,
  retrying,
  onRefreshSlots,
  onGoToStep,
  className,
}: BookingFailurePanelProps): React.ReactElement {
  const tone = TONE_BY_KIND[failure.kind];
  const countdownRunning = failure.kind === "rate-limited" && (retryAfterSeconds ?? 0) > 0;

  return (
    <div
      // `role="alert"` on a failure: it interrupts, which is correct here — the
      // customer just pressed a button and nothing happened.
      role="alert"
      aria-live="assertive"
      className={cn("space-y-4", className)}
    >
      <Alert tone={tone} title={failure.title} icon={<TriangleAlert className="size-5" />}>
        <p className="leading-relaxed">{failure.message}</p>

        {Object.keys(failure.fields).length > 0 ? (
          <ul className="mt-2 space-y-1">
            {Object.entries(failure.fields).map(([field, messages]) => (
              <li key={field} className="text-sm">
                <span className="font-bold">{FIELD_LABELS[field] ?? field}</span>:{" "}
                {messages.join(" ")}
              </li>
            ))}
          </ul>
        ) : null}

        {countdownRunning ? (
          <p className="tabular mt-3 flex items-center gap-2 font-bold">
            <Spinner size="sm" />
            You can try again in {formatCountdown(retryAfterSeconds ?? 0)}
          </p>
        ) : null}

        {failure.requestId ? (
          <p className="mt-2 text-xs opacity-80">
            Reference for whoever you speak to:{" "}
            <span className="tabular font-bold">{failure.requestId}</span>
          </p>
        ) : null}
      </Alert>

      <div className="flex flex-wrap gap-3">
        {failure.kind === "rate-limited" ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={countdownRunning || retrying}
            aria-busy={retrying || undefined}
            className="inline-flex min-h-12 items-center gap-2 rounded-eyebrow bg-accent px-5 font-display text-sm font-extrabold uppercase tracking-wide text-accent-foreground disabled:pointer-events-none disabled:opacity-55"
          >
            {retrying ? <Spinner size="sm" /> : <RefreshCw aria-hidden="true" className="size-4" />}
            {countdownRunning ? "Paused" : "Try again now"}
          </button>
        ) : null}

        {failure.kind === "conflict" && onRefreshSlots ? (
          <button
            type="button"
            onClick={onRefreshSlots}
            disabled={retrying}
            aria-busy={retrying || undefined}
            className="inline-flex min-h-12 items-center gap-2 rounded-eyebrow bg-accent px-5 font-display text-sm font-extrabold uppercase tracking-wide text-accent-foreground disabled:pointer-events-none disabled:opacity-55"
          >
            {retrying ? <Spinner size="sm" /> : <RefreshCw aria-hidden="true" className="size-4" />}
            Show me the free times
          </button>
        ) : null}

        {failure.kind === "validation" && onGoToStep ? (
          <button
            type="button"
            onClick={() => onGoToStep("contact")}
            className="inline-flex min-h-12 items-center gap-2 rounded-eyebrow bg-accent px-5 font-display text-sm font-extrabold uppercase tracking-wide text-accent-foreground"
          >
            Go back and fix it
          </button>
        ) : null}

        {(failure.kind === "server" || failure.kind === "offline" || failure.kind === "unknown") ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            aria-busy={retrying || undefined}
            className="inline-flex min-h-12 items-center gap-2 rounded-eyebrow bg-accent px-5 font-display text-sm font-extrabold uppercase tracking-wide text-accent-foreground disabled:pointer-events-none disabled:opacity-55"
          >
            {retrying ? <Spinner size="sm" /> : <RefreshCw aria-hidden="true" className="size-4" />}
            Try the booking again
          </button>
        ) : null}
      </div>

      <div className="space-y-2 rounded-card border border-border bg-surface-muted p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          {failure.kind === "offline" ? (
            <TriangleAlert aria-hidden="true" className="size-4" />
          ) : (
            <Phone aria-hidden="true" className="size-4" />
          )}
          Or skip all of this and call us
        </p>
        <p className="text-sm text-muted-foreground">
          Booking over the phone takes a minute and gets you the same bay.
          {BUSINESS.address.district ? ` We are on ${BUSINESS.address.street}.` : ""}
        </p>
        <DirectContactLane />
      </div>
    </div>
  );
}

/** Server field names → the words a customer would recognise. */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  name: "Your name",
  phone: "Mobile number",
  email: "Email address",
  startAt: "Date and time",
  serviceIds: "Services selected",
  packageId: "Package",
  promoCode: "Offer code",
  vehicle: "Vehicle details",
  consentSms: "Permission to text you",
  "vehicle.year": "Vehicle year",
  "vehicle.make": "Vehicle make",
  "vehicle.model": "Vehicle model",
  "vehicle.plate": "Plate number",
};

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m} min ${rest} s`;
}
