"use client";

/**
 * PROMO COUNTDOWN — honest urgency, or nothing.
 * ============================================================================
 * THE ONLY RULES THAT MATTER
 *  - A countdown renders ONLY for a promotion with a genuine future `endsAt`.
 *    No `endsAt`, an unparseable `endsAt`, or an `endsAt` already in the past →
 *    render `null` (or the `expired` variant if the caller asks for it).
 *  - It never resets on reload. The target is an absolute instant; the offset is
 *    captured from the server (`serverNowMs`) and advanced monotonically, so
 *    changing the device clock cannot extend the offer.
 *  - It never shows a negative timer. `useCountdown` clamps at zero and flips
 *    `isExpired`.
 *  - On expiry it calls `onExpire` once and re-renders the honest expired state.
 *  - It is not a dark pattern: there is no auto-resetting "deal", no invented
 *    scarcity, and no motion that survives `prefers-reduced-motion`.
 * ============================================================================
 */
import { useEffect, useRef } from "react";
import { Timer } from "lucide-react";
import { formatCountdown, speakCountdown, useCountdown } from "@/hooks/useCountdown";
import { events } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Notice, Pill, Skeleton } from "@/components/widgets/internal/ui";

export interface PromoCountdownProps {
  /** ISO 8601 with an explicit offset (`2026-11-30T23:59:00+08:00`). */
  endsAt: string | null | undefined;
  /** ISO start. A promo that has not started yet renders as "Coming back". */
  startsAt?: string | null | undefined;
  /** Used only for analytics. Never a customer name. */
  promoSlug?: string | undefined;
  /** Short label above the clock, e.g. "Rainy Season Bundle ends in". */
  label?: string | undefined;
  /** `Date.now()` from the server render, for a tamper-resistant offset. */
  serverNowMs?: number | undefined;
  /** Fires once, exactly, when the offer ends. */
  onExpire?: (() => void) | undefined;
  /** Copy for the expired state. Omit to render nothing instead. */
  expiredLabel?: string | undefined;
  /** Render the expired state at all. */
  showExpired?: boolean;
  className?: string;
  variant?: "inline" | "panel";
}

/** Absolute-instant parse that understands the `+08:00` offset the API sends. */
function parseEndsAt(value: string | null | undefined): number | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export default function PromoCountdown({
  endsAt,
  startsAt,
  promoSlug,
  label = "Offer ends in",
  serverNowMs,
  onExpire,
  expiredLabel,
  showExpired = false,
  className,
  variant = "panel",
}: PromoCountdownProps) {
  const endsAtMs = parseEndsAt(endsAt);
  const startsAtMs = parseEndsAt(startsAt);
  const firedExpireRef = useRef(false);

  const countdown = useCountdown(endsAtMs, {
    serverNowMs,
    onExpire: () => {
      if (firedExpireRef.current) return;
      firedExpireRef.current = true;
      if (promoSlug) events.promoExpired(promoSlug);
      onExpire?.();
    },
  });

  // A new target re-arms the expiry edge.
  useEffect(() => {
    firedExpireRef.current = false;
  }, [endsAtMs]);

  const notStarted =
    startsAtMs !== null && Number.isFinite(serverNowMs ?? Date.now())
      ? startsAtMs > (serverNowMs ?? Date.now())
      : false;

  // ── Nothing to count. Render nothing (or the honest expired copy). ────────
  if (endsAtMs === null) return null;

  if (countdown.isExpired && countdown.isRunning) {
    if (!showExpired || !expiredLabel) return null;
    return (
      <div className={className}>
        <Notice tone="warning" title={expiredLabel}>
          <p>
            This offer has finished.{" "}
            <a className="font-semibold underline underline-offset-4" href="/deals">
              See what is running now
            </a>
            .
          </p>
        </Notice>
      </div>
    );
  }

  if (countdown.isExpired) {
    // Server render / first paint: the target is already in the past. Either
    // show the expired copy, or show nothing. Never a frozen zero.
    if (!showExpired || !expiredLabel) return null;
    return (
      <div className={className}>
        <Notice tone="warning" title={expiredLabel}>
          <p>This offer has finished. Ask us about what is running now.</p>
        </Notice>
      </div>
    );
  }

  if (notStarted) {
    return (
      <div className={className}>
        <Pill tone="brand">Coming back soon</Pill>
      </div>
    );
  }

  const spoken = speakCountdown(countdown);

  return (
    <div
      className={cn(
        variant === "panel" && "flex flex-col gap-1.5 rounded-card border border-brand-300 bg-brand-50 p-3",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-800">
        <Timer aria-hidden="true" className="size-3.5" focusable="false" />
        <span>{label}</span>
      </p>

      {/* `aria-live="off"`: a ticking clock announced every second would be
          hostile to a screen-reader user. It is announced once, politely, when
          the offer changes state — see the live region below. */}
      <p
        aria-live="off"
        className="tabular font-display text-2xl font-extrabold tracking-tight text-brand-900"
      >
        {countdown.isRunning ? (
          <span title={spoken} aria-label={spoken}>
            {formatCountdown(countdown)}
          </span>
        ) : (
          <Skeleton className="h-8 w-36" />
        )}
      </p>

      {/* One polite announcement, not sixty per minute. */}
      <p aria-live="polite" className="sr-only">
        {countdown.isRunning && countdown.days === 0 && countdown.hours === 0 && countdown.minutes <= 10
          ? "Less than ten minutes left on this offer."
          : ""}
      </p>
    </div>
  );
}

export { PromoCountdown };