/**
 * EYG — ORDER SUMMARY SIDEBAR
 * ============================================================================
 * Persistent on desktop (`lg:sticky`), a collapsible summary bar on mobile.
 *
 * It is the only place the customer sees the running total, so it must be honest
 * about two things:
 *   • any price in the basket is an INDICATIVE figure until inspection
 *   • anything priced "Ask us" makes the total incomplete, not zero
 *
 * PACKAGE HANDLING: selecting a package pre-selects the services it contains, so
 * the lines are listed but the figure shown is the *bundle* price — otherwise the
 * saving the customer was offered would vanish from the summary.
 * ============================================================================
 */

import Link from "next/link";
import { cn, formatPeso } from "@/lib/utils";
import type { CatalogService } from "@/content/catalog";
import { estimateFor, getPackageBySlug, totalDurationMinutes } from "@/content/catalog";
import { formatDurationLabel } from "@/components/pages/services/ServiceCard";
import { Check, ChevronDown, TriangleAlert } from "@/components/pages/_icons";

export interface OrderSummaryProps {
  serviceSlugs: readonly string[];
  /** Lookup over the already-fetched catalogue. */
  catalogue: readonly CatalogService[];
  packageSlug: string | null;
  /** `YYYY-MM-DD` or null. */
  date: string | null;
  /** Slot label, e.g. "9:00 AM". */
  slotLabel: string | null;
  vehicleSummary: string;
  promoCode: string | null;
  /** Collapsible `<details>` on mobile. */
  collapsible?: boolean;
  className?: string;
}

export function OrderSummary({
  serviceSlugs,
  catalogue,
  packageSlug,
  date,
  slotLabel,
  vehicleSummary,
  promoCode,
  collapsible = false,
  className,
}: OrderSummaryProps): React.ReactElement {
  const chosen = catalogue.filter((s) => serviceSlugs.includes(s.slug));
  const pkg = packageSlug ? getPackageBySlug(packageSlug) : null;
  const estimate = estimateFor(chosen);
  const minutes = totalDurationMinutes(chosen);
  const hasUnpriced = chosen.some((s) => s.pricing === "CALL_FOR_PRICE" || s.priceMin === null);
  const hasWork = chosen.length > 0 || pkg !== null;

  const totalText = !hasWork
    ? "—"
    : pkg
      ? formatPeso(pkg.priceMin)
      : formatPeso(estimate.min);

  const body = (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="eyg-eyebrow text-muted-foreground">Your vehicle</p>
        <p className="text-sm font-bold">{vehicleSummary}</p>
      </div>

      <div className="space-y-2">
        <p className="eyg-eyebrow text-muted-foreground">
          {chosen.length === 0 ? "Nothing selected yet" : `Work selected (${chosen.length})`}
        </p>
        {chosen.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Pick what your car needs in step 2. You can add or remove anything before
            you confirm.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {chosen.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-sm">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pit-500" />
                <span className="min-w-0 flex-1">{s.shortName ?? s.name}</span>
                <span className="tabular shrink-0 text-muted-foreground">
                  {s.priceMin === null ? "Ask us" : formatPeso(s.priceMin, { compact: true })}
                </span>
              </li>
            ))}
          </ul>
        )}

        {pkg ? (
          <div className="rounded-card border-2 border-brand-500 bg-brand-50 p-3 dark:bg-brand-900/25">
            <p className="text-sm font-bold">Bundle applied: {pkg.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              You are being quoted the bundle price, not the sum of the lines above.
              {pkg.compareAtMin !== null
                ? ` That is ${formatPeso(pkg.compareAtMin - pkg.priceMin)} less than doing them separately.`
                : ""}
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-1">
        <p className="eyg-eyebrow text-muted-foreground">When</p>
        <p className="text-sm font-bold">
          {date
            ? `${formatDateLabel(date)}${slotLabel ? ` at ${slotLabel}` : ""}`
            : "No date picked yet"}
        </p>
        {date && !slotLabel ? (
          <p className="text-xs text-muted-foreground">Pick a time slot in step 3.</p>
        ) : null}
      </div>

      {promoCode ? (
        <div className="space-y-1">
          <p className="eyg-eyebrow text-muted-foreground">Offer applied</p>
          <p className="inline-flex items-center gap-1.5 rounded-pill bg-brand-500 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-ink-950">
            {promoCode}
          </p>
        </div>
      ) : null}

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyg-eyebrow text-muted-foreground">Estimated total</p>
          {minutes !== null && chosen.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              ≈{formatDurationLabel(minutes)} in the bay
            </p>
          ) : null}
        </div>
        <p className="tabular font-display text-2xl font-extrabold leading-none text-brand-500">
          {totalText}
        </p>
        {hasWork ? (
          <p className="flex gap-2 rounded-card border border-brand-700 bg-brand-50 p-3 text-xs leading-relaxed text-brand-900 dark:bg-brand-900/30 dark:text-brand-100">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              {hasUnpriced
                ? "Some jobs are priced after we see the car, so this is only part of the total. "
                : ""}
              The final price is confirmed with you before any work starts. Nothing is
              charged without your yes.
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );

  if (!collapsible) {
    return (
      <aside
        aria-labelledby="order-summary-heading"
        className={cn(
          "rounded-panel border border-border bg-surface p-5 shadow-plate",
          className,
        )}
      >
        <h2 id="order-summary-heading" className="sr-only">
          Your booking so far
        </h2>
        {body}
      </aside>
    );
  }

  return (
    <details
      className={cn(
        "group rounded-card border border-border bg-surface p-4 shadow-plate",
        className,
      )}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 marker:content-none">
        <span className="flex items-center gap-2">
          <span className="eyg-eyebrow text-muted-foreground">Summary</span>
          <span className="tabular font-display text-sm font-extrabold">
            {chosen.length === 0 ? "Nothing yet" : `${chosen.length} selected`}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="tabular text-sm text-brand-500">{totalText}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </span>
      </summary>
      <div className="pt-3">{body}</div>
    </details>
  );
}

/** `2026-10-05` → "Mon 5 Oct". Parsed in string space to avoid timezone drift. */
export function formatDateLabel(isoDate: string): string {
  const parts = isoDate.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return isoDate;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${days[dow]} ${d} ${months[m - 1]}`;
}

/** Inline "change this" link used inside the mobile summary. */
export function SummaryEditLink({
  step,
  children = "Change",
}: {
  step: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <Link
      href={`/book?step=${step}`}
      className="inline-flex min-h-11 items-center text-sm font-bold underline decoration-brand-500 decoration-2 underline-offset-4"
    >
      {children}
    </Link>
  );
}
