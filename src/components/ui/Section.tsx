import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Container } from "./Container";

const sectionVariants = cva("relative", {
  variants: {
    tone: {
      /** Page background. */
      default: "bg-background text-foreground",
      /** One step up — alternates with `default` down the page. */
      muted: "bg-surface-muted text-foreground",
      /** Ink band for closing CTAs and emergency lanes. */
      inverse: "bg-ink-950 text-white",
      /** Brand-yellow band. Ink text only. */
      accent: "bg-brand-500 text-ink-950",
    },
    spacing: {
      none: "",
      sm: "py-10 sm:py-12",
      md: "py-14 sm:py-20",
      lg: "py-20 sm:py-28",
    },
  },
  defaultVariants: { tone: "default", spacing: "md" },
});

export interface SectionProps
  extends Omit<React.ComponentPropsWithoutRef<"section">, "children">,
    VariantProps<typeof sectionVariants> {
  /** Section heading id — pair with `aria-labelledby` for a named landmark. */
  labelledBy?: string;
  /** Inner gutter. Set false for full-bleed sections (hero, image bands). */
  contained?: boolean;
  children?: React.ReactNode;
}

/**
 * A real `<section>` landmark. Always pass `labelledBy` (or an `aria-label`)
 * so the section is nameable in the landmarks list.
 */
export const Section = React.forwardRef<HTMLElement, SectionProps>(function Section(
  { className, tone, spacing, labelledBy, contained = true, children, ...props },
  ref,
) {
  return (
    <section
      ref={ref}
      aria-labelledby={labelledBy}
      className={cn(sectionVariants({ tone, spacing }), className)}
      {...props}
    >
      {contained ? <Container>{children}</Container> : children}
    </section>
  );
});

export { sectionVariants };
