import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const headingVariants = cva("eyg-stripe text-eyebrow", {
  variants: {
    align: {
      left: "text-left",
      center: "mx-auto text-center",
    },
    tone: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      inverse: "text-white",
    },
  },
  defaultVariants: { align: "left", tone: "default" },
});

export interface SectionHeadingProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "title">,
    VariantProps<typeof headingVariants> {
  /** Heading text. */
  title: React.ReactNode;
  /** Small uppercase kicker above the heading. */
  eyebrow?: React.ReactNode;
  /** Supporting copy under the heading. */
  description?: React.ReactNode;
  /** Heading level. Homepage sections use h2. */
  as?: "h1" | "h2" | "h3";
  /** Required when the parent <Section> uses `aria-labelledby`. */
  id?: string;
  /** Renders the `.eyg-stripe` brand underline (the signature device). */
  stripe?: boolean;
  /** Content aligned under the heading (buttons, links). */
  children?: React.ReactNode;
}

/**
 * The one heading component. Owns the speed-stripe device so no page has to
 * remember it. `eyg-stripe` positions its bar at `bottom: -0.5rem`, hence the
 * `pb-3 mb-8` compensation when the stripe is on.
 */
export const SectionHeading = React.forwardRef<HTMLDivElement, SectionHeadingProps>(
  function SectionHeading(
    { className, title, eyebrow, description, as: Tag = "h2", id, stripe = true, align, tone, children, ...props },
    ref,
  ) {
    return (
      <div ref={ref} className={cn("max-w-prose", align === "center" && "mx-auto", className)} {...props}>
        {eyebrow ? (
          <p className={cn(headingVariants({ align, tone }), "mb-3 block")}>
            {eyebrow}
          </p>
        ) : null}
        <Tag
          id={id}
          className={cn(
            headingVariants({ align, tone }),
            "block",
            Tag === "h1" ? "text-h1" : Tag === "h2" ? "text-h2" : "text-h3",
            stripe ? "pb-3 mb-8" : "mb-4",
          )}
        >
          {title}
        </Tag>
        {description ? (
          <p className={cn("text-body-lg", tone === "inverse" ? "text-ink-200" : "text-muted-foreground")}>
            {description}
          </p>
        ) : null}
        {children}
      </div>
    );
  },
);

export { headingVariants };
