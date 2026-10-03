import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Card — the base surface. Every variant is a token pair, never a raw hex.
 * `interactive` adds a lift + border change on hover and is only for things
 * that are genuinely a link/button (pair it with `focus-within`).
 */
const cardVariants = cva("rounded-panel", {
  variants: {
    tone: {
      /** Flat panel on the page background. */
      surface: "border border-border bg-surface",
      /** Recessed panel, for code/quote shells. */
      muted: "border border-border bg-surface-muted",
      /** High-contrast marketing band. */
      inverse: "border border-ink-800 bg-ink-950 text-white",
      /** Brand-yellow plate. Ink text only. */
      accent: "border border-brand-700 bg-brand-500 text-ink-950",
      /** No fill — for images that provide their own surface. */
      bare: "border border-transparent bg-transparent",
    },
    elevation: {
      flat: "shadow-none",
      plate: "shadow-plate",
      lift: "shadow-lift",
    },
    interactive: {
      true: "transition-[transform,box-shadow,border-color] duration-200 ease-snap hover:-translate-y-0.5 hover:shadow-lift focus-within:shadow-lift",
      false: "",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-5 sm:p-6",
      lg: "p-6 sm:p-8",
    },
  },
  defaultVariants: { tone: "surface", elevation: "plate", interactive: false, padding: "md" },
});

export interface CardProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, tone, elevation, interactive, padding, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(cardVariants({ tone, elevation, interactive, padding }), className)}
      {...props}
    />
  );
});

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props} />;
});

export interface CardTitleProps extends React.ComponentPropsWithoutRef<"h3"> {
  /** Heading level. Defaults to h3 so cards sit under a section h2. */
  as?: "h2" | "h3" | "h4";
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle(
  { className, as: Tag = "h3", ...props },
  ref,
) {
  return (
    <Tag ref={ref} className={cn("text-h3 leading-tight", className)} {...props} />
  );
});

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<"p">
>(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn("text-muted-foreground", className)} {...props} />;
});

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(function CardContent({ className, ...props }, ref) {
  return <div ref={ref} className={cn("mt-4", className)} {...props} />;
});

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(function CardFooter({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("mt-5 flex flex-wrap items-center gap-3", className)}
      {...props}
    />
  );
});

export { cardVariants };
