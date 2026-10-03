"use client";

/**
 * INVENTORY - THE COUNTING SCREEN
 * ============================================================================
 * A3 owns this file. Built for someone holding a part in one hand and a phone in
 * the other, walking a shelf.
 *
 * The loop is: type the number, press Enter, look at the variance, move on.
 * Enter saves AND advances, because making a second action to get to the next
 * item is where counts get abandoned half-finished.
 *
 * ── LIVE VARIANCE, SERVER-CONFIRMED LINE ───────────────────────────────────
 * While a number is being typed the variance beside it is computed locally and
 * labelled as not yet saved - it is there so a discrepancy is noticed at the
 * shelf, not three shelves later. The moment Enter is pressed the line is
 * REPLACED by the `CountLineDto` the server returned, including the server's
 * own `variance` and `isSignificant`. The screen never shows a number the server
 * has not sent back.
 *
 * ── WHY RE-SENDING A LINE WITH A NOTE IS SAFE ──────────────────────────────
 * `RecordCountInput.counted` is an ABSOLUTE figure, not a delta, so sending the
 * same count twice converges on the same state. That is why this endpoint needs
 * no idempotency key while `PostMovementInput` - which carries a signed delta -
 * absolutely does.
 * ============================================================================
 */

import * as React from "react";
import Link from "next/link";
import { Alert, Button, Input } from "@/components/ui";
import { ArrowLeft, Check, TriangleAlert } from "lucide-react";

import { recordCountLine } from "@/components/inventory/api";
import {
  formatCount,
  plural,
  qty,
  qtySpoken,
  unitShort,
  varianceIsSignificant,
  varianceLabel,
  QTY_ALLOWED_PATTERN,
} from "@/components/inventory/format";
import { InventoryStatusLine } from "@/components/inventory/FourStates";
import { KeyMap, COUNT_SCREEN_KEYS } from "@/components/inventory/InventoryKeyMap";
import type { CountLineDto, StockCountDto } from "@/lib/inventory-types";
import { cn } from "@/lib/utils";

export interface CountRunnerProps {
  count: StockCountDto;
  /** Receives the server's own line, not a locally invented one. */
  onLineSaved: (line: CountLineDto) => void;
  onReview: () => void;
}

export function CountRunner({ count, onLineSaved, onReview }: CountRunnerProps): React.ReactElement {
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("");
  /**
   * The error is scoped to ONE line. A screen-wide error would mark every input
   * on the sheet `aria-invalid`, which tells a screen-reader user that forty
   * products are wrong when one failed.
   */
  const [lineError, setLineError] = React.useState<{ lineId: string | null; message: string }>({
    lineId: null,
    message: "",
  });

  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const leaveRef = React.useRef<HTMLAnchorElement | null>(null);

  const lines = count.lines;
  const outstanding = lines.filter((line) => line.counted === null).length;

  const focusLine = React.useCallback((index: number): void => {
    const clamped = Math.max(0, Math.min(index, lines.length - 1));
    inputRefs.current[clamped]?.focus();
    inputRefs.current[clamped]?.select();
  }, [lines.length]);

  /** The next line that has not been counted yet, or the one after it. */
  const nextUncounted = React.useCallback(
    (fromIndex: number): number => {
      for (let index = fromIndex + 1; index < lines.length; index += 1) {
        const candidate = lines[index];
        if (candidate && candidate.counted === null) return index;
      }
      return Math.min(fromIndex + 1, lines.length - 1);
    },
    [lines],
  );

  const saveLine = React.useCallback(
    async (line: CountLineDto, raw: string, note: string): Promise<boolean> => {
      const parsed = Number.parseInt(raw.trim(), 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setLineError({
          lineId: line.id,
          message:
            "A counted quantity cannot be negative. Count the items you can see; if the shelf is empty, enter 0.",
        });
        return false;
      }

      setSavingId(line.id);
      setLineError({ lineId: null, message: "" });

      const outcome = await recordCountLine({
        countId: count.id,
        productId: line.productId,
        counted: parsed,
        ...(note.trim() === "" ? {} : { note: note.trim() }),
      });

      setSavingId(null);

      if (outcome.kind === "ok") {
        // The server's own line replaces the draft. Never the other way round.
        onLineSaved(outcome.data);
        setDrafts((previous) => {
          const next = { ...previous };
          delete next[line.id];
          return next;
        });
        const variance = outcome.data.variance ?? 0;
        setMessage(
          variance === 0
            ? `${outcome.data.name}: counted, and it matches the ledger exactly.`
            : `${outcome.data.name}: counted ${qtySpoken(parsed, outcome.data.unit)}, ${varianceLabel(
                variance,
                outcome.data.unit,
              )} against the ledger${outcome.data.isSignificant ? ". That is a big enough difference to explain." : "."}`,
        );
        return true;
      }

      if (outcome.kind === "offline") {
        setLineError({
          lineId: line.id,
          message:
            "This device could not reach the inventory service, so nothing was saved. Check your signal and press Enter again.",
        });
        return false;
      }

      setLineError({ lineId: line.id, message: outcome.message });
      return false;
    },
    [count.id, onLineSaved],
  );

  const saveAndAdvance = React.useCallback(
    async (index: number): Promise<void> => {
      const line = lines[index];
      if (line === undefined) return;
      const draft = drafts[line.id] ?? "";

      if (draft.trim() === "") {
        setMessage(`${line.name} left blank. It stays on the list as uncounted.`);
        focusLine(nextUncounted(index));
        return;
      }

      const saved = await saveLine(line, draft, notes[line.id] ?? "");
      if (!saved) return;
      focusLine(nextUncounted(index));
    },
    [drafts, focusLine, lines, nextUncounted, notes, saveLine],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number): void => {
    const line = lines[index];
    if (line === undefined) return;

    switch (event.key) {
      case "Enter": {
        event.preventDefault();
        void saveAndAdvance(index);
        return;
      }
      case "ArrowDown": {
        event.preventDefault();
        focusLine(index + 1);
        return;
      }
      case "ArrowUp": {
        event.preventDefault();
        focusLine(index - 1);
        return;
      }
      case "Escape": {
        event.preventDefault();
        setMessage("You have left the count. Your saved lines are kept; this line is not.");
        leaveRef.current?.focus();
        return;
      }
      default:
        return;
    }
  };

  const onDraftChange = (line: CountLineDto, raw: string): void => {
    if (raw !== "" && !QTY_ALLOWED_PATTERN.test(raw)) {
      setLineError({
        lineId: line.id,
        message: raw.includes("-")
          ? "A counted quantity cannot be negative. Enter 0 if the shelf is empty."
          : "Type digits only. If the item itself is wrong, leave this line blank and note it during review.",
      });
      return;
    }
    setLineError({ lineId: null, message: "" });
    setDrafts((previous) => ({ ...previous, [line.id]: raw }));
  };

  return (
    <section aria-label="Counting sheet" className="space-y-4">
      <KeyMap bindings={COUNT_SCREEN_KEYS} caption="Keyboard shortcuts for the counting sheet" />

      <InventoryStatusLine>{message}</InventoryStatusLine>

      {lineError.message !== "" ? (
        <Alert tone="danger" title="That line did not save" icon={<TriangleAlert className="size-5" />}>
          <p className="leading-relaxed">{lineError.message}</p>
        </Alert>
      ) : null}

      <div className="rounded-card border border-border bg-surface">
        <div className="hidden items-center gap-4 border-b border-border bg-surface-muted px-4 py-2 sm:flex">
          <p className="eyg-eyebrow flex-1 font-bold uppercase tracking-widest text-muted-foreground">Item</p>
          <p className="eyg-eyebrow w-24 text-right font-bold uppercase tracking-widest text-muted-foreground">
            Expected
          </p>
          <p className="eyg-eyebrow w-32 text-center font-bold uppercase tracking-widest text-muted-foreground">
            Counted
          </p>
          <p className="eyg-eyebrow w-32 text-right font-bold uppercase tracking-widest text-muted-foreground">
            Difference
          </p>
        </div>

        <ul>
          {lines.map((line, index) => {
            const draft = drafts[line.id] ?? "";
            const draftValue = draft.trim() === "" ? null : Number.parseInt(draft, 10);
            const liveVariance = draftValue === null || !Number.isFinite(draftValue) ? null : draftValue - line.expected;
            const liveSignificant =
              liveVariance === null ? false : varianceIsSignificant(liveVariance, line.expected);
            const isSaving = savingId === line.id;

            return (
              <li
                key={line.id}
                className={cn(
                  "flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:gap-4",
                  line.counted === null ? "bg-surface" : "bg-surface-muted",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-start gap-2 font-bold">
                    {line.counted !== null ? (
                      <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-success" />
                    ) : null}
                    <span className="min-w-0">{line.name}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {line.sku} / {unitShort(line.unit)}
                  </p>
                </div>

                <div className="sm:w-24 sm:text-right">
                  <span className="eyg-eyebrow text-muted-foreground sm:sr-only">Expected</span>
                  <span className="tabular font-bold">{qty(line.expected, line.unit)}</span>
                </div>

                <div className="sm:w-32">
                  <label htmlFor={`count-${line.id}`} className="eyg-eyebrow text-muted-foreground sm:sr-only">
                    Counted quantity for {line.name}
                  </label>
                  <Input
                    id={`count-${line.id}`}
                    ref={(element: HTMLInputElement | null) => {
                      inputRefs.current[index] = element;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="-"
                    value={draft}
                    disabled={isSaving}
                    aria-invalid={lineError.lineId === line.id || undefined}
                    className="tabular h-14 text-center text-2xl font-bold"
                    onChange={(event) => onDraftChange(line, event.target.value)}
                    onKeyDown={(event) => onKeyDown(event, index)}
                  />
                </div>

                <div className="sm:w-32 sm:text-right">
                  <span className="eyg-eyebrow text-muted-foreground sm:sr-only">Difference</span>
                  {line.counted !== null ? (
                    <span className="block">
                      <span
                        className={cn(
                          "tabular block font-bold",
                          (line.variance ?? 0) === 0
                            ? "text-success"
                            : line.isSignificant
                              ? "text-destructive"
                              : "text-foreground",
                        )}
                      >
                        {varianceLabel(line.variance ?? 0, line.unit)}
                      </span>
                      <span className="text-xs text-muted-foreground">saved</span>
                    </span>
                  ) : liveVariance !== null ? (
                    <span className="block">
                      <span
                        className={cn(
                          "tabular block font-bold",
                          liveVariance === 0 ? "text-success" : liveSignificant ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {varianceLabel(liveVariance, line.unit)}
                      </span>
                      <span className="text-xs text-muted-foreground">not saved yet</span>
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">&mdash;</span>
                  )}
                </div>

                {line.isSignificant && line.note === null ? (
                  <div className="sm:w-full sm:col-span-4">
                    <label htmlFor={`count-note-${line.id}`} className="eyg-eyebrow block text-foreground">
                      Why is {line.name} different
                    </label>
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                      <Input
                        id={`count-note-${line.id}`}
                        type="text"
                        autoComplete="off"
                        placeholder="e.g. one fitted last Saturday and never written off"
                        value={notes[line.id] ?? line.note ?? ""}
                        onChange={(event) =>
                          setNotes((previous) => ({ ...previous, [line.id]: event.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        disabled={isSaving || (notes[line.id] ?? "").trim() === ""}
                        onClick={() => {
                          const current = drafts[line.id] ?? String(line.counted ?? line.expected);
                          void saveLine(line, current, notes[line.id] ?? "");
                        }}
                      >
                        Save the explanation
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This difference is big enough that a person should say why. It stays on the record either
                      way.
                    </p>
                  </div>
                ) : line.note !== null ? (
                  <p className="text-xs text-muted-foreground sm:w-full">Note on record: {line.note}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/inventory/counts"
          ref={leaveRef}
          className="inline-flex min-h-11 items-center gap-2 font-bold text-foreground underline decoration-2 underline-offset-4 hover:decoration-brand-500"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Leave the count and come back later
        </Link>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="text-sm text-muted-foreground">
            {outstanding > 0
              ? `${formatCount(outstanding)} ${plural(outstanding, "line", "lines")} still to count.`
              : `All ${formatCount(lines.length)} ${plural(lines.length, "line", "lines")} counted.`}
          </p>
          <Button type="button" variant="accent" size="lg" onClick={onReview}>
            {outstanding > 0 ? "Review what is counted so far" : "Finish and review"}
          </Button>
        </div>
      </div>

      {outstanding > 0 ? (
        <p className="text-sm text-muted-foreground">
          Reviewing early is allowed. Lines left blank are simply not counted, and they are listed as outstanding
          rather than quietly treated as zero &mdash; a blank line is missing information, not an empty shelf.
        </p>
      ) : null}
    </section>
  );
}