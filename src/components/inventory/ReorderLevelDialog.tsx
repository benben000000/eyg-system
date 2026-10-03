"use client";

/**
 * INVENTORY - SET THE REORDER LEVEL
 * ============================================================================
 * A3 owns this file.
 *
 * Deliberately NOT a stock movement. Raising a reorder point moves nothing, so
 * it must not appear in the ledger: the ledger answers "what happened to the
 * stock", and a reorder threshold is a decision, not an event. It is a `PATCH`
 * on the product instead.
 *
 * Before and after are both shown, the new figure is rejected at the keystroke
 * if it is negative, and the confirmed value comes back from the server.
 * ============================================================================
 */

import * as React from "react";
import { Alert, Button, Field, Input, Modal, ModalContent } from "@/components/ui";
import { Check, TriangleAlert } from "lucide-react";

import { patchProduct } from "@/components/inventory/api";
import { qty, qtySpoken, unitShort } from "@/components/inventory/format";
import type { ProductDto } from "@/lib/inventory-types";
import { useIdempotentSubmit } from "@/hooks/useIdempotentSubmit";
import { cn } from "@/lib/utils";

const WHOLE_NUMBER = /^\d{1,6}$/;

const REORDER_POINT_ERROR =
  "Type a whole number of items. A negative reorder point would make the product look permanently in stock.";

export interface ReorderLevelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductDto;
  onCompleted?: (product: ProductDto) => void;
}

export function ReorderLevelDialog({
  open,
  onOpenChange,
  product,
  onCompleted,
}: ReorderLevelDialogProps): React.ReactElement {
  const [reorderPoint, setReorderPoint] = React.useState(String(product.reorderPoint));
  const [reorderQty, setReorderQty] = React.useState(String(product.reorderQty));
  const [pointError, setPointError] = React.useState<string | null>(null);
  const [qtyError, setQtyError] = React.useState<string | null>(null);
  const [attempted, setAttempted] = React.useState(false);
  const [saved, setSaved] = React.useState<ProductDto | null>(null);

  const {
    submit: runSubmit,
    isPending,
    error: submitError,
    reset: resetSubmit,
  } = useIdempotentSubmit<ProductDto>();

  React.useEffect(() => {
    if (!open) return;
    setReorderPoint(String(product.reorderPoint));
    setReorderQty(String(product.reorderQty));
    setPointError(null);
    setQtyError(null);
    setAttempted(false);
    setSaved(null);
    resetSubmit();
  }, [open, product.id, product.reorderPoint, product.reorderQty, resetSubmit]);

  const onWholeNumberChange = (
    raw: string,
    setter: (value: string) => void,
    setError: (message: string | null) => void,
  ): void => {
    if (raw !== "" && !WHOLE_NUMBER.test(raw)) {
      setError(REORDER_POINT_ERROR);
      return;
    }
    setError(null);
    setter(raw);
  };

  const parsedPoint = Number.parseInt(reorderPoint, 10);
  const parsedQty = Number.parseInt(reorderQty, 10);
  const pointOk = pointError === null && Number.isFinite(parsedPoint) && parsedPoint >= 0 && reorderPoint.trim() !== "";
  const orderQtyOk = qtyError === null && Number.isFinite(parsedQty) && parsedQty >= 0 && reorderQty.trim() !== "";
  const unchanged =
    reorderPoint.trim() === String(product.reorderPoint) && reorderQty.trim() === String(product.reorderQty);
  const canSubmit = pointOk && orderQtyOk && !unchanged && !isPending && saved === null;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setAttempted(true);
    if (!canSubmit) return;

    const envelope = await runSubmit(async (signal) => {
      const outcome = await patchProduct(product.id, { reorderPoint: parsedPoint, reorderQty: parsedQty }, signal);
      if (outcome.kind === "ok") return { ok: true, data: outcome.data };
      if (outcome.kind === "offline") {
        return {
          ok: false,
          error: {
            code: "SERVICE_UNAVAILABLE" as const,
            message: "This device could not reach the inventory service. Nothing was changed.",
          },
        };
      }
      return { ok: false, error: { code: "INTERNAL_ERROR" as const, message: outcome.message } };
    });

    if (envelope === null) return;
    if (envelope.ok) {
      setSaved(envelope.data);
      onCompleted?.(envelope.data);
    }
  };

  const confirmed = saved ?? null;
  const previewLow = pointOk ? parsedPoint : product.reorderPoint;
  const nextSuggested = orderQtyOk ? parsedQty : product.reorderQty;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="md"
        title={confirmed !== null ? "Reorder level saved" : `Reorder level - ${product.name}`}
        description={
          confirmed !== null
            ? undefined
            : "When available stock falls to the reorder point, this product appears on the reorder list. No stock moves."
        }
      >
        {confirmed !== null ? (
          <div className="space-y-4">
            <Alert tone="success" title="Saved">
              <p className="leading-relaxed">
                {product.name} now warns at {qty(confirmed.reorderPoint, product.unit)} and suggests ordering{" "}
                {qty(confirmed.reorderQty, product.unit)}. No stock was moved and no ledger row was written -
                a threshold is a decision, not an event.
              </p>
            </Alert>
            <Button type="button" variant="primary" size="lg" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {submitError !== null ? (
              <Alert tone="danger" title="That did not save" icon={<TriangleAlert className="size-5" />}>
                <p className="leading-relaxed">{submitError}</p>
              </Alert>
            ) : null}

            <Field
              id="reorder-point"
              label={`Warn me at (${unitShort(product.unit)})`}
              required
              helper="The figure at which this product is called low. Set it to the smallest number you would still be willing to sell from."
              error={pointError ?? (attempted && !pointOk ? REORDER_POINT_ERROR : null) ?? undefined}
            >
              {(wiring) => (
                <Input
                  {...wiring}
                  name="reorderPoint"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={reorderPoint}
                  size="lg"
                  className="tabular text-2xl font-bold"
                  onChange={(event) => onWholeNumberChange(event.target.value, setReorderPoint, setPointError)}
                />
              )}
            </Field>

            <Field
              id="reorder-qty"
              label={`Order this much when it trips (${unitShort(product.unit)})`}
              required
              helper="The suggested quantity on the reorder list. For a tyre this is often a set of four or a pair, not one."
              error={qtyError ?? (attempted && !orderQtyOk ? REORDER_POINT_ERROR : null) ?? undefined}
            >
              {(wiring) => (
                <Input
                  {...wiring}
                  name="reorderQty"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={reorderQty}
                  size="lg"
                  className="tabular text-2xl font-bold"
                  onChange={(event) => onWholeNumberChange(event.target.value, setReorderQty, setQtyError)}
                />
              )}
            </Field>

            <dl className="space-y-1.5 rounded-card border border-border bg-surface-muted p-4 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Warns at now</dt>
                <dd className="tabular">{qty(product.reorderPoint, product.unit)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-bold">Warns at after (estimate)</dt>
                <dd className="tabular font-bold">{qty(previewLow, product.unit)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5">
                <dt className="text-muted-foreground">Suggested order now</dt>
                <dd className="tabular">{qty(product.reorderQty, product.unit)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-bold">Suggested order after (estimate)</dt>
                <dd className="tabular font-bold">{qty(nextSuggested, product.unit)}</dd>
              </div>
            </dl>

            <p className="text-xs text-muted-foreground">
              The estimates above are arithmetic. The saved values are the ones the server sends back.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {unchanged
                  ? "Nothing has changed yet."
                  : `Currently ${qtySpoken(product.stock.available, product.unit)} available.`}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="md" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" size="lg" loading={isPending} disabled={!canSubmit}>
                  {isPending ? "Saving..." : "Save reorder level"}
                </Button>
              </div>
            </div>
          </form>
        )}

        {confirmed !== null ? (
          <>
            <p role="status" aria-live="polite" className="sr-only">
              Reorder level saved. Warns at {qtySpoken(confirmed.reorderPoint, confirmed.unit)}, suggests
              ordering {qtySpoken(confirmed.reorderQty, confirmed.unit)}.
            </p>
            <p
              className={cn(
                "mt-4 flex items-center gap-2 text-sm font-bold",
                confirmed.reorderPoint <= 0 ? "text-destructive" : "text-success",
              )}
            >
              <Check aria-hidden="true" className="size-4" />
              {confirmed.reorderPoint <= 0
                ? "A reorder point of zero means this product will never be flagged as low"
                : "Confirmed by the server"}
            </p>
          </>
        ) : null}
      </ModalContent>
    </Modal>
  );
}