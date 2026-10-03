/**
 * INVENTORY - STOCK TABLE
 * ============================================================================
 * A3 owns this file. Presentational: it owns no state and no fetch.
 *
 * ── TWO LAYOUTS, ONE PIECE OF DATA ─────────────────────────────────────────
 * Nine columns do not fit on a 360 px phone, and a table that scrolls sideways is
 * useless to somebody holding a part in one hand. So below `sm` this renders the
 * SAME rows as a stacked card list, and at `sm` and above as a real table with
 * sort controls in the column headers. Only one of the two is in the DOM's
 * visible tree at any width, so there is never a duplicate focus target and never
 * a duplicate announcement.
 *
 * Both layouts read their content from the same helpers, so a figure can never
 * read "4" in one and "4 EA" in the other.
 *
 * ── WHY A REAL `<table>` ON DESKTOP ─────────────────────────────────────────
 * An operator screen scanned column-first across seven figures is a table whether
 * or not it admits it. A real table gives free column headers, `aria-sort` on the
 * sortable columns, and a `<th scope="row">` for the product name, which is what
 * a screen reader navigates by.
 *
 * ── WHY SORTING IS A BUTTON IN THE `<th>` ───────────────────────────────────
 * A clickable `<th>` with an `onClick` is a div with a click handler wearing a
 * table costume: it is not focusable, has no role, and is invisible to a
 * keyboard. Each header holds a real `<button>` with the accessible name of the
 * column, and the direction lives on the `<th>` as `aria-sort`.
 *
 * ── WHY COST AND MARGIN ARE ON THIS SCREEN ──────────────────────────────────
 * This is an internal screen. Hiding the money column from the person standing in
 * the bay does not protect the margin, it just makes them unable to tell a bad
 * price from a good one while a customer listens. The figures arrive from the
 * server already filtered to staff; this client renders them.
 * ============================================================================
 */

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { Badge, NativeSelect } from "@/components/ui";
import { ArrowDown, ArrowUp, Check, ChevronRight, TriangleAlert, X } from "lucide-react";
import type { ProductDto } from "@/lib/inventory-types";
import {
  kindLabel,
  moneyFacts,
  qty,
  qtySpoken,
  stockState,
  STOCK_STATE_LABEL,
  type StockState,
  unitShort,
} from "@/components/inventory/format";
import { PRODUCT_SORT_KEYS, type ProductSortKey, type SortDir } from "@/components/inventory/types";
import { cn, formatPeso } from "@/lib/utils";

const SORT_LABEL: Record<ProductSortKey, string> = {
  sku: "SKU",
  name: "Product name",
  kind: "Kind",
  available: "Available",
  onHand: "On hand",
  reserved: "Reserved",
  cost: "Cost",
  sell: "Sell",
  margin: "Margin",
};

/** Sortable columns, in the order they appear in the table. */
const COLUMN_KEYS: ReadonlyArray<ProductSortKey> = [
  "sku",
  "name",
  "available",
  "onHand",
  "reserved",
  "cost",
  "sell",
  "margin",
];

const STATE_GLYPH: Record<StockState, ReactNode> = {
  oversold: <TriangleAlert aria-hidden="true" className="size-4" />,
  out: <X aria-hidden="true" className="size-4" />,
  low: <TriangleAlert aria-hidden="true" className="size-4" />,
  ok: <Check aria-hidden="true" className="size-4" />,
};

/**
 * Colour + a shape + a word. Never colour alone: under deuteranopia racing red
 * and pit green are 58 RGB units apart, which is the same colour.
 */
function StateChip({ state }: { state: StockState }): ReactElement {
  const tone =
    state === "oversold" || state === "out"
      ? "border-racing-600 bg-racing-600 text-white"
      : state === "low"
        ? "border-brand-700 bg-brand-500 text-ink-950"
        : "border-ink-400 bg-surface text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-eyebrow border px-2 py-0.5 text-eyebrow font-bold uppercase tracking-widest",
        tone,
      )}
    >
      {STATE_GLYPH[state]}
      {STOCK_STATE_LABEL[state]}
    </span>
  );
}

function MarginValue({ product }: { product: ProductDto }): ReactElement {
  const money = moneyFacts(product);
  if (!money.costKnown || money.marginPct === null) {
    return (
      <>
        <span aria-hidden="true" className="text-muted-foreground">
          &mdash;
        </span>
        <span className="sr-only">Margin not available - cost is not on file</span>
      </>
    );
  }
  if (money.atOrBelowCost) {
    return (
      <span className="inline-flex items-center gap-1.5 font-bold text-destructive">
        <TriangleAlert aria-hidden="true" className="size-4" />
        <span className="tabular">{money.marginPct.toFixed(1)}%</span>
        <span className="sr-only">- selling at or below cost</span>
      </span>
    );
  }
  return <span className="tabular">{money.marginPct.toFixed(1)}%</span>;
}

function CostValue({ product }: { product: ProductDto }): ReactElement {
  const money = moneyFacts(product);
  if (!money.costKnown) {
    return (
      <>
        <span aria-hidden="true" className="text-muted-foreground">
          &mdash;
        </span>
        <span className="sr-only">Cost not on file</span>
      </>
    );
  }
  return <span className="tabular">{formatPeso(money.cost)}</span>;
}

/** Name, size, kind, brand and the spoken context for the row link. */
function ProductIdentity({
  product,
  state,
  href,
  tabIndex,
  onFocus,
  linkRef,
}: {
  product: ProductDto;
  state: StockState;
  href: string;
  tabIndex: number;
  onFocus: () => void;
  linkRef: (element: HTMLAnchorElement | null) => void;
}): ReactElement {
  return (
    <Link
      href={href}
      ref={linkRef}
      tabIndex={tabIndex}
      onFocus={onFocus}
      className="group flex min-h-11 items-center gap-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-foreground underline decoration-transparent decoration-2 underline-offset-4 group-hover:decoration-brand-500">
          {product.name}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
          {product.size ? <span className="font-mono text-xs text-foreground">{product.size}</span> : null}
          <Badge tone="outline" size="sm">
            {kindLabel(product.kind)}
          </Badge>
          {product.brand ? <span className="text-xs text-muted-foreground">{product.brand}</span> : null}
          {product.isActive ? null : (
            <Badge tone="neutral" size="sm">
              Inactive
            </Badge>
          )}
        </span>
        {/* Spoken context: a link's accessible name is just its text, so the
            figures a sighted operator reads at a glance are repeated here. */}
        <span className="sr-only">
          {qtySpoken(product.stock.available, product.unit)} available,{" "}
          {qtySpoken(product.stock.onHand, product.unit)} on hand,{" "}
          {qtySpoken(product.stock.reserved, product.unit)} reserved. {STOCK_STATE_LABEL[state]}.
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-5 shrink-0 text-muted-foreground group-hover:text-foreground"
      />
    </Link>
  );
}

export interface StockTableProps {
  products: ProductDto[];
  sort: ProductSortKey;
  dir: SortDir;
  onSortChange: (key: ProductSortKey) => void;
  /** Roving tabindex. The list owns it; this component only reports focus. */
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  /** `slot` tells the two layouts apart, since only one is visible at a time. */
  registerRow: (slot: "card" | "row", index: number, element: HTMLAnchorElement | null) => void;
}

export function StockTable({
  products,
  sort,
  dir,
  onSortChange,
  activeIndex,
  onActiveIndexChange,
  registerRow,
}: StockTableProps): ReactElement {
  const ariaSort = (key: ProductSortKey): "ascending" | "descending" | "none" =>
    sort === key ? (dir === "asc" ? "ascending" : "descending") : "none";

  const sortOptions = PRODUCT_SORT_KEYS.map((key) => ({ value: key as string, label: SORT_LABEL[key] }));

  return (
    <div>
      {/* ── PHONE. A card list, because nine columns do not fit sideways. ── */}
      <div className="sm:hidden">
        <div className="flex items-end gap-2 border-b border-border bg-surface-muted px-3 py-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="stock-sort-mobile" className="eyg-eyebrow block text-foreground">
              Sort this page by
            </label>
            <NativeSelect
              id="stock-sort-mobile"
              className="mt-1"
              size="md"
              value={sort}
              options={sortOptions}
              onChange={(event) => onSortChange(event.target.value as ProductSortKey)}
            />
          </div>
          <button
            type="button"
            onClick={() => onSortChange(sort)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-eyebrow border border-ink-400 px-3 text-sm font-bold"
          >
            {dir === "asc" ? (
              <ArrowUp aria-hidden="true" className="size-4" />
            ) : (
              <ArrowDown aria-hidden="true" className="size-4" />
            )}
            {dir === "asc" ? "Asc" : "Desc"}
            <span className="sr-only">
              , currently sorted by {SORT_LABEL[sort]} {dir === "asc" ? "ascending" : "descending"}. Activate to
              reverse.
            </span>
          </button>
        </div>

        <ul>
          {products.map((product, index) => {
            const state = stockState(product.stock, product.reorderPoint);
            const isActive = index === activeIndex;
            return (
              <li
                key={product.id}
                className={cn(
                  "border-b border-border p-3",
                  isActive ? "bg-surface-muted" : "bg-surface",
                  state === "oversold" && "border-l-4 border-l-racing-600",
                )}
              >
                <ProductIdentity
                  product={product}
                  state={state}
                  href={`/inventory/${product.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onFocus={() => onActiveIndexChange(index)}
                  linkRef={(element) => registerRow("card", index, element)}
                />

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StateChip state={state} />
                  <span className="tabular text-lg font-bold">{qty(product.stock.available, product.unit)}</span>
                  <span className="text-xs text-muted-foreground">available</span>
                </div>

                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <MobileFigure term="On hand" value={qty(product.stock.onHand, product.unit)} />
                  <MobileFigure term="Reserved" value={qty(product.stock.reserved, product.unit)} />
                  <MobileFigure term="Cost" value={<CostValue product={product} />} />
                  <MobileFigure term="Sell" value={<span className="tabular">{formatPeso(product.sellPrice)}</span>} />
                  <MobileFigure
                    term="Margin"
                    value={<MarginValue product={product} />}
                    wide
                  />
                </dl>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── DESKTOP. A real table with sort controls in the headers. ── */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Stock on hand for every product on this page. Each figure carries its unit. Activate a column
            heading to sort this page; activate a product name to open its detail and movement history.
          </caption>

          <thead className="bg-surface-muted">
            <tr>
              {COLUMN_KEYS.map((key) => {
                const right = key === "available" || key === "onHand" || key === "reserved" || key === "cost" || key === "sell" || key === "margin";
                const active = sort === key;
                return (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={ariaSort(key)}
                    className={cn(
                      "border-b border-border px-2 py-0 align-bottom",
                      right && "text-right",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSortChange(key)}
                      className={cn(
                        "inline-flex min-h-11 w-full items-center gap-1 px-1 text-eyebrow font-bold uppercase tracking-widest transition-colors duration-150 hover:text-brand-800 data-[theme=dark]:hover:text-brand-400",
                        right && "flex-row-reverse justify-end",
                        active && "text-brand-800 data-[theme=dark]:text-brand-400",
                      )}
                    >
                      <span>{SORT_LABEL[key]}</span>
                      {active ? (
                        dir === "asc" ? (
                          <ArrowUp aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ArrowDown aria-hidden="true" className="size-3.5" />
                        )
                      ) : null}
                      <span className="sr-only">
                        {active
                          ? dir === "asc"
                            ? "sorted ascending, activate to sort descending"
                            : "sorted descending, activate to sort ascending"
                          : "not sorted, activate to sort ascending"}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="border-b border-border px-2 py-0 text-left align-bottom">
                <span className="inline-flex min-h-11 items-center px-1 text-eyebrow font-bold uppercase tracking-widest">
                  Unit
                </span>
              </th>
            </tr>
          </thead>

          <tbody>
            {products.map((product, index) => {
              const state = stockState(product.stock, product.reorderPoint);
              const isActive = index === activeIndex;

              return (
                <tr
                  key={product.id}
                  className={cn(
                    "border-b border-border align-top transition-colors duration-150",
                    isActive ? "bg-surface-muted" : "bg-surface hover:bg-surface-muted",
                    state === "oversold" && "border-l-4 border-l-racing-600",
                  )}
                >
                  <th scope="row" className="max-w-0 px-2 py-3 text-left font-normal">
                    <ProductIdentity
                      product={product}
                      state={state}
                      href={`/inventory/${product.id}`}
                      tabIndex={isActive ? 0 : -1}
                      onFocus={() => onActiveIndexChange(index)}
                      linkRef={(element) => registerRow("row", index, element)}
                    />
                  </th>

                  <td className="px-2 py-3 text-right">
                    <span
                      className={cn(
                        "tabular font-bold",
                        state === "oversold" || state === "out" ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {qty(product.stock.available, product.unit)}
                    </span>
                    <span className="mt-1 block">
                      <StateChip state={state} />
                    </span>
                  </td>

                  <td className="px-2 py-3 text-right tabular">{qty(product.stock.onHand, product.unit)}</td>

                  <td className="px-2 py-3 text-right tabular">
                    {product.stock.reserved > 0 ? (
                      <span className="font-bold">{qty(product.stock.reserved, product.unit)}</span>
                    ) : (
                      <span className="text-muted-foreground">{qty(0, product.unit)}</span>
                    )}
                  </td>

                  <td className="px-2 py-3 text-right">
                    <CostValue product={product} />
                  </td>

                  <td className="px-2 py-3 text-right tabular">{formatPeso(product.sellPrice)}</td>

                  <td className="px-2 py-3 text-right">
                    <MarginValue product={product} />
                  </td>

                  <td className="px-2 py-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {unitShort(product.unit)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A label/value pair for the phone card. `<dl>` so the pairing is announced. */
function MobileFigure({ term, value, wide = false }: { term: string; value: ReactNode; wide?: boolean }): ReactElement {
  return (
    <div className={cn("flex items-baseline justify-between gap-2", wide && "col-span-2")}>
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="text-sm font-bold">{value}</dd>
    </div>
  );
}