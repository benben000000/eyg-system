import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statVariants = cva("flex flex-col gap-1", {
  variants: {
    align: { left: "text-left", center: "items-center text-center" },
    tone: {
      default: "text-foreground",
      inverse: "text-white",
    },
  },
  defaultVariants: { align: "left", tone: "default" },
});

export interface StatProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof statVariants> {
  /** The number or short phrase. Keep it honest — no invented stats. */
  value: React.ReactNode;
  /** What the value means. */
  label: React.ReactNode;
  /** Optional supporting line. */
  hint?: React.ReactNode;
  /** Decorative leading icon. */
  icon?: React.ReactNode;
}

/** A single figure + caption. Always pairs a value with a real label. */
export const Stat = React.forwardRef<HTMLDivElement, StatProps>(function Stat(
  { className, align, tone, value, label, hint, icon, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn(statVariants({ align, tone }), className)} {...props}>
      {icon ? (
        <span aria-hidden="true" className="mb-1 inline-flex text-brand-500">
          {icon}
        </span>
      ) : null}
      <span className="text-h2 font-extrabold leading-none tracking-tight text-brand-500 tabular">
        {value}
      </span>
      <span className="eyg-eyebrow mt-2 text-muted-foreground">{label}</span>
      {hint ? <span className="text-sm text-muted-foreground">{hint}</span> : null}
    </div>
  );
});

export { statVariants };
