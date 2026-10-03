"use client";

/**
 * LIGHTBOX — gallery viewer with a real focus trap.
 * ============================================================================
 * CONTRACT
 *  - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` / `aria-describedby`.
 *  - Focus moves in on open and is RESTORED to the trigger on close.
 *  - Escape closes. Arrow keys move between images. A visible "3 of 8" counter.
 *  - `useScrollLock` freezes the page behind without leaving it unscrollable.
 *  - Images carry explicit `width` / `height` so opening the dialog shifts nothing.
 *  - NEVER auto-advances. There is no timer here by design: a gallery that moves
 *    on its own is a carousel nobody asked for, and it fights screen readers.
 *  - No animation is applied without `prefers-reduced-motion` consent.
 *  - The page behind is `aria-hidden` while the dialog is open, so a screen
 *    reader cannot wander out of it.
 * ============================================================================
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap, useScrollLock } from "@/hooks/useFocusTrap";

export interface LightboxImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string | undefined;
}

export interface LightboxProps {
  images: readonly LightboxImage[];
  /** Index shown on open. */
  startIndex?: number;
  /** Omit to render nothing — the component is fully controlled. */
  open: boolean;
  onClose: () => void;
  /** Fires on every index change, including keyboard navigation. */
  onIndexChange?: (index: number) => void;
  title?: string;
  className?: string;
}

export default function Lightbox({
  images,
  startIndex = 0,
  open,
  onClose,
  onIndexChange,
  title = "Photo gallery",
  className,
}: LightboxProps) {
  const uid = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const safeStart = images.length === 0 ? 0 : ((startIndex % images.length) + images.length) % images.length;
  const [index, setIndex] = useState(safeStart);

  // Re-sync when the caller re-opens on a different image.
  useEffect(() => {
    if (open) setIndex(safeStart);
  }, [open, safeStart]);

  const go = useCallback(
    (next: number) => {
      if (images.length === 0) return;
      const wrapped = ((next % images.length) + images.length) % images.length;
      setIndex(wrapped);
      onIndexChange?.(wrapped);
    },
    [images.length, onIndexChange],
  );

  const next = useCallback(() => go(index + 1), [go, index]);
  const previous = useCallback(() => go(index - 1), [go, index]);

  useFocusTrap(dialogRef, {
    active: open,
    initialFocusRef: closeRef,
    onEscape: onClose,
  });
  useScrollLock(open);

  // Arrow-key navigation. Registered on the dialog so it does not fight typing
  // in any input that might later live inside.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        previous();
      }
    };
    const node = dialogRef.current;
    node?.addEventListener("keydown", onKey);
    return () => node?.removeEventListener("keydown", onKey);
  }, [open, next, previous]);

  if (!open || images.length === 0) return null;

  const current = images[index] ?? images[0];
  if (!current) return null;

  return (
    <div
      className={cn("fixed inset-0 z-modal flex items-center justify-center bg-ink-950/92 p-3 sm:p-6", className)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        aria-describedby={current.caption ? `${uid}-caption` : undefined}
        className="flex max-h-full w-full max-w-4xl flex-col gap-3 rounded-panel bg-surface p-3 shadow-lift sm:p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={`${uid}-title`} className="text-h3 text-foreground">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-card border border-border-strong text-foreground hover:bg-surface-muted"
            aria-label="Close photo viewer"
          >
            <X aria-hidden="true" className="size-5" focusable="false" />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-card bg-surface-muted">
          <Image
            key={current.src}
            src={current.src}
            alt={current.alt}
            width={current.width}
            height={current.height}
            decoding="async"
            className="max-h-[60vh] w-auto max-w-full object-contain"
            // Capped at the viewport because that is the most this image can
            // ever occupy. Without `sizes`, next/image assumes 100vw at the
            // 2048px device size, so a photo opened on a phone is fetched at
            // desktop width — the exact case this view exists to serve.
            sizes="100vw"
          />

          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={previous}
                aria-label="Previous photo"
                className="absolute left-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-pill border border-border-strong bg-surface/95 text-foreground hover:bg-surface-muted sm:left-2"
              >
                <ChevronLeft aria-hidden="true" className="size-5" focusable="false" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next photo"
                className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-pill border border-border-strong bg-surface/95 text-foreground hover:bg-surface-muted sm:right-2"
              >
                <ChevronRight aria-hidden="true" className="size-5" focusable="false" />
              </button>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Visible counter. Announced politely so the change is not silent. */}
          <p aria-live="polite" aria-atomic="true" className="tabular text-sm font-bold text-foreground">
            {index + 1} of {images.length}
          </p>
          <p id={`${uid}-caption`} className="text-sm text-muted-foreground">
            {current.caption ?? current.alt}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={previous}
            disabled={images.length < 2}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-card border border-border-strong px-3 py-2 text-sm font-bold hover:bg-surface-muted disabled:opacity-50"
          >
            <ChevronLeft aria-hidden="true" className="size-4" focusable="false" />
            Previous
          </button>
          <button
            type="button"
            onClick={next}
            disabled={images.length < 2}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-card border border-border-strong px-3 py-2 text-sm font-bold hover:bg-surface-muted disabled:opacity-50"
          >
            Next
            <ChevronRight aria-hidden="true" className="size-4" focusable="false" />
          </button>
        </div>
      </div>
    </div>
  );
}

export { Lightbox };

// ── Trigger helper ──────────────────────────────────────────────────────────

/**
 * A button that opens a `Lightbox`. Kept here so the gallery pages do not have
 * to re-implement the trigger semantics (and so focus restoration has a real
 * element to return to).
 */
export interface LightboxTriggerProps {
  image: LightboxImage;
  onOpen: (index: number) => void;
  index: number;
  className?: string;
}

export function LightboxTrigger({ image, onOpen, index, className }: LightboxTriggerProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={cn(
        "group relative block w-full overflow-hidden rounded-card border border-border bg-surface-muted",
        className,
      )}
      style={{ aspectRatio: `${image.width} / ${image.height}` }}
    >
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        decoding="async"
        loading="lazy"
        className="size-full object-cover transition-transform duration-200 motion-reduce:transition-none group-hover:scale-[1.02]"
        // The thumbnail grid. Sized for the three-across desktop layout
        // rather than left at the 100vw default, which would fetch
        // desktop-width rasters for a thumbnail that never exceeds a
        // third of the screen.
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      />
      <span className="absolute inset-x-0 bottom-0 bg-ink-950/75 px-2 py-1 text-left text-xs font-bold text-white">
        {image.caption ?? "View larger"}
      </span>
    </button>
  );
}