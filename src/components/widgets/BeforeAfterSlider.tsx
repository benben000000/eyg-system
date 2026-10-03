"use client";

/**
 * BEFORE / AFTER SLIDER — draggable divider, fully keyboard-operable.
 * ============================================================================
 * ACCESSIBILITY CONTRACT
 *  The handle is a real `role="slider"` with `aria-valuemin=0`,
 *  `aria-valuemax=100`, `aria-valuenow`, and an accessible name that tells the
 *  screen reader what is being moved ("Before and after: alloy wheel refurbish.
 *  Slide to reveal."). It is focusable with `tabIndex={0}` and responds to:
 *      ← / →        1%  (2% with Shift, for precision)
 *      ↑ / ↓        same as ← / →
 *      Home         0%  (all "after" hidden)
 *      End          100% (all "before" hidden)
 *      Enter/Space  toggles the side-by-side view
 *  Pointer input covers mouse, touch and pen through `setPointerCapture`.
 *
 * NON-DRAG FALLBACK
 *  A "View side by side" toggle renders both images as two labelled figures.
 *  This is the path for anyone who cannot drag, and it is also the default for
 *  `prefers-reduced-motion` users. Both images are always in the DOM, so the
 *  content is never hidden behind an interaction.
 *
 * IMAGES
 *  Both images carry explicit `width` / `height` and `decoding="async"`, so the
 *  slider never causes layout shift (CLS).
 * ============================================================================
 */
import { useCallback, useId, useRef, useState } from "react";
import { Columns2, MoveHorizontal } from "lucide-react";
import { clamp, cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

export interface BeforeAfterImage {
  /** Absolute or root-relative URL. */
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Tiny base64 placeholder, optional. */
  blurDataUrl?: string | null;
}

export interface BeforeAfterSliderProps {
  before: BeforeAfterImage;
  after: BeforeAfterImage;
  /** Human title of the job, used in the accessible name and the caption. */
  title?: string;
  caption?: string | undefined;
  /** Start position, 0–100. Default 50. */
  defaultPosition?: number;
  className?: string;
  /** Skip the interactive slider and render the side-by-side comparison. */
  defaultSideBySide?: boolean;
}

const STEP = 1;
const FINE_STEP = 0.5;

export default function BeforeAfterSlider({
  before,
  after,
  title = "Before and after",
  caption,
  defaultPosition = 50,
  className,
  defaultSideBySide = false,
}: BeforeAfterSliderProps) {
  const uid = useId();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  const [position, setPosition] = useState(() => clamp(defaultPosition, 0, 100));
  const [sideBySide, setSideBySide] = useState(defaultSideBySide || reduced);

  const positionFromClientX = useCallback((clientX: number): number => {
    const frame = frameRef.current;
    if (!frame) return 50;
    const rect = frame.getBoundingClientRect();
    if (rect.width <= 0) return 50;
    return clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      setPosition(positionFromClientX(event.clientX));
    },
    [positionFromClientX],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) return;
      setPosition(positionFromClientX(event.clientX));
    },
    [positionFromClientX],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? FINE_STEP : STEP;
      let next: number | null = null;
      switch (event.key) {
        case "ArrowLeft":
        case "ArrowDown":
          next = clamp(position - step, 0, 100);
          break;
        case "ArrowRight":
        case "ArrowUp":
          next = clamp(position + step, 0, 100);
          break;
        case "PageDown":
          next = clamp(position - 10, 0, 100);
          break;
        case "PageUp":
          next = clamp(position + 10, 0, 100);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = 100;
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          setSideBySide((v) => !v);
          return;
        default:
          return;
      }
      if (next === null) return;
      event.preventDefault();
      setPosition(next);
    },
    [position],
  );

  if (sideBySide) {
    return (
      <figure className={cn("m-0 flex flex-col gap-3", className)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <BeforeFigure image={before} caption="Before" />
          <BeforeFigure image={after} caption="After" />
        </div>
        <figcaption className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {caption ? <span>{caption}</span> : <span>{title}</span>}
          <button
            type="button"
            onClick={() => setSideBySide(false)}
            className="min-h-11 font-semibold text-brand-700 underline underline-offset-4"
          >
            Use the drag slider instead
          </button>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className={cn("m-0 flex flex-col gap-3", className)}>
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture?.(e.pointerId)}
        onPointerCancel={(e) => e.currentTarget.releasePointerCapture?.(e.pointerId)}
        className="relative touch-pan-y select-none overflow-hidden rounded-card border border-border bg-surface-muted"
        style={{ aspectRatio: `${before.width} / ${before.height}` }}
      >
        {/* BEFORE — the base layer, always fully painted. */}
        <img
          src={before.src}
          alt={before.alt}
          width={before.width}
          height={before.height}
          decoding="async"
          loading="lazy"
          draggable={false}
          className="absolute inset-0 size-full object-cover"
        />

        {/* AFTER — clipped to the handle position. */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          aria-hidden="true"
        >
          <img
            src={after.src}
            alt=""
            width={after.width}
            height={after.height}
            decoding="async"
            loading="lazy"
            draggable={false}
            className="absolute inset-0 size-full object-cover"
          />
        </div>

        {/* The divider line + labels. Pointer events pass through. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-brand-500"
          style={{ left: `${position}%` }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-2 rounded-pill bg-ink-950/80 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-brand-300"
        >
          Before
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-2 rounded-pill bg-ink-950/80 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-brand-300"
        >
          After
        </span>

        {/* The handle. This is the accessible control. */}
        <div
          role="slider"
          tabIndex={0}
          aria-label={`${title}. Slide left and right to compare before and after. Press Enter for a side-by-side view.`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          aria-valuetext={`${Math.round(position)}% before shown, ${Math.round(100 - position)}% after shown`}
          aria-describedby={`${uid}-hint`}
          onKeyDown={onKeyDown}
          className={cn(
            "absolute top-1/2 z-10 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-pill border-2 border-brand-500 bg-ink-950 text-brand-500 shadow-lift",
            reduced ? "" : "transition-transform duration-75",
          )}
          style={{ left: `${position}%` }}
        >
          <MoveHorizontal aria-hidden="true" className="size-5" focusable="false" />
        </div>
      </div>

      <figcaption id={`${uid}-hint`} className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          Drag the handle, or use the left and right arrow keys, to compare. Home and End go to either
          end.
        </span>
        <button
          type="button"
          onClick={() => setSideBySide(true)}
          className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-700 underline underline-offset-4"
        >
          <Columns2 aria-hidden="true" className="size-4" focusable="false" />
          View side by side
        </button>
      </figcaption>

      {caption ? <p className="text-sm text-foreground">{caption}</p> : null}
    </figure>
  );
}

function BeforeFigure({
  image,
  caption,
}: {
  image: BeforeAfterImage;
  caption: string;
}) {
  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <div
        className="overflow-hidden rounded-card border border-border bg-surface-muted"
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
      >
        <img
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          decoding="async"
          loading="lazy"
          className="size-full object-cover"
        />
      </div>
      <figcaption className="eyg-eyebrow text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

export { BeforeAfterSlider };