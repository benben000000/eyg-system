"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Modal & Sheet, both on Radix Dialog.
 *
 * Radix gives us, for free: `role="dialog"` + `aria-modal="true"`, focus trap,
 * Escape to close, scroll lock, `focus` restoration to the trigger, and
 * pointer-events blocking on the rest of the page. Do not reimplement these.
 */
const overlayVariants = cva(
  "fixed inset-0 z-[var(--z-overlay)] bg-ink-950/70 backdrop-blur-sm",
  {
    variants: {
      tone: { default: "", light: "bg-ink-950/50" },
    },
    defaultVariants: { tone: "default" },
  },
);

const contentBase = cva(
  [
    "z-[var(--z-modal)] bg-surface text-foreground shadow-lift",
    "max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain",
  ].join(" "),
);

const modalVariants = cva(contentBase, {
  variants: {
    size: {
      sm: "w-[calc(100vw-2rem)] max-w-sm rounded-panel p-5",
      md: "w-[calc(100vw-2rem)] max-w-lg rounded-panel p-6",
      lg: "w-[calc(100vw-2rem)] max-w-2xl rounded-panel p-6 sm:p-8",
      xl: "w-[calc(100vw-2rem)] max-w-4xl rounded-panel p-6 sm:p-8",
    },
    position: {
      center: "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
      top: "fixed inset-x-0 top-0",
      bottom: "fixed inset-x-0 bottom-0",
      left: "fixed inset-y-0 left-0",
      right: "fixed inset-y-0 right-0",
    },
  },
  defaultVariants: { size: "md", position: "center" },
});

export type ModalProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>;
export const Modal = DialogPrimitive.Root;
export const ModalTrigger = DialogPrimitive.Trigger;
export const ModalClose = DialogPrimitive.Close;

export interface ModalOverlayProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>,
    VariantProps<typeof overlayVariants> {}

export const ModalOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  ModalOverlayProps
>(function ModalOverlay({ className, tone, ...props }, ref) {
  return <DialogPrimitive.Overlay ref={ref} className={cn(overlayVariants({ tone }), className)} {...props} />;
});

export interface ModalContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof modalVariants> {
  /** REQUIRED — Radix uses it as the dialog's accessible name. */
  title: string;
  description?: string;
  /** Hide the visual close button but keep Escape working. */
  hideClose?: boolean;
}

/** Portal + overlay + content in one. `title` is mandatory for a11y. */
export const ModalContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  ModalContentProps
>(function ModalContent({ className, size, position, title, description, hideClose, children, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <ModalOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(modalVariants({ size, position }), className)}
        {...props}
      >
        <div className="mb-4 pr-10">
          <DialogPrimitive.Title className="text-h3 font-extrabold leading-tight">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        {!hideClose ? (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-eyebrow text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            aria-label="Close"
          >
            <X aria-hidden="true" className="size-5" />
          </DialogPrimitive.Close>
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

/** Convenience: a bottom sheet, which is the right pattern on mobile. */
export interface SheetProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {
  side?: "bottom" | "right" | "left";
}

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

const sheetVariants = cva(contentBase, {
  variants: {
    side: {
      bottom: "fixed inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-panel p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]",
      right: "fixed inset-y-0 right-0 h-dvh w-[min(22rem,90vw)] rounded-l-panel p-5",
      left: "fixed inset-y-0 left-0 h-dvh w-[min(22rem,90vw)] rounded-r-panel p-5",
    },
  },
  defaultVariants: { side: "bottom" },
});

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  title: string;
  description?: string;
  hideClose?: boolean;
}

export const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(function SheetContent({ className, side, title, description, hideClose, children, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <ModalOverlay />
      <DialogPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
        {side === "bottom" ? (
          <div aria-hidden="true" className="mx-auto mb-4 h-1 w-12 rounded-pill bg-border-strong" />
        ) : null}
        <div className="mb-4 pr-10">
          <DialogPrimitive.Title className="text-h3 font-extrabold leading-tight">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        {!hideClose ? (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-eyebrow text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            aria-label="Close"
          >
            <X aria-hidden="true" className="size-5" />
          </DialogPrimitive.Close>
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
