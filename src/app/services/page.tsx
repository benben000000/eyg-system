/**
 * EYG — /services  ·  SERVICES & PRICING
 * ============================================================================
 * The upsell engine. Structure, top to bottom:
 *
 *   1. PageHeader + honest "estimates" disclosure
 *   2. Sticky `CategoryFilter` (deep-linkable `?category=`, per-category anchors)
 *   3. "Most booked right now" — the `isPopular` cluster
 *   4. The full catalogue, grouped by category (`#<slug>` per group)
 *   5. `PackageDeals` (the mandated Rainy Season Safety Package band)
 *   6. `PricingExplainer` — why a range, and what moves the price
 *   7. `ServicesFaq` + `faqJsonLd`
 *   8. Closing `CtaBand`
 *
 * Dynamic rendering: the page reads `?category=` so the filter is deep-linkable
 * and survives a refresh. Everything else on it is static.
 * ============================================================================
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { pageSeo, breadcrumbJsonLd } from "@/lib/seo";
import {
  CATALOG_PRICING_NOTICE,
  SERVICE_CATEGORIES,
  getPackages,
  getPopularServices,
  getServices,
} from "@/content/catalog";
import { Alert, ButtonLink, Container, Eyebrow, Section } from "@/components/pages/_shims";
import { Badge } from "@/components/ui/Badge";
import { Divider } from "@/components/ui/Divider";
import { JsonLd } from "@/components/ui/JsonLd";
import { CallButton, CtaBand, PageHeader } from "@/components/pages/_shared";
import { CategoryFilter } from "@/components/pages/services/CategoryFilter";
import { ServiceCard, ServiceQuickCard } from "@/components/pages/services/ServiceCard";
import { PackageDeals } from "@/components/pages/services/PackageDeals";
import { PricingExplainer } from "@/components/pages/services/PricingExplainer";
import { ServicesFaq } from "@/components/pages/services/ServicesFaq";
import { CategoryGridSkeleton } from "@/components/pages/services/ServicesSkeletons";
import { Star, Wrench } from "@/components/pages/_icons";

export const metadata: Metadata = pageSeo({
  title: "Tire & Auto Care Services & Pricing in Balanga",
  description:
    "Tires, PMS, alignment, brakes, undercoating, aircon and roadside in Tuyo, Balanga City. Honest price ranges, itemised inclusions, and one-tap booking.",
  path: "/services",
  keywords: [
    "PMS price Balanga",
    "wheel alignment cost Bataan",
    "tire change price Balanga",
    "undercoating Bataan",
    "brake pad replacement Balanga",
  ],
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}): Promise<React.ReactElement> {
  const params = (await searchParams) ?? {};
  const requested = firstValue(params["category"]);
  const activeSlug = SERVICE_CATEGORIES.some((c) => c.slug === requested) ? requested : null;

  const popular = getPopularServices();
  const allServices = await getServices();
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Services & Pricing", path: "/services" },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} id="ld-breadcrumb-services" />

      <PageHeader
        eyebrow="Services & pricing"
        title="What your car needs — and what it does not"
        lede={
          <>
            Every service we run, with an honest price range, an itemised list of
            what is included, and the time it takes in the bay. Pick a service and
            pick a date in one tap.
          </>
        }
        actions={
          <>
            <ButtonLink href="/book" variant="cta" size="lg">
              Book a bay
            </ButtonLink>
            <ButtonLink href="/deals" variant="secondary" size="lg">
              See current offers
            </ButtonLink>
          </>
        }
        footnote={CATALOG_PRICING_NOTICE}
      />

      <CategoryFilter activeSlug={activeSlug} totalCount={allServices.length} />

      {/* ── Most booked right now ─────────────────────────────────────────── */}
      <Section labelledBy="popular-heading" space="md" className="border-b border-border">
        <Container className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-prose space-y-2">
              <Eyebrow>
                <span className="inline-flex items-center gap-1.5">
                  <Star aria-hidden="true" className="size-3.5" />
                  Most booked right now
                </span>
              </Eyebrow>
              <h2 id="popular-heading" className="text-h2">
                The five jobs that keep our bay busy
              </h2>
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">
              These are the ones drivers book most weeks. If you are not sure what
              you need, start with one of these.
            </p>
          </div>

          {popular.length > 0 ? (
            <ul className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3">
              {popular.map((service) => (
                <ServiceQuickCard key={service.id} service={service} />
              ))}
            </ul>
          ) : (
            <Alert tone="neutral" title="No popularity data yet" icon={<Wrench className="size-5" />}>
              We have not published a &ldquo;most booked&rdquo; list yet. The full
              catalogue below is the same information, unranked.
            </Alert>
          )}
        </Container>
      </Section>

      {/* ── The catalogue ────────────────────────────────────────────────── */}
      <Section
        labelledBy="catalogue-heading"
        id="catalogue"
        space="md"
        className={activeSlug ? "pt-0" : undefined}
      >
        <Container className="space-y-10">
          <div className="max-w-prose space-y-3">
            <Eyebrow>The full catalogue</Eyebrow>
            <h2 id="catalogue-heading" className="text-h2">
              {activeSlug
                ? (SERVICE_CATEGORIES.find((c) => c.slug === activeSlug)?.name ?? "Services")
                : "Everything we do in the bay"}
            </h2>
            {activeSlug ? (
              <p className="text-body-lg text-muted-foreground">
                Showing one category.{" "}
                <Link
                  href="/services"
                  className="font-bold underline decoration-brand-500 decoration-2 underline-offset-4"
                >
                  Show all {allServices.length} services
                </Link>
                .
              </p>
            ) : (
              <p className="text-body-lg text-muted-foreground">
                Grouped the way a driver thinks about them, not the way a workshop
                organises its bays. Tap any service to book it with a date.
              </p>
            )}
          </div>

          <Suspense fallback={<CategoryGridSkeleton />}>
            <Catalogue activeSlug={activeSlug} />
          </Suspense>
        </Container>
      </Section>

      <Divider variant="checker" inset="none" />

      <Suspense fallback={null}>
        <Packages />
      </Suspense>

      <PricingExplainer />
      <ServicesFaq />

      <CtaBand
        title="Not sure which one? Book the check."
        body="A one-hour pre-trip check answers the question properly, costs less than guessing wrong, and leaves you with a written list. Most of what we find can wait — we will tell you what can wait."
        primary={{ label: "Book a bay", href: "/book" }}
        secondary={{ label: "See location & hours", href: "/contact" }}
      />

      {/* Lane A — the emergency escape hatch, deliberately last on the page so
          it never competes with the booking CTA above it. `CallButton` renders
          an honest "number being confirmed" block instead of a dead `tel:` link
          while `site.ts` still carries the TODO-VERIFY placeholder. */}
      <Section labelledBy="call-heading" space="sm" tone="muted">
        <Container>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h2 id="call-heading" className="text-h3">
                Stranded right now? Skip the form.
              </h2>
              <p className="text-sm text-muted-foreground">
                Someone at the shop answers the phone during working hours.
              </p>
            </div>
            <CallButton size="lg" />
          </div>
        </Container>
      </Section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC SLICES
// ─────────────────────────────────────────────────────────────────────────────

async function Catalogue({ activeSlug }: { activeSlug: string | null }): Promise<React.ReactElement> {
  const services = await getServices();
  const groups = activeSlug
    ? SERVICE_CATEGORIES.filter((c) => c.slug === activeSlug)
    : [...SERVICE_CATEGORIES];

  const visible = groups
    .map((cat) => ({
      category: cat,
      services: services.filter((s) => s.category.slug === cat.slug),
    }))
    .filter((g) => g.services.length > 0);

  if (visible.length === 0) {
    // Designed empty state. Never a blank section.
    return (
      <div className="rounded-panel border-2 border-dashed border-border-strong bg-surface-muted p-8 sm:p-12">
        <div className="max-w-prose space-y-4">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-pill bg-surface text-brand-500 ring-2 ring-border-strong"
          >
            <Wrench className="size-6" />
          </span>
          <h3 className="text-h3">No services are published in this category yet</h3>
          <p className="text-muted-foreground">
            We do not list a service we cannot do properly. This category is being
            set up. Everything else on the page is live — or tell us what you need
            and we will do it.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/services" variant="cta" size="md">
              Show all services
            </ButtonLink>
            <CallButton variant="secondary" size="md">Ask us directly</CallButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-16">
      {visible.map(({ category, services: items }, index) => {
        const headingId = `cat-${category.slug}`;
        return (
          <section
            key={category.slug}
            id={category.slug}
            aria-labelledby={headingId}
            className="scroll-mt-32 space-y-6"
          >
            <div className="max-w-prose space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Eyebrow as="span">
                  {String(index + 1).padStart(2, "0")} · {category.name}
                </Eyebrow>
                <Badge tone="neutral" size="sm">
                  {items.length} {items.length === 1 ? "service" : "services"}
                </Badge>
              </div>
              <h3 id={headingId} className="text-h2">
                {category.name}
              </h3>
              <p className="text-body-lg text-muted-foreground">{category.blurb}</p>
            </div>

            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((service) => (
                <li key={service.id} className="flex">
                  <ServiceCard service={service} className="w-full" />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

async function Packages(): Promise<React.ReactElement> {
  const packages = await getPackages();
  return <PackageDeals packages={packages} />;
}
