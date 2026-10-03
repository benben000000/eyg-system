"use client";

import * as React from "react";
// `CalendarClock` is avoided on purpose — see the note in
// `src/components/layout/OpenStatusPill.tsx` about `optimizePackageImports`
// and the lucide barrel. `Timer` resolves correctly.
import { Timer } from "lucide-react";

/**
 * Live retry countdown for the rate-limited error state.
 *
 * Split into its own client file so <ErrorView /> itself stays a Server
 * Component — the 404 page then ships as static HTML, which is what a crawler
 * needs.
 */
export function RetryCountdown({ seconds }: { seconds: number }): React.ReactElement {
  const [remaining, setRemaining] = React.useState(() => Math.max(0, Math.ceil(seconds)));

  React.useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(() => setRemaining((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <p className="mt-4 inline-flex items-center gap-2 rounded-card border border-brand-600 bg-brand-50 px-3 py-2 text-sm font-bold text-brand-900 dark:border-brand-500 dark:bg-ink-900 dark:text-brand-100">
      <Timer aria-hidden="true" className="size-4" />
      {remaining > 0 ? (
        <>
          Try again in <span className="tabular">{mm}:{ss}</span>
        </>
      ) : (
        "You can try again now."
      )}
    </p>
  );
}
