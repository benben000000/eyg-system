"use client";

/**
 * INVENTORY NAVIGATION
 * ============================================================================
 * A3 owns this file. Client only because `usePathname` is what marks the current
 * section, and a nav that does not say where you are makes an operator click
 * every tab to check.
 *
 * Four sections, in the order they are actually used in a working day:
 *   find a product → count the shelf → order what ran out → watch what is ageing.
 *
 * Targets are 44 px tall. A mechanic taps this with a thumb, possibly wearing a
 * glove, while holding something else.
 * ============================================================================
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Hourglass, PackageSearch, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InventoryNavItem {
  href: string;
  label: string;
  /** One line, so a wide screen can show it and a phone still can. */
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const INVENTORY_NAV: ReadonlyArray<InventoryNavItem> = [
  {
    href: "/inventory",
    label: "Stock",
    description: "Find a product and move stock in or out.",
    icon: PackageSearch,
  },
  {
    href: "/inventory/counts",
    label: "Count",
    description: "Count the shelf against the ledger.",
    icon: ClipboardList,
  },
  {
    href: "/inventory/reorder",
    label: "Reorder",
    description: "What to order, and what it will cost.",
    icon: ShoppingCart,
  },
  {
    href: "/inventory/aging",
    label: "Ageing",
    description: "Tyre DOT age and shelf life.",
    icon: Hourglass,
  },
];

/** `/inventory/counts/abc` must light up `/inventory/counts`, not `/inventory`. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/inventory") return pathname === "/inventory" || pathname === "/inventory/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface InventoryNavProps {
  /** Rendered on the right of the bar. Who is signed in, and at what role. */
  signedInAs?: string;
}

export function InventoryNav({ signedInAs }: InventoryNavProps): React.ReactElement {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <nav aria-label="Inventory sections">
        <ul className="-mx-1 flex snap-x gap-1 overflow-x-auto px-1 no-scrollbar sm:flex-wrap sm:overflow-visible">
          {INVENTORY_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Glyph = item.icon;

            return (
              <li key={item.href} className="snap-start">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-eyebrow border px-3 py-2 text-sm font-bold uppercase tracking-widest transition-colors duration-150",
                    active
                      ? "border-ink-950 bg-ink-950 text-white dark:border-brand-500 dark:bg-brand-500 dark:text-ink-950"
                      : "border-ink-400 bg-surface text-foreground hover:bg-surface-muted",
                  )}
                >
                  <Glyph aria-hidden="true" className="size-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {signedInAs ? (
        <p className="shrink-0 text-xs text-muted-foreground sm:text-right">
          Signed in as <span className="font-bold text-foreground">{signedInAs}</span>
        </p>
      ) : null}
    </div>
  );
}