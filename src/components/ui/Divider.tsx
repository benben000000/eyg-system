import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const dividerVariants = cva("w-full", {
  variants: {
    /** `checker` uses the `.eyg-checker` brand device from globals.css. */
    variant: {
      solid: "h-px bg-border",
      strong: "h-0.5 bg-border-strong",
      dashed: "h-px border-t border-dashed border-border-strong",
      /** Brand: checkered-flag micro pattern. Always keeps a visible height. */
      checker: "eyg-checker h-2 opacity-60",
      brand: "h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-transparent",
    },
    inset: {
      none: "",
      sm: "my-3",
      md: "my-6",
      lg: "my-10",
    },
  },
  defaultVariants: { variant: "solid", inset: "md" },
});

export interface DividerProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof dividerVariants> {
  /** Optional centred label. Turns the rule into a labelled separator. */
  label?: React.ReactNode;
}

export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(function Divider(
  { className, variant, inset, label, ...props },
  ref,
) {
  if (!label) {
    return (
      <div
        ref={ref}
        role="presentation"
        className={cn(dividerVariants({ variant, inset }), className)}
        {...props}
      />
    );
  }
  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="horizontal"
      className={cn("flex items-center gap-3", inset === "none" ? "" : "my-6", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn("h-px flex-1", variant === "brand" ? "bg-border" : "bg-border-strong")}
      />
      <span className="eyg-eyebrow shrink-0 text-muted-foreground">{label}</span>
      <span
        aria-hidden="true"
        className={cn("h-px flex-1", variant === "brand" ? "bg-border" : "bg-border-strong")}
      />
    </div>
  );
});

export { dividerVariants };
