import * as React from "react";
import { Check } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const checkboxVariants = cva(
  [
    "peer inline-flex size-5 shrink-0 appearance-none rounded-eyebrow border border-ink-400 bg-surface",
    "transition-colors duration-150 ease-rapid hover:border-foreground",
    "focus-visible:border-brand-500",
    "disabled:cursor-not-allowed disabled:opacity-60",
    "aria-[invalid=true]:border-racing-500",
  ],
  {
    variants: {
      tone: { default: "", danger: "" },
    },
    defaultVariants: {},
  },
);

export interface CheckboxProps
  extends Omit<React.ComponentPropsWithoutRef<"input">, "type" | "size">,
    VariantProps<typeof checkboxVariants> {}

/**
 * Native `<input type="checkbox">` behind a custom box. Native is deliberate:
 * it gives correct keyboard behaviour, form participation and `required`
 * semantics for free, and Radix Checkbox is not in the dependency set.
 *
 * The checkmark is a sibling driven by `peer-checked`, so the input itself is
 * never hidden and stays focusable/announced.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, tone, ...props },
  ref,
) {
  return (
    <span className="relative inline-flex items-center">
      <input ref={ref} type="checkbox" className={cn(checkboxVariants({ tone }), className)} {...props} />
      <Check
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 size-5 text-accent-foreground opacity-0 peer-checked:opacity-100"
        strokeWidth={3}
      />
    </span>
  );
});

export { checkboxVariants };
