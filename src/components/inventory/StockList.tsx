"use client";

/**
 * INVENTORY - STOCK LIST (the default screen)
 * ============================================================================
 * A3 owns this file.
 *
 * Built for one specific person: someone standing at a shelf with a customer
 * waiting, one hand busy, on a phone. Every decision below comes from that.
 *
 * ── WHY SERVER-SIDE SEARCH ──────────────────────────────────────────────────
 * A mechanic types `205/55` or scans a barcode, not `MICHE`. Filtering one
 * cached page in the browser would silently miss the tyre on the next page, and
 * "not found" on a stock screen becomes a customer being told no. The server
 * searches SKU, name, brand, size and barcode; the client only types.
 *
 * ── WHY ROVING TABINDEX AND NOT A COMBOBOX ──────────────────────────────────
 * Arrow keys move focus between real `<Link>` elements. Enter then opens the
 * product natively, middle-click and "open in new tab" work, and a screen reader
 * hears a list of links rather than a synthetic widget. The price is that typing
 * stops working once you arrow down, which is what every mail client and issue
 * tracker does, and what a mechanic expects.
 *
 * ── WHY SORTING AND THE OUT-OF-STOCK FILTER ARE HONEST ABOUT THEIR SCOPE ───
 * A2's list endpoint currently takes `q`, `kind`, `lowStock` and paging - no
 * `sort`, no `dir`, no out-of-stock filter. Rather than silently sorting one page
 * and calling it the catalogue, this screen applies those two to the RETURNED
 * PAGE and prints that fact in the status line and under the filters. A number
 * an operator cannot trust is worse than a number with a caveat attached.
 *
 * ── NO OPTIMISTIC UI ────────────────────────────────────────────────────────
 * Every figure shown is one the server returned. A refresh keeps the last
 * confirmed rows on screen behind an explicit "Updating..." status rather than
 * blanking it, because a mechanic reading a number that is about to change is
 * how stock becomes fiction.
 * ============================================================================
 */

import * as React from "react";
import Link from "next/link";
import { Alert, Button, Input } from "@/components/ui";
import { ArrowRight, Search, TriangleAlert } from "lucide-react";

import { fetchLowStockCount, fetchProducts, type ProductListPayload } from "@/components/inventory/api";
import { formatCount, plural } from "@/components/inventory/format";
import {
  CatalogueConfidenceNote,
  InventoryOffline,
  InventoryPanelEmpty,
  InventoryPanelError,
  InventoryPanelSkeleton,
  InventoryStatusLine,
  NoCatalogueYet,
} from "@/components/inventory/FourStates";
import { KeyMap, STOCK_LIST_KEYS } from "@/components/inventory/InventoryKeyMap";
import { StockFilterBar } from "@/components/inventory/StockFilters";
import { StockTable } from "@/components/inventory/StockTable";
import {
  DEFAULT_STOCK_QUERY,
  type ProductSortKey,
  type SortDir,
  type StockQuery,
} from "@/components/inventory/types";
import type { ProductDto, ProductKindValue } from "@/lib/inventory-types";

/** Long enough to coalesce a burst of keystrokes, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 250;

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; payload: ProductListPayload }
  | { kind: "failed"; title: string; message: string }
  | { kind: "offline" };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/** Comparators for the client-side, page-scoped sort. */
const COMPARATORS: Record<ProductSortKey, (a: ProductDto, b: ProductDto) => number> = {
  sku: (a, b) => a.sku.localeCompare(b.sku),
  name: (a, b) => a.name.localeCompare(b.name),
  kind: (a, b) => a.kind.localeCompare(b.kind),
  available: (a, b) => a.stock.available - b.stock.available,
  onHand: (a, b) => a.stock.onHand - b.stock.onHand,
  reserved: (a, b) => a.stock.reserved - b.stock.reserved,
  cost: (a, b) => (a.costPrice ?? 0) - (b.costPrice ?? 0),
  sell: (a, b) => a.sellPrice - b.sellPrice,
  margin: (a, b) => (a.marginPct ?? 0) - (b.marginPct ?? 0),
};

export function StockList(): React.ReactElement {
  const [query, setQuery] = React.useState<StockQuery>(DEFAULT_STOCK_QUERY);
  const [debouncedTerm, setDebouncedTerm] = React.useState("");
  /** Bumped by the retry buttons. The effect cannot re-run on an identical query. */
  const [reloadToken, setReloadToken] = React.useState(0);
  const [state, setState] = React.useState<LoadState>({ kind: "loading" });
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  /** Catalogue-wide. `null` until it loads, so the badge never guesses. */
  const [lowCount, setLowCount] = React.useState<number | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [hint, setHint] = React.useState("");

  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const cardRefs = React.useRef<Array<HTMLAnchorElement | null>>([]);
  const rowRefs = React.useRef<Array<HTMLAnchorElement | null>>([]);

  // ── Debounce. The timer is reset on every keystroke, so only the LAST
  // character of a burst produces a request.
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTerm(query.q), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query.q]);

  /**
   * Deliberately built from PRIMITIVES, not from the `query` object. A
   * `useMemo` over the object would see a fresh identity on every keystroke and
   * fire a request per character - the exact thing the debounce exists to stop.
   */
  const effectiveQuery = React.useMemo<StockQuery>(
    () => ({
      q: debouncedTerm,
      kind: query.kind,
      filter: query.filter,
      sort: query.sort,
      dir: query.dir,
      page: query.page,
      pageSize: query.pageSize,
    }),
    [debouncedTerm, query.kind, query.filter, query.sort, query.dir, query.page, query.pageSize],
  );

  // ── The read. Every request is abortable and the newest one wins, so a slow
  // response for "20" can never overwrite a fast one for "205/55R16".
  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    // The first paint has nothing to show; a refresh keeps the last confirmed
    // rows visible and announces itself, rather than blanking the screen.
    setState((previous) => (previous.kind === "ready" ? previous : { kind: "loading" }));
    setIsRefreshing(true);

    void fetchProducts(effectiveQuery, controller.signal)
      .then((outcome) => {
        if (cancelled) return;
        if (outcome.kind === "ok") {
          setState({ kind: "ready", payload: outcome.data });
          return;
        }
        if (outcome.kind === "offline") {
          setState({ kind: "offline" });
          return;
        }
        setState({ kind: "failed", title: outcome.title, message: outcome.message });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          kind: "failed",
          title: "The stock list did not load",
          message: "That request ended before it finished. Nothing was changed - try again.",
        });
      })
      .finally(() => {
        if (!cancelled) setIsRefreshing(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [effectiveQuery, reloadToken]);

  // ── The catalogue-wide low count. Deliberately NOT re-run on every keystroke:
  // it does not change because somebody typed a letter, and the list effect
  // above already has a request in flight.
  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    void fetchLowStockCount(controller.signal)
      .then((outcome) => {
        if (cancelled) return;
        // When the low filter is already on, the list response IS the count.
        if (outcome.kind === "ok") setLowCount(outcome.data);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken, query.filter, query.kind]);

  const payload: ProductListPayload | null = state.kind === "ready" ? state.payload : null;
  // Memoised so the two `useMemo`s below do not see a fresh array identity on
  // every render and re-sort the page for nothing.
  const rawRows: ProductDto[] = React.useMemo(() => payload?.rows ?? [], [payload]);
  const total = payload?.total ?? 0;

  /**
   * Page-scoped shaping. Both steps are applied to the rows the server just sent,
   * and both are announced as page-scoped wherever a number is shown.
   */
  const products = React.useMemo((): ProductDto[] => {
    let rows = rawRows;
    if (query.filter === "OUT") {
      rows = rows.filter((row) => row.stock.available <= 0);
    }
    if (query.filter === "TYRES") {
      // Belt and braces: the kind filter is the server's job, but a stale
      // response for the wrong kind must never render as a tyre.
      rows = rows.filter((row) => row.kind === "TYRE");
    }
    const comparator = COMPARATORS[query.sort];
    const sorted = [...rows].sort(comparator);
    return query.dir === "asc" ? sorted : sorted.reverse();
  }, [rawRows, query.filter, query.sort, query.dir]);

  const outOnPage = React.useMemo(
    () => rawRows.filter((row) => row.stock.available <= 0).length,
    [rawRows],
  );

  // A new result set means the old highlighted row is meaningless.
  React.useEffect(() => {
    setActiveIndex(0);
  }, [payload]);

  const registerRow = React.useCallback(
    (slot: "card" | "row", index: number, element: HTMLAnchorElement | null): void => {
      // Both layouts register into the same slot-per-row map. Only one of them
      // is visible at any width, so only one ever holds a focusable element and
      // the arrow keys have one unambiguous place to go.
      if (slot === "card") cardRefs.current[index] = element;
      else rowRefs.current[index] = element;
    },
    [],
  );

  // ── `/` and Cmd/Ctrl+K focus the search box from anywhere on the page.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const isSlash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      const isCommandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isSlash && !isCommandK) return;
      // A slash typed INTO a field is a slash, not a shortcut.
      if (isSlash && isEditableTarget(event.target)) return;

      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const focusRow = React.useCallback((index: number): void => {
    // Whichever layout is actually on screen holds the focusable elements; the
    // other one is `display:none` and its refs are stale or empty.
    const list = window.matchMedia("(min-width: 640px)").matches ? rowRefs.current : cardRefs.current;
    const last = list.length - 1;
    if (last < 0) return;
    const clamped = Math.max(0, Math.min(index, last));
    setActiveIndex(clamped);
    list[clamped]?.focus();
  }, []);

  const focusSearch = React.useCallback((): void => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);

  const clearSearch = React.useCallback((): void => {
    setQuery((previous) => ({ ...previous, q: "", page: 1 }));
    setHint("Search cleared.");
    focusSearch();
  }, [focusSearch]);

  /** Arrow keys, Home, End and Escape. Handled on the container so they work from
   *  the search box and from the rows without a global listener stealing them. */
  const onContainerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    // Arrow keys inside a `<select>` belong to the select. Overriding them would
    // break a control an operator uses constantly.
    if (event.target instanceof HTMLSelectElement) return;

    const last = products.length - 1;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (last >= 0) focusRow(activeIndex + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        if (activeIndex <= 0) {
          focusSearch();
          return;
        }
        focusRow(activeIndex - 1);
        return;
      case "Home":
        if (!isEditableTarget(event.target) || last < 0) return;
        event.preventDefault();
        focusRow(0);
        return;
      case "End":
        if (!isEditableTarget(event.target) || last < 0) return;
        event.preventDefault();
        focusRow(last);
        return;
      case "Escape":
        event.preventDefault();
        if (query.q !== "") {
          clearSearch();
          return;
        }
        focusSearch();
        return;
      default:
        return;
    }
  };

  const update = React.useCallback((patch: Partial<StockQuery>): void => {
    setQuery((previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }));
  }, []);

  const retry = React.useCallback((): void => {
    setReloadToken((token) => token + 1);
  }, []);

  const onSortChange = React.useCallback((key: ProductSortKey): void => {
    setQuery((previous) => {
      const dir: SortDir = previous.sort === key ? (previous.dir === "asc" ? "desc" : "asc") : "asc";
      return { ...previous, sort: key, dir, page: 1 };
    });
  }, []);

  const onSubmitSearch = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (products.length === 0) {
      setHint(
        query.q.trim() === ""
          ? "There is nothing to open - the list is empty."
          : "Nothing matches that search. Press Esc to clear it and see the whole catalogue.",
      );
      return;
    }
    focusRow(activeIndex);
  };

  // ── The page title carries the low-stock count, so the browser tab and the
  // phone bookmark are informative rather than decorative.
  const documentTitle = React.useMemo((): string | null => {
    if (payload === null) return null;
    const parts = [`${formatCount(total)} ${plural(total, "product", "products")}`];
    if (lowCount !== null && lowCount > 0) parts.push(`${lowCount} low`);
    return `Stock - ${parts.join(", ")} - EYG inventory`;
  }, [payload, total, lowCount]);

  React.useEffect(() => {
    if (documentTitle !== null) document.title = documentTitle;
  }, [documentTitle]);

  const firstRow = products.length > 0 ? products[0] : undefined;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const pageStart = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const pageEnd = total === 0 ? 0 : Math.min(pageStart + rawRows.length - 1, total);
  const isFiltered = query.q.trim() !== "" || query.kind !== "ALL" || query.filter !== "ALL";
  const isCatalogueEmpty = payload !== null && total === 0 && !isFiltered;
  const sortLabel =
    query.sort === "name"
      ? "product name"
      : query.sort === "available"
        ? "available"
        : query.sort === "onHand"
          ? "on hand"
          : query.sort === "reserved"
            ? "reserved"
            : query.sort;

  return (
    <div className="space-y-6" onKeyDown={onContainerKeyDown}>
      <header className="space-y-2">
        <p className="eyg-eyebrow text-brand-800 data-[theme=dark]:text-brand-400">Parts &amp; tyres</p>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h1 className="text-h1">Stock</h1>
          {payload !== null ? (
            <p className="tabular text-sm text-muted-foreground">
              {formatCount(total)} {plural(total, "product", "products")}
              {lowCount !== null && lowCount > 0 ? ` - ${formatCount(lowCount)} low` : ""}
            </p>
          ) : null}
        </div>
        <p className="max-w-prose text-muted-foreground">
          Search by SKU, name, brand, tyre size or barcode. Every figure carries its unit - a set of five
          tyres is five each, not five of something unnamed.
        </p>
      </header>

      {payload !== null && lowCount !== null && lowCount > 0 ? (
        <Alert
          tone="warning"
          title={`${formatCount(lowCount)} ${plural(lowCount, "product is", "products are")} at or below the reorder point`}
          action={
            <Link
              href="/inventory/reorder"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-eyebrow border border-ink-400 px-3 text-sm font-bold text-foreground hover:bg-surface-muted"
            >
              Reorder list
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          }
        >
          <p className="leading-relaxed">
            {formatCount(outOnPage)} of the {formatCount(rawRows.length)} on this page have nothing available to
            sell. A low item is a supply problem; an empty one is a customer at the counter with their car up on
            the lift.
          </p>
        </Alert>
      ) : null}

      <StockFilterBar
        kind={query.kind}
        filter={query.filter}
        lowCount={lowCount}
        outOnPage={outOnPage}
        onKindChange={(kind: ProductKindValue | "ALL") => update({ kind })}
        onFilterChange={(filter) => update({ filter })}
      />

      <form role="search" onSubmit={onSubmitSearch} noValidate>
        <label htmlFor="inventory-search" className="eyg-eyebrow block text-foreground">
          Search stock
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Input
              id="inventory-search"
              ref={searchRef}
              name="q"
              type="search"
              inputMode="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="205/55R16, oil filter, MIC-..., or scan a barcode"
              leading={<Search className="size-5" />}
              value={query.q}
              size="lg"
              onChange={(event) => {
                setHint("");
                update({ q: event.target.value });
              }}
            />
          </div>
          <Button type="button" variant="ghost" size="md" onClick={clearSearch} disabled={query.q === ""}>
            Clear
          </Button>
        </div>
      </form>

      <KeyMap bindings={STOCK_LIST_KEYS} caption="Keyboard shortcuts for the stock list" />

      <InventoryStatusLine>
        {state.kind === "loading" ? "Loading the stock list..." : null}
        {payload !== null && isRefreshing ? "Updating the stock list..." : null}
        {payload !== null && !isRefreshing ? (
          <>
            Showing {formatCount(pageStart)}-{formatCount(pageEnd)} of {formatCount(total)}{" "}
            {plural(total, "product", "products")}, sorted on this page by {sortLabel},{" "}
            {query.dir === "asc" ? "ascending" : "descending"}.
            {query.q.trim() !== "" ? ` Search: "${query.q.trim()}".` : ""}
            {firstRow ? ` First row: ${firstRow.name}.` : ""}
          </>
        ) : null}
        {hint !== "" ? hint : null}
      </InventoryStatusLine>

      <section aria-label="Stock list" aria-busy={isRefreshing}>
        {state.kind === "loading" ? (
          <InventoryPanelSkeleton rows={6} label="Loading the stock list" columns={5} />
        ) : null}

        {state.kind === "offline" ? <InventoryOffline onRetry={retry} /> : null}

        {state.kind === "failed" ? (
          <InventoryPanelError
            title={state.title}
            description={state.message}
            onRetry={retry}
            action={
              <Link
                href="/"
                className="text-sm font-bold text-foreground underline decoration-2 underline-offset-4"
              >
                Back to the site
              </Link>
            }
          />
        ) : null}

        {payload !== null && products.length === 0 ? (
          isCatalogueEmpty ? (
            <NoCatalogueYet detail="No products have been loaded into the catalogue yet." />
          ) : (
            <InventoryPanelEmpty
              icon={<Search className="size-8" />}
              title="Nothing to show"
              description={
                <>
                  No product on this page matches{" "}
                  {query.q.trim() !== "" ? (
                    <>the search &ldquo;{query.q.trim()}&rdquo;</>
                  ) : (
                    "these filters"
                  )}
                  . Clear the search, widen the filters, or turn the page. If you are certain it is on the
                  shelf, then it has not been entered into the catalogue yet - that is a different problem from
                  not being found.
                </>
              }
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => {
                    update({ q: "", kind: "ALL", filter: "ALL" });
                    focusSearch();
                  }}
                >
                  Clear search and filters
                </Button>
              }
              secondaryAction={
                pageCount > 1 ? (
                  <Button type="button" variant="ghost" size="md" onClick={() => update({ page: 1 })}>
                    Go to page 1
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="md" onClick={() => update({ filter: "LOW" })}>
                    Show low stock instead
                  </Button>
                )
              }
            />
          )
        ) : null}

        {payload !== null && products.length > 0 ? (
          <>
            <StockTable
              products={products}
              sort={query.sort}
              dir={query.dir}
              onSortChange={onSortChange}
              activeIndex={Math.min(activeIndex, products.length - 1)}
              onActiveIndexChange={setActiveIndex}
              registerRow={registerRow}
            />

            {pageCount > 1 ? (
              <nav
                aria-label="Stock list pages"
                className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
              >
                <p className="tabular text-sm text-muted-foreground">
                  Page {formatCount(query.page)} of {formatCount(pageCount)}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    disabled={query.page <= 1 || isRefreshing}
                    onClick={() => update({ page: query.page - 1 })}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    disabled={query.page >= pageCount || isRefreshing}
                    onClick={() => update({ page: query.page + 1 })}
                  >
                    Next
                  </Button>
                </div>
              </nav>
            ) : null}
          </>
        ) : null}
      </section>

      <CatalogueConfidenceNote />

      {firstRow !== undefined && firstRow.stock.isOversold ? (
        <Alert tone="danger" title="A product on this screen is oversold" icon={<TriangleAlert className="size-5" />}>
          <p className="leading-relaxed">
            More is promised against one product than the shelf holds. That should be impossible. Open it and
            reconcile it with a stock count before you sell anything else.
          </p>
        </Alert>
      ) : null}
    </div>
  );
}

export default StockList;