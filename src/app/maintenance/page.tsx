import type { Metadata } from "next";
import type { ReactElement } from "react";
import { BUSINESS } from "@/config/site";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorView } from "@/components/error/ErrorView";
import { getOpenStatus } from "@/components/layout/hours";
import {
  MESSENGER_HREF,
  PHONE_DISPLAY,
  PHONE_HREF,
  WHATSAPP_HREF,
} from "@/components/layout/business";

/**
 * `MAINTENANCE_MODE` is read, never defined.
 *
 * It is NOT in `.env.example` (orchestrator-owned), so it is read defensively
 * and its absence is a supported state, not an error. Set `MAINTENANCE_MODE=true`
 * and `MAINTENANCE_ESTIMATE` (optional, e.g. "tomorrow 9:00 AM") in the
 * deployment environment.
 *
 * REQUEST FOR THE ORCHESTRATOR: add `MAINTENANCE_MODE=` and
 * `MAINTENANCE_ESTIMATE=` to `.env.example` so the flag is documented.
 */
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true";
const MAINTENANCE_ESTIMATE = process.env.MAINTENANCE_ESTIMATE?.trim();

export const metadata: Metadata = {
  title: "Shop closed for maintenance",
  description: `${BUSINESS.legalName} is temporarily closed while we service the equipment. Call ahead to check when we reopen. ${BUSINESS.address.street}, ${BUSINESS.address.district}.`,
  robots: { index: false, follow: true },
};

export default function MaintenancePage(): ReactElement {
  const status = getOpenStatus(new Date());

  if (!MAINTENANCE_MODE) {
    // Not in maintenance. Send the visitor somewhere useful instead of showing
    // a scary notice for a shop that is trading.
    return (
      <div className="py-6">
        <ErrorView
          kind="unknown"
          headingLevel="h1"
          note={
            <>
              Good news: the shop is trading as normal.{" "}
              <strong className="text-foreground">{status.today}</strong> — {status.detail}.
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="bg-background py-12 sm:py-16">
      <div className="mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-prose">
          <p className="eyg-eyebrow text-brand-600">Temporarily closed</p>
          <h1 className="eyg-stripe mt-3 pb-3 text-h1">
            We are working on the bay, not on your car.
          </h1>

          <p className="mt-6 text-body-lg text-muted-foreground">
            We have taken the shop off the road for maintenance. Nothing is wrong with your booking
            — bookings made before today are still held and we will confirm them by phone the
            moment we are back.
          </p>
        </div>

        <Card tone="inverse" padding="lg" className="mx-auto mt-10 max-w-prose">
          <h2 className="text-h3 font-extrabold">Where we are</h2>
          <address className="mt-3 not-italic leading-relaxed text-ink-200">
            {BUSINESS.address.street}
            <br />
            {BUSINESS.address.district}, {BUSINESS.address.province}{" "}
            {BUSINESS.address.postalCode}
          </address>
          <p className="mt-3 text-sm text-ink-300">{BUSINESS.address.landmark}</p>

          <h3 className="eyg-eyebrow mt-6 text-brand-500">Normal hours</h3>
          <p className="mt-2 text-ink-200">
            {status.schedule
              .filter((row) => row.text !== "Closed")
              .map((row) => `${row.day} ${row.text}`)
              .join(" · ")}
          </p>

          <h3 className="eyg-eyebrow mt-6 text-brand-500">Back by</h3>
          <p className="mt-2 text-lg font-bold text-white">
            {MAINTENANCE_ESTIMATE || "Shortly — call and we will tell you for sure."}
          </p>
          <p className="mt-1 text-sm text-ink-300">
            The phone is still the fastest way to reach us during maintenance.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {PHONE_HREF ? (
              <Button asChild variant="accent" size="lg">
                <a href={PHONE_HREF}>Call {PHONE_DISPLAY}</a>
              </Button>
            ) : (
              <span
                data-unverified="true"
                className="eyg-eyebrow inline-flex min-h-12 cursor-not-allowed items-center rounded-eyebrow border border-white/25 px-4 text-white/60"
              >
                Number being confirmed
              </span>
            )}
            {WHATSAPP_HREF ? (
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-white/40 text-white hover:border-white hover:bg-white/10"
              >
                <a href={WHATSAPP_HREF}>WhatsApp</a>
              </Button>
            ) : null}
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/40 text-white hover:border-white hover:bg-white/10"
            >
              <a href={MESSENGER_HREF}>Messenger</a>
            </Button>
          </div>
        </Card>

        <div className="mx-auto mt-8 flex max-w-prose flex-wrap gap-3">
          <LinkButton href="/" variant="primary" size="md">
            Back to the homepage
          </LinkButton>
          <LinkButton href="/contact" variant="outline" size="md">
            Contact &amp; directions
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
