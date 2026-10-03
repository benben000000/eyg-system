/**
 * INVENTORY - PRODUCT FACT BLOCKS
 * ============================================================================
 * A3 owns this file. Presentational. Five blocks, each a `<section>` with its own
 * heading, so the detail page has a navigable structure instead of one wall of
 * text:
 *
 *   header · stock · money · tyre (tyres only) · shelf life (only when tracked)
 *
 * The rule that shapes all of them: a figure with no unit is a figure nobody can
 * act on. Everything numeric is `qty()`-formatted, and money carries a peso
 * sign from `formatPeso`.
 *
 * ── WHY DOT AGE IS A RANGE ─────────────────────────────────────────────────
 * A DOT code is a production WEEK, not a date. Decoding it to a single day would
 * be invented precision, and invented precision on a shelf label is how a shop
 * misrepresents a tyre. So the block states the week, the window of days, and an
 * age expressed as a range. It deliberately states no legal or warranty limit:
 * those vary by manufacturer and the contract carries no field for them.
 * ============================================================================
 */

import type { ReactElement, ReactNode } from "react";
import { Alert, Badge } from "@/components/ui";
import { Hourglass, TriangleAlert } from "lucide-react";
import type { ProductDto } from "@/lib/inventory-types";
import {
  daysRemainingLabel,
  decodeDotCode,
  dotWeekLabel,
  formatDate,
  formatDateTime,
  kindLabel,
  moneyFacts,
  qty,
  qtySpoken,
  shelfLifeFacts,
  stockState,
  stockStateSentence,
  STOCK_STATE_LABEL,
  unitShort,
} from "@/components/inventory/format";
import { cn, formatPeso } from "@/lib/utils";

/**
 * `<dl>` row. The value is the `<dd>` so a screen reader hears the term with its
 * definition, which is the only reason to reach for a list here.
 */
function Fact({ term, value, wide = false }: { term: string; value: ReactNode; wide?: boolean }): ReactElement {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2", wide && "sm:col-span-2")}>
      <dt className="text-sm text-muted-foreground">{term}</dt>
      <dd className="text-sm font-bold text-foreground">{value}</dd>
    </div>
  );
}

function Block({
  title,
  description,
  children,
  tone,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  tone?: "danger" | "warning";
}): ReactElement {
  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-card border bg-surface p-4 sm:p-5",
        tone === "danger" ? "border-racing-600" : tone === "warning" ? "border-brand-600" : "border-border",
      )}
    >
      <h2 className="text-eyebrow font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

export interface ProductHeaderBlockProps {
  product: ProductDto;
  /** The active toggle, owned by the page (it performs the write). */
  activeToggle: ReactNode;
}

export function ProductHeaderBlock({ product, activeToggle }: ProductHeaderBlockProps): ReactElement {
  return (
    <section aria-label="Product" className="rounded-card border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h2">{product.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-foreground">{product.sku}</span>
            <Badge tone="outline" size="sm">
              {kindLabel(product.kind)}
            </Badge>
            {product.brand ? <Badge tone="neutral" size="sm">{product.brand}</Badge> : null}
            {product.isActive ? null : <Badge tone="danger" size="sm">Inactive</Badge>}
          </p>
        </div>
        <div className="shrink-0">{activeToggle}</div>
      </div>

      <dl className="mt-4 divide-y divide-border border-t border-border">
        {product.size ? <Fact term="Size" value={product.size} /> : null}
        <Fact term="Unit of measure" value={unitShort(product.unit)} />
        {product.barcode ? <Fact term="Barcode" value={<span className="font-mono">{product.barcode}</span>} /> : null}
        {product.supplierName ? <Fact term="Supplier" value={product.supplierName} /> : null}
        <Fact term="Cycle count every" value={product.cycleCountDays > 0 ? `${product.cycleCountDays} days` : "Never"} />
        <Fact term="Added to catalogue" value={formatDate(product.createdAt)} />
        <Fact term="Last changed" value={formatDateTime(product.updatedAt)} />
        {product.notes ? <Fact term="Notes" value={product.notes} wide /> : null}
      </dl>
    </section>
  );
}

// ── Stock ────────────────────────────────────────────────────────────────────

export function StockBlock({ product }: { product: ProductDto }): ReactElement {
  const state = stockState(product.stock, product.reorderPoint);

  return (
    <Block
      title="Stock"
      tone={state === "oversold" ? "danger" : state === "out" || state === "low" ? "warning" : undefined}
    >
      <dl className="divide-y divide-border">
        <Fact term="Available to sell" value={<span className="text-xl">{qty(product.stock.available, product.unit)}</span>} />
        <Fact term="On hand" value={qty(product.stock.onHand, product.unit)} />
        <Fact term="Reserved against bookings" value={qty(product.stock.reserved, product.unit)} />
        <Fact term="Reorder point" value={qty(product.reorderPoint, product.unit)} />
        <Fact term="Order quantity when it trips" value={qty(product.reorderQty, product.unit)} />
      </dl>

      <p
        className={cn(
          "mt-3 flex items-start gap-2 rounded-eyebrow border px-3 py-2 text-sm font-semibold",
          state === "oversold" || state === "out"
            ? "border-racing-600 bg-racing-50 text-racing-900 dark:bg-ink-900 dark:text-racing-100"
            : state === "low"
              ? "border-brand-600 bg-brand-50 text-brand-900 dark:bg-ink-900 dark:text-brand-100"
              : "border-border bg-surface-muted text-foreground",
        )}
      >
        {state === "oversold" || state === "out" ? (
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        ) : null}
        <span>{stockStateSentence(product.stock, product.reorderPoint, product.unit)}</span>
      </p>

      <p className="mt-2 text-xs text-muted-foreground">
        Status: <span className="font-bold text-foreground">{STOCK_STATE_LABEL[state]}</span>.{" "}
        {product.stock.isOversold
          ? "Oversold should be impossible; reconcile this before selling anything else."
          : `Available is on hand minus reserved, and is never negative.`}
      </p>
    </Block>
  );
}

// ── Money ────────────────────────────────────────────────────────────────────

export function MoneyBlock({ product }: { product: ProductDto }): ReactElement {
  const money = moneyFacts(product);

  return (
    <Block
      title="Money"
      description="Staff-only. The bay needs this to know whether a price is a good one."
      tone={money.atOrBelowCost ? "danger" : undefined}
    >
      <dl className="divide-y divide-border">
        <Fact term="Cost (what we paid)" value={money.costKnown ? formatPeso(money.cost) : "Not on file"} />
        <Fact term="Sell (what we charge)" value={formatPeso(money.sell)} />
        <Fact
          term="Margin"
          value={
            money.marginPct === null ? (
              "Cannot be worked out"
            ) : (
              <span className={cn(money.atOrBelowCost && "text-destructive")}>
                {money.marginPct.toFixed(1)}%{money.atOrBelowCost ? " - losing money" : ""}
              </span>
            )
          }
        />
      </dl>

      {money.atOrBelowCost ? (
        <Alert tone="danger" title="Selling at or below cost" className="mt-3">
          <p className="leading-relaxed">
            {money.cost !== null ? formatPeso(money.cost) : "Cost"} cost against a {formatPeso(money.sell)} sell
            price. Every sale of this item loses money. Raise the price or renegotiate before you sell the next
            one.
          </p>
        </Alert>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{money.marginNote}</p>
      )}
    </Block>
  );
}

// ── Tyre ─────────────────────────────────────────────────────────────────────

export function TyreBlock({ product }: { product: ProductDto }): ReactElement | null {
  if (product.kind !== "TYRE") return null;

  // `Date.now()` is read here, not at module scope. This block only ever renders
  // after a client fetch, so it never runs during SSR and cannot produce a
  // hydration mismatch on the age text.
  const dot = product.dotCode === null ? null : decodeDotCode(product.dotCode);

  return (
    <Block title="Tyre" description={product.size ?? undefined}>
      <dl className="divide-y divide-border">
        <Fact term="Size" value={product.size ?? "Not recorded"} />
        <Fact term="Aspect ratio" value={product.aspectRatio === null ? "Not recorded" : `${product.aspectRatio}`} />
        <Fact term="Rim" value={product.rimSizeIn === null ? "Not recorded" : `${product.rimSizeIn} in`} />
        <Fact term="Load index" value={product.loadIndex ?? "Not recorded"} />
        <Fact term="Speed rating" value={product.speedRating ?? "Not recorded"} />
        <Fact term="Pattern" value={product.pattern ?? "Not recorded"} />
        <Fact term="Brand" value={product.brand ?? "Not recorded"} />
      </dl>

      <div className="mt-4 rounded-eyebrow border border-border bg-surface-muted p-3">
        <p className="eyg-eyebrow text-muted-foreground">DOT code</p>
        {dot === null ? (
          <p className="mt-1 text-sm">
            Not recorded. A tyre without a DOT code cannot be aged, and an unaged tyre is one we cannot honestly
            describe to a customer.
          </p>
        ) : dot.ok ? (
          <div className="mt-1 space-y-1.5">
            <p className="font-mono text-lg font-bold">
              {dot.raw} <span className="font-sans text-sm font-normal text-muted-foreground">({dotWeekLabel(dot)})</span>
            </p>
            <p className="text-sm font-bold">
              <Hourglass aria-hidden="true" className="mr-1.5 inline size-4" />
              {dot.ageLabel}
            </p>
            <p className="text-sm text-muted-foreground">
              Made between {formatDate(dot.earliest)} and {formatDate(dot.latest)}, so between{" "}
              {dot.weeksOldMin} and {dot.weeksOldMax} weeks ago.
            </p>
            <p className="text-xs text-muted-foreground">
              A DOT code records a week, not a day, so the age is a range. Check the tyre sidewall and the
              manufacturer&rsquo;s own guidance before you make any age claim to a customer.
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm">
            <span className="font-mono">{dot.raw}</span> could not be read. {dot.reason} The shelf label should
            be corrected.
          </p>
        )}
      </div>
    </Block>
  );
}

// ── Shelf life ───────────────────────────────────────────────────────────────

export function ShelfLifeBlock({ product }: { product: ProductDto }): ReactElement | null {
  const shelf = shelfLifeFacts(product);
  if (shelf === null) return null;

  const tone = shelf.expired ? "danger" : shelf.nearExpiry ? "warning" : undefined;

  return (
    <Block
      title="Shelf life"
      description={`${shelf.shelfLifeDays} days from receipt.`}
      tone={tone}
    >
      <dl className="divide-y divide-border">
        <Fact term="Expires on" value={formatDate(shelf.expiresOn)} />
        <Fact
          term="Time left"
          value={
            <span className={cn((shelf.expired || shelf.nearExpiry) && "text-destructive")}>
              {daysRemainingLabel(shelf.daysRemaining)}
            </span>
          }
        />
      </dl>

      {shelf.expired ? (
        <Alert tone="danger" title="Past its shelf life" className="mt-3">
          <p className="leading-relaxed">
            {qtySpoken(product.stock.onHand, product.unit)} of this are still on the shelf. Take them out of
            sale, record the loss, and do not hand them to a customer.
          </p>
        </Alert>
      ) : shelf.nearExpiry ? (
        <Alert tone="warning" title="Close to expiry" className="mt-3">
          <p className="leading-relaxed">Use these first, or shrink them off the shelf and record why.</p>
        </Alert>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">{shelf.basisNote}</p>
    </Block>
  );
}