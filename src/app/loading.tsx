import type { ReactElement } from "react";
import { Container } from "@/components/ui/Container";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

/**
 * Route-level loading state.
 *
 * A real skeleton, never a spinner: every box below matches the size of the
 * content that will replace it, so the page does not jump when it lands.
 */
export default function Loading(): ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading this page"
      className="bg-ink-950 text-white"
    >
      <span className="sr-only">Loading…</span>

      <Container className="py-12 sm:py-16">
        {/* Hero placeholder */}
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <Skeleton shape="pill" />
            <Skeleton shape="heading" className="mt-6" />
            <Skeleton shape="heading" className="mt-3 w-2/3" />
            <SkeletonText lines={3} className="mt-6" />
            <div className="mt-8 flex gap-3">
              <Skeleton shape="block" className="h-14 w-56 rounded-eyebrow" />
              <Skeleton shape="block" className="h-14 w-48 rounded-eyebrow" />
            </div>
          </div>
          <Skeleton shape="card" className="hidden lg:block" />
        </div>
      </Container>

      <div className="border-t border-ink-800 bg-background py-14">
        <Container>
          <Skeleton shape="pill" />
          <Skeleton shape="title" className="mt-4" />
          <SkeletonText lines={2} className="mt-4 max-w-prose" />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} shape="card" />
            ))}
          </div>
        </Container>
      </div>
    </div>
  );
}
