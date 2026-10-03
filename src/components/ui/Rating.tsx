import * as React from "react";
import { Star } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const ratingVariants = cva("flex", {
  variants: {
    size: {
      sm: "gap-0.5 [&_svg]:size-3.5",
      md: "gap-1 [&_svg]:size-4",
      lg: "gap-1 [&_svg]:size-6",
    },
  },
  defaultVariants: { size: "md" },
});

export interface RatingProps
  extends Omit<React.ComponentPropsWithoutRef<"span">, "children">,
    VariantProps<typeof ratingVariants> {
  /** Score out of `max`. */
  value: number;
  max?: number;
  /**
   * Number of reviews. `0`, `null` or `undefined` means "no published reviews
   * yet" — in that case no numeric score is rendered, only honest copy.
   */
  count?: number | null;
  /** Explicit accessible label. Overrides the generated one. */
  label?: string;
  /** Copy shown when `count` is 0/absent. */
  unratedLabel?: string;
  /** Render the numeric score next to the stars. Requires `count > 0`. */
  showValue?: boolean;
  /**
   * Render the stars even with no review count. Off by default: drawing four
   * and a half filled stars next to "no reviews yet" is a claim the shop has
   * not earned.
   */
  showStarsWhenUnrated?: boolean;
}

/** Pre-keyed star entries. Returning the id here keeps the array index out of
 *  the React key entirely. */
function stars(value: number, max: number): Array<{ id: string; filled: boolean }> {
  const rounded = Math.round(value);
  return Array.from({ length: max }, (_, i) => ({
    id: `star-${i + 1}`,
    filled: i + 1 <= rounded,
  }));
}

/**
 * Star display. A bare "4.9" is never rendered on its own — there is always a
 * spoken label like "Rated 4.9 out of 5 from 120 written reviews", and no score
 * or stars are shown at all until a real review count exists.
 */
export const Rating = React.forwardRef<HTMLSpanElement, RatingProps>(function Rating(
  {
    className,
    size,
    value,
    max = 5,
    count,
    label,
    unratedLabel,
    showValue,
    showStarsWhenUnrated = false,
    ...props
  },
  ref,
) {
  const hasCount = typeof count === "number" && count > 0;
  const accessible = label ??
    (hasCount
      ? `Rated ${value} out of ${max} from ${count} written review${count === 1 ? "" : "s"}.`
      : (unratedLabel ?? "No written customer reviews published yet."));
  const visible = hasCount || showStarsWhenUnrated;

  return (
    <span ref={ref} className={cn("inline-flex items-center gap-2", className)} {...props}>
      {visible ? (
        <span aria-hidden="true" className={cn(ratingVariants({ size }), "text-brand-500")}>
          {stars(value, max).map((star) => (
            // `stars()` returns pre-keyed `{ id, filled }` entries rather than a
            // bare array, so no array index reaches the key. The list is a fixed
            // star scale and the ids are stable for its whole lifetime.
            <Star key={star.id} className={star.filled ? "fill-current" : "fill-none opacity-40"} />
          ))}
        </span>
      ) : null}
      {showValue && hasCount ? (
        <span className="text-sm font-bold tabular">{value.toFixed(1)}</span>
      ) : null}
      <span className="sr-only">{accessible}</span>
    </span>
  );
});

export { ratingVariants };
