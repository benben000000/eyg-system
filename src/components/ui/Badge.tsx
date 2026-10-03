import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge — short status/label chip. Badges are always textual, so colour is
 * decorative reinforcement rather than the sole signal. For state that MUST
 * be distinguishable without colour, use <Alert /> instead.
 */
const badgeVariants = cva(
  // `rounded-eyebrow` (2px), not `rounded-pill`: `--radius-eyebrow: 2px` exists in
  // `globals.css` precisely as the deliberate motorsport squareness rule. A 999px
  // pill reads as a consumer-app chip and fights the EYG mark.
  "inline-flex items-center gap-1.5 rounded-eyebrow border font-bold uppercase tracking-widest whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface-muted text-muted-foreground",
        brand: "border-brand-500 bg-brand-500 text-ink-950",
        outline: "border-ink-400 text-foreground",
        success: "border-pit-600 bg-pit-500 text-ink-950",
        danger: "border-racing-600 bg-racing-500 text-white",
        info: "border-ink-400 bg-ink-100 text-ink-950",
        inverse: "border-transparent bg-ink-950 text-white",
      },
      size: {
        sm: "px-2 py-0.5 text-eyebrow",
        md: "px-3 py-1 text-eyebrow",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export interface BadgeProps
  extends React.ComponentPropsWithoutRef<"span">,
    VariantProps<typeof badgeVariants> {
  /** Small leading dot. Purely decorative — pair with text. */
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone, size, dot, children, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-pill bg-current" /> : null}
      {children}
    </span>
  );
});

export { badgeVariants };
