/** The locked page map from docs/AGENT-BRIEF.md §3. Order is deliberate. */
export interface NavItem {
  label: string;
  href: string;
  /** Exact-match only (the homepage). */
  end?: boolean;
}

export const PRIMARY_NAV: ReadonlyArray<NavItem> = [
  { label: "Home", href: "/", end: true },
  { label: "Services", href: "/services" },
  { label: "Book", href: "/book" },
  { label: "Deals", href: "/deals" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
];

/** The single highest-intent action in the header. */
export const HEADER_CTA = { label: "Book a Service Bay", href: "/book" } as const;
