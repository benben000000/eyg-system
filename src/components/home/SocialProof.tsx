import * as React from "react";
import { Suspense } from "react";
import { Star } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Rating } from "@/components/ui/Rating";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Skeleton } from "@/components/ui/Skeleton";
import { BUSINESS } from "@/config/site";
import { RATING_CLAIMABLE } from "@/components/layout/business";
import { GalleryTeaserWidget, RatingSummaryWidget, ReviewsCarouselWidget } from "./placeholders";

/**
 * Social proof.
 *
 * HONESTY: `BUSINESS.trust.ratingCount` is `0` and `ratingValue` is still
 * `TODO-VERIFY`, and the brief forbids fake reviews and invented customer
 * names. So this section does NOT print a score or a testimonial. It prints the
 * rating block only when a real review count exists, and otherwise it points at
 * the shop's actual Facebook page — where real customers post.
 *
 * All three widgets are `<Suspense>`-wrapped against skeletons of the same size.
 * See `placeholders.tsx` for the swap map.
 */
export function SocialProof(): React.ReactElement {
  return (
    <Section labelledBy="proof-title" tone="muted">
      <SectionHeading
        id="proof-title"
        eyebrow="Social proof"
        title="Straight answers, and work you can check"
        description="We would rather show you the bay and the job than a stock photo of somebody else's garage. Here is where our customers actually talk about us."
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        {/* ── Aggregate rating block (real reviews only) ───────────────── */}
        <Suspense fallback={<RatingSkeleton />}>
          <RatingSummaryWidget />
        </Suspense>

        {/* ── Honest alternative when there is no review count ─────────── */}
        {RATING_CLAIMABLE ? (
          <Card tone="surface" padding="lg" className="flex flex-col justify-center">
            <p className="eyg-eyebrow text-brand-500">What customers rate us</p>
            <p className="mt-4">
              <Rating
                value={BUSINESS.trust.ratingValue}
                count={BUSINESS.trust.ratingCount}
                showValue
                size="lg"
              />
            </p>
          </Card>
        ) : (
          <Card tone="surface" padding="lg" className="flex flex-col justify-center">
            <p className="eyg-eyebrow text-brand-500">No rating published here</p>
            <h3 className="mt-2 text-h3 font-extrabold">
              We have not published a review score on this site — yet.
            </h3>
            <p className="mt-3 text-muted-foreground">
              No written customer reviews are published on this site yet. We would rather leave
              the number blank than print a score nobody can check.
            </p>
            <p className="mt-3 text-muted-foreground">
              A brand-new shop with a 4.9 badge nobody can check is worth nothing. What is worth
              something: our customers post on Facebook, and you can read every word of it before
              you drive over.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <FacebookReviewsButton />
              <LinkButton href="/gallery" variant="outline" size="md">
                See the work instead
              </LinkButton>
            </div>
          </Card>
        )}
      </div>

      {/* ── Review carousel ────────────────────────────────────────────── */}
      <div className="mt-12">
        <h3 className="text-h3 font-extrabold">What customers say</h3>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Pulled from our Facebook page. Nothing here is written by us.
        </p>
        <div className="mt-6">
          <Suspense fallback={<ReviewsSkeleton />}>
            <ReviewsCarouselWidget />
          </Suspense>
        </div>
      </div>

      {/* ── Before / after ─────────────────────────────────────────────── */}
      <div className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-h3 font-extrabold">Before and after</h3>
            <p className="mt-2 max-w-prose text-muted-foreground">
              Real jobs from our own bay — the mess on the left, the finished work on the right.
            </p>
          </div>
          <LinkButton href="/gallery" variant="outline" size="md">
            Open the gallery
          </LinkButton>
        </div>
        <div className="mt-6">
          <Suspense fallback={<GallerySkeleton />}>
            <GalleryTeaserWidget />
          </Suspense>
        </div>
      </div>
    </Section>
  );
}

function FacebookReviewsButton(): React.ReactElement {
  return (
    <Button asChild variant="primary" size="md">
      <a href={BUSINESS.social.facebook} target="_blank" rel="noopener noreferrer">
        <Star aria-hidden="true" className="size-5" />
        Read the Facebook reviews
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </Button>
  );
}

function RatingSkeleton(): React.ReactElement {
  return (
    <Card tone="surface" padding="md" aria-busy="true" aria-label="Loading customer rating">
      <Skeleton shape="pill" />
      <Skeleton shape="title" className="mt-4" />
      <Skeleton shape="text" className="mt-3" />
    </Card>
  );
}

function ReviewsSkeleton(): React.ReactElement {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i} tone="surface" padding="md" aria-busy="true" aria-label="Loading a customer review">
          <Skeleton shape="pill" />
          <Skeleton shape="text" className="mt-4" />
          <Skeleton shape="text" className="mt-2" />
          <Skeleton shape="text" className="mt-2 w-1/2" />
        </Card>
      ))}
    </div>
  );
}

function GallerySkeleton(): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} shape="block" className="aspect-4/3 rounded-card" />
      ))}
    </div>
  );
}
