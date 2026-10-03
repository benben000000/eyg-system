/**
 * EYG — BEFORE / AFTER COMPARISON SLIDER
 * ============================================================================
 * A real draggable comparison, not a decorative one:
 *
 *   • the handle is an `<input type="range">` in a real `<label>`, so it is
 *     focusable, has a genuine `value`/`min`/`max`/`aria-valuenow`, and works
 *     with ← / → / Home / End out of the box
 *   • a `pointerdown`/`pointermove` drag on the track updates the same value
 *   • a `NON-DRAG FALLBACK`: two buttons ("Show before" / "Show after") snap the
 *     handle to 0% and 100%, so the comparison is readable with a mouse, a
 *     finger, a keyboard, or a screen reader with no drag capability at all
 *   • `prefers-reduced-motion` removes the transition entirely
 *
 * The two images are clipped with `clip-path`, not two stacked images with
 * opacity — a clip is cheaper and does not make the hidden layer untappable.
 * ============================================================================
 */

"use client";

import * as React from "react";
import Image from "next/image";
import { clamp, cn } from "@/lib/utils";
import type { GalleryImage } from "@/content/catalog";
import { BrandPlate } from "@/components/pages/_shared";
import { Button } from "@/components/pages/_shims";
import { ChevronLeft, ChevronRight, Maximize2 } from "@/components/pages/_icons";

export interface BeforeAfterComparisonProps {
  image: GalleryImage;
  /** Opens the lightbox on the "after" frame. */
  onOpen: () => void;
}

export function BeforeAfterComparison({
  image,
  onOpen,
}: BeforeAfterComparisonProps): React.ReactElement | null {
  const pair = image.pair;
  const [value, setValue] = React.useState(50);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef(false);

  // Every hook must run before the early return below. `useCallback` was
  // previously declared *after* `if (!pair) return null`, so a gallery image
  // that lost its pair between renders (a publish toggle, a stale cache) reduced
  // the hook count and React threw "Rendered fewer hooks than expected".
  const setFromClientX = React.useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return;
    setValue(Math.round(((clientX - rect.left) / rect.width) * 100));
  }, []);

  if (!pair) return null;

  const pct = clamp(value, 0, 100);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);
  };

  return (
    <figure className="overflow-hidden rounded-panel border border-border bg-surface shadow-plate">
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative w-full touch-none select-none"
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
      >
        {/* AFTER — the base layer, always fully painted. */}
        <Frame src={pair.after.src} alt={pair.after.alt} label="After" width={image.width} height={image.height} />

        {/* BEFORE — clipped from the left up to the handle. */}
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
          aria-hidden="true"
        >
          <Frame src={pair.before.src} alt="" label="Before" width={image.width} height={image.height} />
        </div>

        {/* Labels that do not get clipped away. */}
        <span className="pointer-events-none absolute left-2 top-2 rounded-pill bg-ink-950/85 px-2.5 py-1 text-eyebrow text-white">
          Before
        </span>
        <span className="pointer-events-none absolute right-2 top-2 rounded-pill bg-pit-600/90 px-2.5 py-1 text-eyebrow text-white">
          After
        </span>

        {/* The dividing line. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-brand-500"
          style={{ left: `${pct}%` }}
        />

        {/* The handle — a real range input, so keyboard and AT work natively. */}
        <label className="absolute inset-0 block cursor-ew-resize">
          <span className="sr-only">
            Compare before and after for {image.caption}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => setValue(Number(e.target.value))}
            aria-valuetext={`${pct}% before, ${100 - pct}% after`}
            className="absolute inset-0 size-full cursor-ew-resize appearance-none bg-transparent opacity-0"
          />
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center",
              "rounded-pill border-4 border-brand-500 bg-ink-950 text-brand-500 shadow-lift",
            )}
            style={{ left: `${pct}%` }}
          >
            <ChevronLeft className="size-4" />
            <ChevronRight className="size-4" />
          </span>
        </label>
      </div>

      <figcaption className="space-y-3 border-t border-border p-4">
        <p className="text-sm leading-relaxed">{image.caption}</p>

        {/* Non-drag fallback. Always visible — never hidden behind a gesture. */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setValue(0)}
            aria-pressed={pct === 0}
          >
            Show before
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setValue(100)}
            aria-pressed={pct === 100}
          >
            Show after
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setValue(50)}
            aria-pressed={pct === 50}
          >
            Split view
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpen}
            className="ml-auto"
          >
            <Maximize2 aria-hidden="true" className="size-4" />
            Open larger
          </Button>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Drag the handle, or focus it and use the left and right arrow keys. The two
          buttons above do the same thing without dragging.
        </p>
      </figcaption>
    </figure>
  );
}

function Frame({
  src,
  alt,
  label,
  width,
  height,
}: {
  src: string | null;
  alt: string;
  label: string;
  width: number;
  height: number;
}): React.ReactElement {
  if (!src) {
    // The placeholder still names which side of the comparison it is, so the
    // control is never a pair of identical grey boxes.
    return <BrandPlate label={`${label} — awaiting the shop's own photo`} variant={label === "Before" ? "before" : "after"} width={width} height={height} />;
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes="(min-width: 1024px) 46vw, 100vw"
      className="size-full object-cover"
    />
  );
}
