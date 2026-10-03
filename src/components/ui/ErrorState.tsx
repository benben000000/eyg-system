import * as React from "react";
import { RotateCw } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

/**
 * Inline error card for a failed sub-request (a widget, a form submit, a
 * sidebar). For whole-page states use `<ErrorView />` from
 * `@/components/error/ErrorView`, which also carries the phone escape hatch.
 */
const errorStateVariants = cva("flex flex-col gap-3 rounded-card border p-4", {
  variants: {
    tone: {
      // THEME-AWARE — see the note in Alert.tsx. Light-only tints made the
      // inline error states unreadable on the default dark theme.
      danger:
        "border-racing-600 bg-racing-50 text-racing-900 dark:border-racing-500 dark:bg-ink-900 dark:text-racing-100",
      warning:
        "border-brand-600 bg-brand-50 text-brand-900 dark:border-brand-500 dark:bg-ink-900 dark:text-brand-100",
    },
    size: { sm: "p-3", md: "p-4" },
  },
  defaultVariants: { tone: "danger", size: "md" },
});

export interface ErrorStateProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof errorStateVariants> {
  title?: string;
  description?: React.ReactNode;
  /** Omit when there is nothing to retry. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra recovery route, e.g. a link to another page. */
  action?: React.ReactNode;
  /** Technical detail. Only rendered in development. */
  digest?: string;
}

export function ErrorState({
  title = "That did not load",
  description = "Something went wrong on our side. Your booking was not lost — try again, or call the shop.",
  onRetry,
  retryLabel = "Try again",
  action,
  digest,
  className,
  tone,
  size,
  ...props
}: ErrorStateProps): React.ReactElement {
  const resolvedTone = (tone ?? "danger") as "danger" | "warning";
  return (
    <div
      role="alert"
      className={cn(errorStateVariants({ tone: resolvedTone, size }), className)}
      {...props}
    >
      <p className="text-sm font-bold">
        <span aria-hidden="true" className="mr-2 inline-block">
          {resolvedTone === "danger" ? "✕" : "▲"}
        </span>
        {title}
      </p>
      <p className="text-sm opacity-90">{description}</p>
      {onRetry || action ? (
        <div className="flex flex-wrap items-center gap-3">
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RotateCw aria-hidden="true" className="size-4" />
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
      {digest && process.env.NODE_ENV === "development" ? (
        <p className="font-mono text-xs opacity-70">digest: {digest}</p>
      ) : null}
    </div>
  );
}

export { errorStateVariants };
