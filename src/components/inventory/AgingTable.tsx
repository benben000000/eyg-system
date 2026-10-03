"use client";

/**
 * INVENTORY - THE AGEING WATCH
 * ============================================================================
 * A3 owns this file. Tyre DOT age and shelf-life expiry, side by side.
 *
 * ── THIS SCREEN IS INFORMATIONAL. IT IS NOT A BLOCKER ──────────────────────
 * That sentence is on the page, not just in a comment, because the temptation
 * with a screen like this is to start refusing sales on it. EYG does not have a
 * documented age policy it can cite, the contract carries no field for one, and
 * a shop that invents an age rule and then refuses a customer's tyre has created
 * a worse problem than the one it was solving. So this screen reports, and the
 * decision stays with the person at the counter.
 *
 * ── AGE IS A RANGE, EXPIRY IS A DERIVED DATE ───────────────────────────────
 * A DOT code is a production WEEK. Its age is therefore a seven-day window, and
 * the screen shows both ends of it rather than a false single figure. Shelf-life
 * expiry needs a receipt date the contract does not carry, so it is derived from
 * the catalogue record date and LABELLED as that, rather than presented as fact.
 * Both caveats are printed next to the numbers, not hidden in a tooltip.
 * ============================================================================
 */

import * as React from "react";
import Link from "next/link";
import { Alert, Badge } from "@/components/ui";
import { Hourglass, Info } from "lucide-react";

import { fetchAging } from "@/components/inventory/api";
import {
  decodeDotCode,
  daysRemainingLabel,
  dotWeekLabel,
  formatCount,
  formatDate,
  kindLabel,
  plural,
  qty,
  shelfLifeFacts,
} from "@/components/inventory/format";
import {
  InventoryOffline,
  InventoryPanelEmpty,
  InventoryPanelError,
  InventoryPanelSkeleton,
  InventoryStatusLine,
} from "@/components/inventory/FourStates";
import type { DotDecodedOk } from "@/components/inventory/format";
import type { ProductDto } from "@/lib/inventory-types";
import { cn } from "@/lib/utils";

type AgingState =
  | { kind: "loading" }
  | { kind: "ready"; products: ProductDto[] }
  | { kind: "failed"; title: string; message: string }
  | { kind: "offline" };

interface TyreRow {
  product: ProductDto;
  dot: DotDecodedOk;
}

export function AgingTable(): React.ReactElement {
  const [state, setState] = React.useState<AgingState>({ kind: "loading" });
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    void fetchAging(controller.signal)
      .then((outcome) => {
        if (cancelled) return;
        if (outcome.kind === "ok") {
          setState({ kind: "ready", products: outcome.data.products });
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
          title: "The ageing watch list did not load",
          message: "That request ended before it finished. Nothing was changed.",
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken]);

  const products = state.kind === "ready" ? state.products : [];

  // Both lists are built in one pass, after the data lands. `Date.now()` is read
  // here rather than at module scope so the age text can never be server-rendered
  // and then disagree with the browser's clock.
  const nowMs = Date.now();
  const tyres = products
    .map((product) => {
      if (product.kind !== "TYRE" || product.dotCode === null) return null;
      const dot = decodeDotCode(product.dotCode, nowMs);
      return dot.ok ? { product, dot } : null;
    })
    .filter((row): row is TyreRow => row !== null)
    .sort((a, b) => b.dot.weeksOldMax - a.dot.weeksOldMax);

  const unreadableTyreCodes = products.filter(
    (product) => product.kind === "TYRE" && product.dotCode !== null && !decodeDotCode(product.dotCode, nowMs).ok,
  );

  const shelfItems = products
    .map((product) => {
      const shelf = shelfLifeFacts(product, nowMs);
      return shelf === null ? null : { product, shelf };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.shelf.daysRemaining - b.shelf.daysRemaining);

  const overdueTyres = tyres.filter((row) => row.dot.weeksOldMax > 260);
  const expiredShelf = shelfItems.filter((row) => row.shelf.expired);
  const nearShelf = shelfItems.filter((row) => !row.shelf.expired && row.shelf.nearExpiry);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="eyg-eyebrow text-brand-800 data-[theme=dark]:text-brand-400">Shelf watch</p>
        <h1 className="text-h1">Ageing</h1>
        <p className="max-w-prose text-muted-foreground">
          How old the tyre stock is, by its DOT code, and what is approaching the end of its shelf life.
        </p>
      </header>

      {/* The one sentence that keeps this screen honest. */}
      <Alert tone="info" title="Informational, not a blocker" icon={<Info className="size-5" />}>
        <p className="leading-relaxed">
          Nothing on this page stops a sale, and no age limit is applied automatically. There is no policy on
          file that EYG can point to, and the acceptable age of a tyre is the manufacturer&rsquo;s call, not a
          screen&rsquo;s. Read it, make the decision, and record it as a movement with a reason if you act on it.
        </p>
      </Alert>

      {state.kind === "loading" ? (
        <InventoryPanelSkeleton rows={5} label="Loading the ageing watch" columns={3} />
      ) : null}

      {state.kind === "offline" ? <InventoryOffline onRetry={() => setReloadToken((token) => token + 1)} /> : null}

      {state.kind === "failed" ? (
        <InventoryPanelError
          title={state.title}
          description={state.message}
          onRetry={() => setReloadToken((token) => token + 1)}
        />
      ) : null}

      {state.kind === "ready" && products.length === 0 ? (
        <InventoryPanelEmpty
          icon={<Hourglass className="size-8" />}
          title="Nothing to watch yet"
          description="No tyre carries a DOT code and nothing in the catalogue has a shelf life recorded, so there is nothing to age. Add a DOT code to a tyre and a shelf life to an oil or a coolant and this page fills itself in."
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

      {tyres.length > 0 ? (
        <section aria-label="Tyre age by DOT code" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-h3">Tyres by DOT code</h2>
            <InventoryStatusLine>
              {formatCount(tyres.length)} {plural(tyres.length, "tyre line", "tyre lines")} with a readable code
              {overdueTyres.length > 0 ? `, ${formatCount(overdueTyres.length)} over five years old` : ""}.
            </InventoryStatusLine>
          </div>

          <ul className="space-y-2">
            {tyres.map(({ product, dot }) => (
              <li
                key={product.id}
                className={cn(
                  "rounded-card border bg-surface p-4",
                  dot.weeksOldMax > 260 ? "border-brand-600" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/inventory/${product.id}`}
                        className="font-bold text-foreground underline decoration-2 underline-offset-4 hover:decoration-brand-500"
                      >
                        {product.name}
                      </Link>
                      {product.size ? <span className="font-mono text-xs">{product.size}</span> : null}
                      {dot.weeksOldMax > 260 ? (
                        <Badge tone="brand" size="sm">
                          Over five years
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {product.sku} / {kindLabel(product.kind)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-mono text-lg font-bold">
                      {dot.raw}{" "}
                      <span className="font-sans text-xs font-normal text-muted-foreground">
                        ({dotWeekLabel(dot)})
                      </span>
                    </p>
                    <p className="text-sm font-bold">{dot.ageLabel}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {formatCount(dot.weeksOldMin)} to {formatCount(dot.weeksOldMax)} weeks
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  Made between {formatDate(dot.earliest)} and {formatDate(dot.latest)} &mdash; a seven-day
                  window, which is all a DOT code records. {qty(product.stock.onHand, product.unit)} on hand.
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {shelfItems.length > 0 ? (
        <section aria-label="Shelf life" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-h3">Shelf life</h2>
            <InventoryStatusLine>
              {formatCount(shelfItems.length)} {plural(shelfItems.length, "line", "lines")} with a shelf life
              {expiredShelf.length > 0 ? `, ${formatCount(expiredShelf.length)} already past it` : ""}
              {nearShelf.length > 0 ? `, ${formatCount(nearShelf.length)} within thirty days` : ""}.
            </InventoryStatusLine>
          </div>

          <ul className="space-y-2">
            {shelfItems.map(({ product, shelf }) => (
              <li
                key={product.id}
                className={cn(
                  "rounded-card border bg-surface p-4",
                  shelf.expired ? "border-racing-600" : shelf.nearExpiry ? "border-brand-600" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/inventory/${product.id}`}
                        className="font-bold text-foreground underline decoration-2 underline-offset-4 hover:decoration-brand-500"
                      >
                        {product.name}
                      </Link>
                      {shelf.expired ? (
                        <Badge tone="danger" size="sm">
                          Past its shelf life
                        </Badge>
                      ) : shelf.nearExpiry ? (
                        <Badge tone="brand" size="sm">
                          Close to expiry
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {product.sku} / {kindLabel(product.kind)} / {shelf.shelfLifeDays} days
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold">Expires {formatDate(shelf.expiresOn)}</p>
                    <p
                      className={cn(
                        "tabular text-sm font-bold",
                        shelf.expired || shelf.nearExpiry ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {daysRemainingLabel(shelf.daysRemaining)}
                    </p>
                    <p className="tabular text-xs text-muted-foreground">
                      {qty(product.stock.onHand, product.unit)} on hand
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">{shelf.basisNote}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {unreadableTyreCodes.length > 0 ? (
        <Alert tone="warning" title={`${formatCount(unreadableTyreCodes.length)} DOT ${plural(unreadableTyreCodes.length, "code", "codes")} could not be read`}>
          <p className="leading-relaxed">
            A DOT code is four digits: the week and the year, so 2418 is week 18 of 2024. These could not be
            read, so their age is unknown rather than zero.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {unreadableTyreCodes.slice(0, 10).map((product) => (
              <li key={product.id}>
                <Link href={`/inventory/${product.id}`} className="font-mono underline decoration-2 underline-offset-4">
                  {product.dotCode}
                </Link>{" "}
                &mdash; {product.name}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}