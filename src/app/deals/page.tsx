/**
 * EYG — /deals  ·  PROMOTIONS & SPECIAL OFFERS
 * ============================================================================
 * The re-engagement lane (Lane C in the funnel brief): a customer who came for a
 * promo, claims it, and is routed into `/book` with the offer pre-applied.
 *
 * "CURRENT OFFER" LOGIC IS DRIVEN BY REAL DATES ONLY.
 *   live     → `isActive` AND start <= now AND (no end OR now <= end)
 *   upcoming → `isActive` AND start > now
 *   ended    → `isActive` AND end <= now
 * `now` is the server clock, and every comparison is on absolute ISO instants
 * carrying an explicit `+08:00`, so no timezone maths is done by hand.
 *
 * `noindex` is NOT set: seasonal offers are legitimate search landing pages
 * ("tyre promo Bataan", "PMS discount Balanga") and should rank.
 *
 * SOURCER: `src/content/marketing/promotions.ts`, owned by the marketing agent.
 * When the Promotions table is live this page should read it from
 * `GET /api/promos` instead — the shapes are identical, so only the loader moves.
 * ============================================================================
 */

import type { Metadata } from "next";
import { pageSeo, breadcrumbJsonLd } from "@/lib/seo";
import { PROMOTIONS, type PromotionSeed } from "@/content/marketing/promotions";
import { CATALOG_PRICING_NOTICE } from "@/content/catalog";
import { Alert, ButtonLink, Container, EmptyState, Eyebrow, Section } from "@/components/pages/_shims";
import { Divider } from "@/components/ui/Divider";
import { JsonLd } from "@/components/ui/JsonLd";
import { Breadcrumb, CallButton, CtaBand, PageHeader } from "@/components/pages/_shared";
import { PromoCard, PromoEnded, PromoHero, PromoUpcoming } from "@/components/pages/deals/PromoCards";
import { promoWindow } from "@/components/pages/deals/promo-window";
import { Calendar, Handshake, ShieldCheck, Tag, TriangleAlert } from "@/components/pages/_icons";

export const metadata: Metadata = pageSeo({
  title: "Promotions & Special Offers",
  description:
    "Current tyre, PMS, undercoating and bundle offers at EYG Tire & Auto Care in Tuyo, Balanga City. Every term shown in full before you claim.",
  path: "/deals",
  keywords: [
    "tyre promo Bataan",
    "PMS discount Balanga",
    "bundle deal auto care Balanga",
    "undercoating promo Tuyo",
  ],
});

/**
 * DYNAMIC: the live/upcoming/ended split is time-dependent, so this page must be
 * rendered per request. A statically built page would show yesterday's offers.
 */
export const dynamic = "force-dynamic";

function classify(promos: readonly PromotionSeed[], now: Date) {
  const live: PromotionSeed[] = [];
  const upcoming: PromotionSeed[] = [];
  const ended: PromotionSeed[] = [];

  // One pass, one source of truth: `promoWindow` owns the date logic.
  for (const promo of promos) {
    const window = promoWindow(promo, now);
    if (window === "live") live.push(promo);
    else if (window === "upcoming") upcoming.push(promo);
    else ended.push(promo);
  }

  const byPriority = (a: PromotionSeed, b: PromotionSeed) => b.priority - a.priority;
  return {
    hero: [...live].sort(byPriority)[0] ?? null,
    rest: live.slice().sort(byPriority).slice(1),
    upcoming: upcoming.sort(byPriority),
    ended: ended.sort(byPriority),
  };
}

export default async function DealsPage(): Promise<React.ReactElement> {
  const now = new Date();
  const { hero, rest, upcoming, ended } = classify(PROMOTIONS, now);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Promotions & Special Offers", path: "/deals" },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} id="ld-breadcrumb-deals" />

      <PageHeader
        eyebrow="Promotions & special offers"
        title="What is running right now"
        lede={
          <>
            Seasonal offers, clearance stock and first-visit pricing. Every one of
            them shows its full terms on this page — nothing is hidden behind a
            link or a phone call.
          </>
        }
        actions={
          <>
            <ButtonLink href="/services" variant="cta" size="lg">
              See services &amp; prices
            </ButtonLink>
            <ButtonLink href="/book" variant="secondary" size="lg">
              Book a bay
            </ButtonLink>
          </>
        }
        footnote={CATALOG_PRICING_NOTICE}
      />

      <Container className="pt-6">
        <Breadcrumb trail={crumbs} />
      </Container>

      {hero === null ? (
        <Section labelledBy="no-offers-heading" space="md">
          <Container>
            <div className="max-w-prose space-y-4">
              <Eyebrow>Nothing live at the moment</Eyebrow>
              <h2 id="no-offers-heading" className="text-h2">
                No promotion is running today
              </h2>
            </div>
            <div className="mt-6 space-y-4">
              <p className="max-w-prose text-muted-foreground">
                When a discount is on, it is on this page with its dates and its full
                terms, and it ends on the day it said it would. We are not going to
                invent urgency to fill this space.
              </p>
              {/* `description` renders inside a `<p>`, so the copy stays inline. */}
              <EmptyState
                title="Nothing live at the moment — but the shop is open"
                body="In the meantime the services page has honest price ranges for everything we do, and a booked bay beats a walk-in queue every time."
                icon={<Tag aria-hidden="true" className="size-6" />}
                action={
                  <>
                    <ButtonLink href="/services" variant="cta" size="md">
                      See services &amp; prices
                    </ButtonLink>
                    <ButtonLink href="/book" variant="secondary" size="md">
                      Book a bay
                    </ButtonLink>
                  </>
                }
              />
            </div>
          </Container>
        </Section>
      ) : (
        <>
          <Section labelledBy="featured-offer-heading" space="md">
            <Container className="space-y-6">
              <div className="max-w-prose space-y-3">
                <Eyebrow>Top offer</Eyebrow>
                <h2 id="featured-offer-heading" className="text-h2">
                  {hero.title}
                </h2>
                <p className="text-body-lg text-muted-foreground">
                  The offer we are putting the most bay time into this month.
                </p>
              </div>
              <PromoHero promo={hero} />
            </Container>
          </Section>

          {rest.length > 0 ? (
            <Section labelledBy="live-offers-heading" space="md" tone="muted">
              <Container className="space-y-6">
                <div className="max-w-prose space-y-3">
                  <Eyebrow>Also running now</Eyebrow>
                  <h2 id="live-offers-heading" className="text-h2">
                    {rest.length} more {rest.length === 1 ? "offer" : "offers"} live
                  </h2>
                  <p className="text-body-lg text-muted-foreground">
                    Each one is priced on its own. They do not stack, and we will tell
                    you which is the better deal for what you actually need.
                  </p>
                </div>
                <ul className="grid gap-6 lg:grid-cols-2">
                  {rest.map((promo) => (
                    <li key={promo.slug} className="flex">
                      <PromoCard promo={promo} />
                    </li>
                  ))}
                </ul>
              </Container>
            </Section>
          ) : null}
        </>
      )}

      {upcoming.length > 0 ? (
        <Section labelledBy="upcoming-heading" space="md">
          <Container className="space-y-6">
            <div className="max-w-prose space-y-3">
              <Eyebrow>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar aria-hidden="true" className="size-3.5" />
                  Coming up
                </span>
              </Eyebrow>
              <h2 id="upcoming-heading" className="text-h2">
                Announced, not started
              </h2>
              <p className="text-body-lg text-muted-foreground">
                We publish these early so you can plan around them. Nothing is live
                yet, and we will not start taking the price before the date below.
              </p>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((promo) => (
                <li key={promo.slug} className="flex">
                  <PromoUpcoming promo={promo} />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {ended.length > 0 ? (
        <Section labelledBy="ended-heading" space="md" tone="muted">
          <Container className="space-y-6">
            <div className="max-w-prose space-y-3">
              <Eyebrow>
                <span className="inline-flex items-center gap-1.5">
                  <TriangleAlert aria-hidden="true" className="size-3.5" />
                  Ended
                </span>
              </Eyebrow>
              <h2 id="ended-heading" className="text-h2">
                Offers that have finished
              </h2>
              <p className="text-body-lg text-muted-foreground">
                We leave these here rather than deleting them, because the dates we
                published are the dates we said we would run to.
              </p>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ended.map((promo) => (
                <li key={promo.slug} className="flex">
                  <PromoEnded promo={promo} />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      <Divider variant="checker" inset="none" />

      {/* ── How our offers work ──────────────────────────────────────────── */}
      <Section labelledBy="promo-rules-heading" space="md">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-12">
            <div className="space-y-3">
              <Eyebrow>How our offers work</Eyebrow>
              <h2 id="promo-rules-heading" className="text-h2">
                Four rules we do not break
              </h2>
              <p className="text-body-lg text-muted-foreground">
                Small shop, few followers, and most of our customers come from someone
                else&rsquo;s recommendation. That only works if a deal means exactly
                what it says.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {PROMO_RULES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="space-y-2 rounded-card border border-border bg-surface p-5">
                  <p className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
                    <Icon aria-hidden="true" className="size-4 text-brand-500" />
                    {title}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      <Divider variant="checker" inset="none" />

      <Section labelledBy="promo-help-heading" space="md" tone="raised">
        <Container>
          <div className="max-w-prose space-y-4">
            <Eyebrow>Not sure which offer applies</Eyebrow>
            <h2 id="promo-help-heading" className="text-h2">
              Tell us the job, we will tell you the best price
            </h2>
            <p className="text-body-lg text-muted-foreground">
              Offers rarely stack, and the cheaper headline is not always the cheaper
              bill. Send us the service and we will work out which route gets you the
              lowest total, including the parts.
            </p>
            <Alert
              tone="neutral"
              title="One thing worth saying plainly"
              icon={<ShieldCheck aria-hidden="true" className="size-5" />}
            >
              <p>
                Every offer on this page is applied <em>before</em> any repair is
                started, and the final price is confirmed with you at the counter. A
                discount that only appears on the invoice is not a discount.
              </p>
            </Alert>
            <div className="flex flex-wrap gap-3 pt-1">
              <ButtonLink href="/book" variant="cta" size="lg">
                Book a bay
              </ButtonLink>
              <CallButton variant="secondary" size="lg">Ask us which applies</CallButton>
            </div>
          </div>
        </Container>
      </Section>

      <CtaBand
        title="Offers are here and gone. The shop is not."
        body="Whatever is running this month, the services page has honest price ranges for everything we do, and a booked bay beats a walk-in queue every time."
        primary={{ label: "See services & pricing", href: "/services" }}
        secondary={{ label: "Book a bay", href: "/book" }}
      />
    </>
  );
}

const PROMO_RULES: ReadonlyArray<{ icon: typeof Tag; title: string; body: string }> = [
  {
    icon: Calendar,
    title: "The end date is real",
    body: "Every offer carries the date it closes, and we do not quietly extend it. If an offer is over, the page says so.",
  },
  {
    icon: Tag,
    title: "Terms are in full, on the page",
    body: "You should never have to ask a shop what a discount excludes. The conditions sit directly on the offer, not behind a link.",
  },
  {
    icon: Handshake,
    title: "One live offer per category",
    body: "We do not run two discounts on the same kind of work at once. It makes the maths confusing and the quality worse.",
  },
  {
    icon: ShieldCheck,
    title: "Estimates stay estimates",
    body: "A discount never changes the honesty of the price. The final figure is confirmed after inspection, before any work begins.",
  },
];

/* NOTE: `DEALS_VIEW_EVENT` was removed from this module. Next.js rejects any
   export from a `page.tsx` that is not on the route-segment allow-list, which
   broke `next build`. The event name lives in `_telemetry.ts`
   (`FUNNEL_EVENTS.dealView`) — import it from there. */
