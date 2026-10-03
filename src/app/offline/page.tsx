import type { Metadata } from "next";
import type { ReactElement } from "react";
import { BUSINESS } from "@/config/site";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { getOpenStatus } from "@/components/layout/hours";
import {
  ADDRESS_SHORT,
  CONTACT_PENDING_NOTE,
  MESSENGER_HREF,
  PAYMENT_METHODS,
  PHONE_DISPLAY,
  PHONE_HREF,
  WHATSAPP_HREF,
} from "@/components/layout/business";
import { HOMEPAGE_CATEGORIES } from "@/components/home/catalog";

/**
 * `/offline` — what a visitor sees when the connection drops (a tunnel on the
 * way back from Manila, a dead spot on the freeway).
 *
 * The most important thing on this page is reassurance: the shop's details and
 * hours are rendered server-side, so they are readable with no network at all
 * once this document is cached, and the copy says plainly that a booking made
 * earlier is still there.
 */
export const metadata: Metadata = {
  title: "You are offline",
  description: `No connection right now. ${BUSINESS.legalName} details, hours and phone number — your booking is still saved.`,
  robots: { index: false, follow: false },
};

export default function OfflinePage(): ReactElement {
  const status = getOpenStatus(new Date());

  return (
    <div className="bg-background py-12 sm:py-16">
      <div className="mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-prose">
          <p className="eyg-eyebrow text-brand-600">No connection</p>
          <h1 className="eyg-stripe mt-3 pb-3 text-h1">You are offline — the shop is not.</h1>

          <p className="mt-6 text-body-lg text-muted-foreground">
            This page needed a connection and did not get one. It happens in a tunnel on the way
            back from Manila, or on a bad signal along the freeway. Everything below was already
            loaded, so you can still read it.
          </p>

          <Card tone="surface" padding="lg" className="mt-8">
            <h2 className="text-h3 font-extrabold">Your booking is still there</h2>
            <p className="mt-2 text-muted-foreground">
              If you already booked a bay, it is saved on our side. When your signal comes back you
              will see it exactly as you left it — nothing to re-enter, nothing to re-confirm.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <LinkButton href="/book" variant="accent" size="md">
                Open my booking
              </LinkButton>
              <LinkButton href="/" variant="outline" size="md">
                Back to the homepage
              </LinkButton>
            </div>
          </Card>
        </div>

        <Divider variant="checker" inset="lg" className="opacity-60" />

        {/* ── Everything below is static, cached content ─────────────────── */}
        <div className="mx-auto grid max-w-page gap-6 md:grid-cols-2">
          <Card tone="inverse" padding="lg">
            <h2 className="text-h3 font-extrabold">Call the shop</h2>
            <address className="mt-3 not-italic leading-relaxed text-ink-200">
              {BUSINESS.address.street}
              <br />
              {BUSINESS.address.district}, {BUSINESS.address.province}{" "}
              {BUSINESS.address.postalCode}
            </address>
            <p className="mt-3 text-sm text-ink-300">{BUSINESS.address.landmark}</p>

            <p className="mt-5 font-bold">
              {status.isOpen ? "Open now" : "Closed now"}
              <span className="block text-sm font-semibold text-ink-200">{status.detail}</span>
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {PHONE_HREF ? (
                <Button asChild variant="accent" size="lg">
                  <a href={PHONE_HREF}>
                    Call {PHONE_DISPLAY}
                  </a>
                </Button>
              ) : (
                <span
                  data-unverified="true"
                  className="eyg-eyebrow inline-flex min-h-12 cursor-not-allowed items-center rounded-eyebrow border border-white/25 px-4 text-white/60"
                >
                  Number being confirmed
                </span>
              )}
            </div>

            {!PHONE_HREF ? (
              <p className="mt-4 text-sm text-ink-300">{CONTACT_PENDING_NOTE}</p>
            ) : null}

            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {WHATSAPP_HREF ? (
                <li>
                  <a href={WHATSAPP_HREF} className="font-semibold text-brand-500 underline underline-offset-4">
                    WhatsApp
                  </a>
                </li>
              ) : null}
              <li>
                <a href={MESSENGER_HREF} className="font-semibold text-brand-500 underline underline-offset-4">
                  Messenger
                </a>
              </li>
            </ul>
          </Card>

          <div className="flex flex-col gap-6">
            <Card tone="surface" padding="lg">
              <h2 className="text-h3 font-extrabold">What we do</h2>
              <ul className="mt-4 flex flex-col gap-2">
                {HOMEPAGE_CATEGORIES.map((category) => (
                  <li key={category.slug} className="text-sm font-semibold text-foreground">
                    {category.name}
                  </li>
                ))}
              </ul>
            </Card>

            <Card tone="surface" padding="lg">
              <h2 className="text-h3 font-extrabold">We accept</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <li
                    key={method.id}
                    className="rounded-pill border border-border bg-surface-muted px-2.5 py-1 text-eyebrow text-muted-foreground"
                  >
                    {method.label}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                You are near {ADDRESS_SHORT}. Look for the yellow sign on the main road.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
