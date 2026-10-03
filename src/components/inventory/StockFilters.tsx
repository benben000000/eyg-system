/**
 * INVENTORY - STOCK FILTERS
 * ============================================================================
 * A3 owns this file. Presentational: it owns no state, so it stays a plain
 * function component that can be rendered from either side of the boundary.
 *
 * Every control is a real `<button>` or `<select>` at 44 px or taller. No div
 * with a click handler, no custom listbox: a mechanic wearing gloves on a phone
 * needs the platform's own control.
 *
 * The counts beside each filter say exactly what they count. `lowCount` is the
 * whole catalogue; the out-of-stock number is this page only, and it is labelled
 * as such, because the server has no out-of-stock filter and pretending
 * otherwise would put a wrong number in front of the person making a purchase
 * decision.
 * ============================================================================
 */

import type { ReactElement } from "react";
import { NativeSelect } from "@/components/ui";
import { PRODUCT_KINDS, type ProductKindValue } from "@/lib/inventory-types";
import { KIND_LABEL } from "@/components/inventory/format";
import { STOCK_FILTERS, STOCK_FILTER_LABEL, type StockFilter } from "@/components/inventory/types";
import { cn } from "@/lib/utils";

const KIND_SELECT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "ALL", label: "All kinds" },
  ...PRODUCT_KINDS.map((kind) => ({ value: kind as string, label: KIND_LABEL[kind as ProductKindValue] })),
];

export interface StockFilterBarProps {
  kind: ProductKindValue | "ALL";
  filter: StockFilter;
  /** Catalogue-wide. `null` until loaded, so the badge is empty rather than "0". */
  lowCount: number | null;
  /** This page only. */
  outOnPage: number;
  onKindChange: (kind: ProductKindValue | "ALL") => void;
  onFilterChange: (filter: StockFilter) => void;
}

export function StockFilterBar({
  kind,
  filter,
  lowCount,
  outOnPage,
  onKindChange,
  onFilterChange,
}: StockFilterBarProps): ReactElement {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1 sm:max-w-xs">
        <label htmlFor="inventory-kind" className="eyg-eyebrow block text-foreground">
          Kind
        </label>
        <NativeSelect
          id="inventory-kind"
          className="mt-1.5"
          size="md"
          value={kind}
          options={KIND_SELECT_OPTIONS}
          onChange={(event) => {
            const next = event.target.value;
            onKindChange(next === "ALL" ? "ALL" : (next as ProductKindValue));
          }}
        />
      </div>

      <div className="min-w-0">
        <p className="eyg-eyebrow text-foreground" id="inventory-filter-label">
          Show
        </p>
        <div role="group" aria-labelledby="inventory-filter-label" className="mt-1.5 flex flex-wrap gap-2">
          {STOCK_FILTERS.map((option) => {
            const active = option === filter;
            const count =
              option === "LOW" ? lowCount : option === "OUT" ? outOnPage : option === "TYRES" ? null : null;

            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => onFilterChange(option)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-eyebrow border px-3.5 text-sm font-bold uppercase tracking-widest transition-colors duration-150",
                  active
                    ? "border-ink-950 bg-ink-950 text-white data-[theme=dark]:border-brand-500 data-[theme=dark]:bg-brand-500 data-[theme=dark]:text-ink-950"
                    : "border-ink-400 bg-surface text-foreground hover:bg-surface-muted",
                )}
              >
                {STOCK_FILTER_LABEL[option]}
                {/* Plain text, not a Badge: a chip inside a chip fights the active
                    state on both themes, and the number inherits the button's own
                    contrast for free. */}
                {count !== null ? <span className="tabular font-bold">{count}</span> : null}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {lowCount === null
            ? "The catalogue-wide low count has not loaded yet."
            : `Low is counted across the whole catalogue. Out is counted on this page only.`}
        </p>
      </div>
    </div>
  );
}