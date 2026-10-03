/**
 * EYG — PROMOTION CARDS
 * ============================================================================
 * `PromoHero`     — the highest-priority live promotion, hazard-hatch treatment.
 * `PromoCard`     — the remaining live promos, terms ALWAYS visible.
 * `PromoUpcoming` — a promotion whose window has not opened yet.
 * `PromoEnded`    — a promotion whose window has closed. Designed and honest,
 *                   not a 404 and not a silent disappearance.
 *
 * TERMS ARE NEVER BEHIND A LINK. A discount whose conditions are hidden is not a
 * discount a small shop can afford to run, and a customer who finds the catch at
 * the counter comes back angry. The full `terms` array renders inline on every
 * card, above the claim form.
 * ============================================================================
 */

import Link from "next/link";
import Image from "next/image";
import { cn, formatPeso } from "@/lib/utils";
import type { PromotionSeed } from "@/content/marketing/promotions";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink, Card, CardContent, CardHeader, CardTitle } from "@/components/pages/_shims";
import { BrandPlate } from "@/components/pages/_shared";
import { ArrowRight, Calendar, Check, Clock, Tag } from "@/components/pages/_icons";
import { PromoCountdown } from "@/components/pages/deals/PromoCountdown";
import { ClaimForm } from "@/components/pages/deals/ClaimForm";

/** "₱950 off" / "10% off" / "₱300 off, both sides". */
function savingLabel(promo: PromotionSeed): string | null {
  if (promo.valuePct !== null && promo.valuePct > 0) return `${promo.valuePct}% off`;
  if (promo.valueOff !== null && promo.valueOff > 0) return `${formatPeso(promo.valueOff)} off`;
  return null;
}

function windowLabel(promo: PromotionSeed): string {
  const start = formatDate(promo.startsAt);
  const end = formatDate(promo.endsAt);
  if (start && end) return `${start} to ${end}`;
  if (end) return `Until ${end}`;
  if (start) return `From ${start}`;
  return "No end date published — ask at the counter";
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Rendered in the shop's timezone so a Manila date never shifts a day.
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** `/book` with the promo code pre-applied, or plain `/book` when there is none. */
export function bookHrefFor(promo: PromotionSeed): string {
  return promo.code ? `/book?promo=${encodeURIComponent(promo.code)}` : "/book";
}

function TermsList({ promo }: { promo: PromotionSeed }): React.ReactElement {
  return (
    <div className="space-y-2 rounded-card border border-border bg-surface-muted p-4">
      <p className="eyg-eyebrow text-muted-foreground">
        Terms — the whole thing, in writing
      </p>
      <ol className="space-y-1.5">
        {promo.terms.map((term, i) => (
          <li key={term} className="flex gap-2 text-sm leading-relaxed">
            <span aria-hidden="true" className="tabular shrink-0 font-bold text-brand-500">
              {i + 1}.
            </span>
            <span>{term}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CodeChip({ code }: { code: string | null }): React.ReactElement | null {
  if (!code) return null;
  return (
    <p className="flex flex-wrap items-center gap-2">
      <span className="eyg-eyebrow text-muted-foreground">Code</span>
      <span className="tabular rounded-pill bg-ink-950 px-3 py-1 font-display text-sm font-extrabold tracking-widest text-brand-500">
        {code}
      </span>
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

export interface PromoHeroProps {
  promo: PromotionSeed;
}

export function PromoHero({ promo }: PromoHeroProps): React.ReactElement {
  const saving = savingLabel(promo);
  const headingId = `promo-hero-${promo.slug}`;
  return (
    <article
      aria-labelledby={headingId}
      className="relative overflow-hidden rounded-panel border-2 border-brand-500 bg-surface shadow-lift"
    >
      {/* Hazard hatch: the brand device, reserved for the top offer. */}
      <div aria-hidden="true" className="eyg-hazard h-3 w-full" />

      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" size="md" dot>
              {promo.badge ?? "Current offer"}
            </Badge>
            {saving ? (
              <Badge tone="success" size="md">
                <Tag aria-hidden="true" className="size-3" />
                {saving}
              </Badge>
            ) : null}
          </div>

          <div className="space-y-3">
            {/* `h3` because the wrapping <Section> already owns an `h2`; the
                `text-h2` class keeps the visual weight. */}
            <h3 id={headingId} className="text-h2">
              {promo.title}
            </h3>
            <p className="text-body-lg text-muted-foreground">{promo.subtitle}</p>
            <p className="text-body-lg leading-relaxed">{promo.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {promo.endsAt ? (
              <PromoCountdown endsAt={promo.endsAt} className="rounded-card border-2 border-border-strong bg-surface-muted p-3" />
            ) : null}
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar aria-hidden="true" className="size-4" />
              {windowLabel(promo)}
            </p>
          </div>

          <CodeChip code={promo.code} />

          <div className="flex flex-wrap gap-3">
            <ButtonLink href={bookHrefFor(promo)} variant="cta" size="lg">
              Book with this offer
              <ArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
            <ButtonLink href="/services" variant="secondary" size="lg">
              See what is included
            </ButtonLink>
          </div>
        </div>

        <div className="space-y-4">
          {promo.imageUrl ? (
            // The owner has supplied a hero image for this promo. `next/image`
            // with explicit dimensions keeps the box reserved, so the swap from
            // BrandPlate to a real photo causes no layout shift.
            <div
              className="overflow-hidden rounded-panel border border-border"
              style={{ aspectRatio: "16 / 10" }}
            >
              <Image
                src={promo.imageUrl}
                alt={`${promo.title} — ${promo.subtitle}`}
                width={1200}
                height={750}
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="size-full object-cover"
              />
            </div>
          ) : (
            <BrandPlate
              label="Photo of the work this offer covers"
              width={1200}
              height={750}
              className="rounded-panel border border-border"
            />
          )}

          <TermsList promo={promo} />
          <ClaimForm slug={promo.slug} promoCode={promo.code} idPrefix={`claim-${promo.slug}`} />
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDARD LIVE CARD
// ─────────────────────────────────────────────────────────────────────────────

export function PromoCard({ promo }: { promo: PromotionSeed }): React.ReactElement {
  const saving = savingLabel(promo);
  const headingId = `promo-${promo.slug}`;
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          {promo.badge ? (
            <Badge tone={promo.badge === "Most booked" ? "success" : "brand"} size="sm">
              {promo.badge}
            </Badge>
          ) : null}
          {saving ? (
            <Badge tone="success" size="sm">
              {saving}
            </Badge>
          ) : null}
        </div>
        <CardTitle id={headingId} level={3} className="text-xl">
          {promo.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{promo.subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed">{promo.description}</p>

        {promo.endsAt ? (
          <PromoCountdown endsAt={promo.endsAt} />
        ) : null}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar aria-hidden="true" className="size-3.5" />
          {windowLabel(promo)}
        </p>

        <TermsList promo={promo} />
        <CodeChip code={promo.code} />
      </CardContent>
      <div className="mt-auto space-y-3 border-t border-border bg-surface-muted p-5 sm:p-6">
        <ClaimForm slug={promo.slug} promoCode={promo.code} compact idPrefix={`claim-${promo.slug}`} />
        <ButtonLink href="/book" variant="ghost" size="sm" fullWidth className="justify-between">
          Or book a slot with no offer code
          <ArrowRight aria-hidden="true" className="size-4" />
        </ButtonLink>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPCOMING
// ─────────────────────────────────────────────────────────────────────────────

export function PromoUpcoming({ promo }: { promo: PromotionSeed }): React.ReactElement {
  const start = formatDate(promo.startsAt);
  const headingId = `promo-upcoming-${promo.slug}`;
  return (
    <article
      aria-labelledby={headingId}
      className="flex h-full flex-col rounded-panel border-2 border-dashed border-border-strong bg-surface p-5"
    >
      <div className="space-y-3">
        <Badge tone="neutral" size="sm">
          <Clock aria-hidden="true" className="size-3" />
          Not started yet
        </Badge>
        <h3 id={headingId} className="text-h3">
          {promo.title}
        </h3>
        <p className="text-sm text-muted-foreground">{promo.subtitle}</p>
        {start ? (
          <p className="text-sm font-bold">
            Opens {start} — book ahead and we will hold the price for you.
          </p>
        ) : null}
        <p className="text-sm leading-relaxed text-muted-foreground">{promo.description}</p>
        <TermsList promo={promo} />
      </div>
      <div className="mt-auto pt-4">
        <ButtonLink href="/book" variant="secondary" size="md" fullWidth>
          Book a slot for {start ? start.split(" ")[1] ?? "then" : "later"}
        </ButtonLink>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ended state. It is a real, designed card that states the closing date and
 * points at what is available now — never a 404, never a silent removal, and
 * never a dead claim form that would fail on submit.
 */
export function PromoEnded({ promo }: { promo: PromotionSeed }): React.ReactElement {
  const end = formatDate(promo.endsAt);
  const headingId = `promo-ended-${promo.slug}`;
  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "flex h-full flex-col rounded-panel border border-border bg-surface-muted p-5 opacity-90",
        "saturate-[0.6]",
      )}
    >
      <div className="space-y-3">
        <Badge tone="neutral" size="sm">
          Offer ended
        </Badge>
        <h3 id={headingId} className="text-h3 text-muted-foreground">
          {promo.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {end
            ? `This offer ended on ${end}. We do not extend these quietly — the date it closed is the date we said it would.`
            : "This offer is no longer running. The terms it had are kept below for reference."}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">{promo.description}</p>
        <details className="group/ended">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-bold text-foreground marker:content-none hover:underline">
            <Check aria-hidden="true" className="size-4" />
            The terms it had
          </summary>
          <div className="pt-3">
            <TermsList promo={promo} />
          </div>
        </details>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <ButtonLink href="/services" variant="secondary" size="md">
          See what is running now
        </ButtonLink>
        <Link
          href="/book"
          className="inline-flex min-h-12 items-center gap-2 rounded-eyebrow px-4 font-display text-sm font-extrabold uppercase tracking-wide underline decoration-2 underline-offset-4"
        >
          Book at the normal price
        </Link>
      </div>
    </article>
  );
}
