"use client";

/**
 * FOCUS TRAP FOR MODALS AND DRAWERS
 * ============================================================================
 * Contract, in order of importance:
 *  1. Focus moves INTO the container on `active`.
 *  2. Tab / Shift+Tab wrap inside the container — focus cannot escape.
 *  3. On `active === false` or unmount, focus is RESTORED to whatever was
 *     focused when the trap opened. This is what stops a keyboard user being
 *     dumped at the top of the page after closing a dialog.
 *  4. A user who navigates away (link click, browser back) is NOT held: the
 *     `returnFocus` restore is skipped if the previously focused element is no
 *     longer in the document.
 *  5. Every listener is removed on unmount.
 * ============================================================================
 */
import { useEffect, useRef } from "react";

/** Selector for natively focusable things, in DOM order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function visibleFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute("inert")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    // `offsetParent === null` covers `display:none`; the rect check covers
    // `visibility:hidden`, which `offsetParent` misses in some engines.
    const style = typeof window !== "undefined" ? window.getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    return el.getClientRects().length > 0 || el === document.activeElement;
  });
}

export interface FocusTrapOptions {
  /** Turn the trap on/off. When false the effect cleans up and restores focus. */
  active: boolean;
  /** Move focus to this element on open. Falls back to the first focusable. */
  initialFocusRef?: React.RefObject<HTMLElement | null> | undefined;
  /** Restore focus here on close instead of the previous element. */
  returnFocusRef?: React.RefObject<HTMLElement | null> | undefined;
  /** Called on Escape. Wire this to the close handler. */
  onEscape?: (() => void) | undefined;
  /** Set false for a non-modal drawer (no Tab containment). */
  lockTab?: boolean;
}

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  { active, initialFocusRef, returnFocusRef, onEscape, lockTab = true }: FocusTrapOptions,
): void {
  // The previously focused element, captured at open.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof document === "undefined") return;

    const container = containerRef.current;
    if (!container) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Focus the requested element, else the first focusable, else the container.
    const focusables = visibleFocusables(container);
    const initial = initialFocusRef?.current ?? focusables[0] ?? container;
    if (initial === container && !container.hasAttribute("tabindex")) {
      container.setAttribute("tabindex", "-1");
    }
    initial.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onEscape?.();
        return;
      }
      if (event.key !== "Tab" || !lockTab) return;

      const items = visibleFocusables(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;

      const activeElement = document.activeElement;
      const inside = activeElement instanceof HTMLElement && container.contains(activeElement);

      if (event.shiftKey) {
        if (!inside || activeElement === first) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
        return;
      }
      if (!inside || activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [active, containerRef, initialFocusRef, onEscape, lockTab]);

  // Restore focus on close / unmount. Skipped when the original element is gone
  // (the user navigated away) so we never scroll a dead page back into view.
  useEffect(() => {
    if (active) return;

    // Snapshot the trigger at effect-setup time. Reading `.current` inside the
    // cleanup would use whatever the ref holds *later* — open a second dialog
    // before the first unmounts and focus would jump to the wrong trigger.
    const target = returnFocusRef?.current ?? previouslyFocusedRef.current;

    return () => {
      if (typeof document === "undefined") return;
      previouslyFocusedRef.current = null;
      if (!target) return;
      if (typeof document.contains !== "function" || !document.contains(target)) return;
      target.focus({ preventScroll: true });
    };
  }, [active, returnFocusRef]);
}

/**
 * Scroll-locking for a full-screen overlay. Restores the previous `overflow` and
 * `padding-right` exactly, so a nested lock cannot leave the page unscrollable.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof document === "undefined" || typeof window === "undefined") return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [active]);
}