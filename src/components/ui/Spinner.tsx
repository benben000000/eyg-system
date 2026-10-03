import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Spinner — use ONLY where a skeleton cannot do the job (button submit state,
 * short unknown-duration fetches). Any region with a known shape gets a
 * <Skeleton /> instead so nothing reflows when the data lands.
 */
const spinnerVariants = cva("inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent", {
  variants: {
    size: {
      xs: "h-3 w-3 border",
      sm: "h-4 w-4",
      md: "h-6 w-6",
      lg: "h-8 w-8",
    },
  },
  defaultVariants: { size: "md" },
});

export interface SpinnerProps
  extends React.ComponentPropsWithoutRef<"span">,
    VariantProps<typeof spinnerVariants> {
  /**
   * Announced to screen readers. When omitted the spinner is decorative and
   * the surrounding control is expected to carry `aria-busy`.
   */
  label?: string;
}

export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { className, size, label, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(spinnerVariants({ size }), className)}
      {...(label ? { role: "status" as const } : { "aria-hidden": true as const })}
      {...props}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
});

export { spinnerVariants };
