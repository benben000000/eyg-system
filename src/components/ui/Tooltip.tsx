"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = ({
  delayDuration = 150,
  skipDelayDuration = 400,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...props} />
);

export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

const tooltipVariants =
  "z-[var(--z-dropdown)] max-w-xs rounded-card border border-border bg-ink-950 px-3 py-2 text-xs font-semibold text-white shadow-lift";

export type TooltipContentProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>;

/** The styled bubble. */
export const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(function TooltipContent({ className, sideOffset = 8, children, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(tooltipVariants, className)}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-ink-950" width={11} height={5} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
});

export interface TooltipProps {
  /** Plain-text hint. Announced by screen readers on focus/hover. */
  content: React.ReactNode;
  /**
   * The focusable trigger. MUST be a single element: Radix renders it through
   * `Slot`, which throws on more than one child. Any extra text (including
   * `sr-only` explanations) belongs INSIDE this element.
   */
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Disable without unmounting. */
  disabled?: boolean;
  className?: string;
}

/**
 * One-call tooltip. Wraps its own Provider so any leaf can use it without
 * ceremony. Radix renders the bubble in a portal and only shows it on hover
 * *or keyboard focus* — which is the accessible behaviour, not a nicety.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  disabled,
  className,
}: TooltipProps): React.ReactElement {
  if (disabled || !content) return <>{children}</>;
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipContent side={side} align={align} className={className}>
          {content}
        </TooltipContent>
      </TooltipPrimitive.Root>
    </TooltipProvider>
  );
}
