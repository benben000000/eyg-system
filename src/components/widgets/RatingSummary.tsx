"use client";

/**
 * RATING SUMMARY — the aggregate, with a star distribution.
 * ============================================================================
 * THE ONE RULE THIS COMPONENT EXISTS TO ENFORCE
 *  When there are no reviews, there is no average. It renders the `empty` state
 *  — a sentence in the shop's own voice plus a link to the Facebook page where
 *  real recommendations live. It never renders "0 reviews", never renders a
 *  5.0, and never renders a bar chart of five zeros, which would read as proof
 *  of something.
 *
 * When there ARE reviews, the average is shown with a `role="img"` star cluster
 * carrying a text equivalent (`"Rated 4.8 out of 5"`), and the distribution is
 * a real table, not a picture of one.
 * ============================================================================
 */
import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { BUSINESS } from "@/config/site";
import { cn } from "@/lib/utils";
import type { ReviewDistributionRow, ReviewDto, ReviewFeedDto } from "@/hooks/useReviews";
import { formatAverage, formatReviewCount } from "@/hooks/useReviews";
import { ButtonLink, Skeleton, Stars, WidgetCard } from "@/components/widgets/internal/ui";

export interface RatingSummaryProps {
  feed: ReviewFeedDto | null;
  /** Render skeletons instead of content. */
  loading?: boolean;
  /** The API could not be reached — collapse to one honest line. */
  unavailable?: boolean;
  unavailableMessage?: string | undefined;
  /** Compact single-row variant for the homepage hero. */
  compact?: boolean;
  /** Render a plain container instead of a bordered card (nesting contexts). */
  bare?: boolean;
  className?: string;
  headingId?: string;
}

export default function RatingSummary({
  feed,
  loading = false,
  unavailable = false,
  unavailableMessage,
  compact = false,
  bare = false,
  className,
  headingId,
}: RatingSummaryProps) {
  // Nesting guard: `ReviewsFeed` already owns a card, so this can render inside it.
  const wrap = (node: ReactNode) =>
    bare ? (
      <div className={cn("flex flex-col gap-3", className)}>{node}</div>
    ) : (
      <WidgetCard className={cn("flex flex-col gap-3", className)}>{node}</WidgetCard>
    );

  if (loading) {
    return wrap(
      <>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </>,
    );
  }

  // ── API down: one honest line, no invented numbers. ──────────────────────
  if (unavailable) {
    return wrap(
      <>
        <p id={headingId} className="text-sm leading-relaxed text-muted-foreground">
          {unavailableMessage ??
            "We could not load our customer ratings just now. Our Facebook page has the latest ones in the customers' own words."}
        </p>
        <FacebookLink />
      </>,
    );
  }

  const hasReviews = feed !== null && feed.count > 0 && feed.reviews.length > 0;
  const average = hasReviews ? formatAverage(feed.average) : null;

  // ── Empty: designed, honest, in the shop's voice. ────────────────────────
  if (!hasReviews || average === null) {
    return wrap(
      <>
        <h3 id={headingId} className="text-h3 text-foreground">
          Straight from our customers
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We have not published online reviews yet. We ask every customer for a review after each
          job, and when we have enough of them we will put them here — in their own words, not
          edited.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          In the meantime, the best place to see what people say about us is the comments on our own
          page.
        </p>
        <FacebookLink label="Read our customer comments on Facebook" />
      </>,
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  const distribution = normaliseDistribution(feed.distribution, feed.reviews);
  const maxCount = Math.max(1, ...distribution.map((row) => row.count));

  if (compact) {
    return (
      <div
        className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}
        aria-labelledby={headingId}
      >
        <span id={headingId} className="flex items-center gap-1.5">
          <Stars value={Number(average)} />
          <span className="text-sm font-bold text-foreground">{average}</span>
        </span>
        <span className="text-sm text-muted-foreground">
          {formatReviewCount(feed.count)}
          {feed.sourceLabel ? ` · ${feed.sourceLabel}` : ""}
        </span>
      </div>
    );
  }

  return wrap(
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-baseline gap-1.5">
          <span
            aria-hidden="true"
            className="font-display text-4xl font-extrabold tabular text-foreground"
          >
            {average}
          </span>
          <span className="sr-only">Average rating {average} out of 5</span>
          <Stars value={Number(average)} size={20} />
        </span>
        <p id={headingId} className="text-sm text-muted-foreground">
          {formatReviewCount(feed.count)}
          {feed.sourceLabel ? ` · ${feed.sourceLabel}` : ""}
        </p>
      </div>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">How the {feed.count} ratings are spread across five stars</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Stars</th>
            <th scope="col">Number of reviews</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {distribution.map((row) => (
            <tr key={row.star}>
              <th scope="row" className="w-20 py-1 pr-2 text-left align-middle">
                <span className="inline-flex items-center gap-1">
                  <Star aria-hidden="true" className="size-3.5 text-brand-500" focusable="false" />
                  <span className="tabular font-bold">{row.star}</span>
                  <span className="sr-only">star{row.star === 1 ? "" : "s"}</span>
                </span>
              </th>
              <td className="w-8 py-1 pr-2 align-middle tabular text-muted-foreground">{row.count}</td>
              <td className="py-1 align-middle">
                <span
                  className="block h-2.5 w-full overflow-hidden rounded-pill bg-surface-muted"
                  role="presentation"
                >
                  <span
                    className="block h-full rounded-pill bg-brand-500"
                    style={{ width: `${Math.round((row.count / maxCount) * 100)}%` }}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <FacebookLink />
    </>
  );
}

function FacebookLink({ label }: { label?: string }) {
  return (
    <ButtonLink
      href={BUSINESS.social.facebook}
      target="_blank"
      rel="noopener noreferrer"
      variant="secondary"
      className="self-start"
    >
      {label ?? "Read more on Facebook"}
      <span aria-hidden="true">↗</span>
    </ButtonLink>
  );
}

/** Guarantees five rows, 5 → 1, even if the API sent a sparse object. */
function normaliseDistribution(
  rows: readonly ReviewDistributionRow[] | undefined,
  reviews: readonly ReviewDto[],
): ReviewDistributionRow[] {
  const byStar = new Map<number, number>();
  for (const row of rows ?? []) {
    if (row && Number.isFinite(row.count)) byStar.set(row.star, Math.max(0, Math.round(row.count)));
  }
  return [5, 4, 3, 2, 1].map((star) => {
    const direct = byStar.get(star);
    const computed = reviews.filter((r) => Math.round(r.rating) === star).length;
    return { star: star as 1 | 2 | 3 | 4 | 5, count: direct ?? computed };
  });
}

export { RatingSummary };