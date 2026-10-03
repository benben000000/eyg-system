/**
 * EYG — SERVICES SKELETONS
 * ============================================================================
 * Suspense fallbacks for the async catalogue. The shapes match the real layout
 * exactly so nothing shifts when `getServices()` resolves.
 * ============================================================================
 */

import { Container } from "@/components/pages/_shims";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export function CategoryGridSkeleton(): React.ReactElement {
  return (
    <div className="space-y-14" aria-hidden="true">
      {[0, 1].map((group) => (
        <section key={group}>
          <div className="mb-5 max-w-prose space-y-3">
            <Skeleton shape="pill" />
            <Skeleton shape="title" className="h-9 w-64" />
            <SkeletonText lines={2} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="flex flex-col rounded-panel border border-border bg-surface p-5 sm:p-6"
              >
                <div className="flex gap-4">
                  <Skeleton shape="circle" className="size-11" />
                  <div className="flex-1 space-y-2">
                    <Skeleton shape="text" className="h-5 w-3/4" />
                    <SkeletonText lines={2} />
                    <Skeleton shape="text" className="h-4 w-1/3" />
                  </div>
                </div>
                <Skeleton shape="block" className="mt-4 h-16" />
                <Skeleton shape="block" className="mt-5 h-12" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function PackageGridSkeleton(): React.ReactElement {
  return (
    <Container className="space-y-6" aria-hidden="true">
      <Skeleton shape="title" className="h-10 w-3/4" />
      <Skeleton shape="block" className="h-64" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} shape="block" className="h-80" />
        ))}
      </div>
    </Container>
  );
}
