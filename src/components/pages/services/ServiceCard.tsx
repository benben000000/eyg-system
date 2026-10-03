/**
 * EYG — SERVICE CARD
 * ============================================================================
 * The unit of the `/services` catalogue. Every card carries the five things a
 * customer needs before they will book:
 *
 *   1. an icon (paired with the name, never decorative-only)
 *   2. the name and a one-line plain-English summary
 *   3. how long it takes in the bay
 *   4. an honest `PriceTag` — a range, a fixed number, or "Ask us"
 *   5. a disclosure with what's included and what is NOT
 *   6. the mandated CTA — "Select [Service] & Pick Date" → `/book?service=<slug>`
 *
 * The disclosure is a native `<details>`/`<summary>`. That gives keyboard
 * support, a real toggle state, find-in-page on the open text, and full
 * operation with JavaScript disabled — with zero client JavaScript.
 * ============================================================================
 */

import Link from "next/link";
import { cn, formatPeso } from "@/lib/utils";
import type { CatalogService } from "@/content/catalog";
import {
  ButtonLink,
  PriceTag,
} from "@/components/pages/_shims";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Minus,
  categoryIcon,
} from "@/components/pages/_icons";

export interface ServiceCardProps {
  service: CatalogService;
  /** `compact` is used inside the "Most booked right now" cluster. */
  compact?: boolean;
  className?: string;
}

export function ServiceCard({
  service,
  compact = false,
  className,
}: ServiceCardProps): React.ReactElement {
  const Icon = categoryIcon(service.category.icon);
  const headingId = `svc-${service.slug}-title`;
  const bodyId = `svc-${service.slug}-body`;

  return (
    <article
      aria-labelledby={headingId}
      id={service.slug}
      className={cn(
        "group flex scroll-mt-32 flex-col rounded-panel border border-border bg-surface shadow-plate transition-shadow hover:shadow-lift",
        compact && "sm:flex-row sm:items-center sm:gap-5",
        className,
      )}
    >
      <div className={cn("flex gap-4 p-5 sm:p-6", compact && "sm:flex-1 sm:items-start")}>
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-card bg-surface-muted text-brand-500 ring-1 ring-border-strong"
        >
          <Icon className="size-5" />
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3
              id={headingId}
              className={cn("text-h3 font-display font-extrabold", compact && "text-base")}
            >
              {service.name}
            </h3>
            {service.isPopular ? (
              <span className="eyg-eyebrow rounded-pill bg-surface-muted px-2 py-0.5 text-brand-500">
                ★ Most booked
              </span>
            ) : null}
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">{service.summary}</p>

          {service.durationMin !== null ? (
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Clock aria-hidden="true" className="size-3.5" />
              About {formatDurationLabel(service.durationMin)} in the bay
            </p>
          ) : (
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Time depends on the car — confirmed on the day
            </p>
          )}

          <div className="pt-1">
            <PriceTag
              priceMin={service.priceMin}
              priceMax={service.priceMax}
              note={service.priceNote}
              size={compact ? "sm" : "md"}
            />
          </div>
        </div>
      </div>

      {service.includes.length > 0 || service.excluded.length > 0 ? (
        <details
          className="group/details border-t border-border px-5 sm:px-6"
          // `open` is intentionally not defaulted: a closed card keeps the
          // catalogue scannable at a glance.
        >
          <summary
            className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-2 text-sm font-bold text-brand-500 marker:content-none hover:underline"
            aria-describedby={bodyId}
          >
            <span>What&apos;s included — and what isn&apos;t</span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform group-open/details:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div id={bodyId} className="space-y-4 pb-5 pt-1">
            {service.includes.length > 0 ? (
              <div>
                <p className="eyg-eyebrow mb-2 text-muted-foreground">Included</p>
                <ul className="space-y-1.5">
                  {service.includes.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pit-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {service.excluded.length > 0 ? (
              <div>
                <p className="eyg-eyebrow mb-2 text-muted-foreground">Not included</p>
                <ul className="space-y-1.5">
                  {service.excluded.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed">
                      <Minus aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      <div className="mt-auto border-t border-border bg-surface-muted p-5 sm:p-6">
        {/* P0 CTA — copy is fixed by the brief: "Select [Service] & Pick Date". */}
        <ButtonLink
          href={`/book?service=${service.slug}`}
          variant="cta"
          size="md"
          fullWidth
          className="justify-between"
        >
          <span>
            Select {service.shortName ?? service.name} &amp; Pick Date
          </span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </ButtonLink>
      </div>
    </article>
  );
}

/** 45 → "45 minutes", 120 → "2 hours", 240 → "4 hours". */
export function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} ${h === 1 ? "hour" : "hours"}`;
  return `${h} ${h === 1 ? "hour" : "hours"} ${m} min`;
}

/** The condensed variant used in the "Most booked right now" cluster. */
export function ServiceQuickCard({
  service,
}: {
  service: CatalogService;
}): React.ReactElement {
  return (
    <li className="min-w-[16rem] shrink-0 snap-start sm:min-w-0">
      <ServiceCard service={service} compact className="h-full" />
    </li>
  );
}

/** A one-line row used by the "everything else" quick links. */
export function ServiceLinkRow({ service }: { service: CatalogService }): React.ReactElement {
  const Icon = categoryIcon(service.category.icon);
  return (
    <li>
      <Link
        href={`/services?category=${service.category.slug}#${service.slug}`}
        className="flex min-h-11 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 transition-colors hover:border-brand-500"
      >
        <Icon aria-hidden="true" className="size-4 shrink-0 text-brand-500" />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{service.name}</span>
        <span className="tabular shrink-0 text-xs text-muted-foreground">
          {service.priceMin === null ? "Ask us" : formatPeso(service.priceMin, { compact: true })}
        </span>
      </Link>
    </li>
  );
}
