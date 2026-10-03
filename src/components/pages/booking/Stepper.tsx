/**
 * EYG — BOOKING STEPPER
 * ============================================================================
 * Four steps, always visible on desktop; a compact "step 2 of 4" bar with
 * previous/next affordances on mobile.
 *
 * Completed steps are real buttons that jump back, and carry `aria-current="step"`
 * on the active one. Steps the customer has not unlocked yet are rendered as
 * non-interactive text rather than disabled buttons — a disabled button is
 * invisible to some screen readers and gives no explanation.
 * ============================================================================
 */

import { cn } from "@/lib/utils";
import { Check } from "@/components/pages/_icons";
import { BOOKING_STEPS, type BookingStepId } from "@/components/pages/booking/types";

export interface StepperProps {
  current: BookingStepId;
  /** Highest step the customer is allowed to jump to. */
  reachable: BookingStepId;
  onGo: (step: BookingStepId) => void;
}

export function Stepper({ current, reachable, onGo }: StepperProps): React.ReactElement {
  const currentIndex = BOOKING_STEPS.findIndex((s) => s.id === current);
  const reachableIndex = BOOKING_STEPS.findIndex((s) => s.id === reachable);
  const meta = BOOKING_STEPS[currentIndex] ?? BOOKING_STEPS[0]!;

  return (
    <div className="space-y-4">
      {/* Mobile: a labelled progress bar. */}
      <div className="lg:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-sm font-extrabold uppercase tracking-wide">
            Step {meta.index} of 4 — {meta.label}
          </p>
          <p className="tabular text-xs text-muted-foreground">{Math.round((meta.index / 4) * 100)}%</p>
        </div>
        <ol className="mt-2 flex gap-1.5" aria-hidden="true">
          {BOOKING_STEPS.map((s) => (
            <li
              key={s.id}
              className={cn(
                "h-1.5 flex-1 rounded-pill",
                s.index < meta.index
                  ? "bg-brand-500"
                  : s.index === meta.index
                    ? "bg-brand-500"
                    : "bg-border-strong",
              )}
            />
          ))}
        </ol>
      </div>

      <nav aria-label="Booking steps">
        <ol className="hidden gap-2 lg:grid lg:grid-cols-4">
          {BOOKING_STEPS.map((step) => {
            const isCurrent = step.id === current;
            const isDone = step.index < meta.index;
            const canGo = !isCurrent && step.index <= reachableIndex;
            return (
              <li key={step.id}>
                {canGo ? (
                  <button
                    type="button"
                    onClick={() => onGo(step.id)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-card border-2 border-border-strong bg-surface px-3 text-left transition-colors hover:border-brand-500"
                  >
                    <StepDot index={step.index} done={isDone} active={isCurrent} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{step.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {isDone ? "Done — tap to change" : step.short}
                      </span>
                    </span>
                  </button>
                ) : (
                  <div
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-card border-2 px-3",
                      isCurrent
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/25"
                        : "border-dashed border-border bg-surface-muted",
                    )}
                  >
                    <StepDot index={step.index} done={isDone} active={isCurrent} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{step.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {isCurrent ? "You are here" : "Locked until earlier steps are done"}
                      </span>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <p className="text-sm text-muted-foreground">{meta.purpose}</p>
    </div>
  );
}

function StepDot({
  index,
  done,
  active,
}: {
  index: number;
  done: boolean;
  active: boolean;
}): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "tabular flex size-8 shrink-0 items-center justify-center rounded-pill border-2 font-display text-sm font-extrabold",
        active
          ? "border-brand-500 bg-brand-500 text-ink-950"
          : done
            ? "border-pit-600 bg-pit-500 text-ink-950"
            : "border-border-strong bg-surface-muted text-muted-foreground",
      )}
    >
      {done ? <Check className="size-4" /> : index}
    </span>
  );
}

/** Mobile back/next pair. The stepper above cannot carry 44px targets on mobile. */
export function StepNav({
  onBack,
  onNext,
  backLabel = "Back",
  nextLabel = "Continue",
  canGoBack,
  canGoNext,
  nextBusy = false,
}: {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  canGoBack: boolean;
  canGoNext: boolean;
  nextBusy?: boolean;
}): React.ReactElement {
  if (!onBack && !onNext) return <></>;
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          className="inline-flex min-h-12 items-center gap-2 rounded-eyebrow border-2 border-border-strong bg-surface px-5 font-display text-sm font-extrabold uppercase tracking-wide transition-colors hover:border-brand-500 disabled:pointer-events-none disabled:opacity-50"
        >
          {backLabel}
        </button>
      ) : null}
      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          aria-busy={nextBusy || undefined}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-eyebrow bg-accent px-6 font-display text-sm font-extrabold uppercase tracking-wide text-accent-foreground shadow-cta transition-transform active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-55 sm:flex-none"
        >
          {nextLabel}
        </button>
      ) : null}
    </div>
  );
}
