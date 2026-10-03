import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type AlertTone = "info" | "success" | "warning" | "danger";

/**
 * Alert — a status message. Every tone ships an icon AND a spoken word, so the
 * state is never communicated by colour alone (WCAG 1.4.1).
 */
const alertVariants = cva("flex gap-3 rounded-card border", {
  variants: {
    tone: {
      info: "border-ink-400 bg-surface-muted text-foreground",
      // THEME-AWARE. These were light-mode tints only, so on the dark default
      // theme an alert rendered as a pale card with pale text — the validation
      // feedback a customer is looking for, made unreadable.
      success:
        "border-pit-600 bg-pit-50 text-pit-900 dark:border-pit-500 dark:bg-ink-900 dark:text-pit-100",
      warning:
        "border-brand-600 bg-brand-50 text-brand-900 dark:border-brand-500 dark:bg-ink-900 dark:text-brand-100",
      danger:
        "border-racing-600 bg-racing-50 text-racing-900 dark:border-racing-500 dark:bg-ink-900 dark:text-racing-100",
    },
    size: { sm: "p-3", md: "p-4", lg: "p-5" },
  },
  defaultVariants: { tone: "info", size: "md" },
});

const TONE_WORD: Record<AlertTone, string> = {
  info: "Note",
  success: "Success",
  warning: "Heads up",
  danger: "Problem",
};

const TONE_ICON: Record<AlertTone, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export interface AlertProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "title">,
    VariantProps<typeof alertVariants> {
  /** Short headline. */
  title?: React.ReactNode;
  /** Body copy. */
  children?: React.ReactNode;
  /** Override the live-region role. `alert` interrupts; `status` is polite. */
  role?: "status" | "alert";
  /** Custom leading icon (caller marks it `aria-hidden`). */
  icon?: React.ReactNode;
  /** Trailing action (usually a link or button). */
  action?: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { className, tone = "info", size, title, children, role, icon, action, ...props },
  ref,
) {
  const resolved = (tone ?? "info") as AlertTone;
  const Glyph = TONE_ICON[resolved];
  return (
    <div
      ref={ref}
      role={role ?? (resolved === "danger" || resolved === "warning" ? "alert" : "status")}
      className={cn(alertVariants({ tone: resolved, size }), className)}
      {...props}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        {icon ?? <Glyph className="size-5" />}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        {title ? (
          <p className="font-bold">
            <span className="sr-only">{TONE_WORD[resolved]}: </span>
            {title}
          </p>
        ) : null}
        {children ? <div className={cn("opacity-90", title && "mt-1")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
});

export { alertVariants };
