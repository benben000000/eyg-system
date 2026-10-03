/**
 * EYG — SERVICES CATEGORY FILTER BAR
 * ============================================================================
 * A sticky, horizontally scrollable row of real `<Link>`s.
 *
 * WHY LINKS AND NOT A CLIENT COMPONENT: the filter is deep-linkable
 * (`?category=tires-alignment`) and each pill also carries the `#<slug>` anchor
 * for the section it scrolls to. Rendering them as links means the filter works
 * with JavaScript disabled, survives a refresh, and gives the customer a
 * shareable URL. Next's `<Link>` upgrades to client-side navigation when JS is
 * available and falls back to a normal navigation when it is not.
 *
 * The active pill is marked with `aria-current="true"` — not colour alone; it
 * also gets a heavier weight and a leading tick.
 * ============================================================================
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORIES } from "@/content/catalog";
import { Check } from "@/components/pages/_icons";

export interface CategoryFilterProps {
  /** `null` = "All services". */
  activeSlug: string | null;
  /** Per-category service counts, used for the `All` pill only. */
  totalCount: number;
}

export function CategoryFilter({
  activeSlug,
  totalCount,
}: CategoryFilterProps): React.ReactElement {
  return (
    <div
      // Sits directly under the sticky site header. `globals.css` already sets
      // `scroll-padding-top` to header + 1rem, so anchors land correctly.
      className="sticky top-(--header-height) z-(--z-sticky-header) border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <nav aria-label="Service categories" className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <ul
          className="no-scrollbar -mx-1 flex snap-x snap-mandatory items-center gap-2 overflow-x-auto py-2.5"
          // Horizontal scroll on mobile, wrap on desktop. Both are keyboard
          // reachable because the pills are links.
        >
          <li className="snap-start">
            <FilterPill href="/services" active={activeSlug === null} label="All services" count={totalCount} />
          </li>
          {SERVICE_CATEGORIES.map((cat) => (
            <li key={cat.slug} className="snap-start">
              <FilterPill
                href={`/services?category=${cat.slug}#${cat.slug}`}
                active={activeSlug === cat.slug}
                label={cat.name}
              />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function FilterPill({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}): React.ReactElement {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      scroll={!href.includes("#")}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border-2 px-4 py-2 text-sm transition-colors",
        active
          ? "border-brand-500 bg-brand-500 font-bold text-ink-950"
          : "border-border-strong bg-surface text-foreground hover:border-brand-500 hover:text-brand-500",
      )}
    >
      {active ? <Check aria-hidden="true" className="size-3.5" /> : null}
      {label}
      {typeof count === "number" ? (
        <span
          className={cn(
            "tabular rounded-pill px-1.5 text-xs font-bold",
            active ? "bg-ink-950/15 text-ink-950" : "bg-surface-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
