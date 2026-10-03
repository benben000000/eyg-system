/**
 * EYG — PACKAGE DEALS BAND
 * ============================================================================
 * `/services` section: "Package Deals".
 *
 * The mandated **Rainy Season Safety Package** gets a visually distinct band —
 * the `.eyg-hazard` device, a `compareAtMin` struck through, and the saving
 * shown in BOTH pesos and percent (a peso figure alone reads as a discount
 * percentage to nobody, and a percentage alone hides the size of the deal).
 *
 * Other packages render as cards in the same section so the comparison is
 * honest and side by side.
 * ============================================================================
 */

import { cn, formatPeso } from "@/lib/utils";
import type { PackageDto } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import {
  ButtonLink,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  Eyebrow,
  Section,
} from "@/components/pages/_shims";
import { ArrowRight, Check, ShoppingBag } from "@/components/pages/_icons";

/** The one package the brief requires to be visually distinct. */
export const FEATURED_PACKAGE_SLUG = "rainy-season-safety-package";

export interface PackageDealsProps {
  packages: readonly PackageDto[];
}

export function PackageDeals({ packages }: PackageDealsProps): React.ReactElement {
  const featured = packages.find((p) => p.slug === FEATURED_PACKAGE_SLUG) ?? null;
  const rest = packages.filter((p) => p.slug !== FEATURED_PACKAGE_SLUG);
  const headingId = "package-deals";

  return (
    <Section labelledBy={headingId} tone="muted" id="packages">
      <Container className="space-y-10">
        <div className="max-w-prose space-y-3">
          <Eyebrow>Package deals</Eyebrow>
          <h2 id={headingId} className="text-h2">
            Bundle it and pay for one bay visit, not three
          </h2>
          <p className="text-body-lg text-muted-foreground">
            A package is just the same work we would do anyway, ordered for you and
            priced as a bundle. Nothing is added that you did not ask for — and the
            itemised list is on the card, in full.
          </p>
        </div>

        {featured ? <FeaturedPackage pkg={featured} /> : null}

        {rest.length > 0 ? (
          <div>
            <h3 className="text-h3 mb-5">Other bundles we run</h3>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((pkg) => (
                <li key={pkg.id}>
                  <PackageCard pkg={pkg} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {packages.length === 0 ? (
          <p className="rounded-panel border-2 border-dashed border-border-strong bg-surface p-8 text-muted-foreground">
            No packages are published right now. Every service on this page can still
            be booked on its own — pick what you need and add it to one visit.
          </p>
        ) : null}
      </Container>
    </Section>
  );
}

function savingFor(pkg: PackageDto): { amount: number | null; pct: number | null } {
  // `PackageDto` carries the saving as a struck-through `compareAtMin` plus a
  // `savingsPct`. The peso amount is derived here so the two can never drift.
  if (pkg.compareAtMin === null) return { amount: null, pct: pkg.savingsPct };
  const amount = Math.max(0, pkg.compareAtMin - pkg.priceMin);
  const pct =
    pkg.savingsPct ?? (pkg.compareAtMin > 0 ? Math.round((amount / pkg.compareAtMin) * 100) : null);
  return { amount, pct };
}

function PackagePrice({ pkg, large = false }: { pkg: PackageDto; large?: boolean }): React.ReactElement {
  const { amount, pct } = savingFor(pkg);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={cn(
            "tabular font-display font-extrabold leading-none",
            large ? "text-h2" : "text-2xl",
          )}
        >
          {formatPeso(pkg.priceMin, { compact: !large })}
          {pkg.priceMax !== null && pkg.priceMax !== pkg.priceMin ? (
            <span className="text-muted-foreground">–{formatPeso(pkg.priceMax, { compact: !large })}</span>
          ) : null}
        </span>
        {pkg.compareAtMin !== null ? (
          <span
            className="tabular text-sm text-muted-foreground line-through decoration-2"
            aria-label={`Normally ${formatPeso(pkg.compareAtMin)}`}
          >
            {formatPeso(pkg.compareAtMin)}
          </span>
        ) : null}
      </div>
      {amount !== null && amount > 0 ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold">
          <span className="rounded-pill bg-pit-500 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-ink-950">
            Save {formatPeso(amount)}
          </span>
          {pct !== null && pct > 0 ? (
            <span className="tabular text-pit-600 dark:text-pit-400">({pct}% off à la carte)</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function ItemList({ pkg }: { pkg: PackageDto }): React.ReactElement {
  return (
    <ul className="space-y-2">
      {pkg.items.map((item) => (
        <li key={`${item.name}-${item.quantity}`} className="flex gap-2 text-sm leading-relaxed">
          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pit-500" />
          <span>
            {item.name}
            {item.quantity > 1 ? (
              <span className="tabular ml-1.5 text-xs text-muted-foreground">×{item.quantity}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FeaturedPackage({ pkg }: { pkg: PackageDto }): React.ReactElement {
  const headingId = "pkg-rainy-season";
  return (
    <article
      aria-labelledby={headingId}
      className="relative overflow-hidden rounded-panel border-2 border-brand-500 bg-surface shadow-lift"
    >
      {/* Hazard hatch: the brand device reserved for the seasonal anchor. */}
      <div aria-hidden="true" className="eyg-hazard h-3 w-full" />
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" size="md" dot>
              {pkg.badge ?? "Featured package"}
            </Badge>
            <Badge tone="success" size="md">
              Rainy season
            </Badge>
          </div>
          <div className="space-y-3">
            <h3 id={headingId} className="text-h2">
              {pkg.name}
            </h3>
            <p className="text-body-lg text-muted-foreground">{pkg.tagline}</p>
          </div>
          <PackagePrice pkg={pkg} large />
          <ButtonLink href={`/book?package=${pkg.slug}`} variant="cta" size="lg" className="justify-between">
            <span>Select {pkg.name} &amp; Pick Date</span>
            <ArrowRight aria-hidden="true" className="size-4" />
          </ButtonLink>
        </div>

        <div className="space-y-4 rounded-card border border-border bg-surface-muted p-5">
          <p className="eyg-eyebrow text-muted-foreground">What is in the box</p>
          <ItemList pkg={pkg} />
          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            The package price is an estimate. Brake parts, wiper brands other than
            the standard fit, and any repair found during the check are quoted and
            approved by you before any work starts.
          </p>
        </div>
      </div>
    </article>
  );
}

function PackageCard({ pkg }: { pkg: PackageDto }): React.ReactElement {
  const headingId = `pkg-${pkg.slug}`;
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          {pkg.badge ? (
            <Badge tone={pkg.badge === "Most booked" ? "success" : "neutral"} size="sm">
              {pkg.badge}
            </Badge>
          ) : null}
          <span aria-hidden="true" className="text-brand-500">
            <ShoppingBag className="size-4" />
          </span>
        </div>
        <CardTitle id={headingId} level={3} className="text-lg">
          {pkg.name}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{pkg.tagline}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <PackagePrice pkg={pkg} />
        <ItemList pkg={pkg} />
      </CardContent>
      <div className="mt-auto border-t border-border bg-surface-muted p-5 sm:p-6">
        <ButtonLink
          href={`/book?package=${pkg.slug}`}
          variant="secondary"
          size="md"
          fullWidth
          className="justify-between"
        >
          <span>Select {pkg.name}</span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </ButtonLink>
      </div>
    </Card>
  );
}
