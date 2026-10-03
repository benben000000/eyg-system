"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Toast system — hand-rolled because `@radix-ui/react-toast` is not in the
 * dependency set and package.json is orchestrator-owned. It reproduces the
 * parts that matter for accessibility:
 *
 *  • polite live region (`aria-live="polite"`) for info + success
 *  • `role="alert"` region for danger + warning (interrupts immediately)
 *  • auto-dismiss timers that pause on hover/focus so they cannot be missed
 *  • a real dismiss button, keyboard reachable
 */

export type ToastTone = "info" | "success" | "warning" | "danger";

export interface ToastInput {
  title: string;
  description?: React.ReactNode;
  tone?: ToastTone;
  /** ms. 0 keeps it until dismissed. */
  duration?: number;
}

export interface ToastItem extends ToastInput {
  id: string;
  tone: ToastTone;
  duration: number;
}

interface ToastContextValue {
  toasts: readonly ToastItem[];
  toast: (input: ToastInput) => string;
  info: (title: string, description?: React.ReactNode) => string;
  success: (title: string, description?: React.ReactNode) => string;
  warning: (title: string, description?: React.ReactNode) => string;
  error: (title: string, description?: React.ReactNode) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <Providers> (ToastProvider).");
  }
  return ctx;
}

let counter = 0;
const nextId = () => `toast-${(counter += 1)}`;

const toastToneVariants = cva("flex items-start gap-3 rounded-card border p-4 shadow-lift", {
  variants: {
    tone: {
      info: "border-ink-400 bg-ink-950 text-white",
      success: "border-pit-600 bg-ink-950 text-white",
      warning: "border-brand-500 bg-ink-950 text-white",
      danger: "border-racing-500 bg-ink-950 text-white",
    },
  },
  defaultVariants: { tone: "info" },
});

const TONE_ICON: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}): React.ReactElement {
  const [paused, setPaused] = React.useState(false);
  const Glyph = TONE_ICON[item.tone];

  React.useEffect(() => {
    if (item.duration <= 0 || paused) return;
    const timer = window.setTimeout(() => onDismiss(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [item.duration, item.id, paused, onDismiss]);

  return (
    <div
      className={cn(toastToneVariants({ tone: item.tone }), "pointer-events-auto w-full max-w-sm")}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-brand-500">
        <Glyph className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{item.title}</p>
        {item.description ? (
          <div className="mt-0.5 text-sm text-ink-200">{item.description}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={`Dismiss: ${item.title}`}
        className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-eyebrow text-ink-300 transition-colors hover:bg-ink-800 hover:text-white"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = React.useCallback(() => setToasts([]), []);

  const toast = React.useCallback((input: ToastInput) => {
    const id = nextId();
    setToasts((prev) => [
      ...prev.slice(-4),
      { id, tone: "info", duration: 5000, ...input },
    ]);
    return id;
  }, []);

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toasts,
      toast,
      dismiss,
      dismissAll,
      info: (title, description) => toast({ title, description, tone: "info" }),
      success: (title, description) => toast({ title, description, tone: "success" }),
      warning: (title, description) => toast({ title, description, tone: "warning" }),
      error: (title, description) => toast({ title, description, tone: "danger", duration: 8000 }),
    }),
    [toasts, toast, dismiss, dismissAll],
  );

  const polite = toasts.filter((t) => t.tone === "info" || t.tone === "success");
  const assertive = toasts.filter((t) => t.tone === "danger" || t.tone === "warning");

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 z-[var(--z-toast)] flex flex-col items-center gap-2",
          "px-3 pb-[calc(var(--mobile-action-bar-height)+1rem+env(safe-area-inset-bottom,0px))]",
          "sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end sm:pb-0 sm:pr-0",
        )}
      >
        <div aria-live="polite" aria-atomic="false" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {polite.map((item) => (
            <ToastCard key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </div>
        <div role="alert" aria-live="assertive" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {assertive.map((item) => (
            <ToastCard key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export type ToastViewportProps = VariantProps<typeof toastToneVariants>;
export { toastToneVariants };
