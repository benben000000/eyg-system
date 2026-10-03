/**
 * INVENTORY KEY MAP
 * ============================================================================
 * A3 owns this file. The shortcuts are PRINTED ON SCREEN, permanently, not
 * hidden behind a `?` help dialog.
 *
 * Why: the operator is standing at a shelf with a customer waiting. A mechanic
 * who learns `/` and the arrow keys on day one uses this tool with one hand for
 * the rest of their career; one who has to guess will go back to walking to the
 * shelf and squinting at a box. Discoverability is not a nice-to-have here, it
 * is the difference between the tool being used and the tool being abandoned.
 * ============================================================================
 */

import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

export interface KeyBinding {
  /** The literal key or combination, as printed. */
  keys: string[];
  /** What it does. One line, imperative. */
  label: string;
}

/** The stock list's bindings. One source of truth for the panel and for docs. */
export const STOCK_LIST_KEYS: ReadonlyArray<KeyBinding> = [
  { keys: ["/"], label: "Jump to search" },
  { keys: ["Ctrl", "K"], label: "Jump to search (Command + K on a Mac)" },
  { keys: ["↑", "↓"], label: "Move between products" },
  { keys: ["Home", "End"], label: "First / last product" },
  { keys: ["Enter"], label: "Open the highlighted product" },
  { keys: ["Esc"], label: "Clear the search" },
];

/** The stock-count screen's bindings — a different screen, different keys. */
export const COUNT_SCREEN_KEYS: ReadonlyArray<KeyBinding> = [
  { keys: ["Enter"], label: "Save this line and move on" },
  { keys: ["↑", "↓"], label: "Move between lines" },
  { keys: ["Esc"], label: "Leave the count and come back to this line" },
];

function KeyCap({ children }: { children: string }): ReactElement {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-eyebrow border border-ink-400 bg-surface px-1.5 font-mono text-xs font-bold text-foreground">
      {children}
    </kbd>
  );
}

/**
 * A `<dl>` of bindings, visible by default. Semantics matter here: a screen
 * reader user gets the key and its effect as a labelled pair rather than a
 * sentence of punctuation.
 */
export function KeyMap({
  bindings,
  caption,
  className,
}: {
  bindings: ReadonlyArray<KeyBinding>;
  /** Names the region for assistive tech. */
  caption: string;
  className?: string;
}): ReactElement {
  return (
    <dl
      aria-label={caption}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-border bg-surface-muted px-3 py-2.5",
        className,
      )}
    >
      {bindings.map((binding) => (
        <div key={binding.keys.join("+")} className="flex items-center gap-2">
          <dt className="flex items-center gap-1">
            {binding.keys.map((key) => (
              <KeyCap key={key}>{key}</KeyCap>
            ))}
          </dt>
          <dd className="text-xs text-muted-foreground">{binding.label}</dd>
        </div>
      ))}
    </dl>
  );
}