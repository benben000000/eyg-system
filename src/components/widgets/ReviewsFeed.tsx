"use client";

/**
 * REVIEWS FEED — real customer reviews, or an honest page about having none.
 * ============================================================================
 * FOUR STATES, NO EXCEPTIONS
 *   loading    → skeletons (never a spinner, never a layout shift)
 *   success    → the list
 *   empty      → the shop's own voice + a link to the Facebook page
 *   error      → one line, plus the Facebook link, plus retry
 *
 * NEVER FABRICATE
 *  No placeholder people. No invented star average. No "0 reviews (5.0)". If the
 *  API returns nothing, this says so and points at Facebook, which is where the
 *  real recommendations are.
 *
 * CAROUSEL BEHAVIOUR (optional; the default is a plain list)
 *  If `carousel` is set, the strip is keyboard-operable (arrow keys), pauses on
 *  hover AND on focus, and does not animate at all under
 *  `prefers-reduced-motion`. It never auto-advances, so no infinite-scroll
 *  hijack is possible.
 * ============================================================================
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { BUSINESS } from "@/config/site";
import { cn } from "@/lib/utils";
import { useReviews } from "@/hooks/useReviews";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { formatShopDateTime } from "@/components/widgets/internal/time-ph";
import {
  Button,
  ButtonLink,
  Notice,
  Skeleton,
  Stars,
  WidgetCard,
} from "@/components/widgets/internal/ui";
import RatingSummary from "@/components/widgets/RatingSummary";

export interface ReviewsFeedProps {
  /** How many reviews to request. */
  limit?: number;
  /** Render as a horizontal strip instead of a list. */
  carousel?: boolean;
  /** Optional server-side seeded reviews, so the first paint is not empty. */
  initialFeed?: ReturnType<typeof useReviews>["feed"] | null;
  className?: string;
  headingId?: string;
  /** Skip the client fetch (static page rendering from a server fetch). */
  enabled?: boolean;
  title?: string;
}

export default function ReviewsFeed({
  limit = 6,
  carousel = false,
  initialFeed = null,
  className,
  headingId,
  enabled = true,
  title = "What our customers say",
}: ReviewsFeedProps) {
  const { status, feed, error, isStale, retry } = useReviews({ limit, enabled });
  const reduced = usePrefersReducedMotion();

  const trackRef = useRef<HTMLUListElement | null>(null);
  const [paused, setPaused] = useState(false);

  // Keyboard scrolling for the carousel. Arrow keys move by one card.
  useEffect(() => {
    if (!carousel) return;
    const node = trackRef.current;
    if (!node) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const card = node.firstElementChild as HTMLElement | null;
      const step = (card?.offsetWidth ?? 280) + 16;
      node.scrollBy({ left: event.key === "ArrowRight" ? step : -step, behavior: reduced ? "auto" : "smooth" });
      event.preventDefault();
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [carousel, reduced]);

  const scrollBy = (direction: 1 | -1) => {
    const node = trackRef.current;
    if (!node) return;
    const card = node.firstElementChild as HTMLElement | null;
    const step = (card?.offsetWidth ?? 280) + 16;
    node.scrollBy({ left: direction * step, behavior: reduced ? "auto" : "smooth" });
  };

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (status === "loading" || status === "idle") {
    if (initialFeed && initialFeed.reviews.length > 0) {
      // SSR-seeded content: render it, and let the client revalidate quietly.
      return <Feed initialFeed={initialFeed} isStale={isStale} className={className} headingId={headingId} title={title} />;
    }
    return (
      <WidgetCard as="section" className={cn("flex flex-col gap-4", className)} aria-labelledby={headingId} aria-busy="true">
        <Skeleton className="h-6 w-52" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        <span className="sr-only" role="status">
          Loading customer reviews.
        </span>
      </WidgetCard>
    );
  }

  // ── ERROR (API down) ─────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <WidgetCard as="section" className={cn("flex flex-col gap-3", className)} aria-labelledby={headingId}>
        {feed && feed.reviews.length > 0 ? (
          // Partial success: real cached reviews plus an honest notice.
          <>
            <Notice tone="warning" title="These reviews may be out of date">
              {error ?? "We could not refresh our reviews just now."}
            </Notice>
            <Feed initialFeed={feed} isStale headingId={headingId} title={title} />
          </>
        ) : (
          <>
            <h2 id={headingId} className="text-h3 text-foreground">
              {title}
            </h2>
            <Notice
              tone="warning"
              title="We could not load customer reviews right now"
              actions={
                <>
                  <Button variant="secondary" onClick={retry}>
                    <RefreshCw aria-hidden="true" className="size-4" focusable="false" />
                    Try again
                  </Button>
                  <ButtonLink
                    href={BUSINESS.social.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="secondary"
                  >
                    Read them on Facebook ↗
                  </ButtonLink>
                </>
              }
            >
              <p>
                {error ??
                  "Our Facebook page has the latest comments from customers, in their own words."}
              </p>
            </Notice>
            <FacebookFooter />
          </>
        )}
      </WidgetCard>
    );
  }

  // ── EMPTY or SUCCESS ─────────────────────────────────────────────────────
  const current = feed ?? initialFeed;

  return (
    <Feed
      initialFeed={current}
      isStale={isStale}
      carousel={carousel}
      trackRef={trackRef}
      paused={paused}
      setPaused={setPaused}
      scrollBy={scrollBy}
      reduced={reduced}
      className={className}
      headingId={headingId}
      title={title}
    />
  );
}

// ── The list itself, shared by every state that has reviews to show ─────────

interface FeedProps {
  initialFeed: ReturnType<typeof useReviews>["feed"];
  isStale?: boolean;
  carousel?: boolean;
  trackRef?: React.RefObject<HTMLUListElement | null>;
  paused?: boolean;
  setPaused?: (v: boolean) => void;
  scrollBy?: (d: 1 | -1) => void;
  reduced?: boolean;
  className?: string;
  headingId?: string;
  title?: string;
}

function Feed({
  initialFeed,
  isStale = false,
  carousel = false,
  trackRef,
  paused = false,
  setPaused,
  scrollBy,
  reduced = false,
  className,
  headingId,
  title = "What our customers say",
}: FeedProps) {
  const hasReviews = initialFeed !== null && initialFeed.reviews.length > 0;

  return (
    <WidgetCard as="section" className={cn("flex flex-col gap-4", className)} aria-labelledby={headingId}>
      <h2 id={headingId} className="text-h3 text-foreground">
        {title}
      </h2>

      {/* The aggregate. Renders its own honest empty state when there is nothing. */}
      <RatingSummary bare feed={initialFeed} headingId={`${headingId ?? "reviews"}-rating`} />

      {hasReviews && initialFeed ? (
        carousel ? (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <ul
                ref={trackRef}
                tabIndex={0}
                onPointerEnter={() => setPaused?.(true)}
                onPointerLeave={() => setPaused?.(false)}
                onFocus={() => setPaused?.(true)}
                onBlur={() => setPaused?.(false)}
                aria-label="Customer reviews. Use the left and right arrow keys to scroll."
                className={cn(
                  "no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1",
                  paused && "[scroll-snap-type:none]",
                  reduced && "scroll-smooth",
                )}
              >
                {initialFeed.reviews.map((review) => (
                  <li key={review.id} className="w-[85%] shrink-0 snap-start sm:w-[22rem]">
                    <ReviewCard review={review} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => scrollBy?.(-1)}
                aria-label="Scroll reviews left"
                className="grid size-11 place-items-center rounded-card border border-border-strong hover:bg-surface-muted"
              >
                <ChevronLeft aria-hidden="true" className="size-5" focusable="false" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy?.(1)}
                aria-label="Scroll reviews right"
                className="grid size-11 place-items-center rounded-card border border-border-strong hover:bg-surface-muted"
              >
                <ChevronRight aria-hidden="true" className="size-5" focusable="false" />
              </button>
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {initialFeed.reviews.map((review) => (
              <li key={review.id}>
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
        )
      ) : null}

      {isStale ? (
        <p className="text-xs text-muted-foreground">
          Showing the last copy we loaded. The page may be slightly behind.
        </p>
      ) : null}

      <FacebookFooter />
    </WidgetCard>
  );
}

function ReviewCard({ review }: { review: NonNullable<ReturnType<typeof useReviews>["feed"]>["reviews"][number] }) {
  return (
    <article className="flex h-full flex-col gap-2 rounded-card border border-border bg-surface-muted p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* The author's name exactly as published. Never "A. Customer". */}
        <span className="text-sm font-bold text-foreground">{review.authorName}</span>
        {review.rating > 0 ? <Stars value={review.rating} size={14} /> : null}
      </div>

      {review.title ? <p className="text-sm font-bold text-foreground">{review.title}</p> : null}

      <p className="text-sm leading-relaxed text-foreground">{review.body}</p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
        {review.serviceTag ? (
          <span className="rounded-pill border border-border-strong px-2 py-0.5 font-semibold">
            {review.serviceTag}
          </span>
        ) : null}
        {review.publishedAt ? (
          <time dateTime={review.publishedAt}>{formatShopDateTime(review.publishedAt, { withYear: false })}</time>
        ) : null}
        {review.source === "FACEBOOK" ? <span>via Facebook</span> : null}
      </div>
    </article>
  );
}

function FacebookFooter() {
  return (
    <ButtonLink
      href={BUSINESS.social.facebook}
      target="_blank"
      rel="noopener noreferrer"
      variant="secondary"
      className="self-start"
    >
      Read more on Facebook
      <span aria-hidden="true">↗</span>
    </ButtonLink>
  );
}

export { ReviewsFeed };