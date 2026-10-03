import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * IconButton — square, never smaller than 44×44 so it is always a legal tap
 * target. `label` is mandatory: an icon-only control with no accessible name
 * is unusable with a screen reader.
 */
const iconButtonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center rounded-eyebrow",
    "transition-[background-color,color,border-color,transform] duration-150 ease-rapid",
    "disabled:pointer-events-none disabled:opacity-55",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:translate-y-px",
        accent: "bg-accent text-accent-foreground shadow-cta hover:bg-brand-400 hover:shadow-cta-hover active:translate-y-1",
        outline: "border border-ink-400 text-foreground hover:border-foreground hover:bg-surface-muted active:translate-y-px",
        ghost: "text-foreground hover:bg-surface-muted active:translate-y-px",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:translate-y-px",
        inverse: "border border-ink-700 bg-ink-900 text-white hover:bg-ink-800",
      },
      /** `sm` still clears 44px because the icon itself is the target. */
      size: {
        sm: "size-11",
        md: "size-11",
        lg: "size-12",
        xl: "size-14",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export interface IconButtonProps
  extends Omit<React.ComponentPropsWithoutRef<"button">, "aria-label">,
    VariantProps<typeof iconButtonVariants> {
  /** REQUIRED accessible name. */
  label: string;
  asChild?: boolean;
  /** The icon itself. Mark decorative icons `aria-hidden`. */
  children?: React.ReactNode;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant, size, label, asChild = false, children, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    >
      {children}
    </Comp>
  );
});

export { iconButtonVariants };
