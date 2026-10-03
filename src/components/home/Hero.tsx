import type { ReactElement, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ClipboardList, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { BUSINESS } from "@/config/site";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { Marquee } from "@/components/ui/Marquee";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { OpenStatusPill } from "@/components/layout/OpenStatusPill";
import type { OpenStatus } from "@/components/layout/hours";
import {
  MESSENGER_HREF,
  PAYMENT_METHODS,
  PHONE_DISPLAY,
  PHONE_HREF,
  TIRE_BRANDS_CLAIMABLE,
  WHATSAPP_HREF,
  YEARS_CLAIMABLE,
} from "@/components/layout/business";
import { TrackedCta } from "@/components/providers/TrackedCta";

/**
 * HERO PHOTOGRAPH SEAM — see the comment at the render site below.
 *
 * Set this to `{ src: "/hero/bay.webp", width: 1920, height: 1080, alt: "…" }`
 * once the brand or marketing agent supplies an authentic photo of the EYG bay.
 * Explicit `width`/`height` + `priority` are wired in the JSX, so it cannot
 * introduce layout shift.
 */
export const HERO_IMAGE: {
  src: string;
  width: number;
  height: number;
  alt: string;
} | null = null;

/**
 * Hero — LANE A first, then LANE B.
 *
 * The `h1` names the shop, the place and the job in the words a Balanga driver
 * would actually use. Below it, in priority order: a live open/closed pill, one
 * accent CTA, one outline CTA, the phone, and a trust strip.
 *
 * TRUST STRIP HONESTY: every figure in `BUSINESS.trust` is `TODO-VERIFY`, and
 * the brands are `TODO-VERIFY` too. So this strip ships *statements the shop can
 * stand behind* — payment methods (not flagged) plus plain policies — instead of
 * invented numbers. Flip the `*_CLAIMABLE` flags in
 * `src/components/layout/business.ts` once the owner signs off.
 */
export function Hero({ status }: { status: OpenStatus }): ReactElement {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden bg-ink-950 text-white"
    >
      {/* Brand atmosphere: hazard rail + checker wash. Purely decorative. */}
      <div aria-hidden="true" className="eyg-hazard absolute inset-x-0 top-0 h-2 opacity-90" />
      <div
        aria-hidden="true"
        className="eyg-checker absolute -right-16 top-24 size-72 rotate-12 opacity-10"
      />
      {/*
        BRAND RULE: no soft glow.
        This was a 320px circle of 10% yellow under `blur-3xl` — a radial bloom.
        The EYG mark is a hard-edged motorsport lockup, so depth comes from flat
        planes, a 1px border and the angle of the speed stripe, never from a
        blurred halo. See docs/brand/DO-NOT.md.
      */}
      <div
        aria-hidden="true"
        className="absolute -left-24 bottom-0 h-px w-72 bg-gradient-to-r from-brand-500/50 to-transparent"
      />

      <Container className="relative pb-14 pt-10 sm:pb-20 sm:pt-14 lg:pb-24">
        <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          {/* ── Copy ──────────────────────────────────────────────────────── */}
          <div className="min-w-0">
            <Link href="/" aria-label={`${BUSINESS.legalName} — home`} className="inline-block rounded-eyebrow">
              <BrandLockup width={168} tone="inverse" />
            </Link>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <OpenStatusPill initial={status} variant="solid" />
              <Badge tone="brand" size="sm">
                On EGSA Fourlanes, Tuyo
              </Badge>
            </div>

            <h1
              id="hero-title"
              className="eyg-stripe mt-6 pb-3 text-display-1 text-white"
            >
              Tire shop &amp; auto care in Balanga City
            </h1>

            <p className="mt-6 max-w-prose text-body-lg text-ink-200 sm:text-xl">
              Tire change, PMS, wheel alignment, brakes, undercoating and car aircon — done in the
              bay while you wait. Book a slot online, or call and talk to the person who will do
              the work.
            </p>

            {/* ── CTAs ────────────────────────────────────────────────────── */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <TrackedCta
                href="/book"
                event="cta_clicked"
                params={{ placement: "hero", cta: "book_bay" }}
                variant="accent"
                size="xl"
                leadingIcon={null}
                trailingIcon={<ArrowRight aria-hidden="true" className="size-5" />}
              >
                Book a Service Bay
              </TrackedCta>

              <TrackedCta
                href="/#quote"
                event="cta_clicked"
                params={{ placement: "hero", cta: "free_quote" }}
                variant="outline"
                size="xl"
                className="border-white/40 text-white hover:border-white hover:bg-white/10"
                leadingIcon={<ClipboardList aria-hidden="true" className="size-5" />}
              >
                Get a free quote
              </TrackedCta>
            </div>

            {/* ── Phone / message ─────────────────────────────────────────── */}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              {PHONE_HREF ? (
                <TrackedCta
                  href={PHONE_HREF}
                  event="call_clicked"
                  params={{ placement: "hero" }}
                  variant="link"
                  unstyled
                  className="inline-flex min-h-11 items-center gap-2 text-base font-bold text-brand-500 underline decoration-transparent underline-offset-4 transition-colors hover:decoration-brand-500"
                  leadingIcon={<Phone aria-hidden="true" className="size-5" />}
                >
                  {PHONE_DISPLAY}
                </TrackedCta>
              ) : (
                <span
                  data-unverified="true"
                  className="inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-eyebrow text-base font-bold text-ink-300"
                >
                  <Phone aria-hidden="true" className="size-5" />
                  Phone number being confirmed
                </span>
              )}

              {WHATSAPP_HREF ? (
                <TrackedCta
                  href={WHATSAPP_HREF}
                  event="whatsapp_clicked"
                  params={{ placement: "hero" }}
                  unstyled
                  className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-ink-200 underline decoration-transparent underline-offset-4 transition-colors hover:text-white hover:decoration-current"
                  leadingIcon={<MessageCircle aria-hidden="true" className="size-5" />}
                >
                  Message on WhatsApp
                </TrackedCta>
              ) : (
                <TrackedCta
                  href={MESSENGER_HREF}
                  event="messenger_clicked"
                  params={{ placement: "hero" }}
                  unstyled
                  className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-ink-200 underline decoration-transparent underline-offset-4 transition-colors hover:text-white hover:decoration-current"
                  leadingIcon={<MessageCircle aria-hidden="true" className="size-5" />}
                >
                  Message on Messenger
                </TrackedCta>
              )}
            </div>
          </div>

          {/* ── Shop plate ────────────────────────────────────────────────── */}
          <aside
            aria-label="What to expect"
            className="relative rounded-panel border border-ink-800 bg-ink-900/80 p-6 shadow-lift backdrop-blur-sm lg:p-8"
          >
            <p className="eyg-eyebrow text-brand-500">Today at the shop</p>
            <dl className="mt-4 flex flex-col gap-4">
              <div>
                <dt className="eyg-eyebrow text-ink-300">Status</dt>
                <dd className="mt-1 text-lg font-bold text-white">
                  {status.isOpen ? "Open now" : "Closed now"}
                  <span className="block text-sm font-semibold text-ink-200">{status.detail}</span>
                </dd>
              </div>
              <div>
                <dt className="eyg-eyebrow text-ink-300">Where</dt>
                <dd className="mt-1 text-lg font-bold text-white">
                  {BUSINESS.address.street}
                  <span className="block text-sm font-semibold text-ink-200">
                    {BUSINESS.address.district}, {BUSINESS.address.province}{" "}
                    {BUSINESS.address.postalCode}
                  </span>
                </dd>
              </div>
              {/*
                 Only rendered when the shop has actually confirmed what it
                 takes. An empty "Pay with" heading is worse than no heading:
                 it reads as an unfinished build, and the payment methods are
                 still `TODO-VERIFY` in `site.ts`. Fill the array and this
                 block appears on its own.
               */}
              {PAYMENT_METHODS.length > 0 ? (
                <div>
                  <dt className="eyg-eyebrow text-ink-300">Pay with</dt>
                  <dd className="mt-2 flex flex-wrap gap-1.5">
                    {PAYMENT_METHODS.map((method) => (
                      <span
                        key={method.id}
                        className="rounded-pill border border-ink-700 bg-ink-950 px-2.5 py-1 text-eyebrow text-ink-200"
                      >
                        {method.label}
                      </span>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </aside>
        </div>
      </Container>

      {/* ── Hero photograph ────────────────────────────────────────────────
          SEAM: drop a real photo of the shop or the bay into
          `public/hero/` and set `HERO_IMAGE`. It is `null` today because
          `docs/AGENT-BRIEF.md` §5 forbids stock photography presented as this
          shop's work, and no authentic photo has been supplied yet. Until then
          the hero uses the brand devices (hazard rail, checker wash, speed
          stripe) rather than a picture of somebody else's garage. */}
      {HERO_IMAGE ? (
        <div className="relative border-t border-ink-800">
          <Image
            src={HERO_IMAGE.src}
            alt={HERO_IMAGE.alt}
            width={HERO_IMAGE.width}
            height={HERO_IMAGE.height}
            priority
            sizes="100vw"
            className="h-auto w-full"
          />
        </div>
      ) : null}

      {/* ── Trust strip ─────────────────────────────────────────────────────
          Marquee respects `prefers-reduced-motion`; with motion off it becomes a
          plain horizontally scrollable row. `aria-hidden` on the duplicate means
          the list is announced once. */}
      <div className="relative border-t border-ink-800 bg-ink-950">
        <Marquee className="py-3" speed={26}>
          <TrustItem icon={<ShieldCheck aria-hidden="true" className="size-4" />}>
            Workmanship guarantee on the bay work
          </TrustItem>
          <TrustItem icon={<ClipboardList aria-hidden="true" className="size-4" />}>
            Price range before you book, not after
          </TrustItem>
          <TrustItem icon={<Phone aria-hidden="true" className="size-4" />}>
            A person answers the phone
          </TrustItem>
          <TrustItem>
            {YEARS_CLAIMABLE
              ? `Serving Balanga for years`
              : "Tire brands we can fit today — ask us which"}
          </TrustItem>
          {!TIRE_BRANDS_CLAIMABLE ? null : (
            <TrustItem>{`Authorised for ${BUSINESS.tireBrands.join(", ")}`}</TrustItem>
          )}
        </Marquee>
      </div>
    </section>
  );
}

function TrustItem({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <span className="eyg-eyebrow flex shrink-0 items-center gap-2 px-6 text-ink-200">
      {icon}
      {children}
    </span>
  );
}
