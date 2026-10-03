import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const progressVariants = cva("relative h-2 w-full overflow-hidden rounded-pill bg-surface-muted", {
  variants: {
    tone: {
      brand: "bg-surface-muted [&>div]:bg-brand-500",
      success: "bg-surface-muted [&>div]:bg-pit-500",
      danger: "bg-surface-muted [&>div]:bg-racing-500",
    },
  },
  defaultVariants: { tone: "brand" },
});

export interface ProgressProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "children">,
    VariantProps<typeof progressVariants> {
  /** 0–100 (or whatever `max` is). Clamped. */
  value: number;
  max?: number;
  /** Required for the accessible name. */
  label: string;
  /** Optional visible caption. */
  showValue?: boolean;
  valueText?: string;
}

/** Determinate progress. Always labelled — a bar with no name is not useful. */
export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { className, tone, value, max = 100, label, showValue, valueText, ...props },
  ref,
) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(safeMax, Math.max(0, value));
  const pct = (clamped / safeMax) * 100;

  return (
    <div ref={ref} className={cn("w-full", className)} {...props}>
      {showValue ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="eyg-eyebrow text-muted-foreground">{label}</span>
          <span className="text-sm font-bold tabular">
            {valueText ?? `${Math.round(pct)}%`}
          </span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        className={cn(progressVariants({ tone }))}
      >
        <div
          className="h-full rounded-pill transition-[width] duration-300 ease-snap"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
});

export { progressVariants };
