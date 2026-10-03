/**
 * EYG — /book  ·  BOOK APPOINTMENT
 * ============================================================================
 * The low-friction conversion page.
 *
 * INDEXING: `noIndex: true`. This is a transactional page. It should not compete
 * with `/services` or `/contact` for "tire shop Balanga" queries, it should not be
 * in a sitemap, and its `?step=` / `?service=` variants must not fragment the
 * index. Crawlers get a `noindex, nofollow` and the canonical still points here.
 *
 * DYNAMIC RENDERING: the page reads `?step=`, `?service=`, `?package=`, `?promo=`
 * and `?fallback=`, and computes the date strip in Asia/Manila. It must not be
 * statically cached or the strip would freeze on the build date.
 *
 * JAVASCRIPT-OFF PATH: `<noscript>` inside the header shows a styled panel, and
 * `<NoJsBookingForm>` renders a real Server-Action `<form method="post">` at the
 * bottom that posts to `POST /api/leads`. A customer with no JavaScript can still
 * get a booking, and can still reach the shop by phone.
 * ============================================================================
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { pageSeo } from "@/lib/seo";
import { BOOKING, BUSINESS } from "@/config/site";
import { getPackages, getServices, isKnownServiceSlug } from "@/content/catalog";
import { ButtonLink, Container, Eyebrow, Section } from "@/components/pages/_shims";
import { Divider } from "@/components/ui/Divider";
import { Skeleton } from "@/components/ui/Skeleton";
import { Breadcrumb, CallButton, PageHeader, PRIMARY_PHONE_UNCONFIRMED } from "@/components/pages/_shared";
import { BookingWizard } from "@/components/pages/booking/BookingWizard";
import { NoJsBookingForm } from "@/components/pages/booking/NoJsBookingForm";
import { isBookingStepId, type BookingStepId } from "@/components/pages/booking/types";
import { getDateStrip, getShopStatus, type DateStripDay } from "@/components/pages/_hours";
import { Phone, ShieldCheck, WifiOff } from "@/components/pages/_icons";

export const metadata: Metadata = pageSeo({
  title: "Book an Appointment",
  description:
    "Book a bay at EYG Tire & Auto Care in Tuyo, Balanga City. Pick your services, choose a time, and we text you a confirmation.",
  path: "/book",
  noIndex: true,
  // A 4-step wizard has no meaningful share preview.
  image: "/og/default.png",
});

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export default async function BookPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}): Promise<React.ReactElement> {
  const params = (await searchParams) ?? {};

  const rawStep = first(params["step"]);
  const initialStep: BookingStepId = isBookingStepId(rawStep) ? rawStep : "vehicle";

  const rawService = first(params["service"]);
  const initialServiceSlug = rawService && isKnownServiceSlug(rawService) ? rawService : null;

  const rawPackage = first(params["package"]);
  const rawPromo = first(params["promo"]);
  const initialPackageSlug = rawPackage && /^[a-z0-9-]{3,64}$/.test(rawPackage) ? rawPackage : null;
  const initialPromoCode = rawPromo && /^[A-Z0-9-]{3,24}$/.test(rawPromo.toUpperCase()) ? rawPromo.toUpperCase() : null;

  const strip: DateStripDay[] = getDateStrip(14);
  const status = getShopStatus();

  const services = await getServices();
  const packages = await getPackages();

  return (
    <>
      <PageHeader
        eyebrow="Book a bay"
        title="Four steps. Then it is done."
        lede={
          <>
            Tell us the car, what it needs and when. We text you a confirmation
            within a minute, and the bay is yours. No account, no password, no
            payment at this stage.
          </>
        }
        actions={
          <ButtonLink href="/services" variant="secondary" size="lg">
            Not sure what to book? See services &amp; prices
          </ButtonLink>
        }
        footnote={`${status.label}. ${BUSINESS.address.street}, ${BUSINESS.address.district}.`}
      />

      <Container className="pt-6">
        <Breadcrumb
          trail={[
            { name: "Home", path: "/" },
            { name: "Book", path: "/book" },
          ]}
        />
      </Container>

      {/* ── The no-JS notice sits ABOVE the wizard, not at the bottom ─────── */}
      <Container className="pt-6">
        <noscript>
          <div className="space-y-4">
            <div
              role="note"
              className="flex gap-3 rounded-panel border-2 border-brand-500 bg-brand-50 p-5 dark:bg-brand-900/25"
            >
              <WifiOff aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-brand-500" />
              <div className="space-y-2">
                <p className="font-display text-h3">The step-by-step booker needs JavaScript</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  That is on us, not on you — and you are not stuck. Two things still
                  work with the browser as it is:
                </p>
                <ul className="space-y-1.5 text-sm">
                  <li>
                    <strong>Scroll to the bottom of this page</strong> and send your name
                    and number. We will call or text you back and confirm a time — it is
                    the same bay, the same price.
                  </li>
                  <li>
                    <strong>Call or WhatsApp us</strong> during working hours. Booked
                    customers get priority on a freed bay.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </noscript>
      </Container>

      {/* ── The wizard ───────────────────────────────────────────────────── */}
      <Suspense
        fallback={
          <Section labelledBy="wizard-loading" space="md">
            <div className="mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-6">
                  <h2 id="wizard-loading" className="sr-only">
                    Loading the booking form
                  </h2>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-hidden="true">
                    {Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={i} shape="block" className="h-14" />
                    ))}
                  </div>
                  <Skeleton shape="block" className="h-12" />
                  <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
                    <Skeleton shape="block" className="h-24" />
                    <Skeleton shape="block" className="h-24" />
                  </div>
                  <Skeleton shape="block" className="h-56" />
                </div>
                <Skeleton shape="block" className="hidden h-80 lg:block" />
              </div>
              <p className="sr-only" role="status">
                Loading the booking form.
              </p>
            </div>
          </Section>
        }
      >
        <BookingWizard
          services={services}
          packages={packages}
          strip={strip}
          maxServices={BOOKING.maxServicesPerBooking}
          initialServiceSlug={initialServiceSlug}
          initialPackageSlug={initialPackageSlug}
          initialPromoCode={initialPromoCode}
          initialStep={initialStep}
        />
      </Suspense>

      <Divider variant="checker" inset="none" />

      {/* ── Progressive-enhancement lane ─────────────────────────────────── */}
      <Section labelledBy="fallback-heading-anchor" space="md" tone="muted">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
            <div className="space-y-4">
              <Eyebrow>Simpler route</Eyebrow>
              <h2 id="fallback-heading-anchor" className="text-h2">
                Rather just have us call you?
              </h2>
              <p className="max-w-prose text-body-lg text-muted-foreground">
                Some people would honestly rather pick up the phone than fill in a
                form. That is fine — this form sends your number to the shop and a
                person replies, and it works whether or not the page above loaded.
              </p>
            </div>
            <div id="fallback-heading-anchor" className="scroll-mt-24">
              <NoJsBookingForm strip={strip} />
            </div>
          </div>
        </Container>
      </Section>

      {/* ── Assurances ───────────────────────────────────────────────────── */}
      <Section labelledBy="assurance-heading" space="sm">
        <Container>
          <div className="max-w-prose space-y-4">
            <h2 id="assurance-heading" className="text-h2">
              What booking here does and does not do
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {ASSURANCES.map((a) => (
                <li key={a.title} className="space-y-1 rounded-card border border-border bg-surface p-4">
                  <p className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
                    <ShieldCheck aria-hidden="true" className="size-4 text-brand-500" />
                    {a.title}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{a.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* ── Last-resort phone lane ───────────────────────────────────────── */}
      <Section labelledBy="book-call-heading" space="sm" tone="raised">
        <Container>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h2 id="book-call-heading" className="text-h3">
                Broken down right now?
              </h2>
              <p className="text-sm text-muted-foreground">
                {PRIMARY_PHONE_UNCONFIRMED
                  ? "Our phone number is being confirmed. Messenger and WhatsApp are live now."
                  : "Call the shop directly. Someone answers during working hours and can talk you through the next step."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <CallButton size="lg" />
              {PRIMARY_PHONE_UNCONFIRMED ? (
                <ButtonLink href={BUSINESS.social.messenger} variant="secondary" size="lg">
                  Messenger
                </ButtonLink>
              ) : null}
            </div>
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <Phone aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Booking a slot reserves bay time, it does not reserve a specific
              mechanic. On a very busy morning we may run slightly behind — if we are
              more than about thirty minutes late, we will tell you and reschedule at
              your convenience.
            </span>
          </p>
        </Container>
      </Section>
    </>
  );
}

const ASSURANCES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "No payment at this stage",
    body: "Booking is a request, not an invoice. We agree the work and the price with you at the counter before anything is done.",
  },
  {
    title: "You can change it",
    body: "Reply to the confirmation text or call us. Changes are easy as long as you give us a few hours' notice.",
  },
  {
    title: "Estimates stay estimates",
    body: "The total shown in the wizard is a range, confirmed after inspection. We will not add work you did not approve.",
  },
  {
    title: "Your number stays with the shop",
    body: "It is used for this booking and, only if you agree, occasional offers. You can opt out with one reply.",
  },
  {
    title: "We tell you if it can wait",
    body: "A large part of what we find can safely wait. We will say so rather than selling you a repair you do not need yet.",
  },
  {
    title: "Walk-ins are still fine",
    body: "Booking just means you are not waiting behind a queue. If you turn up without a booking, we will fit you in honestly.",
  },
];
