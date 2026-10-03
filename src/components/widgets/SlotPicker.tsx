"use client";

/**
 * SLOT PICKER — step 3 of the booking flow.
 * ============================================================================
 * FOUR STATES, ALL DESIGNED, NONE OF THEM A SPINNER
 *   loading  → slot skeletons + `aria-live="polite"` status text
 *   success  → the grid, with honest capacity, a "Recommended" badge on
 *              `isBest`, and `aria-disabled` + a written reason on full slots
 *   empty    → the shop is CLOSED that day, or there is genuinely nothing left.
 *              Offers the next open day, a call, and WhatsApp.
 *   error    → a written explanation, a retry, and the phone number.
 *
 * NO COLOUR-ONLY SIGNALS. A full slot is disabled AND says "Fully booked" in
 * text. A recommended slot carries the word "Recommended", not just a highlight.
 *
 * ACCESSIBILITY
 *  - The date strip is a horizontal list of real buttons with `aria-pressed`.
 *  - The grid is a `radiogroup`-style set of buttons with `aria-checked` on the
 *    chosen slot, reachable by Tab and activated by Enter or Space.
 *  - Result counts are announced once per load via `aria-live="polite"` — never
 *    once per skeleton.
 *  - A full slot uses `aria-disabled` (not `disabled`) on the *description*, so
 *    screen-reader users can still hear WHY it is unavailable. The button itself
 *    is `disabled` for pointer safety.
 * ============================================================================
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarOff, MessageCircle, Phone, RefreshCw, Sparkles } from "lucide-react";
import { BUSINESS, LINKS, TIMEZONE } from "@/config/site";
import { cn } from "@/lib/utils";
import type { SlotAvailabilityDto, SlotDto } from "@/lib/types";
import { useAvailability, capacityCopy, firstOpenDate } from "@/hooks/useAvailability";
import { useCountdown } from "@/hooks/useCountdown";
import { events } from "@/lib/hooks";
import { addDaysYmd, formatMinutes, toShopParts, weekdayShort, ymdWeekday } from "@/components/widgets/internal/time-ph";
import { Button, Notice, Pill, Skeleton, WidgetCard } from "@/components/widgets/internal/ui";

export interface SlotPickerProps {
  /** Selected `YYYY-MM-DD`. */
  date: string;
  onDateChange: (ymd: string) => void;
  /** Selected slot `startAt` (ISO with offset). */
  startAt: string;
  slotLabel: string;
  onSlotChange: (startAt: string, label: string) => void;
  /** Extra query for the availability endpoint. */
  serviceIds?: readonly string[];
  /** `Date.now()` from the server render — makes "today" match the SSR HTML. */
  serverNowMs?: number | undefined;
  /** Days shown in the strip. Default 14. */
  days?: number;
  errors?: Record<string, string | undefined>;
  headingId?: string;
  className?: string;
  bare?: boolean;
  /** Lets the wizard force a refresh after a 409 conflict. */
  registerRefresh?: (fn: (() => void) | null) => void;
}

/** The "today" reference date, correct in Manila either way. */
function referenceToday(serverNowMs: number | undefined): string {
  return toShopParts(serverNowMs ?? Date.now()).ymd;
}

export default function SlotPicker({
  date,
  onDateChange,
  startAt,
  slotLabel,
  onSlotChange,
  serviceIds = [],
  serverNowMs,
  days = 14,
  errors = {},
  headingId,
  className,
  bare = false,
  registerRefresh,
}: SlotPickerProps) {
  const today = useMemo(() => referenceToday(serverNowMs), [serverNowMs]);
  const [todayMs, setTodayMs] = useState<number>(() => serverNowMs ?? Date.now());

  // Keep "today" honest if the page is left open past midnight.
  useEffect(() => {
    const id = setInterval(() => setTodayMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { status, data, error, retryAfter, retry, version } = useAvailability(date, {
    serviceIds,
  });
  const rateLimit = useCountdown(retryAfter !== null ? Date.now() + retryAfter * 1000 : null);

  // The wizard registers a refresh callback so a 409 can reload the grid while
  // preserving every other input.
  const refreshRef = useRef(retry);
  refreshRef.current = retry;
  useEffect(() => {
    registerRefresh?.(() => refreshRef.current());
    return () => registerRefresh?.(null);
  }, [registerRefresh]);

  const dates = useMemo(() => {
    const anchor = toShopParts(todayMs).ymd;
    return Array.from({ length: days }, (_, i) => addDaysYmd(anchor, i));
  }, [days, todayMs]);

  // Select today automatically the first time, without fighting the customer.
  useEffect(() => {
    if (date === "" && dates.length > 0) onDateChange(dates[0] ?? today);
  }, [date, dates, today, onDateChange]);

  const nextOpen = useMemo(() => {
    if (!data || (data.isClosed && data.slots.length === 0)) {
      return firstOpenDate(date || today, 7, (dow) => dow === 0);
    }
    return null;
  }, [data, date, today]);

  const bookable = useMemo(() => (data?.slots ?? []).filter((s) => s.capacityLeft > 0), [data]);

  const body = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="eyg-eyebrow text-muted-foreground">Step 3 of 4</p>
        <h2 id={headingId} tabIndex={-1} className="text-h3 text-foreground outline-none">
          Pick a day and time
        </h2>
        <p className="text-sm text-muted-foreground">
          Times are Philippine time ({TIMEZONE}). If none of these work, call us — we often have a
          bay free later the same day.
        </p>
      </div>

      {/* ── Date strip ────────────────────────────────────────────────────── */}
      <div
        role="group"
        aria-label={`Choose a date. The next ${days} days are shown.`}
        className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {dates.map((ymd) => {
          const day = ymdWeekday(ymd) ?? 0;
          const dateNumber = Number(ymd.slice(8, 10));
          const active = ymd === date;
          const isToday = ymd === today;
          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onDateChange(ymd)}
              aria-pressed={active}
              aria-label={`${weekdayShort(day)} ${dateNumber} ${
                ymd.slice(0, 4)
              }${isToday ? ", today" : ""}`}
              className={cn(
                "flex min-h-11 w-16 shrink-0 flex-col items-center justify-center rounded-card border px-1 py-2 text-center",
                active
                  ? "border-brand-500 bg-brand-500 text-accent-foreground"
                  : "border-border-strong bg-surface text-foreground hover:bg-surface-muted",
              )}
            >
              <span aria-hidden="true" className="text-[0.625rem] font-bold uppercase tracking-widest opacity-80">
                {isToday ? "Today" : weekdayShort(day)}
              </span>
              <span aria-hidden="true" className="tabular text-lg font-extrabold leading-tight">
                {dateNumber}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Async status. One polite announcement per load. ───────────────── */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {status === "loading"
          ? "Loading available times."
          : status === "success"
            ? `${bookable.length} times available on ${date}.`
            : status === "empty"
              ? `No bookable times on ${date}.`
              : status === "error"
                ? "We could not load the times."
                : ""}
      </div>

      {errors.startAt ? (
        <p role="alert" className="text-sm font-semibold text-racing-700">
          ⚠ {errors.startAt}
        </p>
      ) : null}

      {/* ── LOADING ───────────────────────────────────────────────────────── */}
      {status === "loading" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-16 w-24" />
            ))}
          </div>
          <span className="sr-only" role="status">
            Loading available times.
          </span>
        </div>
      ) : null}

      {/* ── SUCCESS ───────────────────────────────────────────────────────── */}
      {status === "success" && data ? (
        <SlotGrid
          slots={data.slots}
          startAt={startAt}
          onSelect={(slot) => {
            onSlotChange(slot.startAt, slot.label || formatMinutes(toShopParts(slot.startAt).minutes));
            events.bookingSlot(date, slot.label, slot.isBest);
          }}
        />
      ) : null}

      {/* ── EMPTY: closed day, or nothing left ────────────────────────────── */}
      {status === "empty" ? (
        <div className="flex flex-col gap-3 rounded-card border border-border-strong bg-surface-muted p-4">
          <div className="flex items-start gap-3">
            <CalendarOff aria-hidden="true" className="size-6 shrink-0 text-muted-foreground" focusable="false" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-foreground">
                {data?.isClosed ? "We are closed on this day" : "No bays left on this day"}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {data?.closedReason ??
                  (data?.isClosed
                    ? "Our bay schedule is published a week ahead. Pick another date, or call and we will find you a time."
                    : "Every bay is taken. Here is the next day that is open — or call us, we sometimes fit people in.")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {nextOpen ? (
              <Button
                onClick={() => onDateChange(nextOpen)}
                variant="secondary"
              >
                Try {formatFriendlyDate(nextOpen, today)}
              </Button>
            ) : null}
            <a
              href={LINKS.call}
              onClick={() => events.call("slot-picker-empty")}
              className="inline-flex min-h-11 items-center gap-2 rounded-card border border-border-strong bg-surface px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-muted"
            >
              <Phone aria-hidden="true" className="size-4" focusable="false" />
              Call {BUSINESS.phoneDisplay}
            </a>
            <a
              href={LINKS.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => events.whatsapp("slot-picker-empty")}
              className="inline-flex min-h-11 items-center gap-2 rounded-card border border-border-strong bg-surface px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-muted"
            >
              <MessageCircle aria-hidden="true" className="size-4" focusable="false" />
              Message us on WhatsApp
            </a>
          </div>
        </div>
      ) : null}

      {/* ── ERROR ─────────────────────────────────────────────────────────── */}
      {status === "error" ? (
        <Notice
          tone="danger"
          title="We could not load the available times"
          actions={
            <>
              {retryAfter !== null && !rateLimit.isExpired ? (
                <Button variant="secondary" disabled>
                  Try again in {Math.ceil(rateLimit.remainingMs / 1000)}s
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={retry}
                >
                  <RefreshCw aria-hidden="true" className="size-4" focusable="false" />
                  Try again
                </Button>
              )}
              <a
                href={LINKS.call}
                onClick={() => events.call("slot-picker-error")}
                className="inline-flex min-h-11 items-center gap-2 rounded-card border border-racing-400 bg-racing-50 px-4 py-2 text-sm font-bold text-racing-900"
              >
                <Phone aria-hidden="true" className="size-4" focusable="false" />
                Call {BUSINESS.phoneDisplay}
              </a>
            </>
          }
        >
          <p>
            {error ??
              "The schedule system is not answering. Everything else still works — pick a service and call us, we will book you by hand."}
          </p>
          <p className="mt-2 text-xs">
            {version > 0 ? "" : "This is our problem, not yours. Sorry about the wait."}
          </p>
        </Notice>
      ) : null}

      {/* ── Chosen slot, restated so it is never a surprise ───────────────── */}
      {startAt ? (
        <p className="rounded-card border border-pit-300 bg-pit-50 p-2.5 text-sm font-semibold text-pit-900">
          You picked <span className="font-extrabold">{slotLabel}</span> on{" "}
          <span className="font-extrabold">{formatFriendlyDate(date, today)}</span>.
        </p>
      ) : null}
    </div>
  );

  if (bare) return <div className={className}>{body}</div>;
  return <WidgetCard className={cn("flex flex-col", className)}>{body}</WidgetCard>;
}

// ── The grid ────────────────────────────────────────────────────────────────

function SlotGrid({
  slots,
  startAt,
  onSelect,
}: {
  slots: readonly SlotDto[];
  startAt: string;
  onSelect: (slot: SlotDto) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Available times"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
    >
      {slots.map((slot) => {
        const full = slot.capacityLeft <= 0;
        const selected = startAt === slot.startAt;
        return (
          <div key={slot.startAt} className="flex flex-col gap-1">
            {!full && slot.isBest ? (
              <Pill tone="brand" className="self-start px-1.5 py-0 text-[0.5625rem] uppercase tracking-widest">
                <Sparkles aria-hidden="true" className="size-2.5" focusable="false" />
                Recommended
              </Pill>
            ) : (
              <span aria-hidden="true" className="h-0" />
            )}
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={full}
              onClick={() => onSelect(slot)}
              className={cn(
                "relative flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-card border px-2 py-2 text-center",
                full
                  ? "cursor-not-allowed border-border bg-surface-muted text-muted-foreground"
                  : selected
                    ? "border-brand-500 bg-brand-500 text-accent-foreground"
                    : "border-border-strong bg-surface text-foreground hover:bg-surface-muted",
              )}
            >
              <span className="tabular text-base font-extrabold">{slot.label}</span>
              {/* Capacity is text, never a colour alone. */}
              <span
                className={cn(
                  "text-[0.6875rem] font-semibold",
                  selected ? "text-accent-foreground" : "text-muted-foreground",
                )}
                aria-disabled={full || undefined}
              >
                {capacityCopy(slot.capacityLeft)}
              </span>
            </button>
            {/* The accessible label, kept out of the button so a full slot can
                still be *explained* rather than silently disabled. */}
            <span className="sr-only">
              {slot.label}:{" "}
              {full
                ? "fully booked, choose another time or call the shop"
                : `${capacityCopy(slot.capacityLeft)}${slot.isBest ? ". Recommended slot" : ""}`}
            </span>
          </div>
        );
      })}

      {slots.length === 0 ? (
        <Notice tone="warning" title="No times published for this day">
          <p>Call the shop and we will find you a bay.</p>
        </Notice>
      ) : null}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function formatFriendlyDate(ymd: string, todayYmdValue: string): string {
  if (ymd === todayYmdValue) return "today";
  if (ymd === addDaysYmd(todayYmdValue, 1)) return "tomorrow";
  const day = ymdWeekday(ymd) ?? 0;
  return `${weekdayShort(day)} ${Number(ymd.slice(8, 10))}`;
}

export { SlotPicker };
export type { SlotAvailabilityDto };