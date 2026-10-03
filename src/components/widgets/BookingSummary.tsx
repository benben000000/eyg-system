"use client";

/**
 * BOOKING SUMMARY — the review card shown on step 4 and in the sticky rail.
 * ============================================================================
 *  - Always shows the vehicle, the services with quantities, the estimate range,
 *    the total duration, the slot in Philippine time, and the promo code if one
 *    was applied.
 *  - Anything variable carries its `variableNote` verbatim, and the disclaimer
 *    is repeated here because this is the last screen before the customer
 *    commits. An estimate that hides its own uncertainty at the point of
 *    commitment is a bait-and-switch.
 *  - Server-produced totals (`booking.items`, `booking.estimateMin/Max`) win over
 *    the client-side estimate when a confirmation is being shown, because the
 *    server is what will be held to the number.
 * ============================================================================
 */
import type { PackageDto, ServiceDto } from "@/lib/types";
import { formatPesoRange, cn } from "@/lib/utils";
import { ESTIMATE_DISCLAIMER, durationOf, priceBand } from "@/components/widgets/internal/catalogue";
import { formatShopDateTime } from "@/components/widgets/internal/time-ph";
import { Pill, WidgetCard } from "@/components/widgets/internal/ui";

export interface BookingSummaryProps {
  services: readonly ServiceDto[];
  packages?: readonly PackageDto[];
  packageId?: string | undefined;
  promoCode?: string | undefined;
  vehicleLabel: string;
  /** `YYYY-MM-DD` chosen, or "" if not yet chosen. */
  date: string;
  /** ISO `startAt`, or "". */
  startAt: string;
  slotLabel: string;
  estimateMin: number;
  estimateMax: number;
  durationLabel: string;
  hasVariable: boolean;
  /** Server-side item lines, if this is a confirmed booking. */
  items?: ReadonlyArray<{ id: string; name: string; quantity: number; priceMin: number | null; priceMax: number | null }> | undefined;
  className?: string;
  headingId?: string;
  /** Compact rendering for a sidebar. */
  compact?: boolean;
  /** Hide the "nothing selected yet" copy. */
  hideEmpty?: boolean;
}

export default function BookingSummary({
  services,
  packages = [],
  packageId,
  promoCode,
  vehicleLabel,
  date,
  startAt,
  slotLabel,
  estimateMin,
  estimateMax,
  durationLabel,
  hasVariable,
  items,
  className,
  headingId,
  compact = false,
  hideEmpty = false,
}: BookingSummaryProps) {
  const pkg = packageId ? packages.find((p) => p.id === packageId) : undefined;
  const empty = services.length === 0 && !pkg && !items?.length;

  return (
    <WidgetCard
      as="section"
      className={cn("flex flex-col gap-3", compact && "p-3", className)}
      aria-labelledby={headingId}
    >
      <h3 id={headingId} className="eyg-eyebrow text-muted-foreground">
        Your booking
      </h3>

      {empty && !hideEmpty ? (
        <p className="text-sm text-muted-foreground">
          Nothing selected yet. Pick your services and a time and this will fill in.
        </p>
      ) : null}

      {/* ── Vehicle ───────────────────────────────────────────────────────── */}
      {!empty ? (
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Vehicle</dt>
            <dd className="text-right font-semibold text-foreground">{vehicleLabel || "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Date &amp; time</dt>
            <dd className="text-right font-semibold text-foreground">
              {startAt ? (
                <>
                  {formatShopDateTime(startAt)}
                  {slotLabel ? (
                    <span className="block text-xs font-medium text-muted-foreground">{slotLabel}</span>
                  ) : null}
                </>
              ) : date ? (
                date
              ) : (
                "Not chosen yet"
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Bay time</dt>
            <dd className="text-right font-semibold text-foreground tabular">{durationLabel}</dd>
          </div>
          {promoCode ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Promo</dt>
              <dd className="text-right">
                <Pill tone="brand">{promoCode}</Pill>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {/* ── Line items ────────────────────────────────────────────────────── */}
      {pkg && services.length === 0 && !items?.length ? (
        <ul className="flex flex-col gap-1">
          {pkg.items.map((item) => (
            <li key={item.name} className="flex justify-between gap-3 text-sm">
              <span className="text-foreground">
                {item.name}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {items && items.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="text-foreground">
                {item.name}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
              </span>
              <span className="tabular shrink-0 text-muted-foreground">
                {formatPesoRange(item.priceMin, item.priceMax)}
              </span>
            </li>
          ))}
        </ul>
      ) : services.length > 0 && !items ? (
        <ul className="flex flex-col gap-1.5">
          {services.map((service) => {
            const band = priceBand(service);
            return (
              <li key={service.id} className="flex flex-col gap-0.5">
                <span className="flex justify-between gap-3 text-sm">
                  <span className="text-foreground">{service.name}</span>
                  <span className="tabular shrink-0 font-semibold text-foreground">
                    {service.pricing === "CALL_FOR_PRICE" ? "On inspection" : formatPesoRange(band.min, band.max)}
                  </span>
                </span>
                <span className="flex justify-between gap-3 text-xs text-muted-foreground">
                  <span>{durationOf(service)} min in the bay</span>
                </span>
                {band.isVariable && band.variableNote ? (
                  <span className="text-xs italic leading-relaxed text-muted-foreground">
                    {band.variableNote}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* ── Total ─────────────────────────────────────────────────────────── */}
      {!empty ? (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-bold text-foreground">Estimated total</span>
            <span
              aria-live="polite"
              className="tabular font-display text-2xl font-extrabold text-foreground"
            >
              {formatPesoRange(estimateMin, estimateMax)}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {hasVariable ? "Range, not a fixed price. " : ""}
            {ESTIMATE_DISCLAIMER}
          </p>
        </div>
      ) : null}
    </WidgetCard>
  );
}

export { BookingSummary };