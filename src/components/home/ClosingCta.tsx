import type { ReactElement } from "react";
import { ArrowRight, Phone } from "lucide-react";
import { BUSINESS } from "@/config/site";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { PHONE_DISPLAY, PHONE_HREF, WHATSAPP_HREF } from "@/components/layout/business";
import { TrackedCta } from "@/components/providers/TrackedCta";

/**
 * The closing band: the last thing on the page, and the last thing a visitor
 * sees. Ink, hazard rail, and exactly two actions — book, or call.
 */
export function ClosingCta(): ReactElement {
  return (
    <section
      aria-labelledby="closing-title"
      className="relative isolate overflow-hidden border-t-2 border-brand-500 bg-ink-950 text-white"
    >
      <div aria-hidden="true" className="eyg-hazard absolute inset-x-0 bottom-0 h-2 opacity-90" />
      {/*
        BRAND RULE: no soft glow. The blurred 10%-yellow circle that used to sit
        here is replaced by a hard diagonal speed bar — flat geometry, no halo.
      */}
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 h-24 w-72 rotate-[-12deg] border-t-2 border-brand-500/40"
      />

      <Container className="relative py-14 sm:py-20">
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <BrandLockup width={140} tone="inverse" />
            <h2 id="closing-title" className="eyg-stripe mt-6 pb-3 text-display-2 text-white">
              Car trouble does not keep office hours. Neither do we.
            </h2>
            <p className="mt-6 text-body-lg text-ink-200">
              Pick a slot online and we will have the bay ready — or call and talk to the person who
              will do the work. {BUSINESS.address.street}, {BUSINESS.address.district}.
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:min-w-72">
            <TrackedCta
              href="/book"
              event="cta_clicked"
              params={{ placement: "closing_cta", cta: "book_bay" }}
              variant="accent"
              size="xl"
              fullWidth
              trailingIcon={<ArrowRight aria-hidden="true" className="size-5" />}
            >
              Book a Service Bay
            </TrackedCta>

            {PHONE_HREF ? (
              <TrackedCta
                href={PHONE_HREF}
                event="call_clicked"
                params={{ placement: "closing_cta" }}
                variant="outline"
                size="xl"
                fullWidth
                className="border-white/40 text-white hover:border-white hover:bg-white/10"
                leadingIcon={<Phone aria-hidden="true" className="size-5" />}
              >
                Call {PHONE_DISPLAY}
              </TrackedCta>
            ) : WHATSAPP_HREF ? (
              <TrackedCta
                href={WHATSAPP_HREF}
                event="whatsapp_clicked"
                params={{ placement: "closing_cta" }}
                variant="outline"
                size="xl"
                fullWidth
                className="border-white/40 text-white hover:border-white hover:bg-white/10"
              >
                Message us instead
              </TrackedCta>
            ) : (
              <span
                data-unverified="true"
                className="eyg-eyebrow inline-flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-eyebrow border border-white/25 text-white/60"
              >
                <Phone aria-hidden="true" className="size-5" />
                Number being confirmed
              </span>
            )}

            <LinkButton
              href="/deals"
              variant="ghost"
              size="lg"
              className="text-ink-200 hover:bg-white/10 hover:text-white"
            >
              Check this month&rsquo;s deals first
            </LinkButton>
          </div>
        </div>
      </Container>
    </section>
  );
}
