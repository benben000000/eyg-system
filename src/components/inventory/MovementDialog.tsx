"use client";

/**
 * INVENTORY - THE MUTATION DIALOG
 * ============================================================================
 * A3 owns this file. ONE component, six intents, ONE write path.
 *
 *   Receive / Consume / Adjust / Shrink / Return / Reserve
 *     all of them go to POST /api/inventory/movement
 *
 * WHY SIX INTENTS IN ONE DIALOG
 * Every one of them is the same `PostMovementInput` with a different `kind`. Six
 * dialogs would be six copies of the same three hard rules - no negative
 * quantity, mandatory reason, one idempotency key per open - and hard rules that
 * live in six files are hard rules that get fixed in one.
 *
 * NO OPTIMISTIC UI, EVER
 * The stock figure in this dialog does not move when you press Confirm. It moves
 * when the server answers, and then it shows the numbers the server returned:
 * `result.movement.onHandAfter` and `result.stock`. The block above the form is
 * explicitly labelled a PREVIEW - an arithmetic estimate of what was asked for,
 * clearly not a promise. An optimistic number here would be a mechanic pulling
 * an oil filter off a shelf because the screen said there were two left, on a
 * number that never existed.
 *
 * IDEMPOTENCY
 * The key is minted ONCE, when the dialog opens, and reused for every retry
 * within that open. Two taps, or a tap and a retry after a dropped response,
 * therefore reach the server as one move and the server returns the ORIGINAL
 * result rather than applying it twice. A fresh key is minted only when the
 * dialog is opened again, which is a genuinely new intent.
 *
 * WHY A REFUSAL DOES NOT CLOSE THE DIALOG
 * The refusal is the most useful thing this dialog will ever show: it is the
 * shelf telling you the truth. Closing would throw that away and reset the form,
 * so the operator would have to type the number again. The dialog stays open,
 * the quantity field takes focus, and the message says how many are actually
 * available - "3 EA available", never "failed".
 * ============================================================================
 */

import * as React from "react";
import { Alert, Button, Field, Input, Modal, ModalContent, NativeSelect } from "@/components/ui";
import { Check, Minus, Plus, TriangleAlert } from "lucide-react";

import { newIdempotencyKey, postMovement, type MovementRefusal } from "@/components/inventory/api";
import {
  checkQty,
  composeReason,
  kindLabel,
  movementLabel,
  qty,
  qtySpoken,
  unitShort,
  QTY_ALLOWED_PATTERN,
  QTY_NOT_A_NUMBER_MESSAGE,
  REASON_EMPTY_MESSAGE,
  REASON_WEAK_MESSAGE,
  reasonIsTooThin,
} from "@/components/inventory/format";
import type { MovementKindValue, PostMovementResult, UnitValue } from "@/lib/inventory-types";
import type { InventoryProductRef } from "@/components/inventory/types";
import { useIdempotentSubmit } from "@/hooks/useIdempotentSubmit";
import { cn } from "@/lib/utils";

// ── Intents ──────────────────────────────────────────────────────────────────

export type MovementIntent = "RECEIVE" | "CONSUME" | "ADJUST" | "SHRINK" | "RETURN" | "RESERVE";

type AdjustDirection = "up" | "down";

interface IntentConfig {
  /** Button and heading wording. */
  label: string;
  description: string;
  /** Whether `onHand` goes up, down, or is untouched (a hold). */
  effect: "in" | "out" | "hold";
  confirmLabel: string;
  causes: ReadonlyArray<{ value: string; label: string }>;
  noteLabel: string;
  noteHint: string;
}

const SHOP_DELIVERY = "Delivery from supplier";
const SHOP_JOB = "Fitted to a customer vehicle";
const SHOP_BOOKING = "Held for a booking";
const SHOP_COUNT = "Found during a stock count";

const INTENT_CONFIG: Record<MovementIntent, IntentConfig> = {
  RECEIVE: {
    label: "Receive",
    description: "Stock arrived. Adds to what is on hand.",
    effect: "in",
    confirmLabel: "Receive stock",
    causes: [
      { value: SHOP_DELIVERY, label: SHOP_DELIVERY },
      { value: "Returned by a customer", label: "Returned by a customer" },
      { value: SHOP_COUNT, label: SHOP_COUNT },
      { value: "Transferred in from another location", label: "Transferred in from another location" },
    ],
    noteLabel: "Delivery detail",
    noteHint: "Supplier invoice number, who delivered it, what was on the box. Optional, but it settles arguments later.",
  },
  CONSUME: {
    label: "Consume",
    description: "Parts went onto a vehicle. Takes stock off the shelf.",
    effect: "out",
    confirmLabel: "Consume stock",
    causes: [
      { value: SHOP_JOB, label: SHOP_JOB },
      { value: "Used in a service", label: "Used in a service" },
      { value: "Installed and sold at the counter", label: "Installed and sold at the counter" },
      { value: "Used to repair a returned item", label: "Used to repair a returned item" },
    ],
    noteLabel: "Job detail",
    noteHint: "Ticket or plate reference if you have one. Optional.",
  },
  ADJUST: {
    label: "Adjust",
    description: "The recorded number is wrong and you are correcting it. Say which way.",
    effect: "out",
    confirmLabel: "Save adjustment",
    causes: [
      { value: "Count correction", label: "Count correction" },
      { value: "Data entry correction", label: "Data entry correction" },
      { value: "Relabelled - the wrong item was entered", label: "Relabelled - the wrong item was entered" },
      { value: "Split a case into singles", label: "Split a case into singles" },
    ],
    noteLabel: "What was wrong",
    noteHint: "Say what the error was, not just that there was one. This is the entry someone reads when the shelf and the screen disagree.",
  },
  SHRINK: {
    label: "Shrink",
    description: "Stock went missing or became unusable. Treated as a loss.",
    effect: "out",
    confirmLabel: "Record the loss",
    causes: [
      { value: "Damaged beyond use", label: "Damaged beyond use" },
      { value: "Expired or perished", label: "Expired or perished" },
      { value: "Lost in the store room", label: "Lost in the store room" },
      { value: "Stolen or unaccounted for", label: "Stolen or unaccounted for" },
    ],
    noteLabel: "What happened",
    noteHint: "Where it was and what was found. An unexplained shrink is not a record, it is a hole.",
  },
  RETURN: {
    label: "Return",
    description: "Stock went back out to a supplier. Takes stock off the shelf.",
    effect: "out",
    confirmLabel: "Return to supplier",
    causes: [
      { value: "Faulty on arrival", label: "Faulty on arrival" },
      { value: "Customer returned it", label: "Customer returned it" },
      { value: "Over-ordered - surplus", label: "Over-ordered - surplus" },
      { value: "Warranty claim", label: "Warranty claim" },
    ],
    noteLabel: "Return detail",
    noteHint: "Credit note or RMA number. Optional, but it is how a return gets its money back.",
  },
  RESERVE: {
    label: "Reserve",
    description: "Hold stock for a job. It stays on the shelf but stops being promiseable.",
    effect: "hold",
    confirmLabel: "Hold stock",
    causes: [
      { value: SHOP_BOOKING, label: SHOP_BOOKING },
      { value: "Held for a walk-in waiting", label: "Held for a walk-in waiting" },
      { value: "Held for a bay already in progress", label: "Held for a bay already in progress" },
    ],
    noteLabel: "Booking reference",
    noteHint: "The booking reference or plate number this is held for. Optional, but a later release needs to know why.",
  },
};

/** The one place an intent becomes a contract `kind`. */
export function resolveMovementKind(intent: MovementIntent, direction: AdjustDirection): MovementKindValue {
  switch (intent) {
    case "RECEIVE":
      return "RECEIVE";
    case "CONSUME":
      return "CONSUME";
    case "ADJUST":
      return direction === "up" ? "ADJUST_UP" : "ADJUST_DOWN";
    case "SHRINK":
      return "SHRINK";
    case "RETURN":
      return "RETURN_TO_SUPPLIER";
    case "RESERVE":
      return "RESERVE";
  }
}

// ── Refusal copy ─────────────────────────────────────────────────────────────

/**
 * A refusal states what the shelf actually holds. `available` is in the message
 * because that number is the whole point: a mechanic told "3 EA available" can
 * act; a mechanic told "failed" can only try again.
 */
export function refusalCopy(
  refusal: MovementRefusal,
  unit: UnitValue,
  name: string,
): { title: string; message: string } {
  const have = qty(refusal.available, unit);
  const wanted = qty(refusal.requested, unit);

  switch (refusal.reason) {
    case "INSUFFICIENT_STOCK":
      return {
        title: `Only ${have} on the shelf`,
        message: `${name} has ${have} on hand and ${wanted} was requested. Nothing was changed. Take ${have} or fewer, or receive more first.`,
      };
    case "INSUFFICIENT_AVAILABLE":
      return {
        title: `Only ${have} free to promise`,
        message: `${name} has ${have} available; the rest are already reserved against bookings. Nothing was changed. Hold ${have} or fewer, or release a booking first.`,
      };
    case "NEGATIVE_QUANTITY":
      return {
        title: "That quantity is not allowed",
        message:
          "A stock movement is always a positive count. Choose the action that reduces stock instead: Consume, Adjust down, Shrink or Return.",
      };
    case "ZERO_QUANTITY":
      return {
        title: "A movement of zero is not a movement",
        message: "Enter how many. Nothing was changed.",
      };
    case "PRODUCT_INACTIVE":
      return {
        title: `${name} is not active`,
        message:
          "Inactive products cannot be moved. Reactivate it on the product page first. Nothing was changed.",
      };
    case "OPENING_ALREADY_SET":
      return {
        title: "An opening balance already exists",
        message: `${name} already has stock recorded, so it cannot be opened a second time. Use Adjust to correct it. Nothing was changed.`,
      };
    default: {
      // Exhaustiveness guard: adding a reason to the contract must break HERE,
      // rather than silently falling into a vague message.
      const exhaustive: never = refusal.reason;
      return { title: "The move was refused", message: String(exhaustive) };
    }
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export interface MovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The product being moved. `stock` is the server's last confirmed figure. */
  product: InventoryProductRef;
  intent: MovementIntent;
  /**
   * Called ONLY after the server has confirmed the move, with its own result.
   * Parents refresh from `result.stock`, never from the quantity that was asked
   * for.
   */
  onCompleted?: (result: PostMovementResult) => void;
}

export function MovementDialog({
  open,
  onOpenChange,
  product,
  intent,
  onCompleted,
}: MovementDialogProps): React.ReactElement {
  const config = INTENT_CONFIG[intent];

  const [direction, setDirection] = React.useState<AdjustDirection>("up");
  const [quantity, setQuantity] = React.useState("");
  const [qtyError, setQtyError] = React.useState<string | null>(null);
  const [cause, setCause] = React.useState("");
  const [note, setNote] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [attempted, setAttempted] = React.useState(false);

  const [idempotencyKey, setIdempotencyKey] = React.useState<string>(() => newIdempotencyKey());
  const [result, setResult] = React.useState<PostMovementResult | null>(null);
  const [refusal, setRefusal] = React.useState<MovementRefusal | null>(null);

  const qtyRef = React.useRef<HTMLInputElement | null>(null);
  const refusalRef = React.useRef<MovementRefusal | null>(null);

  /**
   * Destructured rather than consumed as one object: the hook returns a fresh
   * object literal every render, and putting THAT in an effect's dependency list
   * re-runs the effect forever. `submit` and `reset` are `useCallback`s with no
   * dependencies, so they are safe to depend on.
   */
  const {
    submit: runSubmit,
    isPending,
    error: submitError,
    errorCode: submitErrorCode,
    reset: resetSubmit,
  } = useIdempotentSubmit<PostMovementResult>();

  // One key per OPEN. Reopened, it is a new intent and gets a new key; retried
  // inside the same open, it reuses the key and the server replays the original
  // result instead of applying the move twice.
  React.useEffect(() => {
    if (!open) return;
    setIdempotencyKey(newIdempotencyKey());
    setQuantity("");
    setQtyError(null);
    setCause("");
    setNote("");
    setReference("");
    setAttempted(false);
    setResult(null);
    setRefusal(null);
    setDirection("up");
    resetSubmit();
    // `intent` and `product.id` are here so the form also resets when the caller
    // swaps which product, or which action, the dialog is for.
  }, [open, intent, product.id, resetSubmit]);

  const qtyCheck = React.useMemo(() => checkQty(quantity, product.unit), [quantity, product.unit]);

  const causeOptions = React.useMemo(
    () => [{ value: "", label: "Choose a reason..." }, ...config.causes],
    [config.causes],
  );

  const effectiveDirection: AdjustDirection =
    intent === "ADJUST" ? direction : config.effect === "in" ? "up" : "down";
  const kind = resolveMovementKind(intent, effectiveDirection);

  const causeProblem = cause === "" ? REASON_EMPTY_MESSAGE : reasonIsTooThin(cause) ? REASON_WEAK_MESSAGE : null;

  const canSubmit =
    qtyCheck.ok && qtyCheck.value !== null && causeProblem === null && !isPending && result === null;

  // The PREVIEW. Arithmetic on the last confirmed figure, labelled as an estimate
  // everywhere it appears. It is never written to the ledger and never used as
  // the new value.
  const preview = React.useMemo((): Preview | null => {
    if (!qtyCheck.ok || qtyCheck.value === null) return null;
    const amount = qtyCheck.value;
    const onHand = product.stock.onHand;
    const reserved = product.stock.reserved;

    if (config.effect === "in") {
      return { onHandAfter: onHand + amount, reservedAfter: reserved, availableAfter: onHand + amount - reserved };
    }
    if (config.effect === "hold") {
      const reservedAfter = reserved + amount;
      return { onHandAfter: onHand, reservedAfter, availableAfter: onHand - reservedAfter };
    }
    return { onHandAfter: onHand - amount, reservedAfter: reserved, availableAfter: onHand - amount - reserved };
  }, [config.effect, product.stock.onHand, product.stock.reserved, qtyCheck]);

  const onQuantityChange = (raw: string): void => {
    if (raw !== "" && !QTY_ALLOWED_PATTERN.test(raw)) {
      // Reject AT THE KEYSTROKE. The value never reaches state, so there is no
      // way to submit it.
      setQtyError(
        raw.includes("-")
          ? "A quantity cannot be negative. Stock is only reduced by choosing Consume, Adjust down, Shrink or Return."
          : QTY_NOT_A_NUMBER_MESSAGE,
      );
      return;
    }
    setQtyError(null);
    setQuantity(raw);
  };

  const onUseMaximum = (): void => {
    const maximum = config.effect === "hold" ? Math.max(0, product.stock.available) : product.stock.onHand;
    setQuantity(String(maximum));
    setQtyError(null);
  };

  const maximumLabel =
    config.effect === "hold"
      ? `Hold everything available (${qty(Math.max(0, product.stock.available), product.unit)})`
      : `Use everything on hand (${qty(product.stock.onHand, product.unit)})`;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setAttempted(true);
    if (!canSubmit || qtyCheck.value === null) return;

    setRefusal(null);
    refusalRef.current = null;

    const envelope = await runSubmit(async (signal) => {
      const outcome = await postMovement(
        {
          productId: product.id,
          kind,
          qty: qtyCheck.value ?? 0,
          reason: composeReason(cause, note),
          ...(reference.trim() === "" ? {} : { reference: reference.trim() }),
          idempotencyKey,
        },
        signal,
      );

      if (outcome.kind === "ok") return { ok: true, data: outcome.result };

      if (outcome.kind === "refused") {
        // A ref, not state: the read happens immediately after the await, where
        // TypeScript's narrowing of a `let` captured in a closure would be wrong.
        refusalRef.current = outcome.refusal;
        return { ok: false, error: { code: "CONFLICT" as const, message: outcome.refusal.message } };
      }

      if (outcome.kind === "offline") {
        return {
          ok: false,
          error: {
            code: "SERVICE_UNAVAILABLE" as const,
            message:
              "This device could not reach the inventory service, so nothing was changed. Check your signal and confirm again.",
          },
        };
      }

      return { ok: false, error: { code: "INTERNAL_ERROR" as const, message: outcome.message } };
    });

    // A duplicate tap returns null. Nothing was applied twice and there is
    // nothing to report, so stay silent rather than showing a second success.
    if (envelope === null) return;

    const captured = refusalRef.current;
    refusalRef.current = null;

    if (captured !== null) {
      // The dialog STAYS OPEN. The operator keeps their reason and reference and
      // only has to correct the number.
      setRefusal(captured);
      window.setTimeout(() => qtyRef.current?.focus(), 0);
      return;
    }

    if (envelope.ok) {
      setResult(envelope.data);
      onCompleted?.(envelope.data);
    }
  };

  const confirmed = result?.stock;
  const refusalText = refusal === null ? null : refusalCopy(refusal, product.unit, product.name);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="md"
        title={result ? `${config.label} confirmed` : `${config.label} - ${product.name}`}
        description={result ? undefined : config.description}
      >
        {result !== null && confirmed !== undefined ? (
          <div className="space-y-4">
            <Alert tone="success" title="Saved and written to the ledger">
              <p className="leading-relaxed">
                {movementLabel(kind)} {qtySpoken(Math.abs(result.movement.qty), product.unit)} of {product.name}.
                The ledger now holds {qtySpoken(result.movement.onHandAfter, product.unit)} on hand as of this
                movement.
              </p>
            </Alert>

            <dl className="grid grid-cols-2 gap-3 rounded-card border border-border bg-surface-muted p-4 sm:grid-cols-3">
              <div>
                <dt className="eyg-eyebrow text-muted-foreground">On hand</dt>
                <dd className="tabular text-lg font-bold">{qty(confirmed.onHand, product.unit)}</dd>
              </div>
              <div>
                <dt className="eyg-eyebrow text-muted-foreground">Reserved</dt>
                <dd className="tabular text-lg font-bold">{qty(confirmed.reserved, product.unit)}</dd>
              </div>
              <div>
                <dt className="eyg-eyebrow text-muted-foreground">Available</dt>
                <dd className="tabular text-lg font-bold">{qty(confirmed.available, product.unit)}</dd>
              </div>
            </dl>

            <p className="text-sm text-muted-foreground">
              These figures came back from the server after it wrote the movement. Nothing on this screen was
              calculated locally.
            </p>

            <Button type="button" variant="primary" size="lg" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {refusalText !== null ? (
              <Alert tone="danger" title={refusalText.title} icon={<TriangleAlert className="size-5" />}>
                <p className="leading-relaxed">{refusalText.message}</p>
              </Alert>
            ) : null}

            {submitError !== null && refusal === null ? (
              <Alert
                tone="danger"
                title={submitErrorCode === "CONFLICT" ? "Refused by the server" : "That did not save"}
                icon={<TriangleAlert className="size-5" />}
              >
                <p className="leading-relaxed">{submitError}</p>
              </Alert>
            ) : null}

            {intent === "ADJUST" ? (
              <Field
                id="movement-direction"
                label="Which way"
                required
                helper="Adjusting up adds stock you found. Adjusting down removes stock that was never there. Pick deliberately."
              >
                {(wiring) => (
                  <NativeSelect
                    {...wiring}
                    size="md"
                    value={direction}
                    options={[
                      { value: "up", label: "Up - the shelf has more than the system says" },
                      { value: "down", label: "Down - the shelf has less than the system says" },
                    ]}
                    onChange={(event) => setDirection(event.target.value === "down" ? "down" : "up")}
                  />
                )}
              </Field>
            ) : null}

            <Field
              id="movement-quantity"
              label={`How many (${unitShort(product.unit)})`}
              required
              helper={
                product.unit === "LITRE" || product.unit === "KG"
                  ? "Decimals are allowed for this unit: 1.4 is one point four, not fourteen."
                  : `Whole items only. A set of five tyres is 5 ${unitShort(product.unit)}.`
              }
              error={qtyError ?? (attempted && !qtyCheck.ok ? qtyCheck.message : null) ?? undefined}
            >
              {(wiring) => (
                <Input
                  {...wiring}
                  ref={qtyRef}
                  name="qty"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={quantity}
                  size="lg"
                  className="tabular text-2xl font-bold"
                  onChange={(event) => onQuantityChange(event.target.value)}
                />
              )}
            </Field>

            {product.stock.onHand > 0 || config.effect === "hold" ? (
              <Button type="button" variant="ghost" size="sm" onClick={onUseMaximum}>
                {config.effect === "hold" ? (
                  <Minus aria-hidden="true" className="size-4" />
                ) : (
                  <Plus aria-hidden="true" className="size-4" />
                )}
                {maximumLabel}
              </Button>
            ) : null}

            <Field
              id="movement-cause"
              label="Reason"
              required
              helper="Written to the ledger, and the only answer to the question of why this number is different."
              {...(attempted && causeProblem !== null ? { error: causeProblem } : {})}
            >
              {(wiring) => (
                <NativeSelect
                  {...wiring}
                  size="md"
                  value={cause}
                  options={causeOptions}
                  onChange={(event) => setCause(event.target.value)}
                />
              )}
            </Field>

            <Field id="movement-note" label={config.noteLabel} helper={config.noteHint}>
              {(wiring) => (
                <Input
                  {...wiring}
                  name="note"
                  type="text"
                  autoComplete="off"
                  placeholder="Optional detail that makes this entry readable in six weeks"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              )}
            </Field>

            <Field
              id="movement-reference"
              label="Reference"
              helper="Invoice, PO or ticket number. Optional, but it is what makes the entry reconcilable."
            >
              {(wiring) => (
                <Input
                  {...wiring}
                  name="reference"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. SI-2411-093"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              )}
            </Field>

            {/* THE PREVIEW. Labelled an estimate, every time it appears. */}
            <div className="rounded-card border border-border bg-surface-muted p-4">
              <p className="eyg-eyebrow text-muted-foreground">Preview - an estimate, not a promise</p>
              {preview !== null ? (
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">On hand now</dt>
                    <dd className="tabular">{qty(product.stock.onHand, product.unit)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-bold">On hand after (estimate)</dt>
                    <dd
                      className={cn(
                        "tabular font-bold",
                        preview.onHandAfter < 0 ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {qty(preview.onHandAfter, product.unit)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">Reserved now</dt>
                    <dd className="tabular">{qty(product.stock.reserved, product.unit)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-bold">Reserved after (estimate)</dt>
                    <dd className="tabular font-bold">{qty(preview.reservedAfter, product.unit)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5">
                    <dt className="font-bold">Available after (estimate)</dt>
                    <dd
                      className={cn(
                        "tabular font-bold",
                        preview.availableAfter < 0 ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {qty(preview.availableAfter, product.unit)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter a quantity to see the estimate. The ledger only changes when the server says so.
                </p>
              )}
              {preview !== null && preview.availableAfter < 0 ? (
                <p className="mt-2 flex items-start gap-1.5 text-sm font-bold text-destructive">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    This estimate would leave available below zero. The server will refuse it: pick a smaller
                    quantity, or release a booking first.
                  </span>
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Saved as <span className="font-mono">{movementLabel(kind)}</span>. Nothing is written until the
                server confirms it.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="md" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" size="lg" loading={isPending} disabled={!canSubmit}>
                  {isPending ? "Saving..." : config.confirmLabel}
                </Button>
              </div>
            </div>

            {attempted && !canSubmit && !isPending ? (
              <p role="alert" className="flex items-start gap-1.5 text-sm font-semibold text-destructive">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  {!qtyCheck.ok
                    ? qtyCheck.message
                    : causeProblem ?? "Fill in the quantity and the reason before saving."}
                </span>
              </p>
            ) : null}
          </form>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Ledger entry <span className="font-mono">{kind}</span> for a{" "}
          <span className="font-mono">{product.kind}</span> product ({kindLabel(product.kind)}). One endpoint,
          one movement, one reason.
        </p>

        {result !== null ? (
          <p role="status" aria-live="polite" className="sr-only">
            {config.label} confirmed. On hand is now {qtySpoken(result.stock.onHand, product.unit)}, available{" "}
            {qtySpoken(result.stock.available, product.unit)}.
          </p>
        ) : null}

        {result !== null && confirmed !== undefined ? (
          confirmed.isOversold ? (
            <Alert tone="danger" title="This product is now oversold" className="mt-4">
              <p className="leading-relaxed">
                Reserved now exceeds on hand. The ledger says {qty(confirmed.reserved, product.unit)} promised
                against {qty(confirmed.onHand, product.unit)} on the shelf. Resolve it before selling anything
                else.
              </p>
            </Alert>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm font-bold text-success">
              <Check aria-hidden="true" className="size-4" />
              Confirmed by the server
            </p>
          )
        ) : null}
      </ModalContent>
    </Modal>
  );
}

interface Preview {
  onHandAfter: number;
  reservedAfter: number;
  availableAfter: number;
}