"use client";

/**
 * BOOKING PARTS PANEL — STAFF ONLY
 * ============================================================================
 * The one screen that answers "are the parts for this job actually on the
 * shelf, and are they already promised to somebody else?" while somebody is
 * standing at the counter.
 *
 * ── THE HARD RULE ON THIS SCREEN ────────────────────────────────────────────
 * This is an internal surface. It never renders cost, margin, supplier name or
 * any other commercial detail — not because the markup hides them, but because
 * the snapshot it renders does not contain them. `BookingPartsSnapshot`
 * (server, in `@/lib/server/inventory/booking-hooks`) selects none of those
 * columns, so mounting this component on the wrong page still cannot leak a
 * peso. A customer must never see this panel; `data-staff-only` marks it so a
 * future page can assert on it.
 *
 * Staff see cost and margin on the product screens, which is where margin is
 * actually decided. This panel is about whether the car can be finished.
 *
 * ── WHY IT IS A CLIENT COMPONENT ─────────────────────────────────────────────
 * "Reserve now" and "Release" are writes with a mandatory reason, so the panel
 * owns a small amount of pending/error state. It stays presentational: the data
 * and the mutation callbacks both arrive as props from a Server Component, so
 * this file never fetches, never touches Prisma and never renders a token.
 *
 * ── FOUR STATES ─────────────────────────────────────────────────────────────
 * Loading skeleton, success, empty (no bill of materials) and error are all real
 * states with real copy. The empty state is a sentence, not whitespace: most
 * services in this shop have no parts list at all, and that is normal.
 *
 * ── KEYBOARD ────────────────────────────────────────────────────────────────
 * Everything is native — buttons, a text input, a datalist. Tab order is DOM
 * order, Enter submits, there is no custom key handling to get wrong.
 */
import * as React from "react";
import { CheckCircle2, Lock, PackageOpen, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProductKindValue, UnitValue } from "@/lib/inventory-types";
import type {
  BookingPartsSnapshot,
  BookingPartRow,
  BookingShortfallRow,
  ConsumedPartRow,
} from "@/lib/server/inventory/booking-hooks";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

// ── Props ────────────────────────────────────────────────────────────────────

export type BookingPartsPanelState =
  | { kind: "loading" }
  | { kind: "error"; message: string; retryable: boolean }
  | { kind: "ready"; snapshot: BookingPartsSnapshot };

export interface BookingPartsPanelProps {
  bookingId: string;
  state: BookingPartsPanelState;
  /**
   * "Reserve now". Receives the staff's reason and must resolve with whatever
   * the caller re-fetches. Omit for a read-only panel.
   */
  onReserve?: (reason: string) => Promise<unknown>;
  /** "Release". Same contract. The reason is mandatory and is validated here. */
  onRelease?: (reason: string) => Promise<unknown>;
  onRetry?: () => void;
  className?: string;
}

// ── Formatting (local; nothing here reads cost) ──────────────────────────────

const UNIT_SHORT: Readonly<Record<UnitValue, string>> = {
  EA: "ea",
  PAIR: "pair",
  SET: "set",
  LITRE: "L",
  KG: "kg",
  M: "m",
};

const KIND_LABEL: Readonly<Record<ProductKindValue, string>> = {
  TYRE: "Tyre",
  OIL: "Oil / fluid",
  FILTER: "Filter",
  BRAKE: "Brake",
  SUSPENSION: "Suspension",
  BATTERY: "Battery",
  WIPER: "Wiper",
  ELECTRICAL: "Electrical",
  CONSUMABLE: "Consumable",
  TYRE_ACCESSORY: "Accessory",
  TOOL: "Tool",
  OTHER: "Other",
};

const countFormatter = new Intl.NumberFormat("en-PH");

function unitLabel(unit: UnitValue, value: number): string {
  return `${countFormatter.format(value)} ${UNIT_SHORT[unit]}`;
}

function partSubtitle(row: { kind: ProductKindValue; size: string | null }): string {
  const kind = KIND_LABEL[row.kind];
  return row.size === null ? kind : `${row.size} · ${kind}`;
}

/**
 * Shop-local time. A hold that reads "expires 23:15" to somebody reading in
 * another timezone is worse than no expiry at all.
 */
function formatInstant(iso: string | null): string {
  if (iso === null) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function hoursUntil(iso: string, nowMs: number): string {
  const ms = new Date(iso).getTime() - nowMs;
  if (Number.isNaN(ms)) return "";
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}

/** Reasons the front desk actually types. A reason is mandatory on every write. */
const RELEASE_REASONS = [
  "Booking cancelled by the customer",
  "Customer rescheduled",
  "No-show",
  "Parts substituted — different product fitted",
  "Order came in late — released pending the new date",
  "Wrong part held",
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export function BookingPartsPanel({
  bookingId,
  state,
  onReserve,
  onRelease,
  onRetry,
  className,
}: BookingPartsPanelProps): React.ReactElement {
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"reserve" | "release" | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [liveMessage, setLiveMessage] = React.useState<string | null>(null);
  const reasonRef = React.useRef<HTMLInputElement | null>(null);

  const run = React.useCallback(
    async (action: "reserve" | "release", handler: (reason: string) => Promise<unknown>) => {
      const trimmed = reason.trim();
      if (trimmed.length === 0) {
        // "Because" is not a reason, and neither is an empty box. The ledger is
        // only as good as the sentence written next to the number.
        setReasonError("Write what happened — this is stored against the stock movement.");
        reasonRef.current?.focus();
        return;
      }
      if (trimmed.length < 4) {
        setReasonError("A few more words, please. One word is not a reason anyone can act on.");
        reasonRef.current?.focus();
        return;
      }
      setReasonError(null);
      setActionError(null);
      setBusy(action);
      try {
        await handler(trimmed);
        setReason("");
        setLiveMessage(action === "reserve" ? "Parts reserved." : "Holds released back to available stock.");
      } catch (err: unknown) {
        setActionError(
          err instanceof Error && err.message.length > 0
            ? err.message
            : "That did not go through. Nothing was changed — try again.",
        );
      } finally {
        setBusy(null);
      }
    },
    [reason],
  );

  const headingId = React.useId();
  const reasonId = React.useId();
  const reasonErrorId = React.useId();
  const releaseReasonsId = React.useId();

  const canReserve = state.kind === "ready" && state.snapshot.canReserve;
  const canRelease = state.kind === "ready" && state.snapshot.canRelease;

  /**
   * The primary action — what a plain Enter in the reason box does. Release only
   * wins the keyboard when there is nothing to reserve, so the keyboard can
   * never do something the operator did not mean.
   */
  const primaryAction = React.useCallback(() => {
    if (busy !== null) return;
    if (onReserve !== undefined && canReserve) {
      void run("reserve", onReserve);
      return;
    }
    if (onRelease !== undefined && canRelease) {
      void run("release", onRelease);
    }
  }, [busy, canRelease, canReserve, onRelease, onReserve, run]);

  return (
    <Card
      className={cn("overflow-hidden", className)}
      role="region"
      aria-labelledby={headingId}
      data-staff-only="true"
      data-inventory-surface="booking-parts"
      data-booking-id={bookingId}
    >
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle as="h3" id={headingId} className="flex items-center gap-2">
              <PackageOpen aria-hidden="true" className="size-5 text-brand-500" />
              Parts for this job
            </CardTitle>
            <p role="note" className="flex items-start gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              Internal — staff only. Never show this screen to a customer.
            </p>
          </div>
          {state.kind === "ready" ? <BookingStateBadge status={state.snapshot.bookingStatus} /> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/*
          Every number here is a promise made against `available = onHand - reserved`.
          No cost, no margin, no supplier. The panel cannot show what it was never
          given.
        */}
        {state.kind === "loading" ? <PanelSkeleton /> : null}
        {state.kind === "error" ? (
          <ErrorState
            title="The parts for this job did not load"
            description={state.message}
            {...(state.retryable && onRetry !== undefined ? { onRetry } : {})}
          />
        ) : null}
        {state.kind === "ready" ? (
          <ReadyState snapshot={state.snapshot} />
        ) : null}

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        {state.kind === "ready" && (onReserve !== undefined || onRelease !== undefined) ? (
          <div className="space-y-4 rounded-card border-2 border-border-strong bg-surface-muted p-4">
            <div className="space-y-2">
              <label htmlFor={reasonId} className="block text-sm font-bold text-foreground">
                Reason for the change <span className="font-normal text-muted-foreground">(required)</span>
              </label>
              <input
                id={reasonId}
                ref={reasonRef}
                list={releaseReasonsId}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  primaryAction();
                }}
                disabled={busy !== null}
                aria-invalid={reasonError !== null}
                aria-describedby={reasonError !== null ? reasonErrorId : undefined}
                placeholder="Supplier delivered 2 oil filters"
                autoComplete="off"
                className="min-h-11 w-full rounded-eyebrow border border-border bg-surface px-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
              <datalist id={releaseReasonsId}>
                {RELEASE_REASONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <p id={reasonErrorId} role={reasonError !== null ? "alert" : undefined} className="text-xs font-bold text-destructive">
                {reasonError ?? "Written against every stock movement, so “why is the number wrong” always has an answer."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {onReserve !== undefined ? (
                <Button
                  type="button"
                  variant="accent"
                  size="md"
                  loading={busy === "reserve"}
                  disabled={busy !== null || !canReserve}
                  onClick={() => void run("reserve", onReserve)}
                >
                  Reserve now
                </Button>
              ) : null}
              {onRelease !== undefined ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  loading={busy === "release"}
                  disabled={busy !== null || !canRelease}
                  onClick={() => void run("release", onRelease)}
                >
                  <Undo2 aria-hidden="true" className="size-4" />
                  Release
                </Button>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {canReserve
                  ? "Reserve holds the parts off the shelf for this job only."
                  : canRelease
                    ? "There is nothing left to reserve on this job — Release returns the holds to the shelf."
                    : "This job has no parts to hold or release."}
              </p>
            </div>

            {actionError !== null ? <ErrorState size="sm" title="Nothing was changed" description={actionError} /> : null}
            <p role="status" aria-live="polite" className="text-xs font-bold text-pit-600 dark:text-pit-400">
              {liveMessage ?? ""}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── Ready state ──────────────────────────────────────────────────────────────

function ReadyState({ snapshot }: { snapshot: BookingPartsSnapshot }): React.ReactElement {
  const nowMs = React.useMemo(() => new Date(snapshot.generatedAt).getTime(), [snapshot.generatedAt]);

  return (
    <div className="space-y-6">
      {snapshot.warnings.map((warning) => (
        <Alert key={warning} tone="warning" size="sm">
          {warning}
        </Alert>
      ))}

      {snapshot.shortfalls.length > 0 ? <ShortfallList rows={snapshot.shortfalls} /> : null}

      {snapshot.held.length > 0 ? <HeldTable rows={snapshot.held} nowMs={nowMs} /> : null}

      {snapshot.consumed.length > 0 ? <ConsumedTable rows={snapshot.consumed} /> : null}

      {snapshot.released.length > 0 ? (
        <section className="space-y-2">
          <h4 className="eyg-eyebrow text-muted-foreground">Released back to the shelf</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {snapshot.released.map((row) => (
              <li key={row.reservationId} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-bold text-foreground">{row.sku}</span>
                <span>{row.name}</span>
                <span className="tabular">{unitLabel(row.unit, row.qty)}</span>
                <span>
                  {row.status === "EXPIRED" ? "hold expired" : "released"} ·{" "}
                  {formatInstant(row.releasedAt)}
                  {row.releasedReason !== null ? ` · ${row.releasedReason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!snapshot.hasBom && snapshot.held.length === 0 && snapshot.consumed.length === 0 ? (
        <EmptyState
          size="sm"
          title="No parts list on this job"
          description="None of the services on this booking has stock items attached, so there is nothing to hold or consume. That is normal — the bay just draws parts off the shelf as usual."
        />
      ) : null}

      {snapshot.hasBom && snapshot.held.length === 0 && snapshot.consumed.length === 0 && snapshot.shortfalls.length === 0 ? (
        <Alert tone="info" size="sm">
          Every part this job needs is on the shelf and free. Use “Reserve now” so nobody else takes them.
        </Alert>
      ) : null}
    </div>
  );
}

// ── Shortfalls ───────────────────────────────────────────────────────────────

function ShortfallList({ rows }: { rows: readonly BookingShortfallRow[] }): React.ReactElement {
  // `useId`, not a literal: two panels on one admin page would otherwise ship
  // the same `aria-labelledby` target and break both.
  const headingId = React.useId();
  const blockers = rows.filter((r) => r.blocksBooking);
  const soft = rows.filter((r) => !r.blocksBooking);

  return (
    <section className="space-y-3" aria-labelledby={headingId}>
      <h4 id={headingId} className="eyg-eyebrow text-muted-foreground">
        Short
      </h4>

      {blockers.length > 0 ? (
        <Alert tone="danger" title="This job cannot be promised yet">
          <ul className="mt-1 space-y-1">
            {blockers.map((row) => (
              <ShortfallItem key={row.productId} row={row} />
            ))}
          </ul>
        </Alert>
      ) : null}

      {soft.length > 0 ? (
        <Alert tone="warning" title="Short, but the job still goes ahead">
          <ul className="mt-1 space-y-1">
            {soft.map((row) => (
              <ShortfallItem key={row.productId} row={row} />
            ))}
          </ul>
        </Alert>
      ) : null}
    </section>
  );
}

function ShortfallItem({ row }: { row: BookingShortfallRow }): React.ReactElement {
  return (
    <li className="space-y-0.5">
      <p className="tabular text-sm font-bold text-foreground">
        {row.name}
        {row.size !== null ? <span className="font-normal"> · {row.size}</span> : null} — short {unitLabel(row.unit, row.shortBy)}
      </p>
      <p className="tabular text-xs opacity-90">
        Need {unitLabel(row.unit, row.qtyNeeded)} · {row.qtyHeld > 0 ? `${unitLabel(row.unit, row.qtyHeld)} held · ` : ""}
        {unitLabel(row.unit, row.available)} free on the shelf · SKU {row.sku}
      </p>
      <p className="text-xs font-bold">{row.actionLabel}</p>
      <p className="text-xs opacity-80">{row.detail}</p>
      {row.usedBy.length > 0 ? (
        <p className="text-xs opacity-70">Needed for: {row.usedBy.join(", ")}</p>
      ) : null}
    </li>
  );
}

// ── Tables ───────────────────────────────────────────────────────────────────

const TH = "px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground";
const TD = "px-3 py-2.5 text-sm align-top";

function HeldTable({ rows, nowMs }: { rows: readonly BookingPartRow[]; nowMs: number }): React.ReactElement {
  const headingId = React.useId();
  return (
    <section className="space-y-2" aria-labelledby={headingId}>
      <h4 id={headingId} className="eyg-eyebrow text-muted-foreground">
        Held for this job
      </h4>
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <caption className="sr-only">
            Parts currently held for this booking, with the quantity, the unit, whether the part blocks the job, and how long the
            hold lasts.
          </caption>
          <thead className="border-b border-border bg-surface-muted">
            <tr>
              <th scope="col" className={TH}>Part</th>
              <th scope="col" className={cn(TH, "text-right")}>Held</th>
              <th scope="col" className={cn(TH, "text-right")}>Free on shelf</th>
              <th scope="col" className={TH}>Needed for</th>
              <th scope="col" className={TH}>Hold ends</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.reservationId} className="border-b border-border last:border-b-0">
                <td className={TD}>
                  <span className="block font-bold text-foreground">{row.name}</span>
                  <span className="tabular block text-xs text-muted-foreground">
                    {row.sku} · {partSubtitle(row)}
                  </span>
                </td>
                <td className={cn(TD, "tabular text-right font-bold")}>
                  {unitLabel(row.unit, row.qty)}
                  <span className="mt-1 block">
                    {row.isBlocking ? (
                      <Badge tone="danger" size="sm">Blocking</Badge>
                    ) : (
                      <Badge tone="neutral" size="sm">Not blocking</Badge>
                    )}
                  </span>
                </td>
                <td className={cn(TD, "tabular text-right")}>
                  {unitLabel(row.unit, row.available)}
                  <span className="tabular block text-xs text-muted-foreground">
                    {unitLabel(row.unit, row.onHand)} in · {unitLabel(row.unit, row.reserved)} promised
                  </span>
                </td>
                <td className={cn(TD, "text-xs text-muted-foreground")}>
                  {row.usedBy.length > 0 ? row.usedBy.join(", ") : "—"}
                </td>
                <td className={cn(TD, "tabular text-xs")}>
                  {formatInstant(row.expiresAt)}
                  {row.expiresAt !== null ? (
                    <span className="block text-muted-foreground">{hoursUntil(row.expiresAt, nowMs)}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConsumedTable({ rows }: { rows: readonly ConsumedPartRow[] }): React.ReactElement {
  const headingId = React.useId();
  return (
    <section className="space-y-2" aria-labelledby={headingId}>
      <h4 id={headingId} className="eyg-eyebrow text-muted-foreground">
        Used on this job
      </h4>
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[30rem] border-collapse text-left">
          <caption className="sr-only">
            Parts consumed against this booking, with the quantity taken off the shelf and the stock level immediately after each
            ledger entry.
          </caption>
          <thead className="border-b border-border bg-surface-muted">
            <tr>
              <th scope="col" className={TH}>Part</th>
              <th scope="col" className={cn(TH, "text-right")}>Consumed</th>
              <th scope="col" className={cn(TH, "text-right")}>Stock after</th>
              <th scope="col" className={TH}>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.productId} className="border-b border-border last:border-b-0">
                <td className={TD}>
                  <span className="block font-bold text-foreground">{row.name}</span>
                  <span className="tabular block text-xs text-muted-foreground">{row.sku}</span>
                </td>
                <td className={cn(TD, "tabular text-right font-bold")}>
                  {unitLabel(row.unit, row.qty)}
                  <span className="mt-1 block">
                    <Badge tone="success" size="sm">
                      <CheckCircle2 aria-hidden="true" className="size-3" />
                      Off the shelf
                    </Badge>
                  </span>
                </td>
                <td className={cn(TD, "tabular text-right")}>
                  {row.onHandAfter === null ? "—" : unitLabel(row.unit, row.onHandAfter)}
                </td>
                <td className={cn(TD, "tabular text-xs text-muted-foreground")}>
                  {formatInstant(row.consumedAt)}
                  {row.actorName !== null ? <span className="block">by {row.actorName}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Loading ──────────────────────────────────────────────────────────────────

function PanelSkeleton(): React.ReactElement {
  return (
    <div className="space-y-4" role="presentation">
      <Skeleton shape="text" className="w-1/3" />
      <Skeleton shape="block" className="h-40" />
      <SkeletonText lines={2} />
      <span className="sr-only">Loading the parts held for this job.</span>
    </div>
  );
}

// ── Booking status chip ──────────────────────────────────────────────────────

const STATUS_TONE: Readonly<Record<string, "neutral" | "success" | "info" | "danger">> = {
  PENDING: "neutral",
  CONFIRMED: "info",
  CHECKED_IN: "info",
  IN_PROGRESS: "info",
  READY: "success",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "danger",
  RESCHEDULED: "neutral",
};

function BookingStateBadge({ status }: { status: string | null }): React.ReactElement {
  if (status === null) return <Badge tone="neutral" size="sm">Unknown state</Badge>;
  const tone = STATUS_TONE[status] ?? "neutral";
  const label = status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
  return (
    <Badge tone={tone} size="sm" dot>
      {label}
    </Badge>
  );
}