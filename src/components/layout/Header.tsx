"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Phone, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/Tooltip";
import { BrandLockup } from "./BrandLockup";
import { HEADER_CTA, PRIMARY_NAV, type NavItem } from "./nav";
import { PHONE_DISPLAY, PHONE_HREF, CONTACT_PENDING_NOTE } from "./business";
import { track } from "@/components/providers/analytics";

/** Scroll past this and the header becomes solid. */
const SCROLL_THRESHOLD = 24;

export interface HeaderProps {
  /** Extra classes for the `<header>` element (page agents may add a z-index). */
  className?: string;
}

/**
 * Sticky site header.
 *
 * • Transparent over the homepage hero, solid everywhere else and everywhere
 *   once the user scrolls (rAF-throttled, passive listener — it never thrashes).
 * • The mobile nav is a Radix Dialog: focus-trapped, Escape-closable, scroll
 *   locked, and it returns focus to the hamburger on close.
 * • A `TODO-VERIFY` phone number renders a visually identical but DISABLED
 *   button with an explanatory tooltip. There is no dead `tel:` anywhere.
 */
export function Header({ className }: HeaderProps): React.ReactElement {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const isHome = pathname === "/";
  const transparent = isHome && !scrolled && !menuOpen;

  // Passive + rAF-throttled. One state write per frame at most, and none while
  // the offset has not actually changed.
  React.useEffect(() => {
    let ticking = false;
    const read = () => {
      ticking = false;
      const next = window.scrollY > SCROLL_THRESHOLD;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      ticking = false;
    };
  }, []);

  // Close the drawer on navigation.
  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (item: NavItem) =>
    item.end ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <header
      className={cn(
        "sticky top-0 z-[var(--z-sticky-header)] transition-[background-color,border-color,box-shadow] duration-200 ease-snap",
        transparent
          ? "border-b border-transparent bg-transparent"
          : "border-b border-border bg-background/95 shadow-plate backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-[var(--header-height)] w-full max-w-page items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* ── Logo ─────────────────────────────────────────────────────── */}
        <Link
          href="/"
          aria-label="EYG Tire &amp; Auto Care — home"
          className="shrink-0 rounded-eyebrow"
        >
          <BrandLockup width={124} tone={transparent ? "inverse" : "default"} />
        </Link>

        {/* ── Desktop nav ──────────────────────────────────────────────── */}
        <nav aria-label="Main" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "eyg-eyebrow relative inline-flex h-10 items-center rounded-eyebrow px-3 transition-colors",
                      transparent ? "text-white/85 hover:text-white" : "text-muted-foreground hover:text-foreground",
                      active && (transparent ? "text-white" : "text-foreground"),
                    )}
                  >
                    {item.label}
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-2 -bottom-0.5 h-0.5 bg-brand-500"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Desktop CTAs ─────────────────────────────────────────────── */}
        <div className="ml-auto hidden items-center gap-2 sm:flex lg:ml-4">
          {PHONE_HREF ? (
            <a
              href={PHONE_HREF}
              onClick={() => track("call_clicked", { placement: "header" })}
              className={cn(
                "eyg-eyebrow inline-flex h-11 items-center gap-2 rounded-eyebrow border px-3 transition-colors",
                transparent
                  ? "border-white/30 text-white hover:border-white hover:bg-white/10"
                  : "border-ink-400 text-foreground hover:border-foreground hover:bg-surface-muted",
              )}
            >
              <Phone aria-hidden="true" className="size-4 shrink-0 text-brand-500" />
              <span className="hidden md:inline">Call</span>
              <span className="md:hidden">{PHONE_DISPLAY}</span>
            </a>
          ) : (
            <Tooltip content={CONTACT_PENDING_NOTE}>
              <span
                data-unverified="true"
                tabIndex={0}
                className={cn(
                  "eyg-eyebrow inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-eyebrow border px-3",
                  transparent
                    ? "border-white/20 text-white/45"
                    : "border-ink-400/60 text-muted-foreground",
                )}
              >
                <Phone aria-hidden="true" className="size-4 shrink-0" />
                <span className="hidden md:inline">Call</span>
                <span className="md:hidden">Call</span>
                <span className="sr-only"> — {CONTACT_PENDING_NOTE}</span>
              </span>
            </Tooltip>
          )}

          <Button asChild variant="accent" size="md">
            <Link href={HEADER_CTA.href} onClick={() => track("cta_clicked", { placement: "header", cta: "book_bay" })}>
              {HEADER_CTA.label}
            </Link>
          </Button>
        </div>

        {/* ── Mobile trigger ───────────────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-1 sm:hidden">
          {PHONE_HREF ? (
            <IconButton
              asChild
              label={`Call the shop, ${PHONE_DISPLAY}`}
              variant="accent"
              size="md"
            >
              <a href={PHONE_HREF} onClick={() => track("call_clicked", { placement: "header_mobile" })}>
                <Phone aria-hidden="true" className="size-5" />
              </a>
            </IconButton>
          ) : (
            <Tooltip content={CONTACT_PENDING_NOTE}>
              <span
                data-unverified="true"
                tabIndex={0}
                className="inline-flex size-11 cursor-not-allowed items-center justify-center rounded-eyebrow border border-ink-400/60 text-muted-foreground"
              >
                <Phone aria-hidden="true" className="size-5" />
                <span className="sr-only">Call the shop — number being confirmed</span>
              </span>
            </Tooltip>
          )}

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <IconButton label="Open menu" variant="outline" size="md" aria-expanded={menuOpen} aria-haspopup="dialog">
                <Menu aria-hidden="true" className="size-5" />
              </IconButton>
            </SheetTrigger>
            <SheetContent side="right" title="Menu" description="Jump to any part of the site.">
              <nav aria-label="Mobile" className="flex flex-col">
                <ul className="flex flex-col divide-y divide-border">
                  {PRIMARY_NAV.map((item) => {
                    const active = isActive(item);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex min-h-14 items-center justify-between py-3 text-h3 font-extrabold transition-colors",
                            active ? "text-brand-500" : "text-foreground hover:text-brand-500",
                          )}
                        >
                          {item.label}
                          {active ? <span className="eyg-eyebrow">Current</span> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-6 flex flex-col gap-3">
                  <Button asChild variant="accent" size="lg" fullWidth>
                    <Link
                      href={HEADER_CTA.href}
                      onClick={() => track("cta_clicked", { placement: "mobile_menu", cta: "book_bay" })}
                    >
                      {HEADER_CTA.label}
                    </Link>
                  </Button>

                  {PHONE_HREF ? (
                    <Button asChild variant="outline" size="lg" fullWidth>
                      <a href={PHONE_HREF} onClick={() => track("call_clicked", { placement: "mobile_menu" })}>
                        <Phone aria-hidden="true" className="size-5" />
                        Call {PHONE_DISPLAY}
                      </a>
                    </Button>
                  ) : (
                    <Tooltip content={CONTACT_PENDING_NOTE}>
                      <span
                        data-unverified="true"
                        tabIndex={0}
                        className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-eyebrow border border-ink-400/60 text-muted-foreground"
                      >
                        <TriangleAlert aria-hidden="true" className="size-5" />
                        Call — number being confirmed
                      </span>
                    </Tooltip>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Hairline of brand yellow on the solid header. */}
      <div
        aria-hidden="true"
        className={cn(
          "h-0.5 w-full bg-gradient-to-r from-brand-500 via-brand-400 to-transparent transition-opacity duration-200",
          transparent ? "opacity-0" : "opacity-100",
        )}
      />
    </header>
  );
}
