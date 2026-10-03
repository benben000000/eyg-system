import * as React from "react";
import { cn } from "@/lib/utils";

/** Hides content visually while keeping it in the accessibility tree. */
export const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span">
>(function VisuallyHidden({ className, ...props }, ref) {
  return <span ref={ref} className={cn("sr-only", className)} {...props} />;
});
