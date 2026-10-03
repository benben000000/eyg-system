"use client";

/**
 * SERVICE PICKER — step 2 of the booking flow.
 * ============================================================================
 *  - Services are grouped by `category` from the catalogue, in catalogue order.
 *  - Each row shows duration, an INDICATIVE price (never a promise), and a
 *    plain-language "why we might not be exact" note for anything variable.
 *  - Package bundles are offered alongside individual services, with their
 *    saving shown as a peso amount AND a percentage where both are known.
 *    Choosing a package does not silently clear the individual services — the
 *    customer can see exactly what the total is either way.
 *  - A running total (price range + total duration) sits at the top and is
 *    `aria-live="polite"`, so it updates without a screen reader reading every
 *    intermediate value.
 *  - Removing a service re-computes both, immediately.
 *
 * EMPTY CATALOGUE: renders a designed state with the phone number, not a blank
 * box. The customer can still finish the flow by calling.
 * ============================================================================
 */
import { useMemo } from "react";
import { Check, Clock3, Phone, Wallet } from "lucide-react";
import type { PackageDto, ServiceDto } from "@/lib/types";
import { formatPesoRange, cn } from "@/lib/utils";
import { durationOf, priceBand, serviceLabel } from "@/components/widgets/internal/catalogue";
import { Pill, WidgetCard } from "@/components/widgets/internal/ui";

export interface ServicePickerTotals {
  min: number;
  max: number;
  durationMin: number;
  itemCount: number;
  hasVariable: boolean;
  savings: { amount: number; compareAt: number } | null;
  durationLabel: string;
}

export interface ServicePickerProps {
  services: readonly ServiceDto[];
  packages?: readonly PackageDto[];
  selectedIds: readonly string[];
  packageId: string;
  onToggle: (id: string) => void;
  onSelectPackage: (id: string) => void;
  totals: ServicePickerTotals;
  errors?: Record<string, string | undefined>;
  maxServices?: number;
  headingId?: string;
  className?: string;
  bare?: boolean;
  /** Shown when the catalogue is empty or fails to load. */
  emptyMessage?: string;
  phoneHref?: string;
  phoneDisplay?: string;
}

export default function ServicePicker({
  services,
  packages = [],
  selectedIds,
  packageId,
  onToggle,
  onSelectPackage,
  totals,
  errors = {},
  maxServices = 8,
  headingId,
  className,
  bare = false,
  emptyMessage,
  phoneHref,
  phoneDisplay,
}: ServicePickerProps) {
  const groups = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; services: ServiceDto[] }>();
    for (const service of services) {
      const existing = map.get(service.category.slug);
      if (existing) existing.services.push(service);
      else map.set(service.category.slug, { slug: service.category.slug, name: service.category.name, services: [service] });
    }
    return Array.from(map.values());
  }, [services]);

  const atLimit = selectedIds.length >= maxServices;
  const body = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="eyg-eyebrow text-muted-foreground">Step 2 of 4</p>
        <h2 id={headingId} tabIndex={-1} className="text-h3 text-foreground outline-none">
          What do you need done?
        </h2>
        <p className="text-sm text-muted-foreground">
          Tick everything you want. Nothing is charged now — we confirm the price first.
        </p>
      </div>

      {/* ── Running total ─────────────────────────────────────────────────── */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-300 bg-brand-50 p-3"
      >
        <div className="flex flex-col">
          <span className="eyg-eyebrow text-brand-800">
            {totals.itemCount === 0 ? "Nothing selected yet" : `${totals.itemCount} selected`}
          </span>
          <span className="tabular font-display text-2xl font-extrabold text-brand-900">
            {totals.itemCount === 0 ? "—" : formatPesoRange(totals.min, totals.max)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-bold text-brand-900">
          <Clock3 aria-hidden="true" className="size-4" focusable="false" />
          <span className="tabular">{totals.durationLabel}</span> in the bay
        </div>
      </div>

      {totals.hasVariable && totals.itemCount > 0 ? (
        <p className="rounded-card border border-border-strong bg-surface-muted p-2.5 text-xs leading-relaxed text-muted-foreground">
          <strong className="font-bold text-foreground">This is an estimate.</strong> Items marked
          &ldquo;varies&rdquo; depend on the parts your car actually needs. We check them and give you
          the price before any work starts.
        </p>
      ) : null}

      {errors.serviceIds ? (
        <p role="alert" className="text-sm font-semibold text-racing-700">
          ⚠ {errors.serviceIds}
        </p>
      ) : null}

      {/* ── Packages ──────────────────────────────────────────────────────── */}
      {packages.length > 0 ? (
        <section aria-labelledby={`${headingId ?? "svc"}-packages`} className="flex flex-col gap-2">
          <h3 id={`${headingId ?? "svc"}-packages`} className="text-sm font-bold text-foreground">
            Packages
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {packages.map((pkg) => {
              const active = packageId === pkg.id;
              return (
                <li key={pkg.id}>
                  <label
                    className={cn(
                      "flex min-h-11 cursor-pointer items-start gap-3 rounded-card border p-3 transition-colors",
                      active
                        ? "border-brand-500 bg-brand-50"
                        : "border-border-strong bg-surface hover:bg-surface-muted",
                    )}
                  >
                    <input
                      type="radio"
                      name="bookingPackage"
                      value={pkg.id}
                      checked={active}
                      onChange={() => onSelectPackage(pkg.id)}
                      className="mt-1 size-5 shrink-0 accent-[var(--color-brand-500)]"
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{pkg.name}</span>
                        {pkg.badge ? <Pill tone="brand">{pkg.badge}</Pill> : null}
                      </span>
                      <span className="text-sm leading-relaxed text-muted-foreground">{pkg.tagline}</span>
                      <span className="tabular text-sm font-bold text-foreground">
                        {pkg.priceMin > 0 ? formatPesoRange(pkg.priceMin, pkg.priceMax) : "Ask us"}
                        {pkg.savingsPct ? (
                          <span className="ml-2 font-semibold text-pit-700">{pkg.savingsPct}% off</span>
                        ) : null}
                      </span>
                      {active ? <span className="sr-only">Selected</span> : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {packageId ? (
            <button
              type="button"
              onClick={() => onSelectPackage(packageId)}
              className="self-start text-xs font-semibold text-brand-700 underline underline-offset-4"
            >
              Clear the package and pick services instead
            </button>
          ) : null}
        </section>
      ) : null}

      {/* ── Individual services ───────────────────────────────────────────── */}
      {groups.length === 0 ? (
        <div className="rounded-card border border-border-strong bg-surface-muted p-4 text-sm leading-relaxed text-muted-foreground">
          <p className="font-bold text-foreground">Our service list did not load.</p>
          <p className="mt-1">
            {emptyMessage ??
              "That is our side, not yours. Call the shop and we will book you by hand — it takes a minute."}
          </p>
          {phoneHref && phoneDisplay ? (
            <a
              href={phoneHref}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-card border border-border-strong bg-surface px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-muted"
            >
              <Phone aria-hidden="true" className="size-4" focusable="false" />
              Call {phoneDisplay}
            </a>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {atLimit ? (
            <p className="rounded-card border border-brand-400 bg-brand-50 p-2 text-xs font-semibold text-brand-900">
              You have reached the {maxServices}-service limit for one booking. Remove one to add
              another, or call us and we will split it across two visits.
            </p>
          ) : null}

          {groups.map((group) => (
            <section key={group.slug} aria-labelledby={`${headingId ?? "svc"}-${group.slug}`}>
              <h3
                id={`${headingId ?? "svc"}-${group.slug}`}
                className="eyg-eyebrow mb-2 text-muted-foreground"
              >
                {group.name}
              </h3>
              <ul className="flex flex-col gap-2">
                {group.services.map((service) => {
                  const checked = selectedIds.includes(service.id);
                  const band = priceBand(service);
                  const disabled = !checked && atLimit;
                  const inputId = `svc-${service.id}`;
                  return (
                    <li key={service.id}>
                      <label
                        htmlFor={inputId}
                        className={cn(
                          "flex min-h-11 items-start gap-3 rounded-card border p-3",
                          disabled
                            ? "cursor-not-allowed border-border bg-surface-muted opacity-60"
                            : "cursor-pointer border-border-strong bg-surface",
                          checked && !disabled && "border-brand-500 bg-brand-50",
                        )}
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          name="serviceIds"
                          value={service.id}
                          checked={checked}
                          disabled={disabled}
                          aria-disabled={disabled || undefined}
                          onChange={() => onToggle(service.id)}
                          className="mt-1 size-5 shrink-0 accent-[var(--color-brand-500)]"
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-foreground">
                              {serviceLabel(service)}
                            </span>
                            {service.isPopular ? <Pill tone="brand">Popular</Pill> : null}
                            {band.isVariable ? <Pill tone="warning">Varies</Pill> : null}
                          </span>
                          <span className="text-sm leading-relaxed text-muted-foreground">
                            {service.summary}
                          </span>
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="tabular font-bold text-foreground">
                              {service.pricing === "CALL_FOR_PRICE"
                                ? "Price confirmed on inspection"
                                : formatPesoRange(band.min, band.max)}
                            </span>
                            <span className="tabular inline-flex items-center gap-1 text-muted-foreground">
                              <Clock3 aria-hidden="true" className="size-3" focusable="false" />
                              {formatDuration(durationOf(service))}
                            </span>
                          </span>
                          {band.isVariable && band.variableNote ? (
                            <span className="text-xs italic leading-relaxed text-muted-foreground">
                              {band.variableNote}
                            </span>
                          ) : service.priceNote && !band.isVariable ? (
                            <span className="text-xs italic leading-relaxed text-muted-foreground">
                              {service.priceNote}
                            </span>
                          ) : null}
                        </span>
                        {checked ? (
                          <Check aria-hidden="true" className="size-5 shrink-0 text-brand-600" focusable="false" />
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {totals.itemCount > 0 ? (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Wallet aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" focusable="false" />
          <span>
            Totals include labour for the services you ticked. Parts that vary are billed at what
            your car actually needs, and we tell you before we order anything.
          </span>
        </p>
      ) : null}
    </div>
  );

  if (bare) return <div className={className}>{body}</div>;
  return <WidgetCard className={cn("flex flex-col", className)}>{body}</WidgetCard>;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${h} hr` : `${h} hr ${rest} min`;
}

export { ServicePicker };