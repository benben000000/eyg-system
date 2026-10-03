import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * ============================================================================
 * PLACEHOLDER SEAMS — DELETE THIS FILE WHEN THE WIDGETS AGENT LANDS
 * ============================================================================
 * The `widgets` agent owns `src/components/widgets/**`. Until those files exist,
 * the homepage imports the local placeholders below so the build never breaks
 * and no region is left empty (an empty region is worse than a placeholder: it
 * is a layout shift waiting to happen).
 *
 * Each placeholder is the EXACT box the real component will occupy, so swapping
 * them in causes zero layout shift.
 *
 * SWAP MAP
 * --------
 *   placeholders.tsx        →  real component
 *   ─────────────────────────────────────────────────────────────────────────
 *   <QuoteEstimatorWidget/> →  @/components/widgets/quote/QuoteEstimator
 *   <ReviewsCarouselWidget/>→  @/components/widgets/reviews/ReviewsCarousel
 *   <GalleryTeaserWidget/>  →  @/components/widgets/gallery/GalleryTeaser
 *   <RatingSummaryWidget/>  →  @/components/widgets/reviews/RatingSummary
 *
 * To swap: delete this file and update the imports in
 * `src/components/home/QuoteTeaser.tsx` and `src/components/home/SocialProof.tsx`.
 */

/** Backing store for the estimator once it lands. Kept explicit so the swap is obvious. */
function QuoteEstimatorWidget(): React.ReactElement {
  return (
    <Card tone="surface" padding="lg" className="h-full">
      <div className="flex flex-col gap-4">
        <div>
          <p className="eyg-eyebrow text-brand-500">Instant quote</p>
          <h3 className="mt-2 text-h3 font-extrabold">Price your service in about 20 seconds.</h3>
          <p className="mt-2 text-muted-foreground">
            Pick your vehicle, choose the jobs, and get a straight peso range — no account, no
            commitment. The estimator is loading; the phone number works right now if you would
            rather talk to a person.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
          {["Vehicle", "Services", "Contact"].map((label) => (
            <div key={label} className="flex flex-col gap-2">
              <span className="eyg-eyebrow text-muted-foreground">{label}</span>
              <Skeleton shape="block" className="h-11 rounded-eyebrow" />
            </div>
          ))}
        </div>

        <Skeleton shape="block" className="h-14 rounded-eyebrow" />
        <Skeleton shape="text" className="w-2/3" />
      </div>
    </Card>
  );
}

/** Placeholder for the widgets agent's review carousel. */
function ReviewsCarouselWidget(): React.ReactElement {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i} tone="surface" padding="md">
          <Skeleton shape="pill" />
          <Skeleton shape="text" className="mt-4" />
          <Skeleton shape="text" className="mt-2" />
          <Skeleton shape="text" className="mt-2 w-1/2" />
        </Card>
      ))}
    </div>
  );
}

/** Placeholder for the aggregate-rating block. */
function RatingSummaryWidget(): React.ReactElement {
  return (
    <Card tone="surface" padding="md" className="h-full">
      <Skeleton shape="pill" />
      <Skeleton shape="title" className="mt-4" />
      <Skeleton shape="text" className="mt-3" />
    </Card>
  );
}

/** Placeholder for the before/after gallery teaser. */
function GalleryTeaserWidget(): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} shape="block" className="aspect-4/3 rounded-card" />
      ))}
    </div>
  );
}

export {
  GalleryTeaserWidget,
  QuoteEstimatorWidget,
  RatingSummaryWidget,
  ReviewsCarouselWidget,
};
