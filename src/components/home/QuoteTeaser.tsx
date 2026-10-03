import * as React from "react";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Skeleton } from "@/components/ui/Skeleton";
import { QuoteEstimatorWidget } from "./placeholders";

/**
 * LANE B — the instant-quote teaser. `id="quote"` is the anchor the hero's
 * "Get a free quote" button targets.
 *
 * The estimator itself belongs to the widgets agent. Until it lands this renders
 * a static, compelling shell wrapped in `<Suspense>` with a skeleton that is the
 * SAME SIZE as the shell, so when the real widget mounts the page does not
 * jump. See `placeholders.tsx` for the swap map.
 */
export function QuoteTeaser(): React.ReactElement {
  return (
    <Section labelledBy="quote-title" id="quote" className="scroll-mt-24">
      <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div>
          <SectionHeading
            id="quote-title"
            eyebrow="Instant quote"
            title="Know roughly what it costs before you leave home"
            description="Answer three questions about your vehicle and get a peso range on the spot. No account, no card, no obligation — and if the range looks wrong, tell us on the phone and we will price it properly."
          />

          <dl className="mt-8 flex flex-col gap-4">
            <Step
              n={1}
              title="Tell us the car"
              body="Year, make and model. That alone moves the price a lot."
            />
            <Step
              n={2}
              title="Tick what it needs"
              body="PMS, tire change, alignment, brakes — as many as you like."
            />
            <Step
              n={3}
              title="Get a range, then book"
              body="A straight min-to-max figure, with what is included."
            />
          </dl>
        </div>

        <Suspense fallback={<QuoteSkeleton />}>
          <QuoteEstimatorWidget />
        </Suspense>
      </div>
    </Section>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }): React.ReactElement {
  return (
    <div className="flex gap-4">
      <span
        aria-hidden="true"
        className="eyg-eyebrow inline-flex size-9 shrink-0 items-center justify-center rounded-pill bg-ink-950 text-brand-500"
      >
        {n}
      </span>
      <div className="min-w-0">
        <dt className="font-bold text-foreground">{title}</dt>
        <dd className="text-sm text-muted-foreground">{body}</dd>
      </div>
    </div>
  );
}

/** Sized to match the real estimator so the swap causes no shift. */
function QuoteSkeleton(): React.ReactElement {
  return (
    <Card tone="surface" padding="lg" aria-busy="true" aria-label="Loading the instant quote estimator">
      <Skeleton shape="pill" />
      <Skeleton shape="title" className="mt-4" />
      <Skeleton shape="text" className="mt-3" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} shape="block" className="h-11 rounded-eyebrow" />
        ))}
      </div>
      <Skeleton shape="block" className="mt-5 h-14 rounded-eyebrow" />
    </Card>
  );
}
