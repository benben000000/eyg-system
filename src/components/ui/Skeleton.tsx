import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Skeleton — every async region on the site reserves space with one of these
 * so nothing shifts when data lands. Animation is neutralised automatically by
 * the global `prefers-reduced-motion` rule in globals.css.
 */
const skeletonVariants = cva("animate-pulse bg-surface-muted", {
  variants: {
    shape: {
      text: "h-4 w-full rounded-eyebrow",
      heading: "h-8 w-3/4 rounded-eyebrow",
      title: "h-6 w-1/2 rounded-eyebrow",
      block: "w-full rounded-card",
      circle: "size-10 rounded-pill",
      pill: "h-8 w-24 rounded-pill",
      /** A whole card placeholder — same box as a real <Card />. */
      card: "h-64 w-full rounded-panel",
      /** A hero-sized plate. */
      plate: "h-72 w-full rounded-panel sm:h-96",
    },
  },
  defaultVariants: { shape: "text" },
});

export interface SkeletonProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof skeletonVariants> {}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { className, shape, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="presentation"
      aria-hidden="true"
      className={cn(skeletonVariants({ shape }), className)}
      {...props}
    />
  );
});

export interface SkeletonTextProps extends React.ComponentPropsWithoutRef<"div"> {
  /** Number of placeholder lines. */
  lines?: number;
  /** Width class of the final (short) line. */
  lastLineClassName?: string;
}

/** Multi-line text placeholder. Lines are equal height so the stack is stable. */
export function SkeletonText({
  lines = 3,
  className,
  lastLineClassName = "w-2/3",
  ...props
}: SkeletonTextProps): React.ReactElement {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          shape="text"
          className={i === lines - 1 ? lastLineClassName : "w-full"}
        />
      ))}
    </div>
  );
}

export { skeletonVariants };
