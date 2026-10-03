"use client";

/**
 * INVENTORY - THE MOVEMENT LEDGER
 * ============================================================================
 * A3 owns this file. This is the trust surface: when the shelf and the screen
 * disagree, this list is the answer, and it only works if it is plain.
 *
 * Every entry shows five things without being asked:
 *   when · what kind of movement · how many, signed, with its unit ·
 *   what on-hand became · why, with a name against it
 *
 * There is no edit, no delete and no "hide". The ledger is append-only on the
 * server (A2's rule) and this component never offers the illusion of otherwise.
 *
 * ── WHY A LIST AND NOT A TABLE ─────────────────────────────────────────────
 * A ledger row is read one at a time, top to bottom, usually on a phone in a
 * bay. A seven-column table on a 360 px screen wraps into mush. A chronological
 * list with the same five facts reads cleanly at any width, needs no horizontal
 * scroll, and keeps the most important line - the signed change and what it
 * became - at the top of each entry where the eye lands first.
 * ============================================================================
 */

import * as React from "react";
import { Alert, Badge, Button, Input, NativeSelect } from "@/components/ui";
import { ArrowRight, History, RotateCcw, TriangleAlert } from "lucide-react";

import { fetchMovements } from "@/components/inventory/api";
import {
  formatCount,
  formatDateTime,
  movementAddsStock,
  movementLabel,
  plural,
  signedQty,
  qty,
} from "@/components/inventory/format";
import {
  InventoryOffline,
  InventoryPanelEmpty,
  InventoryPanelError,
  InventoryPanelSkeleton,
  InventoryStatusLine,
} from "@/components/inventory/FourStates";
import {
  MOVEMENT_KINDS,
  type MovementDto,
  type MovementKindValue,
  type UnitValue,
} from "@/lib/inventory-types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

const KIND_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Every kind of movement" },
  ...MOVEMENT_KINDS.map((kind) => ({ value: kind as string, label: movementLabel(kind) })),
];

type LedgerState =
  | { kind: "loading" }
  | { kind: "ready"; movements: MovementDto[]; total: number }
  | { kind: "failed"; title: string; message: string }
  | { kind: "offline" };

export interface MovementLedgerProps {
  productId: string;
  productName: string;
  unit: UnitValue;
  /** `initialCount` comes from the page so the heading can say the real total. */
  pageSize?: number;
}

export function MovementLedger({
  productId,
  productName,
  unit,
  pageSize = PAGE_SIZE,
}: MovementLedgerProps): React.ReactElement {
  const [kind, setKind] = React.useState<MovementKindValue | "">("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [reloadToken, setReloadToken] = React.useState(0);
  const [state, setState] = React.useState<LedgerState>({ kind: "loading" });

  React.useEffect(() => {
    setPage(1);
  }, [kind, from, to]);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((previous) => (previous.kind === "ready" ? previous : { kind: "loading" }));

    void fetchMovements(
      {
        productId,
        ...(kind === "" ? {} : { kind }),
        ...(from === "" ? {} : { from: `${from}T00:00:00.000+08:00` }),
        ...(to === "" ? {} : { to: `${to}T23:59:59.999+08:00` }),
        page,
        pageSize,
      },
      controller.signal,
    )
      .then((outcome) => {
        if (cancelled) return;
        if (outcome.kind === "ok") {
          setState({ kind: "ready", movements: outcome.data.movements, total: outcome.data.total });
          return;
        }
        if (outcome.kind === "offline") {
          setState({ kind: "offline" });
          return;
        }
        setState({ kind: "failed", title: outcome.title, message: outcome.message });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            kind: "failed",
            title: "The movement history did not load",
            message: "That request ended before it finished. Nothing was changed.",
          });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [productId, kind, from, to, page, pageSize, reloadToken]);

  const retry = React.useCallback((): void => setReloadToken((token) => token + 1), []);

  const filtersActive = kind !== "" || from !== "" || to !== "";
  const clearFilters = (): void => {
    setKind("");
    setFrom("");
    setTo("");
  };

  const movements = state.kind === "ready" ? state.movements : [];
  const total = state.kind === "ready" ? state.total : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section aria-label="Movement history" className="space-y-4">
      <div>
        <h2 className="text-h3">Movement ledger</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Every change to {productName}, newest first. Entries are never edited or deleted &mdash; a correction
          is a new entry that says what the correction was.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="ledger-kind" className="eyg-eyebrow block text-foreground">
            Kind
          </label>
          <NativeSelect
            id="ledger-kind"
            className="mt-1.5"
            size="md"
            value={kind}
            options={KIND_OPTIONS}
            onChange={(event) => setKind(event.target.value === "" ? "" : (event.target.value as MovementKindValue))}
          />
        </div>
        <div>
          <label htmlFor="ledger-from" className="eyg-eyebrow block text-foreground">
            From date
          </label>
          <Input
            id="ledger-from"
            className="mt-1.5"
            type="date"
            size="md"
            value={from}
            max={to === "" ? undefined : to}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="ledger-to" className="eyg-eyebrow block text-foreground">
            To date
          </label>
          <Input
            id="ledger-to"
            className="mt-1.5"
            type="date"
            size="md"
            value={to}
            min={from === "" ? undefined : from}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>

      {filtersActive ? (
        <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Clear the filters
        </Button>
      ) : null}

      <InventoryStatusLine>
        {state.kind === "loading" ? "Loading the movement history..." : null}
        {state.kind === "ready" && movements.length > 0 ? (
          <>
            {formatCount(total)} {plural(total, "entry", "entries")}
            {filtersActive ? " match these filters" : " in total"}
            {state.total > 0 ? `, showing ${formatCount((page - 1) * pageSize + 1)} to ${formatCount((page - 1) * pageSize + movements.length)}` : ""}
            .
          </>
        ) : null}
        {state.kind === "ready" && movements.length === 0
          ? filtersActive
            ? "Nothing matches these filters."
            : "No movements recorded yet."
          : null}
      </InventoryStatusLine>

      {state.kind === "loading" ? (
        <InventoryPanelSkeleton rows={4} label="Loading the movement history" columns={3} />
      ) : null}

      {state.kind === "offline" ? <InventoryOffline onRetry={retry} /> : null}

      {state.kind === "failed" ? (
        <InventoryPanelError title={state.title} description={state.message} onRetry={retry} />
      ) : null}

      {state.kind === "ready" && movements.length === 0 ? (
        filtersActive ? (
          <InventoryPanelEmpty
            icon={<History className="size-8" />}
            title="Nothing in that window"
            description="No movement of this product matches the kind and dates you picked. Widen the dates or clear the kind filter."
            action={
              <Button type="button" variant="outline" size="md" onClick={clearFilters}>
                Clear the filters
              </Button>
            }
          />
        ) : (
          <InventoryPanelEmpty
            icon={<History className="size-8" />}
            title="No movements recorded yet"
            description={`${productName} has never been received, consumed or adjusted. Until something moves, the ledger cannot vouch for the number on the shelf - receive stock to start the record.`}
          />
        )
      ) : null}

      {state.kind === "ready" && movements.length > 0 ? (
        <>
          <ol className="space-y-2">
            {movements.map((movement) => {
              const adds = movementAddsStock(movement.kind);
              return (
                <li
                  key={movement.id}
                  className="rounded-card border border-border bg-surface p-3 sm:p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <span className="flex items-center gap-2">
                      <Badge tone={adds ? "success" : "outline"} size="sm">
                        {movementLabel(movement.kind)}
                      </Badge>
                      <span
                        className={cn(
                          "tabular text-lg font-bold",
                          movement.qty > 0 ? "text-success" : movement.qty < 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {signedQty(movement.qty, unit)}
                      </span>
                      <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
                      <span className="tabular font-bold">{qty(movement.onHandAfter, unit)} on hand</span>
                    </span>
                    <time
                      dateTime={movement.createdAt}
                      className="text-xs text-muted-foreground tabular"
                    >
                      {formatDateTime(movement.createdAt)}
                    </time>
                  </div>

                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <dt className="text-muted-foreground">Why</dt>
                      <dd className="font-semibold">{movement.reason ?? "No reason recorded"}</dd>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <dt className="text-muted-foreground">Recorded by</dt>
                      <dd className="text-muted-foreground">
                        {movement.actorName ?? "System - no person on this entry"}
                      </dd>
                    </div>
                    {movement.reference ? (
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <dt className="text-muted-foreground">Reference</dt>
                        <dd className="font-mono text-xs">{movement.reference}</dd>
                      </div>
                    ) : null}
                    {movement.bookingReference ?? movement.bookingId ? (
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <dt className="text-muted-foreground">Booking</dt>
                        <dd className="font-mono text-xs">
                          {movement.bookingReference ?? movement.bookingId}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </li>
              );
            })}
          </ol>

          {pageCount > 1 ? (
            <nav
              aria-label="Ledger pages"
              className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
            >
              <p className="tabular text-sm text-muted-foreground">
                Page {formatCount(page)} of {formatCount(pageCount)}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={page <= 1}
                  onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                >
                  Newer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={page >= pageCount}
                  onClick={() => setPage((previous) => Math.min(pageCount, previous + 1))}
                >
                  Older
                </Button>
              </div>
            </nav>
          ) : null}
        </>
      ) : null}

      {state.kind === "ready" && movements.some((movement) => movement.reason === null) ? (
        <Alert tone="info" size="sm" title="Some entries have no reason">
          <p className="leading-relaxed">
            A movement with no reason is usually one the system made on its own. Those entries cannot be
            explained to a customer, which is exactly why every entry a person makes asks for a reason first.
          </p>
        </Alert>
      ) : null}

      {state.kind === "ready" && movements.length > 0 ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Times are shown in Philippine time (Asia/Manila). If a figure here does not match the shelf, count
            the item and record the difference rather than editing history.
          </span>
        </p>
      ) : null}
    </section>
  );
}