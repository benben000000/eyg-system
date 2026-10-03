"use client";

/**
 * INVENTORY - START A STOCK COUNT
 * ============================================================================
 * A3 owns this file. Pick a scope, start it, and land on the counting screen.
 *
 * A cycle count is the only mechanism in this system that can make the ledger
 * agree with the shelf. Everything else - receiving, consuming, adjusting -
 * records what somebody already did. A count is how you find out that somebody
 * did something and did not record it.
 *
 * Existing counts are listed with their real progress. An abandoned DRAFT or
 * COUNTING sheet is not junk: it is usually last week's unfinished count, and
 * finishing it is how that work gets used rather than repeated.
 * ============================================================================
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Field, Input, NativeSelect } from "@/components/ui";
import { ClipboardList, Play, TriangleAlert } from "lucide-react";

import { createCount, fetchCounts } from "@/components/inventory/api";
import { formatCount, formatDateTime, KIND_OPTIONS, kindLabel, plural } from "@/components/inventory/format";
import {
  InventoryOffline,
  InventoryPanelEmpty,
  InventoryPanelError,
  InventoryPanelSkeleton,
  InventoryStatusLine,
} from "@/components/inventory/FourStates";
import type { ProductKindValue, StockCountDto, StockCountStatusValue } from "@/lib/inventory-types";
import { useIdempotentSubmit } from "@/hooks/useIdempotentSubmit";
import { formatPeso } from "@/lib/utils";

const SCOPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "Everything that is active" },
  ...KIND_OPTIONS.map((option) => ({ value: option.value, label: `Only ${option.label.toLowerCase()} items` })),
];

type CountsState =
  | { kind: "loading" }
  | { kind: "ready"; counts: StockCountDto[] }
  | { kind: "failed"; title: string; message: string }
  | { kind: "offline" };

/** A word, never a colour alone: under deuteranopia these chips are the same. */
function CountStatusBadge({ status }: { status: StockCountStatusValue }): React.ReactElement {
  const label: Record<StockCountStatusValue, string> = {
    DRAFT: "Not started",
    COUNTING: "Counting",
    REVIEW: "Ready to review",
    POSTED: "Posted",
    CANCELLED: "Cancelled",
  };
  const tone: Record<StockCountStatusValue, "neutral" | "brand" | "info" | "success"> = {
    DRAFT: "neutral",
    COUNTING: "brand",
    REVIEW: "info",
    POSTED: "success",
    CANCELLED: "neutral",
  };
  return (
    <Badge tone={tone[status]} size="sm">
      {label[status]}
    </Badge>
  );
}

export function CountStart(): React.ReactElement {
  const router = useRouter();

  const [scope, setScope] = React.useState("all");
  const [note, setNote] = React.useState("");
  const [state, setState] = React.useState<CountsState>({ kind: "loading" });
  const [reloadToken, setReloadToken] = React.useState(0);
  const [started, setStarted] = React.useState<string | null>(null);

  const { submit: runCreate, isPending, error: createError } = useIdempotentSubmit<StockCountDto>();

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    void fetchCounts(controller.signal)
      .then((outcome) => {
        if (cancelled) return;
        if (outcome.kind === "ok") {
          setState({ kind: "ready", counts: outcome.data.counts });
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
          title: "The count list did not load",
          message: "That request ended before it finished. Nothing was changed.",
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken]);

  const onStart = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const envelope = await runCreate(async () => {
      const outcome = await createCount({ scope, ...(note.trim() === "" ? {} : { note: note.trim() }) });
      if (outcome.kind === "ok") return { ok: true, data: outcome.data };
      if (outcome.kind === "offline") {
        return {
          ok: false,
          error: {
            code: "SERVICE_UNAVAILABLE" as const,
            message: "This device could not reach the inventory service, so no count was started.",
          },
        };
      }
      return { ok: false, error: { code: "INTERNAL_ERROR" as const, message: outcome.message } };
    });

    // A duplicate tap returns null: one count was created, not two.
    if (envelope === null) return;

    if (envelope.ok) {
      setStarted(envelope.data.reference);
      router.push(`/inventory/counts/${envelope.data.id}`);
    }
  };

  const counts = state.kind === "ready" ? state.counts : [];
  const stillOpen = counts.filter((count) => count.status !== "POSTED" && count.status !== "CANCELLED");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="eyg-eyebrow text-brand-800 data-[theme=dark]:text-brand-400">Cycle count</p>
        <h1 className="text-h1">Stock count</h1>
        <p className="max-w-prose text-muted-foreground">
          Count the shelf against the ledger. Every difference is a real difference, and recording it is the
          only way the screen and the shelf ever agree. Nothing here is filled in for you.
        </p>
      </header>

      <section aria-label="Start a count" className="rounded-card border border-border bg-surface p-4 sm:p-5">
        <h2 className="text-h3">Start a count</h2>

        <form onSubmit={onStart} noValidate className="mt-4 space-y-5">
          {createError !== null ? (
            <Alert tone="danger" title="That count did not start" icon={<TriangleAlert className="size-5" />}>
              <p className="leading-relaxed">{createError}</p>
            </Alert>
          ) : null}

          {started !== null ? (
            <Alert tone="success" title="Count started">
              <p className="leading-relaxed">
                Reference <span className="font-mono">{started}</span>. Opening the counting screen now.
              </p>
            </Alert>
          ) : null}

          <Field
            id="count-scope"
            label="What are you counting"
            required
            helper="One shelf, one kind, or everything. A wide count is slower to finish and finds more."
          >
            {(wiring) => (
              <NativeSelect
                {...wiring}
                size="lg"
                value={scope}
                options={SCOPE_OPTIONS}
                onChange={(event) => setScope(event.target.value)}
              />
            )}
          </Field>

          <Field id="count-note" label="Note" helper="Optional. Who is counting, and why now.">
            {(wiring) => (
              <Input
                {...wiring}
                name="note"
                type="text"
                autoComplete="off"
                placeholder="e.g. Monday morning count before the weekend rush"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </Field>

          <Button type="submit" variant="accent" size="lg" loading={isPending} disabled={isPending}>
            <Play aria-hidden="true" className="size-4" />
            {isPending ? "Starting..." : "Start counting"}
          </Button>
        </form>
      </section>

      <section aria-label="Existing counts" className="space-y-3">
        <h2 className="text-h3">Counts on record</h2>

        {state.kind === "loading" ? (
          <InventoryPanelSkeleton rows={3} label="Loading the count list" columns={3} />
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

        {state.kind === "ready" && counts.length === 0 ? (
          <InventoryPanelEmpty
            icon={<ClipboardList className="size-8" />}
            title="No counts yet"
            description="Nothing has been counted against this ledger. That is survivable right up until the moment a customer is told a part is in stock on the strength of it."
          />
        ) : null}

        {counts.length > 0 ? (
          <>
            <InventoryStatusLine>
              {formatCount(counts.length)} {plural(counts.length, "count", "counts")} on record
              {stillOpen.length > 0 ? `, ${formatCount(stillOpen.length)} still open` : ", none of them still open"}.
            </InventoryStatusLine>

            <ul className="space-y-2">
              {counts.map((count) => {
                const share = count.summary.total === 0 ? 0 : Math.round((count.summary.counted / count.summary.total) * 100);
                return (
                  <li key={count.id} className="rounded-card border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold">{count.reference}</span>
                          <CountStatusBadge status={count.status} />
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {count.scope === "all" ? "Everything active" : kindLabel(count.scope as ProductKindValue)} /{" "}
                          {formatCount(count.summary.total)} {plural(count.summary.total, "line", "lines")} /{" "}
                          {formatDateTime(count.createdAt)}
                        </p>
                        {count.note ? <p className="mt-1 text-sm">{count.note}</p> : null}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <p className="tabular text-sm">
                          {formatCount(count.summary.counted)}/{formatCount(count.summary.total)} counted
                        </p>
                        <Link
                          href={`/inventory/counts/${count.id}`}
                          className="inline-flex min-h-11 items-center rounded-eyebrow border border-ink-400 px-4 text-sm font-bold hover:bg-surface-muted"
                        >
                          {count.status === "REVIEW"
                            ? "Review"
                            : count.status === "POSTED" || count.status === "CANCELLED"
                              ? "View"
                              : "Continue counting"}
                        </Link>
                      </div>
                    </div>

                    <div
                      role="progressbar"
                      aria-valuenow={share}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Counting progress for ${count.reference}`}
                      className="mt-3 h-2 w-full bg-surface-muted"
                    >
                      <div className="h-2 bg-brand-500" style={{ width: `${share}%` }} />
                    </div>

                    {count.summary.variances > 0 ? (
                      <p className="mt-2 text-sm font-bold text-destructive">
                        {formatCount(count.summary.variances)}{" "}
                        {plural(count.summary.variances, "line differs", "lines differ")} from the ledger
                        {typeof count.summary.varianceValue === "number"
                          ? `, worth ${formatPeso(Math.abs(count.summary.varianceValue))} at cost`
                          : ""}
                        .
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </section>

      <p className="text-sm text-muted-foreground">
        Counting is unglamorous work. It is also the only thing that makes every other figure on this system
        worth reading.
      </p>
    </div>
  );
}

export default CountStart;