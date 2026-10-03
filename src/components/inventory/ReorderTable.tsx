"use client";

/**
 * INVENTORY - THE REORDER LIST
 * ============================================================================
 * A3 owns this file. One question: what do we order, from whom, and what will it
 * cost.
 *
 * ── URGENCY IS A WORD, NOT A COLOUR ────────────────────────────────────────
 * A stockout and a low item both mean "order", but they are not the same event.
 * A stockout means a customer is standing at the counter with their car up on
 * the lift and the shelf is empty. That is written in words on every row, and
 * sorted to the top, because it is the only row on this screen that has a
 * customer waiting.
 *
 * Sorting happens on the SERVER (`sort=urgency|cost|sku`) so there is one
 * ordering rule in the system rather than two that can disagree.
 * ============================================================================
 */

import * as React from "react";
import Link from "next/link";
import { Alert, Badge, Button } from "@/components/ui";
import { ArrowDown, ArrowRight, ArrowUp, ShoppingCart, TriangleAlert } from "lucide-react";

import { fetchReorder, type ReorderSort } from "@/components/inventory/api";
import { formatCount, plural, qty, unitShort } from "@/components/inventory/format";
import {
  InventoryOffline,
  InventoryPanelEmpty,
  InventoryPanelError,
  InventoryPanelSkeleton,
  InventoryStatusLine,
} from "@/components/inventory/FourStates";
import type { ReorderRowDto } from "@/lib/inventory-types";
import { cn, formatPeso } from "@/lib/utils";

type ReorderState =
  | { kind: "loading" }
  | { kind: "ready"; rows: ReorderRowDto[] }
  | { kind: "failed"; title: string; message: string }
  | { kind: "offline" };

const SORT_LABEL: Record<ReorderSort, string> = {
  urgency: "Most urgent first",
  cost: "Most expensive first",
  sku: "SKU order",
};

export function ReorderTable(): React.ReactElement {
  const [sort, setSort] = React.useState<ReorderSort>("urgency");
  const [dir, setDir] = React.useState<"asc" | "desc">("desc");
  const [state, setState] = React.useState<ReorderState>({ kind: "loading" });
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((previous) => (previous.kind === "ready" ? previous : { kind: "loading" }));

    void fetchReorder(sort, dir, controller.signal)
      .then((outcome) => {
        if (cancelled) return;
        if (outcome.kind === "ok") {
          setState({ kind: "ready", rows: outcome.data.rows });
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
          title: "The reorder list did not load",
          message: "That request ended before it finished. Nothing was changed.",
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sort, dir, reloadToken]);

  const rows = state.kind === "ready" ? state.rows : [];
  const stockouts = rows.filter((row) => row.isStockout);
  const lows = rows.filter((row) => !row.isStockout);
  const totalCost = rows.reduce(
    (sum, row) => sum + (typeof row.estimatedCost === "number" ? row.estimatedCost : 0),
    0,
  );
  const costKnown = rows.every((row) => typeof row.estimatedCost === "number");
  const suppliers = Array.from(new Set(rows.map((row) => row.supplierName).filter((name): name is string => name !== null)));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="eyg-eyebrow text-brand-800 data-[theme=dark]:text-brand-400">Replenishment</p>
        <h1 className="text-h1">What to order</h1>
        <p className="max-w-prose text-muted-foreground">
          Everything at or below its reorder point, with the quantity to order and what it will cost at the
          price we paid. Costs are staff-only.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyg-eyebrow text-foreground" id="reorder-sort-label">
            Sort by
          </p>
          <div role="group" aria-labelledby="reorder-sort-label" className="mt-1.5 flex flex-wrap gap-2">
            {(Object.keys(SORT_LABEL) as ReorderSort[]).map((option) => (
              <Button
                key={option}
                type="button"
                size="md"
                variant={sort === option ? "primary" : "outline"}
                aria-pressed={sort === option}
                onClick={() => setSort(option)}
              >
                {SORT_LABEL[option]}
              </Button>
            ))}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => setDir((previous) => (previous === "desc" ? "asc" : "desc"))}
        >
          {dir === "desc" ? <ArrowDown aria-hidden="true" className="size-4" /> : <ArrowUp aria-hidden="true" className="size-4" />}
          {dir === "desc" ? "Descending" : "Ascending"}
        </Button>
      </div>

      {stockouts.length > 0 ? (
        <Alert
          tone="danger"
          title={`${formatCount(stockouts.length)} ${plural(stockouts.length, "product is", "products are")} out of stock`}
          icon={<TriangleAlert className="size-5" />}
        >
          <p className="leading-relaxed">
            These cannot be promised to a customer. That is a different problem from running low, and it is the
            one that costs a sale.
          </p>
        </Alert>
      ) : null}

      <InventoryStatusLine>
        {state.kind === "loading" ? "Loading the reorder list..." : null}
        {state.kind === "ready"
          ? `${formatCount(rows.length)} ${plural(rows.length, "product", "products")} to order from ${formatCount(
              suppliers.length,
            )} ${plural(suppliers.length, "supplier", "suppliers")}${
              rows.length > 0 && costKnown ? `. Estimated ${formatPeso(totalCost)} at cost` : ""
            }.`
          : null}
      </InventoryStatusLine>

      {state.kind === "loading" ? (
        <InventoryPanelSkeleton rows={6} label="Loading the reorder list" columns={5} />
      ) : null}

      {state.kind === "offline" ? (
        <InventoryOffline onRetry={() => setReloadToken((token) => token + 1)} />
      ) : null}

      {state.kind === "failed" ? (
        <InventoryPanelError
          title={state.title}
          description={state.message}
          onRetry={() => setReloadToken((token) => token + 1)}
        />
      ) : null}

      {state.kind === "ready" && rows.length === 0 ? (
        <InventoryPanelEmpty
          icon={<ShoppingCart className="size-8" />}
          title="Nothing needs ordering"
          description="No product is at or below its reorder point right now. That is the outcome you want; check the list again after the next delivery."
          action={
            <Link
              href="/inventory"
              className="inline-flex min-h-11 items-center justify-center rounded-eyebrow border border-ink-400 px-4 text-sm font-bold hover:bg-surface-muted"
            >
              Open the stock list
            </Link>
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <ReorderGroup title="Out of stock" tone="danger" rows={stockouts} />
          {lows.length > 0 ? <ReorderGroup title="At or below the reorder point" tone="warning" rows={lows} /> : null}
        </>
      ) : null}
    </div>
  );
}

function ReorderGroup({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "danger" | "warning";
  rows: ReorderRowDto[];
}): React.ReactElement | null {
  if (rows.length === 0) return null;

  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-h3">{title}</h2>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.productId}
            className={cn(
              "rounded-card border bg-surface p-4",
              tone === "danger" ? "border-racing-600" : "border-brand-600",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/inventory/${row.productId}`}
                    className="font-bold text-foreground underline decoration-2 underline-offset-4 hover:decoration-brand-500"
                  >
                    {row.name}
                  </Link>
                  {row.size ? <span className="font-mono text-xs">{row.size}</span> : null}
                  <Badge tone={row.isStockout ? "danger" : "brand"} size="sm">
                    {row.isStockout ? "Out of stock" : "Low"}
                  </Badge>
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{row.sku}</p>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                <div>
                  <dt className="eyg-eyebrow text-muted-foreground">Available</dt>
                  <dd className="tabular font-bold">{qty(row.available, row.unit)}</dd>
                </div>
                <div>
                  <dt className="eyg-eyebrow text-muted-foreground">Warn at</dt>
                  <dd className="tabular">{qty(row.reorderPoint, row.unit)}</dd>
                </div>
                <div>
                  <dt className="eyg-eyebrow text-muted-foreground">Order</dt>
                  <dd className="tabular font-bold">{qty(row.suggestedQty, row.unit)}</dd>
                </div>
                <div>
                  <dt className="eyg-eyebrow text-muted-foreground">At cost</dt>
                  <dd className="tabular font-bold">
                    {typeof row.estimatedCost === "number" ? (
                      formatPeso(row.estimatedCost)
                    ) : (
                      <>
                        <span aria-hidden="true">&mdash;</span>
                        <span className="sr-only">Cost not on file</span>
                      </>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              {row.supplierName ? (
                <>
                  Order from <span className="font-bold text-foreground">{row.supplierName}</span>.{" "}
                </>
              ) : (
                <>
                  No supplier is recorded for this item.{" "}
                </>
              )}
              Default order quantity is {qty(row.reorderQty, row.unit)}
              {typeof row.costPrice === "number" && row.costPrice > 0
                ? ` at ${formatPeso(row.costPrice)} each`
                : ""}
              . Unit of measure: {unitShort(row.unit)}.
            </p>

            <Link
              href={`/inventory/${row.productId}`}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-eyebrow border border-ink-400 px-3 text-sm font-bold hover:bg-surface-muted"
            >
              Open the product to receive it
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}