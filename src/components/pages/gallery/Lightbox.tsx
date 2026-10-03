/**
 * EYG — GALLERY LIGHTBOX
 * ============================================================================
 * A focus-trapped dialog that is fully operable by keyboard alone:
 *
 *   • `role="dialog"` + `aria-modal="true"` + a real `aria-labelledby`
 *   • focus moves into the dialog on open and is RESTORED to the trigger on close
 *   • Tab and Shift+Tab cycle inside the dialog and cannot escape it
 *   • ← / → move between images, Home / End jump to the ends
 *   • Escape closes
 *   • a visible image counter ("3 of 12")
 *   • the background is `inert`-like: it is scroll-locked and not focusable,
 *     because every focusable element outside is unreachable by the tab loop
 *
 * Nothing about it depends on a drag gesture.
 * ============================================================================
 */

"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { BrandPlate } from "@/components/pages/_shared";
import type { GalleryImage } from "@/content/catalog";
import { ChevronLeft, ChevronRight, X } from "@/components/pages/_icons";

export interface LightboxItem {
  id: string;
  /** MANDATORY, descriptive. Rendered as the image's `alt`. */
  alt: string;
  caption: string;
  image: GalleryImage;
}

export interface LightboxProps {
  items: readonly LightboxItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function Lightbox({ items, index, onIndexChange, onClose }: LightboxProps): React.ReactElement | null {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const item = items[index];

  // Remember what had focus, so it can be restored on unmount.
  React.useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    if (!node) return;
    const first = node.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node).focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      triggerRef.current?.focus?.();
    };
  }, []);

  const go = React.useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      onIndexChange((index + delta + items.length) % items.length);
    },
    [index, items.length, onIndexChange],
  );

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          return;
        case "ArrowRight":
          e.preventDefault();
          go(1);
          return;
        case "ArrowLeft":
          e.preventDefault();
          go(-1);
          return;
        case "Home":
          e.preventDefault();
          onIndexChange(0);
          return;
        case "End":
          e.preventDefault();
          onIndexChange(items.length - 1);
          return;
        case "Tab": {
          // Focus trap. Keeps Tab inside the dialog.
          const node = dialogRef.current;
          if (!node) return;
          const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
          if (focusables.length === 0) {
            e.preventDefault();
            node.focus();
            return;
          }
          const firstEl = focusables[0];
          const lastEl = focusables[focusables.length - 1];
          if (!firstEl || !lastEl) return;
          if (e.shiftKey && document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          } else if (!e.shiftKey && document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
          return;
        }
        default:
          return;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [go, items.length, onClose, onIndexChange]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-(--z-modal) flex flex-col bg-ink-950/95 p-4 backdrop-blur-sm sm:p-6"
      // A click on the backdrop closes; a click inside must not.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lightbox-title"
        aria-describedby="lightbox-caption"
        tabIndex={-1}
        className="flex size-full flex-col gap-3 outline-none"
      >
        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            id="lightbox-title"
            className="tabular rounded-pill bg-ink-900 px-3.5 py-1.5 text-sm font-bold text-brand-500"
          >
            {index + 1} of {items.length}
          </p>
          <div className="flex items-center gap-2">
            <LightboxButton onClick={() => go(-1)} label="Previous photo">
              <ChevronLeft aria-hidden="true" className="size-5" />
            </LightboxButton>
            <LightboxButton onClick={() => go(1)} label="Next photo">
              <ChevronRight aria-hidden="true" className="size-5" />
            </LightboxButton>
            <LightboxButton onClick={onClose} label="Close">
              <X aria-hidden="true" className="size-5" />
            </LightboxButton>
          </div>
        </div>

        {/* ── The image ──────────────────────────────────────────────────── */}
        <figure className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-panel border border-ink-700 bg-ink-900">
            <LightboxPhoto item={item} />
          </div>
          <figcaption id="lightbox-caption" className="shrink-0 space-y-1">
            <p className="text-sm leading-relaxed text-ink-100">{item.caption}</p>
            <p className="text-xs text-ink-300">
              Use the left and right arrow keys to move between photos, Escape to close.
            </p>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

function LightboxPhoto({ item }: { item: LightboxItem }): React.ReactElement {
  const { image } = item;
  const source = image.src;
  if (!source || image.needsOwnerPhoto) {
    return <BrandPlate label={image.caption} width={image.width} height={image.height} />;
  }
  return (
    <Image
      src={source}
      alt={item.alt}
      width={image.width}
      height={image.height}
      sizes="100vw"
      className="size-full object-contain"
    />
  );
}

function LightboxButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex size-12 items-center justify-center rounded-pill border-2 border-ink-600 bg-ink-900 text-brand-500",
        "transition-colors hover:border-brand-500 hover:bg-ink-800",
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
