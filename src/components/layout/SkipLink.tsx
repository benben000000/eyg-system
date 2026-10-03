import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

/**
 * The first focusable element on every page.
 *
 * Deliberately NOT `sr-only` + `focus:not-sr-only`: which of `focus:fixed` and
 * `focus:not-sr-only` wins in the cascade depends on Tailwind's internal utility
 * order, and getting it wrong leaves the link visible-but-broken or
 * invisible-but-focusable. A `translate` off-screen is a single property with no
 * competing utility, so the focus behaviour is deterministic:
 *
 *  • hidden   → translated above the viewport, still in the a11y tree and
 *               still reachable with Tab (that is the whole point of it)
 *  • focused  → translated back to the top-left corner
 *
 * `body` has `overflow-x: clip`, so an element parked above the viewport cannot
 * create a scrollbar.
 */
export function SkipLink({
  targetId = "main",
  className,
}: {
  targetId?: string;
  className?: string;
}): ReactElement {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        "absolute left-4 top-4 z-[var(--z-toast)] -translate-y-24 rounded-eyebrow",
        "bg-accent px-4 py-3 font-bold text-accent-foreground shadow-lift",
        "transition-transform duration-150 ease-snap focus:translate-y-0",
        className,
      )}
    >
      Skip to main content
    </a>
  );
}
