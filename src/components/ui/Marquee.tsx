"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface MarqueeProps extends React.ComponentPropsWithoutRef<"div"> {
  /** px per second. */
  speed?: number;
  /** Pause the animation while the user hovers or focuses inside. */
  pauseOnHover?: boolean;
  /** Rendered once and duplicated for a seamless loop. */
  children: React.ReactNode;
}

/**
 * Trust-strip marquee.
 *
 * Implemented with `requestAnimationFrame` and a direct `transform` write
 * (no React state per frame, no re-render churn) and **no CSS keyframes**, so
 * nothing has to be added to globals.css.
 *
 * `prefers-reduced-motion: reduce` never starts the loop — the strip becomes
 * a plain horizontally scrollable row instead.
 */
export function Marquee({
  speed = 28,
  pauseOnHover = true,
  className,
  children,
  ...props
}: MarqueeProps): React.ReactElement {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [reduced, setReduced] = React.useState(true);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    if (reduced) return;
    const track = trackRef.current;
    if (!track) return;

    let raf = 0;
    let offset = 0;
    let last = performance.now();
    let paused = false;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paused) {
        const half = track.scrollWidth / 2;
        if (half > 0) {
          offset += speed * dt;
          if (offset >= half) offset -= half;
          track.style.transform = `translate3d(${-offset}px, 0, 0)`;
        }
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    const node = viewportRef.current;
    const onEnter = () => {
      paused = true;
    };
    const onLeave = () => {
      paused = false;
      last = performance.now();
    };
    if (pauseOnHover && node) {
      node.addEventListener("pointerenter", onEnter);
      node.addEventListener("pointerleave", onLeave);
      node.addEventListener("focusin", onEnter);
      node.addEventListener("focusout", onLeave);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      track.style.transform = "";
      if (pauseOnHover && node) {
        node.removeEventListener("pointerenter", onEnter);
        node.removeEventListener("pointerleave", onLeave);
        node.removeEventListener("focusin", onEnter);
        node.removeEventListener("focusout", onLeave);
      }
    };
  }, [reduced, speed, pauseOnHover]);

  return (
    <div
      ref={viewportRef}
      className={cn("relative w-full overflow-hidden", className)}
      {...props}
    >
      {/*
        The track holds the children twice. `aria-hidden` on the copy means
        assistive tech reads the list exactly once.
      */}
      <div
        ref={trackRef}
        className={cn("flex w-max items-center", reduced && "no-scrollbar overflow-x-auto")}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div aria-hidden="true" className="flex shrink-0 items-center">
          {children}
        </div>
      </div>
    </div>
  );
}
