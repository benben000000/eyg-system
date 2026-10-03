/**
 * EYG — BOOKING STEP 2: SERVICES
 * ============================================================================
 * Multi-select across the whole catalogue, grouped by category, with a live
 * running total and duration estimate.
 *
 * HONESTY RULES ENFORCED HERE
 *   • a service priced "Ask us" contributes to the "incomplete total" warning,
 *     never a silent zero
 *   • packages pre-select their constituent services and switch the displayed
 *     total to the bundle price
 *   • the maximum from `BOOKING.maxServicesPerBooking` is enforced with a
 *     message, not a silent truncation
 * ============================================================================
 */

import { cn, formatPeso } from "@/lib/utils";
import type { CatalogService } from "@/content/catalog";
import { estimateFor, totalDurationMinutes } from "@/content/catalog";
import type { PackageDto } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Check, ShoppingBag, TriangleAlert, X, categoryIcon } from "@/components/pages/_icons";
import { formatDurationLabel } from "@/components/pages/services/ServiceCard";

export interface ServicesStepProps {
  services: readonly CatalogService[];
  packages: readonly PackageDto[];
  /** Group order + labels, from `SERVICE_CATEGORIES`. */
  groups: ReadonlyArray<{ slug: string; name: string; blurb: string }>;
  selectedSlugs: readonly string[];
  packageSlug: string | null;
  onToggle: (slug: string) => void;
  onSelectPackage: (slug: string) => void;
  onClearPackage: () => void;
  fieldErrors: Record<string, string[]>;
  disabled: boolean;
  maxServices: number;
}

export function ServicesStep({
  services,
  packages,
  groups,
  selectedSlugs,
  packageSlug,
  onToggle,
  onSelectPackage,
  onClearPackage,
  fieldErrors,
  disabled,
  maxServices,
}: ServicesStepProps): React.ReactElement {
  const chosen = services.filter((s) => selectedSlugs.includes(s.slug));
  const estimate = estimateFor(chosen);
  const minutes = totalDurationMinutes(chosen);
  const hasUnpriced = chosen.some((s) => s.pricing === "CALL_FOR_PRICE" || s.priceMin === null);
  const isRange = chosen.some((s) => (s.priceMax ?? s.priceMin) !== s.priceMin);
  const atLimit = chosen.length >= maxServices;

  return (
    <fieldset disabled={disabled} className="space-y-8">
      <legend className="sr-only">What your car needs</legend>

      {/* ── Packages first: they are the higher-intent choice ───────────── */}
      {packages.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-h3">Start from a package</h3>
            <p className="text-sm text-muted-foreground">
              A package fills this step in for you, at a bundle price.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {packages.map((pkg) => {
              const active = pkg.slug === packageSlug;
              return (
                <li key={pkg.id}>
                  <button
                    type="button"
                    onClick={() => (active ? onClearPackage() : onSelectPackage(pkg.slug))}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full min-h-24 flex-col items-start gap-1.5 rounded-card border-2 p-4 text-left transition-colors",
                      active
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/25"
                        : "border-border-strong bg-surface hover:border-brand-500",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingBag aria-hidden="true" className="size-4 text-brand-500" />
                      <span className="font-display text-sm font-extrabold uppercase tracking-wide">
                        {pkg.name}
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground">{pkg.tagline}</span>
                    <span className="tabular mt-auto flex flex-wrap items-baseline gap-2 text-sm">
                      <span className="font-bold text-brand-500">{formatPeso(pkg.priceMin)}</span>
                      {pkg.compareAtMin !== null ? (
                        <span className="text-muted-foreground line-through">
                          {formatPeso(pkg.compareAtMin)}
                        </span>
                      ) : null}
                      {active ? (
                        <span className="font-bold text-pit-600 dark:text-pit-400">
                          Selected — tap to remove
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {packageSlug ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check aria-hidden="true" className="size-4 text-pit-500" />
              Package applied. The services it contains are ticked below — you can still
              add or remove individual items.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── Running total ────────────────────────────────────────────────── */}
      <div
        className="rounded-panel border-2 border-border-strong bg-surface-muted p-5"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyg-eyebrow text-muted-foreground">
              {chosen.length === 0
                ? "Nothing selected"
                : `${chosen.length} of a maximum ${maxServices} selected`}
            </p>
            <p className="tabular mt-1 font-display text-3xl font-extrabold leading-none text-brand-500">
              {chosen.length === 0 ? "—" : formatPeso(estimate.min)}
            </p>
            {chosen.length > 0 && packageSlug === null ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Estimated.{" "}
                {minutes !== null ? `About ${formatDurationLabel(minutes)} in the bay.` : null}
              </p>
            ) : null}
          </div>
          {chosen.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                chosen.forEach((s) => onToggle(s.slug));
              }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-eyebrow text-sm font-bold text-foreground underline decoration-2 underline-offset-4"
            >
              <X aria-hidden="true" className="size-4" />
              Clear all
            </button>
          ) : null}
        </div>

        {chosen.length > 0 ? (
          <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-500" />
            <span>
              {hasUnpriced
                ? "Some jobs are priced after we see the car — this total is only part of the bill. "
                : ""}
              {isRange
                ? "Where a service shows a range, the lower figure is shown here; the final price is confirmed before work starts. "
                : ""}
              The final price is confirmed with you after the technician inspects the car.
            </span>
          </p>
        ) : null}

        {fieldErrors["serviceIds"]?.[0] ? (
          <p className="mt-3 text-sm font-bold text-destructive">{fieldErrors["serviceIds"][0]}</p>
        ) : null}
      </div>

      {/* ── The catalogue, grouped ───────────────────────────────────────── */}
      <div className="space-y-8">
        {groups.map((group) => {
          const items = services.filter((s) => s.category.slug === group.slug);
          if (items.length === 0) {
            return (
              <section key={group.slug} className="space-y-3">
                <h3 className="text-h3">{group.name}</h3>
                <p className="rounded-card border-2 border-dashed border-border-strong bg-surface-muted p-5 text-sm text-muted-foreground">
                  Nothing is published in this category yet. Ask us at the counter and we
                  will do it — we just do not list a job we cannot do properly.
                </p>
              </section>
            );
          }
          const headingId = `book-cat-${group.slug}`;
          return (
            <section key={group.slug} aria-labelledby={headingId} className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 id={headingId} className="text-h3">
                  {group.name}
                </h3>
                <Badge tone="neutral" size="sm">
                  {items.length}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{group.blurb}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {items.map((service) => {
                  const checked = selectedSlugs.includes(service.slug);
                  const blocked = !checked && atLimit;
                  return (
                    <li key={service.id}>
                      <label
                        className={cn(
                          "flex min-h-16 cursor-pointer items-start gap-3 rounded-card border-2 p-3.5 transition-colors",
                          checked
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/25"
                            : "border-border bg-surface hover:border-brand-500",
                          blocked && "cursor-not-allowed opacity-55",
                        )}
                      >
                        <input
                          type="checkbox"
                          name="serviceIds"
                          value={service.slug}
                          checked={checked}
                          disabled={blocked}
                          onChange={() => onToggle(service.slug)}
                          className="mt-0.5 size-6 shrink-0 rounded-eyebrow border-2 border-border-strong accent-brand-500"
                        />
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="flex items-start gap-2">
                            <span aria-hidden="true" className="mt-1 text-brand-500">
                              <ServiceIcon slug={service.category.icon} />
                            </span>
                            <span className="min-w-0 flex-1 font-bold">
                              {service.name}
                              {service.isPopular ? (
                                <span className="ml-2 text-xs font-bold uppercase tracking-wide text-brand-500">
                                  ★ Most booked
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <span className="tabular block text-xs text-muted-foreground">
                            {formatServicePriceLabel(service.priceMin, service.priceMax)}
                            {service.durationMin !== null
                              ? ` · ~${formatDurationLabel(service.durationMin)}`
                              : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Not sure? Leave this step empty and describe it in the notes on the last step —
        or book the pre-trip check and we will tell you.
      </p>
    </fieldset>
  );
}

function ServiceIcon({ slug }: { slug: string | null }): React.ReactElement {
  const Icon = categoryIcon(slug);
  return <Icon className="size-4" />;
}

/**
 * A one-line price for the compact service list.
 * `null` min means the price genuinely depends on the part, so it reads
 * "Ask us" — never ₱0, never a dash.
 */
export function formatServicePriceLabel(
  priceMin: number | null,
  priceMax: number | null,
): string {
  if (priceMin === null) return "Ask us";
  if (priceMax === null || priceMax === priceMin) return formatPeso(priceMin);
  return `${formatPeso(priceMin)}–${formatPeso(priceMax)}`;
}

/** Step-2 validation. Empty is allowed — a customer can describe the job later. */
export function validateServicesStep(selected: readonly string[], max: number): string | null {
  if (selected.length > max) return `Choose up to ${max} services in one visit.`;
  return null;
}
