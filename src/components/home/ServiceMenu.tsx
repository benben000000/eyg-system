import type { ReactElement } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleDot,
  Disc3,
  MoveDiagonal,
  ShieldCheck,
  Snowflake,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { PriceTag } from "@/components/ui/PriceTag";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { HOMEPAGE_CATEGORIES, type HomeCategory } from "./catalog";
import { TrackedCta } from "@/components/providers/TrackedCta";

/** Icon names are strings in the catalogue (it mirrors `ServiceCategory.icon`). */
const ICONS: Record<string, LucideIcon> = {
  CircleDot,
  Disc3,
  MoveDiagonal,
  ShieldCheck,
  Snowflake,
  Wrench,
};

function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Wrench;
}

export interface ServiceMenuProps {
  /** Defaults to the local fallback catalogue. Pass live data when the API is up. */
  categories?: ReadonlyArray<HomeCategory>;
}

/**
 * The service menu — the homepage's main LANE B entry point.
 *
 * Prices come from the catalogue. `docs/AGENT-BRIEF.md` §5 forbids inventing
 * them, so unconfirmed jobs read "Ask us" (see `catalog.ts`) and the card's
 * job is to send the visitor to `/services#<slug>` where the seeded range is.
 */
export function ServiceMenu({ categories = HOMEPAGE_CATEGORIES }: ServiceMenuProps): ReactElement {
  return (
    <Section labelledBy="services-title" tone="muted">
      <SectionHeading
        id="services-title"
        eyebrow="What we do"
        title="The jobs that keep a car on the road"
        description="Six things we do every week. Pick one to see the full range, or book straight away and tell us in the notes what you need."
      />

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <li key={category.slug} className="h-full">
            <ServiceCard category={category} />
          </li>
        ))}
      </ul>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Something else?{" "}
        <Link
          href="/contact"
          className="font-semibold text-foreground underline underline-offset-4 hover:text-brand-600"
        >
          Ask us if we can do it
        </Link>{" "}
        — we would rather say no than do it badly.
      </p>
    </Section>
  );
}

function ServiceCard({ category }: { category: HomeCategory }): ReactElement {
  const Icon = iconFor(category.icon);

  return (
    <Card
      tone="surface"
      elevation="plate"
      interactive
      padding="none"
      className="flex h-full flex-col"
    >
      <CardHeader className="p-5 pb-0">
        <span
          aria-hidden="true"
          className="inline-flex size-11 items-center justify-center rounded-eyebrow bg-brand-500 text-ink-950"
        >
          <Icon className="size-6" />
        </span>
        <CardTitle className="mt-4">
          <TrackedCta
            href={`/services#${category.slug}`}
            event="cta_clicked"
            params={{ placement: "service_menu", cta: category.slug }}
            unstyled
            className="rounded-eyebrow after:absolute after:inset-0 hover:text-brand-600"
          >
            {category.name}
          </TrackedCta>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-5">
        <CardDescription>{category.summary}</CardDescription>

        <ul className="mt-4 flex flex-wrap gap-1.5">
          {category.highlights.map((item) => (
            <li
              key={item}
              className="rounded-pill border border-border bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
            >
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
          <PriceTag
            priceMin={category.priceMin}
            priceMax={category.priceMax}
            size="md"
            note={category.priceMin === null ? "Confirm the range when you book" : `Typical: ${category.duration}`}
          />
          <span
            aria-hidden="true"
            className="eyg-eyebrow inline-flex items-center gap-1 text-brand-600"
          >
            Details
            <ArrowRight className="size-4" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
