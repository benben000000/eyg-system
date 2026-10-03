/**
 * EYG — LEGAL PAGE LAYOUT
 * ============================================================================
 * Shared furniture for `/privacy` and `/terms`:
 *
 *   • one `<h1>`, then `<h2>` per numbered section
 *   • a table of contents built from the same array that renders the sections,
 *     so the two can never disagree
 *   • a last-updated date in the shop's timezone
 *   • a print-friendly single-column measure — `globals.css` already neutralises
 *     animation, and `print:` utilities here drop the navigation and the CTAs
 *   • `scroll-mt-24` on every heading so the sticky header does not eat the
 *     target when an anchor is followed
 *
 * The prose is deliberately plain English. A shop owner should read this and think
 * "yes, that is fair" — not "who wrote this for me".
 * ============================================================================
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { BUSINESS, ADDRESS_ONE_LINE, TIMEZONE } from "@/config/site";
import { JsonLd } from "@/components/ui/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo";
import { Container, Eyebrow } from "@/components/pages/_shims";
import { Breadcrumb, CallButton, Prose } from "@/components/pages/_shared";

export interface LegalSection {
  id: string;
  heading: string;
  /** A one-line summary shown under the TOC entry. */
  summary: string;
  body: React.ReactNode;
}

export interface LegalPageProps {
  path: string;
  breadcrumbName: string;
  eyebrow: string;
  title: string;
  lede: string;
  /** ISO date of the last substantive change, `YYYY-MM-DD`. */
  lastUpdated: string;
  sections: readonly LegalSection[];
  /** Rendered after the last section. Usually the contact block. */
  after?: React.ReactNode;
  className?: string;
}

export function LegalPage({
  path,
  breadcrumbName,
  eyebrow,
  title,
  lede,
  lastUpdated,
  sections,
  after,
  className,
}: LegalPageProps): React.ReactElement {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: breadcrumbName, path },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} id={`ld-breadcrumb${path.replace(/\W/g, "")}`} />

      <header className="border-b border-border bg-surface-muted">
        <Container className="py-10 sm:py-14">
          <div className="max-w-prose space-y-5">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="eyg-stripe text-h1">{title}</h1>
            <p className="text-body-lg text-muted-foreground">{lede}</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>Last updated</span>
              <time dateTime={lastUpdated} className="font-bold text-foreground">
                {formatLongDate(lastUpdated)}
              </time>
              <span aria-hidden="true">·</span>
              <span>All times are {TIMEZONE} (UTC+8).</span>
            </p>
          </div>
        </Container>
      </header>

      <Container className="py-8 print:py-0">
        <Breadcrumb trail={crumbs} />
      </Container>

      <div className={cn("pb-16", className)}>
        <Container>
          <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16 print:grid-cols-1 print:gap-0">
            {/* ── Table of contents ──────────────────────────────────────── */}
            <nav
              aria-labelledby="legal-toc-heading"
              className="lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:self-start print:hidden"
            >
              <h2
                id="legal-toc-heading"
                className="eyg-eyebrow border-b border-border pb-2 text-muted-foreground"
              >
                On this page
              </h2>
              <ol className="mt-3 space-y-1.5">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="flex gap-2 rounded-eyebrow py-1.5 text-sm text-muted-foreground transition-colors hover:text-brand-500"
                    >
                      <span aria-hidden="true" className="tabular font-bold text-brand-500">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{s.heading}</span>
                    </a>
                  </li>
                ))}
              </ol>

              <div className="mt-6 space-y-3 rounded-card border border-border bg-surface p-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Questions about any of this? Ask a person.
                </p>
                <CallButton size="md" fullWidth>Call the shop</CallButton>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {BUSINESS.legalName}
                  <br />
                  {ADDRESS_ONE_LINE}
                </p>
              </div>
            </nav>

            {/* ── The document ───────────────────────────────────────────── */}
            <article className="min-w-0">
              <Prose>
                {sections.map((s) => (
                  <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="scroll-mt-24">
                    <h2 id={`${s.id}-heading`}>{s.heading}</h2>
                    <p className="text-base font-bold text-muted-foreground">{s.summary}</p>
                    {s.body}
                  </section>
                ))}
              </Prose>
              {after}
            </article>
          </div>
        </Container>
      </div>
    </>
  );
}

/** The reusable "how to reach us for a rights request" block. */
export function LegalContactBlock({
  heading = "How to contact us about your data",
  intro = "Write to us, or come into the shop with your ID. We do not run a ticketing system and we do not make you fill in a portal — a person reads it and answers it.",
}: {
  heading?: string;
  intro?: string;
}): React.ReactElement {
  return (
    <section aria-labelledby="legal-contact-heading" className="mt-12 rounded-panel border-2 border-border-strong bg-surface p-6 print:border">
      <h2 id="legal-contact-heading" className="!pt-0 text-h3">
        {heading}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{intro}</p>
      <address className="mt-4 space-y-1 text-sm not-italic leading-relaxed">
        <span className="block font-display font-extrabold">
          {BUSINESS.legalName} — Data Privacy Officer
        </span>
        <span className="block">{BUSINESS.address.street}</span>
        <span className="block">
          {BUSINESS.address.district}, {BUSINESS.address.province}{" "}
          {BUSINESS.address.postalCode}, {BUSINESS.address.countryName}
        </span>
        <span className="block">
          Email:{" "}
          <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
        </span>
      </address>
      <p className="mt-4 text-sm text-muted-foreground">
        If you are not satisfied with how we handled your request, you may complain to
        the National Privacy Commission, whose office is at 12th Floor, CyberOne
        Eastwood, Eastwood City, Quezon City, or through{" "}
        <a href="https://privacy.gov.ph" rel="noopener noreferrer" target="_blank">
          privacy.gov.ph
        </a>
        .
      </p>
    </section>
  );
}

/** `2026-10-02` → `2 October 2026`. */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}
