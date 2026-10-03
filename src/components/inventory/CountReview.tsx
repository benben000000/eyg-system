"use client";

/**
 * INVENTORY - COUNT REVIEW AND POSTING
 * ============================================================================
 * A3 owns this file. The last screen of a count, and the only irreversible one.
 *
 * Posting writes real ledger movements against real products. It cannot be
 * undone, because an undoable ledger is not a ledger. So this screen does three
 * things before it will let anybody press the button:
 *
 *   1. Shows EVERY difference, in units and in pesos, not a summary count.
 *   2. Refuses to post while lines are uncounted, and says why.
 *   3. Requires an explicit acknowledgement that this is permanent.
 *
 * ── WHY THE PESO COLUMN IS FETCHED HERE ─────────────────────────────────────
 * `CountLineDto` carries no cost, and cost lives on `ProductDto` behind the staff
 * filter. So the review step re-reads the counted products from the staff-only
 * catalogue and multiplies. The server's own `summary.varianceValue` is shown
 * alongside; when both are present they should agree, and if they do not, the
 * operator sees two numbers and can ask why. Neither figure is invented.
 * ============================================================================
 */

import * as React from "react";
import Link from "next/link";
import { Alert, Badge, Button, Checkbox } from "@/components/ui";
import { Check, ShieldCheck, TriangleAlert } from "lucide-react";

import { fetchProductsByIds, postCount } from "@/components/inventory/api";
import { formatCount, formatDateTime, plural, qty, qtySpoken, varianceLabel } from "@/components/inventory/format";
import { InventoryStatusLine } from "@/components/inventory/FourStates";
import type { CountLineDto, StockCountDto } from "@/lib/inventory-types";
import { useIdempotentSubmit } from "@/hooks/useIdempotentSubmit";
import { cn, formatPeso } from "@/lib/utils";

export interface CountReviewProps {
  count: StockCountDto;
  /** A posted or cancelled count is shown, never re-posted. */
  readOnly?: boolean;
  onBack?: () => void;
  onPosted: () => void;
}

interface CostMap {
  costs: Record<string, number>;
  loading: boolean;
  failed: boolean;
}

export function CountReview({ count, readOnly = false, onBack, onPosted }: CountReviewProps): React.ReactElement {
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [posted, setPosted] = React.useState<StockCountDto | null>(null);
  const [costMap, setCostMap] = React.useState<CostMap>({ costs: {}, loading: false, failed: false });

  const { submit: runPost, isPending, error: postError } = useIdempotentSubmit<StockCountDto>();

  const varianceLines = React.useMemo(
    () => count.lines.filter((line) => line.variance !== null && line.variance !== 0),
    [count.lines],
  );
  const outstanding = count.lines.filter((line) => line.counted === null);
  const significant = count.lines.filter((line) => line.isSignificant);

  // Only fetch costs when there is a variance to value. A clean count needs no
  // second request at all.
  React.useEffect(() => {
    if (readOnly || varianceLines.length === 0) return;
    const controller = new AbortController();
    let cancelled = false;
    setCostMap({ costs: {}, loading: true, failed: false });

    const ids = Array.from(new Set(varianceLines.map((line) => line.productId)));

    void fetchProductsByIds(ids, controller.signal)
      .then((outcome) => {
        if (cancelled) return;
        if (outcome.kind === "ok") {
          const costs: Record<string, number> = {};
          for (const product of outcome.data) {
            if (typeof product.costPrice === "number" && product.costPrice > 0) {
              costs[product.id] = product.costPrice;
            }
          }
          setCostMap({ costs, loading: false, failed: false });
          return;
        }
        setCostMap({ costs: {}, loading: false, failed: true });
      })
      .catch(() => {
        if (!cancelled) setCostMap({ costs: {}, loading: false, failed: true });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [readOnly, varianceLines]);

  const pesoFor = (line: CountLineDto): number | null => {
    const cost = costMap.costs[line.productId];
    if (cost === undefined || line.variance === null) return null;
    return Math.abs(line.variance) * cost;
  };

  const computedTotal = React.useMemo((): number => {
    return varianceLines.reduce<number>((sum, line) => {
      const cost = costMap.costs[line.productId];
      if (cost === undefined || line.variance === null) return sum;
      return sum + Math.abs(line.variance) * cost;
    }, 0);
  }, [varianceLines, costMap.costs]);

  const everyLineValued =
    varianceLines.length > 0 && varianceLines.every((line) => pesoFor(line) !== null);

  const onPost = async (): Promise<void> => {
    if (!acknowledged || outstanding.length > 0) return;

    const envelope = await runPost(async () => {
      const outcome = await postCount(count.id);
      if (outcome.kind === "ok") return { ok: true, data: outcome.data };
      if (outcome.kind === "offline") {
        return {
          ok: false,
          error: {
            code: "SERVICE_UNAVAILABLE" as const,
            message: "This device could not reach the inventory service, so the count was not posted.",
          },
        };
      }
      return { ok: false, error: { code: "INTERNAL_ERROR" as const, message: outcome.message } };
    });

    // A double tap on Post returns null: one post, not two.
    if (envelope === null) return;
    if (envelope.ok) {
      setPosted(envelope.data);
      onPosted();
    }
  };

  if (posted !== null) {
    return (
      <section aria-label="Count posted" className="space-y-4">
        <Alert tone="success" title="Posted to the ledger">
          <p className="leading-relaxed">
            Count <span className="font-mono">{posted.reference}</span> is posted. Its differences are now
            permanent ledger entries with a reason against each one. To change anything now, record a new
            movement on the product.
          </p>
        </Alert>

        <dl className="grid grid-cols-2 gap-3 rounded-card border border-border bg-surface-muted p-4 sm:grid-cols-4">
          <div>
            <dt className="eyg-eyebrow text-muted-foreground">Lines counted</dt>
            <dd className="tabular text-lg font-bold">{formatCount(posted.summary.counted)}</dd>
          </div>
          <div>
            <dt className="eyg-eyebrow text-muted-foreground">Differences</dt>
            <dd className="tabular text-lg font-bold">{formatCount(posted.summary.variances)}</dd>
          </div>
          <div>
            <dt className="eyg-eyebrow text-muted-foreground">Net difference</dt>
            <dd className="tabular text-lg font-bold">
              {posted.summary.netVariance > 0 ? "+" : ""}
              {formatCount(posted.summary.netVariance)} units
            </dd>
          </div>
          <div>
            <dt className="eyg-eyebrow text-muted-foreground">Posted at</dt>
            <dd className="text-sm font-bold">
              {posted.postedAt ? formatDateTime(posted.postedAt) : "Just now"}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/inventory"
            className="inline-flex min-h-12 items-center justify-center rounded-eyebrow border border-ink-400 px-6 font-bold hover:bg-surface-muted"
          >
            Back to the stock list
          </Link>
          <Link
            href="/inventory/reorder"
            className="inline-flex min-h-12 items-center justify-center rounded-eyebrow border border-ink-400 px-6 font-bold hover:bg-surface-muted"
          >
            See what now needs ordering
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Review and post" className="space-y-5">
      <div>
        <h2 className="text-h3">Review before posting</h2>
        <p className="mt-1 max-w-prose text-muted-foreground">
          Posting writes a ledger movement for every difference below. It cannot be undone.
        </p>
      </div>

      {postError !== null ? (
        <Alert tone="danger" title="The count did not post" icon={<TriangleAlert className="size-5" />}>
          <p className="leading-relaxed">{postError}</p>
        </Alert>
      ) : null}

      {varianceLines.length === 0 ? (
        <Alert tone="success" title={outstanding.length === 0 ? "Everything matched" : "No differences so far"}>
          <p className="leading-relaxed">
            {outstanding.length === 0
              ? "Every line you counted matched the ledger exactly. That is the good outcome, and it is worth noticing."
              : `Nothing you have counted so far differs from the ledger. ${formatCount(outstanding.length)} ${plural(
                  outstanding.length,
                  "line is",
                  "lines are",
                )} still uncounted.`}
          </p>
        </Alert>
      ) : (
        <>
          {significant.length > 0 ? (
            <Alert tone="warning" title={`${formatCount(significant.length)} ${plural(significant.length, "difference", "differences")} worth a second look`}>
              <p className="leading-relaxed">
                More than a unit, or more than a tenth of what was expected. These are usually a part fitted
                without a booking, or a delivery never received. They are flagged, not blocked &mdash; but read
                the note before you post.
              </p>
            </Alert>
          ) : null}

          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Every counted line that differs from the ledger, with the difference in units and the peso value
                at cost.
              </caption>
              <thead className="bg-surface-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-eyebrow font-bold uppercase tracking-widest">
                    Item
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-eyebrow font-bold uppercase tracking-widest">
                    Expected
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-eyebrow font-bold uppercase tracking-widest">
                    Counted
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-eyebrow font-bold uppercase tracking-widest">
                    Difference
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-eyebrow font-bold uppercase tracking-widest">
                    At cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {varianceLines.map((line) => {
                  const peso = pesoFor(line);
                  return (
                    <tr key={line.id} className={cn("border-t border-border", line.isSignificant && "bg-brand-50 dark:bg-ink-900")}>
                      <th scope="row" className="px-3 py-2 text-left font-normal">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{line.name}</span>
                          {line.isSignificant ? (
                            <Badge tone="danger" size="sm">
                              Check this
                            </Badge>
                          ) : null}
                        </span>
                        <span className="block font-mono text-xs text-muted-foreground">{line.sku}</span>
                        {line.note ? <span className="block text-xs">Note: {line.note}</span> : null}
                      </th>
                      <td className="px-3 py-2 text-right tabular">{qty(line.expected, line.unit)}</td>
                      <td className="px-3 py-2 text-right tabular font-bold">{qty(line.counted ?? 0, line.unit)}</td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={cn(
                            "tabular font-bold",
                            line.isSignificant ? "text-destructive" : "text-foreground",
                          )}
                        >
                          {varianceLabel(line.variance ?? 0, line.unit)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {peso === null ? (
                          <span className="text-muted-foreground">
                            <span aria-hidden="true">&mdash;</span>
                            <span className="sr-only">Cost not on file</span>
                          </span>
                        ) : (
                          <span className="tabular font-bold">{formatPeso(peso)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-card border border-border bg-surface-muted p-4">
            <InventoryStatusLine>
              {formatCount(varianceLines.length)}{" "}
              {plural(varianceLines.length, "difference", "differences")} on{" "}
              {formatCount(count.lines.length)} {plural(count.lines.length, "line", "lines")}.
              {costMap.loading ? " Working out the peso value..." : null}
              {costMap.failed
                ? " The peso value could not be loaded, so it is not shown. The unit differences above are unaffected."
                : null}
            </InventoryStatusLine>

            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Net difference, from the server</dt>
                <dd className="tabular font-bold">
                  {count.summary.netVariance > 0 ? "+" : ""}
                  {formatCount(count.summary.netVariance)} units
                </dd>
              </div>
              {typeof count.summary.varianceValue === "number" ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Value at cost, from the server</dt>
                  <dd className="tabular font-bold">{formatPeso(Math.abs(count.summary.varianceValue))}</dd>
                </div>
              ) : null}
              {everyLineValued ? (
                <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5">
                  <dt className="font-bold">Sum of the lines above, at cost</dt>
                  <dd className="tabular font-bold">{formatPeso(computedTotal)}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </>
      )}

      {outstanding.length > 0 ? (
        <Alert tone="warning" title={`${formatCount(outstanding.length)} ${plural(outstanding.length, "line", "lines")} still uncounted`}>
          <p className="leading-relaxed">
            A blank line is missing information, not an empty shelf, so this count cannot be posted until every
            line has a number or the sheet is restarted with a narrower scope.
          </p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
            {outstanding.slice(0, 20).map((line) => (
              <li key={line.id}>
                {line.name} <span className="font-mono text-xs text-muted-foreground">{line.sku}</span> &mdash;
                expected {qtySpoken(line.expected, line.unit)}
              </li>
            ))}
          </ul>
          {outstanding.length > 20 ? (
            <p className="mt-2 text-sm">and {formatCount(outstanding.length - 20)} more.</p>
          ) : null}
        </Alert>
      ) : null}

      {readOnly ? (
        <p className="text-sm text-muted-foreground">
          This count has already been posted, so it cannot be posted again. Correct anything that is wrong by
          recording a movement on the product itself.
        </p>
      ) : (
        <div className="rounded-card border-2 border-border-strong bg-surface p-4 sm:p-5">
          <p className="flex items-start gap-2 text-sm font-bold">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            Posting is permanent
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            It writes {formatCount(varianceLines.length)}{" "}
            {plural(varianceLines.length, "entry", "entries")} into the movement ledger, each with a reason and
            your name against it. There is no undo. If you are not sure, leave it and ask the owner.
          </p>

          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-0.5 size-6"
            />
            <span className="text-sm font-semibold">
              I counted these myself and I understand this writes to the ledger permanently.
            </span>
          </label>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {onBack ? (
              <Button type="button" variant="ghost" size="lg" onClick={onBack}>
                Go back and finish counting
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="accent"
              size="lg"
              loading={isPending}
              disabled={!acknowledged || outstanding.length > 0 || isPending || varianceLines.length === 0}
              onClick={() => void onPost()}
            >
              {isPending ? "Posting..." : "Post this count"}
            </Button>
          </div>

          {varianceLines.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {outstanding.length === 0
                ? "Nothing to post: every line matched, so there are no movements to write."
                : "Nothing to post yet: no difference has been recorded, so there are no movements to write."}
            </p>
          ) : null}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          Posting does not change prices, reorder points or suppliers. It changes what the ledger believes is on
          the shelf, which is the only number every other screen is built on.
        </span>
      </p>
    </section>
  );
}