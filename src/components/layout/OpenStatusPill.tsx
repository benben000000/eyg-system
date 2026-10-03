"use client";

/**
 * OPEN / CLOSED STATUS CHIP
 * ============================================================================
 * BRAND RULE — no glow, no neon, no soft translucent fills.
 *
 * The previous version was a `rounded-pill` with `bg-pit-500/15` /
 * `bg-racing-500/15`: a 15%-opacity colour wash on near-black, which reads as a
 * neon halo. That is SaaS-dashboard language, not the EYG identity, and it was
 * the single most off-brand element on the site.
 *
 * The replacement follows the actual mark:
 *   - `rounded-eyebrow` (2px). `--radius-eyebrow: 2px` exists in `globals.css`
 *     precisely as the deliberate motorsport squareness rule; this chip finally
 *     uses it instead of a 999px pill.
 *   - OPEN is the identity colour: solid brand yellow, ink text. It is the one
 *     state the brand should shout.
 *   - CLOSED is deliberately quiet — a flat ink plane with a muted border. A
 *     closed shop is not an emergency; red is reserved for real errors, so the
 *     eye is not trained to ignore it.
 *   - A flat square marker, not a glowing dot. Shape carries the signal
 *     alongside the words, so it survives a colour-blind reader and a greyscale
 *     print of a service receipt.
 * ============================================================================
 */
import * as React from "react";
import { Timer } from "lucide-react";

import { getOpenStatus, type OpenStatus } from "@/components/layout/hours";
import { cn } from "@/lib/utils";

export interface OpenStatusPillProps {
  /** Server-computed value. Must be passed from a Server Component so hydration
   *  never disagrees about what time it is. */
  initial: OpenStatus;
  className?: string;
  variant?: "soft" | "solid";
}

export function OpenStatusPill({
  initial,
  className,
  variant = "soft",
}: OpenStatusPillProps): React.ReactElement {
  const [status, setStatus] = React.useState<OpenStatus>(initial);

  React.useEffect(() => {
    const sync = () => setStatus(getOpenStatus(new Date()));
    const timer = window.setInterval(sync, 60_000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const isOpen = status.isOpen;

  return (
    <span
      title={status.today}
      className={cn(
        // 2px radius + a hard 1px border: the squareness rule.
        "inline-flex items-center gap-2 rounded-eyebrow border px-2.5 py-1 text-eyebrow",
        variant === "solid"
          ? "border-white/30 bg-ink-950 text-white"
          : isOpen
            ? // Solid brand yellow — the identity colour, flat, no halo.
              "border-brand-500 bg-brand-500 text-ink-950"
            : // Quiet. Flat ink, muted border, no colour wash.
              "border-ink-700 bg-ink-900 text-ink-200",
        className,
      )}
    >
      {/* Flat square marker. Shape, not colour, is what distinguishes the states. */}
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0",
          isOpen ? "bg-ink-950" : "border border-ink-400 bg-transparent",
        )}
      />
      <Timer aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only">Shop hours: </span>
      <span className="font-bold">{status.label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "hidden font-semibold sm:inline",
          isOpen ? "opacity-75" : "text-ink-400",
        )}
      >
        {status.detail}
      </span>
      <span className="sr-only">
        {status.detail}. {status.today}.
      </span>
    </span>
  );
}