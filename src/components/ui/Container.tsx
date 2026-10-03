import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const containerVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    size: {
      /** --container-page (76rem) — the default page gutter. */
      page: "max-w-page",
      /** --container-prose (44rem) — long-form copy, FAQ answers. */
      prose: "max-w-prose",
      /** Full bleed with only the horizontal gutter. */
      full: "max-w-none",
    },
  },
  defaultVariants: { size: "page" },
});

export interface ContainerProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof containerVariants> {
  as?: React.ElementType;
}

/** Horizontal page gutter + max width. One per page section, never nested. */
export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(function Container(
  { className, size, as: Tag = "div", ...props },
  ref,
) {
  return (
    <Tag ref={ref} className={cn(containerVariants({ size }), className)} {...props} />
  );
});

export { containerVariants };
