import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { breadcrumbJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { JsonLd } from "./JsonLd";

export interface BreadcrumbItem {
  name: string;
  /** Omit on the current (last) page — it is not a link. */
  href?: string;
}

export interface BreadcrumbsProps extends React.ComponentPropsWithoutRef<"nav"> {
  items: ReadonlyArray<BreadcrumbItem>;
  /** Emit `BreadcrumbList` JSON-LD. Default true. */
  jsonLd?: boolean;
  tone?: "default" | "inverse";
  className?: string;
  "aria-label"?: string;
}

/**
 * Breadcrumb trail in a named `<nav>` landmark, plus the matching
 * `BreadcrumbList` JSON-LD so the SERP shows the hierarchy.
 */
export function Breadcrumbs({
  items,
  jsonLd = true,
  tone = "default",
  className,
  "aria-label": ariaLabel = "Breadcrumb",
  ...props
}: BreadcrumbsProps): React.ReactElement {
  const trail = items.map((item) => ({ name: item.name, path: item.href ?? "" }));
  const lastIndex = items.length - 1;

  return (
    <>
      <nav
        aria-label={ariaLabel}
        className={cn("min-w-0", className)}
        {...props}
      >
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
          {items.map((item, index) => {
            const isLast = index === lastIndex;
            return (
              <li key={`${item.href ?? "current"}-${item.name}`} className="flex min-w-0 items-center gap-1.5">
                {index > 0 ? (
                  <ChevronRight
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 shrink-0",
                      tone === "inverse" ? "text-ink-500" : "text-muted-foreground",
                    )}
                  />
                ) : null}
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className={cn(
                      "truncate underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current",
                      tone === "inverse" ? "text-ink-300 hover:text-white" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.name}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className={cn(
                      "truncate font-bold",
                      tone === "inverse" ? "text-white" : "text-foreground",
                    )}
                  >
                    {item.name}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {jsonLd ? <JsonLd data={breadcrumbJsonLd(trail)} id={`breadcrumb-${trail.length}`} /> : null}
    </>
  );
}
