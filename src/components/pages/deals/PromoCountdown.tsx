/**
 * EYG — PROMO COUNTDOWN
 * ============================================================================
 * A countdown is only rendered for a promotion with a genuine, published
 * `endsAt` in the future. It anchors to that **absolute instant**, not to
 * "however long the page has been open", so reloading never restarts it and two
 * visitors never see different answers.
 *
 * There is deliberately no "3 people are viewing this" and no "offer ending in
 * 00:47" that was invented to create pressure. If the date has passed, the
 * component says the offer has ended and shows the date.
 * ============================================================================
 */

"use client";

import * as React from "react";
import { Clock, Sparkles } from "@/components/pages/_icons";

export interface PromoCountdownProps {
  /** ISO 8601 with an explicit +08:00 offset, from `PromotionSeed.endsAt`. */
  endsAt: string;
  /** Rendered once the date has passed. */
  onEndedLabel?: string;
  className?: string;
}

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

/** The published end date, in the shop's own timezone so it never shifts. */
function formatEndDate(endsAt: string): string {
  const d = new Date(endsAt);
  if (Number.isNaN(d.getTime())) return "on the published date";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function remainingUntil(endsAt: string): Remaining | null {
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return null;
  const totalMs = end - Date.now();
  if (totalMs <= 0) return null;
  return {
    totalMs,
    days: Math.floor(totalMs / 86_400_000),
    hours: Math.floor((totalMs % 86_400_000) / 3_600_000),
    minutes: Math.floor((totalMs % 3_600_000) / 60_000),
    seconds: Math.floor((totalMs % 60_000) / 1000),
  };
}

export function PromoCountdown({
  endsAt,
  onEndedLabel,
  className,
}: PromoCountdownProps): React.ReactElement {
  // `null` means "not measured yet" during SSR. Nothing is claimed on the
  // server, so the first paint cannot show a wrong number.
  const [remaining, setRemaining] = React.useState<Remaining | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setRemaining(remainingUntil(endsAt));
    setReady(true);
    const id = window.setInterval(() => setRemaining(remainingUntil(endsAt)), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (!ready) {
    // Server render: state the DATE (a fact we know) rather than a live number
    // (which we do not, yet). Never render a countdown we have not measured.
    return (
      <p className="flex items-center gap-2 text-sm">
        <Clock aria-hidden="true" className="size-4" />
        <span className="font-bold">Ends {formatEndDate(endsAt)}</span>
      </p>
    );
  }

  if (remaining === null) {
    return (
      <p className={`text-sm font-bold ${className ?? ""}`}>{onEndedLabel ?? "This offer has ended."}</p>
    );
  }

  return (
    <div className={className}>
      <p className="flex items-center gap-2 text-sm">
        <Sparkles aria-hidden="true" className="size-4" />
        <span className="font-bold">Ends in</span>
        <span className="tabular font-display font-extrabold">
          {remaining.days > 0 ? `${remaining.days}d ` : ""}
          {String(remaining.hours).padStart(2, "0")}h{" "}
          {String(remaining.minutes).padStart(2, "0")}m{" "}
          {String(remaining.seconds).padStart(2, "0")}s
        </span>
      </p>
      <p className="sr-only" aria-live="off">
        This offer ends on {new Date(endsAt).toLocaleDateString("en-PH", { dateStyle: "long" })}.
      </p>
    </div>
  );
}
