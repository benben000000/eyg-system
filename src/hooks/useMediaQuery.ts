"use client";

/**
 * SSR-SAFE MEDIA QUERY
 * ============================================================================
 * Returns `false` during server render and on the very first client render, then
 * subscribes to the query *after* mount. That ordering is deliberate:
 *
 *  - No `window` access during render → no hydration mismatch, no SSR crash.
 *  - The subscription only exists once the component is alive, so every
 *    `matchMedia` listener is removed on unmount (no leak).
 *
 * Usage: drive layout *enhancement* with it. Never hide content that would
 * otherwise be reachable — a `false` first paint must still be usable.
 * ============================================================================
 */
import { useEffect, useState } from "react";

/** Query strings used across the widgets, in one place. */
export const MEDIA = {
  reducedMotion: "(prefers-reduced-motion: reduce)",
  coarsePointer: "(pointer: coarse)",
  finePointer: "(pointer: fine)",
  narrow: "(max-width: 39.99rem)",
  wide: "(min-width: 48rem)",
  dark: "(prefers-color-scheme: dark)",
} as const;

function subscribe(query: string, onChange: (matches: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const list = window.matchMedia(query);
  // `addEventListener` is the modern API; `addListener` is the Safari < 14 path.
  if (typeof list.addEventListener === "function") {
    const handler = (e: MediaQueryListEvent) => onChange(e.matches);
    list.addEventListener("change", handler);
    return () => list.removeEventListener("change", handler);
  }
  const legacy = list as MediaQueryList & {
    addListener?: (cb: (e: MediaQueryListEvent) => void) => void;
    removeListener?: (cb: (e: MediaQueryListEvent) => void) => void;
  };
  const handler = (e: MediaQueryListEvent) => onChange(e.matches);
  legacy.addListener?.(handler);
  return () => legacy.removeListener?.(handler);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    // Read once after mount — never during render.
    setMatches(window.matchMedia(query).matches);
    return subscribe(query, setMatches);
  }, [query]);

  return matches;
}

/**
 * `true` when the visitor has asked the OS to reduce motion.
 * Every animated widget in this package gates on this.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(MEDIA.reducedMotion);
}