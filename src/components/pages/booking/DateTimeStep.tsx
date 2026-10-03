/**
 * EYG — BOOKING STEP 3: DATE & TIME
 * ============================================================================
 * A 14-day strip, then the live slot grid from
 * `GET /api/availability?date=YYYY-MM-DD`.
 *
 * EVERY BRANCH IS DESIGNED
 *   • closed day                → an explicit "we are closed" panel, not a void
 *   • loading                   → skeletons at the exact slot-grid shape
 *   • zero slots available      → alternatives: next open day, call, WhatsApp
 *   • some slots                → capacity left, one `isBest` marked Recommended,
 *                                 full slots disabled but still visible (a
 *                                 disappeared slot reads as a bug)
 *   • API down / offline        → the call lane, with the rest of the wizard intact
 *   • slot taken mid-submit     → the parent re-fetches and this step explains
 *
 * The slot region is `aria-live="polite"` so a screen-reader user hears the new
 * slots without losing their place.
 * ============================================================================
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { SlotAvailabilityDto, SlotDto } from "@/lib/types";
import { BUSINESS, LINKS,  BUSINESS_HOURS } from "@/config/site";
import { Alert, ButtonLink } from "@/components/pages/_shims";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Calendar,
  Check,
  Clock,
  Phone,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from "@/components/pages/_icons";
import { formatDateLabel } from "@/components/pages/booking/OrderSummary";
import { PRIMARY_PHONE_UNCONFIRMED } from "@/components/pages/_shared";

export interface DateStripDayView {
  isoDate: string;
  weekdayLabel: string;
  dayOfMonth: number;
  monthLabel: string;
  fullLabel: string;
  closed: boolean;
  isToday: boolean;
}

export type AvailabilityPhase = "idle" | "loading" | "ready" | "error" | "offline";

export interface DateTimeStepProps {
  strip: readonly DateStripDayView[];
  selectedDate: string | null;
  onSelectDate: (isoDate: string) => void;
  phase: AvailabilityPhase;
  availability: SlotAvailabilityDto | null;
  /** Present when `phase === "error"`. */
  errorTitle: string | null;
  errorMessage: string | null;
  onRetry: () => void;
  selectedStartAt: string | null;
  onSelectSlot: (slot: SlotDto) => void;
  /** True immediately after a 409, so the grid can explain itself. */
  slotJustTaken: boolean;
  /** Next open day offered when nothing is free today. */
  nextOpenDate: string | null;
  disabled: boolean;
}

export function DateTimeStep({
  strip,
  selectedDate,
  onSelectDate,
  phase,
  availability,
  errorTitle,
  errorMessage,
  onRetry,
  selectedStartAt,
  onSelectSlot,
  slotJustTaken,
  nextOpenDate,
  disabled,
}: DateTimeStepProps): React.ReactElement {
  return (
    <fieldset disabled={disabled} className="space-y-6">
      <legend className="sr-only">Date and time</legend>

      {/* ── 14-day strip ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-h3">Pick a day</h3>
        <ul
          className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
          aria-label="Next 14 days"
        >
          {strip.map((day) => {
            const selected = day.isoDate === selectedDate;
            return (
              <li key={day.isoDate} className="snap-start">
                <button
                  type="button"
                  onClick={() => onSelectDate(day.isoDate)}
                  disabled={day.closed}
                  aria-pressed={selected}
                  aria-label={
                    day.closed
                      ? `${day.fullLabel} — closed`
                      : `${day.fullLabel}${day.isToday ? " — today" : ""}`
                  }
                  className={cn(
                    "flex min-h-20 w-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-card border-2 px-2 py-2 transition-colors",
                    selected
                      ? "border-brand-500 bg-brand-500 text-ink-950"
                      : day.closed
                        ? "cursor-not-allowed border-dashed border-border-strong bg-surface-muted text-muted-foreground"
                        : "border-border-strong bg-surface hover:border-brand-500",
                  )}
                >
                  <span className="eyg-eyebrow text-[0.625rem]">
                    {day.closed ? "Closed" : day.weekdayLabel}
                  </span>
                  <span className="tabular font-display text-xl font-extrabold leading-none">
                    {day.dayOfMonth}
                  </span>
                  <span className="text-[0.625rem] font-bold uppercase tracking-wide opacity-80">
                    {day.monthLabel}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted-foreground">
          {(() => {
            const openDays = strip.filter((d) => !d.closed).length;
            return `${openDays} of the next ${strip.length} days are open. Sunday is our rest day — we do not take bookings then.`;
          })()}
        </p>
      </div>

      {/* ── Slot grid ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-h3">
            {selectedDate ? `Times on ${formatDateLabel(selectedDate)}` : "Times"}
          </h3>
          {selectedDate && phase === "ready" && availability && !availability.isClosed ? (
            <p className="text-sm text-muted-foreground">
              {availability.totalCapacity} {availability.totalCapacity === 1 ? "bay" : "bays"} that day
            </p>
          ) : null}
        </div>

        {/* Live region: announced, never focused, never a wall of text. */}
        <div
          aria-live="polite"
          aria-busy={phase === "loading" || undefined}
          className="min-h-[9rem]"
        >
          {!selectedDate ? (
            <ChooseADay />
          ) : phase === "idle" || phase === "loading" ? (
            <SlotGridSkeleton />
          ) : phase === "offline" ? (
            <Alert tone="warning" title="You appear to be offline" icon={<TriangleAlert className="size-5" />}>
              The slot list needs a connection. Reconnect and it will load — or call the
              shop and we will note a time down for you.
            </Alert>
          ) : phase === "error" ? (
            <Alert tone="danger" title={errorTitle ?? "Slots unavailable"} icon={<TriangleAlert className="size-5" />}>
              <p>{errorMessage}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex min-h-11 items-center gap-2 rounded-eyebrow border-2 border-current px-4 font-display text-xs font-extrabold uppercase tracking-wide"
                >
                  <RefreshCw aria-hidden="true" className="size-4" />
                  Try again
                </button>
                <ContactLane />
              </div>
            </Alert>
          ) : availability && availability.isClosed ? (
            <ClosedDay reason={availability.closedReason} nextOpenDate={nextOpenDate} onSelectDate={onSelectDate} />
          ) : availability && availability.slots.length === 0 ? (
            <NoSlots
              date={selectedDate}
              nextOpenDate={nextOpenDate}
              onSelectDate={onSelectDate}
            />
          ) : availability ? (
            <div className="space-y-4">
              {slotJustTaken ? (
                <Alert tone="warning" title="That slot was taken a moment ago" icon={<Clock className="size-5" />} live>
                  We have refreshed the list. Your vehicle, services and details are all
                  still here — just pick another time below.
                </Alert>
              ) : null}
              <SlotGrid
                slots={availability.slots}
                selectedStartAt={selectedStartAt}
                onSelectSlot={onSelectSlot}
              />
            </div>
          ) : null}
        </div>
      </div>
    </fieldset>
  );
}

function ChooseADay(): React.ReactElement {
  return (
    <p className="rounded-card border-2 border-dashed border-border-strong bg-surface-muted p-6 text-sm text-muted-foreground">
      Tap a day above and we will show the bays that are still free.
    </p>
  );
}

function ClosedDay({
  reason,
  nextOpenDate,
  onSelectDate,
}: {
  reason: string | null | undefined;
  nextOpenDate: string | null;
  onSelectDate: (d: string) => void;
}): React.ReactElement {
  return (
    <div className="space-y-4 rounded-panel border-2 border-brand-500 bg-brand-50 p-6 dark:bg-brand-900/25">
      <p className="flex items-center gap-2 font-display text-base font-extrabold uppercase tracking-wide">
        <Calendar aria-hidden="true" className="size-5 text-brand-500" />
        We are closed that day
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {reason ??
          "The shop does not take bookings on that day. We use it for servicing and rest."}
      </p>
      <p className="text-sm text-muted-foreground">
        Our usual hours are {BUSINESS_HOURS.filter((d) => !d.closed)
          .map((d) => d.label.slice(0, 3))
          .join(", ")}, 8:00 AM to 5:00 PM.
      </p>
      <div className="flex flex-wrap gap-2">
        {nextOpenDate ? (
          <button
            type="button"
            onClick={() => onSelectDate(nextOpenDate)}
            className="inline-flex min-h-12 items-center gap-2 rounded-eyebrow bg-accent px-5 font-display text-sm font-extrabold uppercase tracking-wide text-accent-foreground"
          >
            Try {formatDateLabel(nextOpenDate)}
          </button>
        ) : null}
        <ContactLane />
      </div>
    </div>
  );
}

function NoSlots({
  date,
  nextOpenDate,
  onSelectDate,
}: {
  date: string;
  nextOpenDate: string | null;
  onSelectDate: (d: string) => void;
}): React.ReactElement {
  return (
    <div className="space-y-4 rounded-panel border border-border bg-surface p-6">
      <p className="flex items-center gap-2 font-display text-base font-extrabold uppercase tracking-wide">
        <Clock aria-hidden="true" className="size-5 text-brand-500" />
        Every bay on {formatDateLabel(date)} is taken
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        We keep a small number of bays so we are not overbooking, and that day filled
        up. Here is what you can do instead — none of it needs you to start again.
      </p>
      <ul className="space-y-3">
        {nextOpenDate ? (
          <li>
            <button
              type="button"
              onClick={() => onSelectDate(nextOpenDate)}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-eyebrow bg-accent px-5 font-display text-sm font-extrabold uppercase tracking-wide text-accent-foreground"
            >
              <Calendar aria-hidden="true" className="size-4" />
              Move to {formatDateLabel(nextOpenDate)}
            </button>
          </li>
        ) : null}
        <li className="flex flex-wrap gap-2">
          <ContactLane />
          <ButtonLink href="/book?step=services" variant="secondary" size="md">
            Change the services instead
          </ButtonLink>
        </li>
      </ul>
    </div>
  );
}

/** Call + WhatsApp, or an honest "number being confirmed" note. */
function ContactLane(): React.ReactElement {
  if (PRIMARY_PHONE_UNCONFIRMED) {
    return (
      <p className="flex items-center gap-2 rounded-card border-2 border-dashed border-border-strong bg-surface-muted px-4 py-3 text-sm font-bold">
        <TriangleAlert aria-hidden="true" className="size-4 text-brand-500" />
        Phone number being confirmed — use Messenger or WhatsApp for now
      </p>
    );
  }
  return (
    <>
      <ButtonLink href={LINKS.call} variant="primary" size="md">
        <Phone aria-hidden="true" className="size-4" />
        Call {BUSINESS.phoneDisplay}
      </ButtonLink>
      <ButtonLink href={LINKS.whatsapp} variant="secondary" size="md">
        WhatsApp us
      </ButtonLink>
    </>
  );
}

function SlotGrid({
  slots,
  selectedStartAt,
  onSelectSlot,
}: {
  slots: readonly SlotDto[];
  selectedStartAt: string | null;
  onSelectSlot: (slot: SlotDto) => void;
}): React.ReactElement {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {slots.map((slot) => {
        const full = slot.capacityLeft <= 0;
        const selected = selectedStartAt === slot.startAt;
        return (
          <li key={slot.startAt}>
            <button
              type="button"
              disabled={full}
              onClick={() => onSelectSlot(slot)}
              aria-pressed={selected}
              aria-label={
                full
                  ? `${slot.label} — fully booked`
                  : `${slot.label}${slot.isBest ? " — recommended" : ""} — ${slot.capacityLeft} of ${slot.capacityLeft === 1 ? "1 bay" : "bays"} left`
              }
              className={cn(
                "relative flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-card border-2 px-2 py-2 transition-colors",
                full
                  ? "cursor-not-allowed border-dashed border-border-strong bg-surface-muted text-muted-foreground line-through"
                  : selected
                    ? "border-brand-500 bg-brand-500 text-ink-950"
                    : "border-border-strong bg-surface hover:border-brand-500",
              )}
            >
              <span className="tabular font-display text-lg font-extrabold leading-none">
                {slot.label}
              </span>
              {full ? (
                <span className="text-[0.625rem] font-extrabold uppercase tracking-widest">
                  Fully booked
                </span>
              ) : (
                <span
                  className={cn(
                    "text-[0.625rem] font-extrabold uppercase tracking-widest",
                    selected ? "text-ink-950" : slot.capacityLeft === 1 ? "text-racing-600" : "text-muted-foreground",
                  )}
                >
                  {slot.capacityLeft === 1 ? "Last bay" : `${slot.capacityLeft} left`}
                </span>
              )}
              {slot.isBest && !full ? (
                <span
                  className={cn(
                    "absolute -top-2 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-pill border-2 px-2 py-0.5 text-[0.5625rem] font-extrabold uppercase tracking-widest",
                    selected
                      ? "border-ink-950 bg-ink-950 text-brand-500"
                      : "border-pit-600 bg-pit-500 text-ink-950",
                  )}
                >
                  <Sparkles aria-hidden="true" className="size-2.5" />
                  Recommended
                </span>
              ) : null}
              {selected ? (
                <Check aria-hidden="true" className="absolute right-1.5 top-1.5 size-3.5" />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SlotGridSkeleton(): React.ReactElement {
  return (
    <div aria-hidden="true">
      <Skeleton shape="text" className="mb-3 h-4 w-48" />
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i}>
            <Skeleton shape="block" className="h-20" />
          </li>
        ))}
      </ul>
      <p className="sr-only">Loading available times…</p>
    </div>
  );
}

/** Step-3 validation. */
export function validateDateTimeStep(date: string | null, startAt: string | null): string | null {
  if (!date) return "Choose a day first.";
  if (!startAt) return "Choose a time slot for that day.";
  return null;
}
