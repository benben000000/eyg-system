import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  /** Decorative glyph or illustration. Keep it `aria-hidden`. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary recovery action. */
  action?: React.ReactNode;
  /** Secondary recovery action. */
  secondaryAction?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

/**
 * A real empty state — never "nothing here". Always offers a way forward.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  className,
  ...props
}: EmptyStateProps): React.ReactElement {
  const pad = size === "sm" ? "p-6" : size === "lg" ? "p-12" : "p-8";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-border-strong bg-surface-muted text-center",
        pad,
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="text-3xl leading-none text-brand-500">
          {icon}
        </span>
      ) : null}
      <p className="text-h3 font-extrabold text-foreground">{title}</p>
      {description ? (
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
