import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, formatPesoRange } from "@/lib/utils";

const priceTagVariants = cva("inline-flex items-baseline gap-1.5", {
  variants: {
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-h3",
    },
    tone: {
      default: "text-foreground",
      accent: "text-brand-500",
      inverse: "text-white",
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: { size: "md", tone: "default" },
});

export interface PriceTagProps
  extends Omit<React.ComponentPropsWithoutRef<"p">, "children">,
    VariantProps<typeof priceTagVariants> {
  /** Lowest price. `null` renders "Ask us" — never a fake number. */
  priceMin: number | null | undefined;
  /** Highest price. `null` collapses the range to a single value. */
  priceMax?: number | null;
  /** Prefix label, e.g. "from". */
  prefix?: string;
  /** When true the range is an estimate and is labelled as such. */
  approximate?: boolean;
  /** Small print under the price. */
  note?: React.ReactNode;
}

/**
 * Renders a PH price range. `priceMin: null` deliberately produces
 * "Ask us" — an honest answer beats an invented number.
 */
export const PriceTag = React.forwardRef<HTMLParagraphElement, PriceTagProps>(function PriceTag(
  { className, size, tone, priceMin, priceMax, prefix, approximate, note, ...props },
  ref,
) {
  const value = formatPesoRange(priceMin ?? null, priceMax ?? null);
  const isAsk = value === "Ask us";
  const label = isAsk
    ? "Price: call the shop for a quote"
    : `${approximate ? "Estimated " : ""}price ${prefix ? `${prefix} ` : ""}${value}`;

  return (
    <p ref={ref} className={cn("flex flex-col gap-0.5", className)} {...props}>
      <span className={cn(priceTagVariants({ size, tone }), "font-bold tabular")}>
        {prefix && !isAsk ? <span className="text-muted-foreground">{prefix}</span> : null}
        <span>{value}</span>
        {approximate && !isAsk ? (
          <span className="text-xs font-semibold text-muted-foreground">est.</span>
        ) : null}
      </span>
      <span className="sr-only">{label}</span>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </p>
  );
});

export { priceTagVariants };
