/**
 * EYG — SHARED PAGE FURNITURE
 * ============================================================================
 * Presentational blocks used by every content page: page headers, closing CTA
 * bands, breadcrumbs, the "photo not uploaded yet" plate, and the contact
 * link helpers.
 *
 * ⚠️  `PageHeader`, `CtaBand`, `Breadcrumb`, `Prose` and `BrandPlate` all have a
 *     natural home in `src/components/layout/*` (owned by `frontend-core`).
 *     When those land, move these five exports and repoint the imports. The
 *     swap is one import path per block.
 *
 * Contains no hooks and no `"use client"`, so it is safe from both Server and
 * Client Components.
 * ============================================================================
 */

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BUSINESS, ADDRESS_ONE_LINE, LINKS } from "@/config/site";
import {
  ButtonLink,
  Container,
  Eyebrow,
  Section,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/pages/_shims";
import {
  ArrowRight,
  Camera,
  ChevronRight,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  TriangleAlert,
} from "@/components/pages/_icons";

// ─────────────────────────────────────────────────────────────────────────────
// HONESTY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * True when a contact number is obviously a stand-in.
 *
 * `site.ts` ships `+639000000000` flagged `TODO-VERIFY`. The rule below catches
 * any national number made of a single repeated digit (`+63 9 0000 0000`,
 * `+63 2 0000 0000`, …) plus a bare all-zero number, and treats null/empty as
 * unconfirmed. A real number never matches.
 *
 * ⇄ ORCHESTRATOR: delete the `TODO-VERIFY` in `src/config/site.ts` once the
 *   owner confirms, and this returns `false` automatically.
 */
export function phoneIsUnconfirmed(value: string | null | undefined): boolean {
  if (!value) return true;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return true;
  const national = digits.startsWith("63") ? digits.slice(2) : digits.replace(/^0/, "");
  if (national.length === 0) return true;
  if (/^0+$/.test(national)) return true;
  return /^(\d)\1+$/.test(national);
}

/** `true` when the shop's primary number is still unconfirmed. */
export const PRIMARY_PHONE_UNCONFIRMED = phoneIsUnconfirmed(BUSINESS.phoneE164);

/** Reusable honesty line shown wherever a contact number is withheld. */
export const PHONE_UNCONFIRMED_NOTE =
  "The shop's phone number is still being confirmed, so we are not showing a " +
  "number we have not verified. Facebook Messenger and email are live now.";

// ─────────────────────────────────────────────────────────────────────────────
// PHONE / CHANNEL LINKS
// ─────────────────────────────────────────────────────────────────────────────

export interface CallActionProps {
  className?: string;
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/**
 * A `tel:` link — or an honest, disabled block when the number is a placeholder.
 * There is deliberately no code path that renders a `tel:` to an unverified
 * number.
 */
export function CallButton({
  className,
  children = "Call the shop",
  variant = "cta",
  size = "lg",
  fullWidth = false,
}: CallActionProps): React.ReactElement {
  if (PRIMARY_PHONE_UNCONFIRMED) {
    return (
      <div
        role="note"
        className={cn(
          "flex flex-col gap-2 rounded-card border-2 border-dashed border-border-strong bg-surface-muted p-4",
          className,
        )}
      >
        <p className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
          <TriangleAlert aria-hidden="true" className="size-4 text-brand-500" />
          Phone number being confirmed
        </p>
        <p className="text-sm text-muted-foreground">{PHONE_UNCONFIRMED_NOTE}</p>
        <a
          href={BUSINESS.social.messenger}
          className="inline-flex min-h-11 items-center gap-2 self-start font-bold text-foreground underline decoration-brand-500 decoration-2 underline-offset-4"
        >
          <MessageCircle aria-hidden="true" className="size-4" />
          Message us on Messenger
        </a>
      </div>
    );
  }
  return (
    <ButtonLink
      href={LINKS.call}
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      className={className}
    >
      <Phone aria-hidden="true" className="size-4" />
      {children}
    </ButtonLink>
  );
}

/** Inline phone text with a `tel:` link. Renders plain text if unconfirmed. */
export function PhoneValue({ className }: { className?: string }): React.ReactElement {
  if (PRIMARY_PHONE_UNCONFIRMED) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        Number being confirmed
      </span>
    );
  }
  return (
    <a href={LINKS.call} className={cn("font-bold underline decoration-2 underline-offset-4", className)}>
      {BUSINESS.phoneDisplay}
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE HEADER
// ─────────────────────────────────────────────────────────────────────────────

export interface PageHeaderProps {
  eyebrow: string;
  title: string;
  lede?: React.ReactNode;
  /** One or two primary actions, rendered thumb-reachable on mobile. */
  actions?: React.ReactNode;
  /** Small trust line under the actions. */
  footnote?: React.ReactNode;
  /** Renders the `.eyg-stripe` device under the h1. */
  stripe?: boolean;
  className?: string;
}

/** The `<header>` + `<h1>` for every content page. Exactly one h1 per page. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  footnote,
  stripe = true,
  className,
}: PageHeaderProps): React.ReactElement {
  return (
    <header className={cn("border-b border-border bg-surface-muted", className)}>
      <Container className="py-10 sm:py-14">
        <div className="max-w-prose space-y-5">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className={cn("text-h1", stripe && "eyg-stripe")}>{title}</h1>
          {lede ? (
            <div className="text-body-lg text-muted-foreground [&_a]:font-bold [&_a]:underline [&_a]:decoration-brand-500 [&_a]:decoration-2 [&_a]:underline-offset-4">
              {lede}
            </div>
          ) : null}
          {actions ? (
            <div className="flex flex-wrap items-center gap-3 pt-1">{actions}</div>
          ) : null}
          {footnote ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <span aria-hidden="true">ⓘ</span>
              <span>{footnote}</span>
            </p>
          ) : null}
        </div>
      </Container>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BREADCRUMB
// ─────────────────────────────────────────────────────────────────────────────

export interface Crumb {
  name: string;
  path: string;
}

export function Breadcrumb({ trail }: { trail: readonly Crumb[] }): React.ReactElement {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        {trail.map((c, i) => {
          const isLast = i === trail.length - 1;
          return (
            <li key={c.path} className="flex items-center gap-1.5">
              {i > 0 ? (
                <ChevronRight aria-hidden="true" className="size-3.5 opacity-60" />
              ) : null}
              {isLast ? (
                <span aria-current="page" className="font-bold text-foreground">
                  {c.name}
                </span>
              ) : (
                <Link href={c.path} className="rounded-eyebrow underline-offset-4 hover:underline">
                  {c.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROSE
// ─────────────────────────────────────────────────────────────────────────────

/** Max-measure reading column used by the legal pages and long copy blocks. */
export function Prose({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "max-w-prose space-y-5 text-body-lg leading-relaxed",
        "[&_a]:font-bold [&_a]:underline [&_a]:decoration-brand-500 [&_a]:decoration-2 [&_a]:underline-offset-4",
        "[&_strong]:font-bold [&_strong]:text-foreground",
        "[&_h2]:text-h2 [&_h2]:scroll-mt-24 [&_h2]:pt-4",
        "[&_h3]:text-h3 [&_h3]:scroll-mt-24 [&_h3]:pt-2",
        "[&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:marker:text-brand-500",
        "[&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ol]:marker:text-brand-500",
        "[&_table]:w-full [&_table]:text-left [&_table]:text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOSING CTA BAND
// ─────────────────────────────────────────────────────────────────────────────

export interface CtaBandProps {
  title: string;
  body: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
  /** `hazard` = the yellow/black band, used for urgency pages. */
  tone?: "default" | "hazard" | "inverse";
  className?: string;
}

/** The closing "here is what to do next" block every page ends on. */
export function CtaBand({
  title,
  body,
  primary,
  secondary,
  tone = "default",
  className,
}: CtaBandProps): React.ReactElement {
  const id = "cta-band";
  return (
    <Section labelledBy={id} tone={tone === "inverse" ? "inverse" : "raised"} className={className}>
      <Container>
        <div className="relative overflow-hidden rounded-panel border-2 border-border-strong bg-surface p-6 sm:p-10">
          {tone === "hazard" ? (
            <div
              aria-hidden="true"
              className="eyg-hazard absolute inset-x-0 top-0 h-2"
            />
          ) : null}
          <div className="max-w-prose space-y-4 pt-2">
            <h2 id={id} className="text-h2 text-balance">
              {title}
            </h2>
            <p className="text-body-lg text-muted-foreground">{body}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              {primary ? (
                <ButtonLink href={primary.href} variant="cta" size="lg">
                  {primary.label}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </ButtonLink>
              ) : null}
              {secondary ? (
                <ButtonLink href={secondary.href} variant="secondary" size="lg">
                  {secondary.label}
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BRAND PLATE — the honest "no photograph yet" panel
// ─────────────────────────────────────────────────────────────────────────────

export interface BrandPlateProps {
  /** Short label describing the shot that is expected. Never a filename. */
  label: string;
  /**
   * The descriptive alternative text for the photograph this plate stands in for.
   * Rendered as `aria-label` on a `role="img"` box, so the description is exposed
   * to assistive technology today and disappears the moment the real photo lands
   * and `alt` takes over.
   */
  alt?: string;
  /** `before` / `after` gets a tinted treatment so pairs are distinguishable. */
  variant?: "neutral" | "before" | "after";
  /** Intrinsic box. Keeps the plate at the real photograph's aspect ratio. */
  width: number;
  height: number;
  className?: string;
}

/**
 * Rendered in place of a photograph the shop has not taken yet.
 *
 * The rule from the brief is absolute: stock photos must never be presented as
 * this shop's work, and a broken `<img>` is not acceptable either. So the
 * gallery and the deals page render this designed plate instead, at the exact
 * aspect ratio of the real image, which means swapping in the real photo later
 * causes **zero layout shift**.
 */
export function BrandPlate({
  label,
  alt,
  variant = "neutral",
  width,
  height,
  className,
}: BrandPlateProps): React.ReactElement {
  return (
    <div
      role="img"
      aria-label={alt ?? label}
      className={cn(
        "relative flex size-full flex-col items-center justify-center gap-3 p-6 text-center",
        variant === "before" && "bg-ink-800",
        variant === "after" && "bg-pit-900",
        variant === "neutral" && "bg-ink-800",
        className,
      )}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {/* The brand hazard hatch from `globals.css`, used as texture not alert. */}
      <div aria-hidden="true" className="eyg-hazard absolute inset-0 opacity-[0.05]" />
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-pill border-2 border-ink-600 bg-ink-900 text-brand-500"
      >
        <Camera className="size-6" />
      </span>
      <p className="eyg-eyebrow max-w-[22ch] text-brand-500">Photo coming</p>
      <p className="max-w-[34ch] text-sm leading-snug text-ink-200">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MISC
// ─────────────────────────────────────────────────────────────────────────────

/** The one-line NAP block used on /contact, /deals and legal pages. */
export function AddressLine({ className }: { className?: string }): React.ReactElement {
  return (
    <p className={cn("text-muted-foreground", className)}>
      {BUSINESS.address.street}, {BUSINESS.address.district}, {BUSINESS.address.province}{" "}
      {BUSINESS.address.postalCode}
    </p>
  );
}

/** A one-tap directions pair (Google Maps + Waze). */
export function DirectionsLinks({
  className,
  label = "Get directions",
}: {
  className?: string;
  label?: string;
}): React.ReactElement {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <ButtonLink href={LINKS.directionsGoogle} variant="primary" size="md">
        <MapPin aria-hidden="true" className="size-4" />
        Google Maps
        <span className="sr-only">
          {label} to {ADDRESS_ONE_LINE}
        </span>
      </ButtonLink>
      <ButtonLink href={LINKS.directionsWaze} variant="secondary" size="md">
        <Navigation aria-hidden="true" className="size-4" />
        Waze
        <span className="sr-only">{label} to {ADDRESS_ONE_LINE}</span>
      </ButtonLink>
    </div>
  );
}
