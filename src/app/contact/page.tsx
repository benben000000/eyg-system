/**
 * EYG — /contact  ·  CONTACT & LOCATION
 * ============================================================================
 * The page a lost driver opens with one hand on the steering wheel. Everything on
 * it is built for that situation:
 *
 *   1. live open/closed status, server-computed in Asia/Manila
 *   2. the address, the landmark, and 1-tap directions to Google Maps AND Waze
 *   3. a click-to-load map (nothing is requested from Google on first paint)
 *   4. every direct channel, with an honest disabled state for any number that
 *      is still the `TODO-VERIFY` placeholder
 *   5. the next seven days' hours
 *   6. accepted payment methods
 *   7. a contact form that works without JavaScript
 *   8. "before you drive over" — parking, what to bring, whether to call ahead
 *
 * DYNAMIC: the shop status is time-dependent, so this must render per request.
 * ============================================================================
 */

import type { Metadata } from "next";
import { pageSeo, localBusinessJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { BUSINESS, ADDRESS_ONE_LINE, LINKS, CURRENCY } from "@/config/site";
import { ButtonLink, Container, Eyebrow, Section } from "@/components/pages/_shims";
import { Divider } from "@/components/ui/Divider";
import { JsonLd } from "@/components/ui/JsonLd";
import {
  Breadcrumb,
  CallButton,
  DirectionsLinks,
  PageHeader,
  PRIMARY_PHONE_UNCONFIRMED,
} from "@/components/pages/_shared";
import { ClosingSoonBand, HoursTable, ShopStatusBadge, hoursSummary } from "@/components/pages/contact/ShopStatus";
import { MapEmbed } from "@/components/pages/contact/MapEmbed";
import {
  ContactChannels,
  DriveOverNote,
  PaymentMethods,
} from "@/components/pages/contact/ContactChannels";
import { ContactForm } from "@/components/pages/contact/ContactForm";
import { getHoursWeek, getShopStatus } from "@/components/pages/_hours";
import { Calendar, Car, Clock, Gauge, LifeBuoy, MapPin, Tag, Wrench } from "@/components/pages/_icons";

export const metadata: Metadata = pageSeo({
  title: "Contact & Location — Tuyo, Balanga City",
  description:
    "Find EYG Tire & Auto Care on the EGSA Fourlanes stretch in Tuyo, Balanga City. Live opening hours, directions and every way to reach us.",
  path: "/contact",
  keywords: [
    "tire shop Tuyo Balanga location",
    "EGSA Fourlanes auto care",
    "car aircon Balanga contact",
    "Balanga City tire shop hours",
  ],
});

export const dynamic = "force-dynamic";

export default async function ContactPage(): Promise<React.ReactElement> {
  // Server clock → Asia/Manila. See `_hours.ts` for why this is not optional.
  const status = getShopStatus();
  const week = getHoursWeek();

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Contact & Location", path: "/contact" },
  ];

  return (
    <>
      <JsonLd data={localBusinessJsonLd()} id="ld-localbusiness-contact" />
      <JsonLd data={breadcrumbJsonLd(crumbs)} id="ld-breadcrumb-contact" />

      <PageHeader
        eyebrow="Contact & location"
        title="Where we are, and when we are open"
        lede={
          <>
            We are on the EGSA Fourlanes expressway stretch in Tuyo. Open{" "}
            {hoursSummary().toLowerCase()}. Here is the address, one-tap directions,
            and every way to reach a person.
          </>
        }
        actions={
          <>
            <ButtonLink href={LINKS.directionsGoogle} variant="cta" size="lg">
              <MapPin aria-hidden="true" className="size-4" />
              Get directions
            </ButtonLink>
            <CallButton size="lg" />
          </>
        }
        footnote={PRIMARY_PHONE_UNCONFIRMED ? undefined : `Shop floor: ${BUSINESS.phoneDisplay}`}
      />

      <Container className="pt-6">
        <Breadcrumb trail={crumbs} />
      </Container>

      {/* ── Live status ──────────────────────────────────────────────────── */}
      <Section labelledBy="status-heading" space="md" tone="muted">
        <Container className="space-y-6">
          <div className="max-w-prose space-y-3">
            <Eyebrow>Right now</Eyebrow>
            <h2 id="status-heading" className="text-h2">
              Is the shop open?
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              <ShopStatusBadge status={status} size="band" />
              <ClosingSoonBand status={status} />
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  Computed on the server against the shop&rsquo;s own clock (Asia/Manila,
                  UTC+8) every time this page loads, so it does not go stale while you
                  read it.
                </span>
              </p>
            </div>
            <HoursTable rows={week} />
          </div>
        </Container>
      </Section>

      <Divider variant="checker" inset="none" />

      {/* ── Location ─────────────────────────────────────────────────────── */}
      <Section labelledBy="location-heading" space="md">
        <Container className="space-y-8">
          <div className="max-w-prose space-y-3">
            <Eyebrow>Finding us</Eyebrow>
            <h2 id="location-heading" className="text-h2">
              You will see us from the main road
            </h2>
            <p className="text-body-lg text-muted-foreground">{BUSINESS.address.landmark}</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <MapEmbed src={LINKS.mapsEmbed} />

            <div className="space-y-6">
              <div className="space-y-3 rounded-panel border border-border bg-surface p-5">
                <h3 className="eyg-eyebrow text-muted-foreground">Our address</h3>
                <address className="space-y-1 text-lg not-italic leading-relaxed">
                  <span className="block font-display font-extrabold">{BUSINESS.legalName}</span>
                  <span className="block">{BUSINESS.address.street}</span>
                  <span className="block">
                    {BUSINESS.address.district}, {BUSINESS.address.province}{" "}
                    {BUSINESS.address.postalCode}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {BUSINESS.address.region}, {BUSINESS.address.countryName}
                  </span>
                </address>
                <Divider variant="dashed" inset="sm" />
                <DirectionsLinks />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Tap either button and your phone&rsquo;s navigation app opens with
                  the route already set. Full address used for directions:{" "}
                  {ADDRESS_ONE_LINE}.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="eyg-eyebrow text-muted-foreground">How we accept payment</h3>
                <PaymentMethods />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Prices are quoted and confirmed in {CURRENCY} before any work starts.
                  If an amount is above what you have with you, tell us at the counter —
                  we will tell you honestly what it will take to settle it.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Divider variant="checker" inset="none" />

      {/* ── Channels ─────────────────────────────────────────────────────── */}
      <Section labelledBy="channels-heading" space="md" tone="muted">
        <Container className="space-y-6">
          <div className="max-w-prose space-y-3">
            <Eyebrow>Reach a person</Eyebrow>
            <h2 id="channels-heading" className="text-h2">
              Four ways to get hold of us
            </h2>
            <p className="text-body-lg text-muted-foreground">
              Somebody reads every one of these. If it is a breakdown, call. If it is a
              question, any of them will do.
            </p>
          </div>
          <ContactChannels />
        </Container>
      </Section>

      <Divider variant="checker" inset="none" />

      {/* ── Before you drive over ────────────────────────────────────────── */}
      <Section labelledBy="come-heading" space="md">
        <Container className="space-y-6">
          <DriveOverNote
            headingId="come-heading"
            rows={[
              {
                icon: Gauge,
                title: "Call ahead on a busy day",
                body: `Weekday mornings and the last hour before we close are the busiest. A ten-second call means we can keep a bay for you instead of you waiting behind three PMS jobs. ${hoursSummary()}.`,
              },
              {
                icon: Car,
                title: "Bring the car and the key",
                body: "That is genuinely all. If you are having tyres done, bring the spare — and the wheel key if your car has one, because the locking nut catches everybody out.",
              },
              {
                icon: Wrench,
                title: "Write down what you noticed first",
                body: "The noise, when it happens, whether it is worse when it rains, the mileage on the odometer. Thirty seconds of memory now saves ten minutes of diagnosis later.",
              },
              {
                icon: MapPin,
                title: "Parking and access",
                body: `We are on ${BUSINESS.address.street}. There is forecourt space in front of the bays and street parking along the service road — do not stop in the EGSA shoulder, the expressway traffic will make it unsafe and it is a fine waiting to happen.`,
              },
              {
                icon: Tag,
                title: "Ask about the current offer",
                body: "If something is on the deals page, mention it at the counter. We will apply it — a discount that only exists on the invoice is not a discount.",
              },
              {
                icon: LifeBuoy,
                title: "Broken down rather than booked?",
                body: "Say so on the phone. A roadside job and a booked bay are handled differently, and we would rather send the right person than send someone who then has to come back.",
              },
            ]}
          />
        </Container>
      </Section>

      <Divider variant="checker" inset="none" />

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <Section labelledBy="contact-form-heading" space="md" tone="muted">
        <Container className="space-y-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div className="space-y-5">
              <ContactForm />
            </div>
            <div className="space-y-6">
              <div className="space-y-3 rounded-panel border-2 border-border-strong bg-surface p-5">
                <Eyebrow>Even faster</Eyebrow>
                <h2 className="text-h2">Book the bay instead</h2>
                <p className="text-muted-foreground">
                  If you already know what the car needs, the booking wizard takes about
                  forty seconds and guarantees you the time rather than hoping for it.
                </p>
                <ButtonLink href="/book" variant="cta" size="lg" fullWidth>
                  Book an appointment
                </ButtonLink>
              </div>

              <div className="space-y-3">
                <h3 className="eyg-eyebrow text-muted-foreground">Useful before you call</h3>
                <ul className="space-y-2">
                  {QUICK_LINKS.map(({ href, label }) => (
                    <li key={href}>
                      <a
                        href={href}
                        className="flex min-h-11 items-center gap-2 rounded-card border border-border bg-surface px-4 text-sm font-bold underline decoration-2 underline-offset-4 transition-colors hover:border-brand-500"
                      >
                        <Calendar aria-hidden="true" className="size-4 text-brand-500" />
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
                <ButtonLink href="/services" variant="secondary" size="md" fullWidth>
                  See services &amp; honest prices
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}

const QUICK_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: LINKS.directionsGoogle, label: "Open the route in Google Maps" },
  { href: LINKS.directionsWaze, label: "Open the route in Waze" },
  { href: BUSINESS.social.facebook, label: "Find us on Facebook" },
  { href: "/book", label: "Book an appointment" },
];
