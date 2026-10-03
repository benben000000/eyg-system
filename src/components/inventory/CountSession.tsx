"use client";

/**
 * INVENTORY - ONE STOCK COUNT
 * ============================================================================
 * A3 owns this file. It owns the fetch and the two steps of a count:
 *
 *   CountSession
 *     |-- CountRunner  (step "count")   key the shelf in, one line at a time
 *     `-- CountReview  (step "review")  read every variance, then commit
 *
 * The fetch lives here rather than in both children so that switching steps does
 * not re-download the sheet, and so the review step is guaranteed to be looking
 * at the same snapshot the operator just finished counting.
 * ============================================================================
 */

import * as React from "react";
import Link from "next/link";
import { Alert, Badge, Button } from "@/components/ui";
import { ArrowLeft } from "lucide-react";

import { fetchCount } from "@/components/inventory/api";
import { formatCount, formatDateTime, kindLabel, plural } from "@/components/inventory/format";
import { InventoryOffline, InventoryPanelError, InventoryStatusLine } from "@/components/inventory/FourStates";
import { CountReview } from "@/components/inventory/CountReview";
import { CountRunner } from "@/components/inventory/CountRunner";
import type { CountLineDto, ProductKindValue, StockCountDto, StockCountStatusValue } from "@/lib/inventory-types";
import { formatPeso } from "@/lib/utils";

type SessionState =
  | { kind: "loading" }
  | { kind: "ready"; count: StockCountDto }
  | { kind: "failed"; title: string; message: string; notFound: boolean }
  | { kind: "offline" };

const STATUS_LABEL: Record<StockCountStatusValue, string> = {
  DRAFT: "Not started",
  COUNTING: "Counting",
  REVIEW: "Ready to review",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

export interface CountSessionProps {
  countId: string;
}

export function CountSession({ countId }: CountSessionProps): React.ReactElement {
  const [state, setState] = React.useState<SessionState>({ kind: "loading" });
  const [reloadToken, setReloadToken] = React.useState(0);
  const [step, setStep] = React.useState<"count" | "review">("count");

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    void fetchCount(countId, controller.signal)
      .then((outcome) => {
        if (cancelled) return;
        if (outcome.kind === "ok") {
          setState({ kind: "ready", count: outcome.data });
          return;
        }
        if (outcome.kind === "offline") {
          setState({ kind: "offline" });
          return;
        }
        setState({
          kind: "failed",
          title: outcome.title,
          message: outcome.message,
          notFound: outcome.httpStatus === 404,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          kind: "failed",
          title: "This stock count did not load",
          message: "That request ended before it finished. Nothing was changed.",
          notFound: false,
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [countId, reloadToken]);

  /** Merge one server-confirmed line back into the sheet. */
  const onLineSaved = React.useCallback((line: CountLineDto): void => {
    setState((previous) => {
      if (previous.kind !== "ready") return previous;
      return {
        kind: "ready",
        count: {
          ...previous.count,
          lines: previous.count.lines.map((candidate) => (candidate.id === line.id ? line : candidate)),
        },
      };
    });
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="space-y-4">
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          Loading the count...
        </p>
        <div className="h-64 w-full rounded-card bg-surface-muted" aria-hidden="true" />
      </div>
    );
  }

  if (state.kind === "offline") {
    return <InventoryOffline onRetry={() => setReloadToken((token) => token + 1)} />;
  }

  if (state.kind === "failed") {
    return (
      <div className="space-y-4">
        <BackToCounts />
        <InventoryPanelError
          title={state.title}
          description={state.message}
          {...(state.notFound ? {} : { onRetry: () => setReloadToken((token) => token + 1) })}
        />
      </div>
    );
  }

  const count = state.count;
  const closed = count.status === "POSTED" || count.status === "CANCELLED";
  // Derived from the lines on screen so it moves the instant a line is confirmed,
  // without a second round trip per keystroke. The authoritative summary is
  // re-read from the server on the review step and after posting.
  const counted = count.lines.filter((line) => line.counted !== null).length;
  const outstanding = count.lines.length - counted;
  const variances = count.lines.filter((line) => line.variance !== null && line.variance !== 0).length;
  const significant = count.lines.filter((line) => line.isSignificant).length;

  return (
    <div className="space-y-6">
      <div>
        <BackToCounts />
      </div>

      <header className="space-y-2">
        <p className="eyg-eyebrow text-brand-800 data-[theme=dark]:text-brand-400">Cycle count</p>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <h1 className="text-h1">
            <span className="font-mono">{count.reference}</span>
          </h1>
          <Badge tone={count.status === "POSTED" ? "success" : count.status === "REVIEW" ? "info" : "brand"} size="md">
            {STATUS_LABEL[count.status]}
          </Badge>
        </div>
        <p className="max-w-prose text-muted-foreground">
          {count.scope === "all" ? "Everything active" : kindLabel(count.scope as ProductKindValue)}, started{" "}
          {formatDateTime(count.createdAt)}
          {count.postedAt ? `, posted ${formatDateTime(count.postedAt)}` : ""}.
        </p>
        {count.note ? <p className="max-w-prose text-sm">{count.note}</p> : null}
      </header>

      <dl className="grid grid-cols-2 gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-4">
        <div>
          <dt className="eyg-eyebrow text-muted-foreground">Lines</dt>
          <dd className="tabular text-xl font-bold">{formatCount(count.lines.length)}</dd>
        </div>
        <div>
          <dt className="eyg-eyebrow text-muted-foreground">Counted</dt>
          <dd className="tabular text-xl font-bold">{formatCount(counted)}</dd>
        </div>
        <div>
          <dt className="eyg-eyebrow text-muted-foreground">Still to count</dt>
          <dd className="tabular text-xl font-bold">{formatCount(outstanding)}</dd>
        </div>
        <div>
          <dt className="eyg-eyebrow text-muted-foreground">Differences</dt>
          <dd className={variances > 0 ? "tabular text-xl font-bold text-destructive" : "tabular text-xl font-bold"}>
            {formatCount(variances)}
            {significant > 0 ? (
              <span className="block text-xs font-bold text-destructive">
                {formatCount(significant)} need a second look
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      {closed ? (
        <Alert tone="info" title="This count is closed">
          <p className="leading-relaxed">
            {count.status === "POSTED"
              ? "It has been posted, so its differences are in the ledger and cannot be changed. Any further correction is a new movement against the product."
              : "It was cancelled, so it changed nothing."}
          </p>
        </Alert>
      ) : null}

      {counted > 0 ? (
        <InventoryStatusLine>
          {formatCount(counted)} of {formatCount(count.lines.length)}{" "}
          {plural(count.lines.length, "line", "lines")} counted
          {outstanding > 0 ? `, ${formatCount(outstanding)} to go` : ", all of them"}.
        </InventoryStatusLine>
      ) : null}

      {closed ? (
        <CountReview count={count} onPosted={() => setReloadToken((token) => token + 1)} readOnly />
      ) : step === "review" ? (
        <CountReview
          count={count}
          onBack={() => setStep("count")}
          onPosted={() => setReloadToken((token) => token + 1)}
        />
      ) : (
        <CountRunner
          count={count}
          onLineSaved={onLineSaved}
          onReview={() => setStep("review")}
        />
      )}

      {typeof count.summary.varianceValue === "number" ? (
        <p className="text-sm text-muted-foreground">
          The ledger values this count&rsquo;s differences at{" "}
          <span className="font-bold text-foreground">{formatPeso(Math.abs(count.summary.varianceValue))}</span> at
          cost. A positive figure means the shelf holds more than the ledger says.
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        <Button type="button" variant="link" size="sm" onClick={() => setReloadToken((token) => token + 1)}>
          Re-read this count from the server
        </Button>
      </p>
    </div>
  );
}

function BackToCounts(): React.ReactElement {
  return (
    <Link
      href="/inventory/counts"
      className="inline-flex min-h-11 items-center gap-2 font-bold text-foreground underline decoration-2 underline-offset-4 hover:decoration-brand-500"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      All stock counts
    </Link>
  );
}

export default CountSession;