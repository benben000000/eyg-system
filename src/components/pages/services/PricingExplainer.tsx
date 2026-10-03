/**
 * EYG — PRICING EXPLAINER
 * ============================================================================
 * `/services` ships ranges, not single numbers. That is a deliberate honesty
 * choice, and without an explanation it reads as hedging. This block is the
 * explanation: why a range, and exactly what moves the price.
 *
 * Copy is written so it is true with the current placeholder catalogue AND with
 * a confirmed one. Nothing here claims a price the shop has not agreed to.
 * ============================================================================
 */

import { Container, Eyebrow, Section } from "@/components/pages/_shims";
import { HelpCircle, Car, Droplet, Settings, ShieldCheck } from "@/components/pages/_icons";
import { CATALOG_PRICING_NOTICE } from "@/content/catalog";

const DRIVERS: ReadonlyArray<{ icon: typeof Car; title: string; body: string }> = [
  {
    icon: Car,
    title: "Size of the vehicle",
    body: "A Innova or a Fortuner needs more bay time, bigger tyres and a longer alignment than a hatchback. Same job, different car, different number.",
  },
  {
    icon: Droplet,
    title: "Which oil and which filter",
    body: "Fully synthetic sits at the top of the range; conventional sits below it. We fit what the manufacturer specifies, and we tell you which one your car takes before we pour it in.",
  },
  {
    icon: Settings,
    title: "Condition of the parts",
    body: "Brake discs, tie-rod ends, bushings — these wear out on their own schedule. If yours are finished, we show you the measurement and quote them separately before fitting anything.",
  },
];

export function PricingExplainer(): React.ReactElement {
  const headingId = "pricing-explainer";
  return (
    <Section labelledBy={headingId} tone="raised" id="pricing">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-12">
          <div className="space-y-4">
            <Eyebrow>About these prices</Eyebrow>
            <h2 id={headingId} className="text-h2">
              Why a range, and not one number
            </h2>
            <p className="text-body-lg text-muted-foreground">
              A shop that prints one price for a service is either guessing, or
              pricing the smallest car in the category and quietly correcting it on
              the invoice. We would rather show you the honest range and confirm the
              exact figure in front of you.
            </p>
            <p className="flex gap-3 rounded-card border-2 border-brand-500 bg-brand-50 p-4 text-sm font-bold text-brand-900 dark:bg-brand-900/30 dark:text-brand-100">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <span>{CATALOG_PRICING_NOTICE}</span>
            </p>
          </div>

          <div className="space-y-6">
            <h3 className="text-h3 flex items-center gap-2">
              <HelpCircle aria-hidden="true" className="size-5 text-brand-500" />
              What moves the price
            </h3>
            <ul className="grid gap-4 sm:grid-cols-2">
              {DRIVERS.map(({ icon: Icon, title, body }) => (
                <li
                  key={title}
                  className="space-y-2 rounded-card border border-border bg-surface p-5"
                >
                  <p className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
                    <Icon aria-hidden="true" className="size-4 text-brand-500" />
                    {title}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
            <p className="rounded-card border border-border bg-surface p-5 text-sm leading-relaxed text-muted-foreground">
              <strong className="text-foreground">If a job says &ldquo;Ask us&rdquo;,</strong> the
              price depends on the part rather than the labour. We quote it in writing
              after we have seen the car — we will not put a number on it over the
              phone that we cannot stand behind.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
