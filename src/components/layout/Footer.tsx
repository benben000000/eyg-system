import * as React from "react";
import Link from "next/link";
import { Facebook, MapPin, MapPinned, MessageCircle, Phone } from "lucide-react";
import { BUSINESS, LINKS, SITE } from "@/config/site";
import { Divider } from "@/components/ui/Divider";
import { Button } from "@/components/ui/Button";
import { BrandLockup } from "./BrandLockup";
import { ThemeToggle } from "./ThemeToggle";
import { getOpenStatus } from "./hours";
import { HOMEPAGE_CATEGORIES } from "@/components/home/catalog";
import {
  ADDRESS_SHORT,
  CONTACT_PENDING_NOTE,
  MESSENGER_HREF,
  PAYMENT_METHODS,
  PHONE_DISPLAY,
  PHONE_HREF,
  WHATSAPP_HREF,
} from "./business";

/**
 * Site footer. A Server Component except for `<ThemeToggle />`.
 *
 * `pb-action-bar` reserves the mobile action bar's height so the bottom row is
 * never hidden behind it on a phone.
 */
export function Footer(): React.ReactElement {
  const status = getOpenStatus(new Date());
  const year = new Date().getFullYear();

  return (
    <footer className="pb-action-bar border-t border-border bg-ink-950 text-white">
      <div className="mx-auto w-full max-w-page px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {/* ── Top: brand + the two things a stranded person needs ────────── */}
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <Link href="/" className="inline-block rounded-eyebrow" aria-label="EYG Tire &amp; Auto Care — home">
              <BrandLockup width={150} tone="inverse" />
            </Link>
            <p className="mt-4 max-w-prose text-body-lg text-ink-200">
              {BUSINESS.tagline} Tire change, PMS, wheel alignment, brakes, undercoating and aircon —
              on the EGSA Fourlanes stretch in Tuyo.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {PHONE_HREF ? (
                <Button asChild variant="accent" size="md">
                  <a href={PHONE_HREF}>
                    <Phone aria-hidden="true" className="size-5" />
                    Call {PHONE_DISPLAY}
                  </a>
                </Button>
              ) : (
                <span
                  data-unverified="true"
                  className="eyg-eyebrow inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-eyebrow border border-white/25 px-4 text-white/60"
                >
                  <Phone aria-hidden="true" className="size-5" />
                  Number being confirmed
                </span>
              )}

              {WHATSAPP_HREF ? (
                <Button asChild variant="outline" size="md" className="border-white/40 text-white hover:border-white hover:bg-white/10">
                  <a href={WHATSAPP_HREF}>
                    <MessageCircle aria-hidden="true" className="size-5" />
                    WhatsApp
                  </a>
                </Button>
              ) : (
                <Button asChild variant="outline" size="md" className="border-white/40 text-white hover:border-white hover:bg-white/10">
                  <a href={MESSENGER_HREF}>
                    <MessageCircle aria-hidden="true" className="size-5" />
                    Messenger
                  </a>
                </Button>
              )}
            </div>

            {!PHONE_HREF ? (
              <p className="mt-3 max-w-prose text-sm text-ink-300">{CONTACT_PENDING_NOTE}</p>
            ) : null}
          </div>

          {/* ── Visit us ────────────────────────────────────────────────── */}
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="eyg-eyebrow mb-3 text-brand-500">Find us</h2>
              <address className="not-italic text-sm leading-relaxed text-ink-200">
                <span className="flex gap-2">
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-500" />
                  <span>
                    {BUSINESS.address.street}
                    <br />
                    {BUSINESS.address.district}, {BUSINESS.address.province} {BUSINESS.address.postalCode}
                  </span>
                </span>
                <span className="mt-3 block text-ink-300">{BUSINESS.address.landmark}</span>
              </address>
              <p className="mt-4 text-sm">
                <span className="eyg-eyebrow text-ink-300">Hours</span>
                <br />
                <span className="text-ink-200">{status.today}</span>
                <br />
                <span className="text-ink-300">
                  {status.isOpen ? status.detail : `Closed — ${status.detail.toLowerCase()}`}
                </span>
              </p>
            </div>

            <div>
              <h2 className="eyg-eyebrow mb-3 text-brand-500">We accept</h2>
              <ul className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <li
                    key={method.id}
                    className="rounded-pill border border-ink-700 bg-ink-900 px-2.5 py-1 text-eyebrow text-ink-200"
                  >
                    {method.label}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-ink-300">
                Credit installment available — ask us at the counter.
              </p>

              <h2 className="eyg-eyebrow mb-3 mt-6 text-brand-500">Theme</h2>
              <ThemeToggle className="[&_legend]:text-ink-300" />
            </div>
          </div>
        </div>

        <Divider variant="checker" inset="lg" className="opacity-60" />

        {/* ── Link columns ──────────────────────────────────────────────── */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <FooterColumn title="Services">
            {HOMEPAGE_CATEGORIES.slice(0, 4).map((category) => (
              <FooterLink key={category.slug} href={`/services#${category.slug}`}>
                {category.name}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="More services">
            {HOMEPAGE_CATEGORIES.slice(4).map((category) => (
              <FooterLink key={category.slug} href={`/services#${category.slug}`}>
                {category.name}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Shop">
            <FooterLink href="/book">Book a service bay</FooterLink>
            <FooterLink href="/deals">Deals &amp; clearance</FooterLink>
            <FooterLink href="/gallery">Before &amp; after gallery</FooterLink>
            <FooterLink href="/about">About EYG</FooterLink>
            <FooterLink href="/contact">Contact &amp; directions</FooterLink>
          </FooterColumn>

          <FooterColumn title="Legal">
            <FooterLink href="/privacy">Privacy policy</FooterLink>
            <FooterLink href="/terms">Terms of service</FooterLink>
            <li>
              <a
                href={BUSINESS.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-ink-200 underline decoration-transparent underline-offset-4 transition-colors hover:text-white hover:decoration-current"
              >
                <Facebook aria-hidden="true" className="size-4" />
                Facebook
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a
                href={LINKS.mapsSearch}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-ink-200 underline decoration-transparent underline-offset-4 transition-colors hover:text-white hover:decoration-current"
              >
                <MapPinned aria-hidden="true" className="size-4" />
                Open in Maps
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          </FooterColumn>
        </div>

        <Divider variant="solid" inset="lg" className="opacity-20" />

        <div className="flex flex-col gap-3 text-sm text-ink-300 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {BUSINESS.legalName}. All rights reserved.
          </p>
          <p className="tabular">
            {ADDRESS_SHORT} · {SITE.url.replace(/^https?:\/\//, "")}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <nav aria-label={title}>
      <h2 className="eyg-eyebrow mb-3 text-brand-500">{title}</h2>
      <ul className="flex flex-col gap-2">{children}</ul>
    </nav>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.ReactElement {
  const external = /^https?:/i.test(href);
  return (
    <li>
      <Link
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="text-sm text-ink-200 underline decoration-transparent underline-offset-4 transition-colors hover:text-white hover:decoration-current"
      >
        {children}
        {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
      </Link>
    </li>
  );
}
