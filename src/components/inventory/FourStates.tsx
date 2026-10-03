/**
 * INVENTORY — THE FOUR STATES, IN ONE PLACE
 * ============================================================================
 * Every async surface in this UI ships four states: loading skeleton, success,
 * empty, error. Collecting them here means a new screen cannot accidentally ship
 * three, and an operator never sees a blank rectangle and has to guess whether
 * the shelf is empty or the request died.
 *
 * No hooks — this file is imported by Server and Client Components alike.
 * ============================================================================
 */

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { PackageOpen, TriangleAlert } from "lucide-react";

/**
 * The loading state. Reserves the same box the real content occupies so nothing
 * jumps when data lands — the `animate-pulse` is neutralised automatically by
 * the global `prefers-reduced-motion` rule in `globals.css`.
 */
export function InventoryPanelSkeleton({
  rows = 6,
  label = "Loading",
  columns = 5,
}: {
  rows?: number;
  label: string;
  columns?: number;
}): ReactElement {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <p className="sr-only">{label}…</p>
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex items-center gap-3 rounded-card border border-border bg-surface p-3"
          >
            {Array.from({ length: columns }, (_, col) => (
              <Skeleton
                key={col}
                shape="text"
                className={col === 0 ? "h-5 w-24" : "h-4 flex-1"}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generic failure card. Always offers a retry, because a read is always retryable. */
export function InventoryPanelError({
  title,
  description,
  onRetry,
  action,
}: {
  title: string;
  description: ReactNode;
  onRetry?: () => void;
  action?: ReactNode;
}): ReactElement {
  return (
    <ErrorState
      title={title}
      description={description}
      {...(onRetry ? { onRetry } : {})}
      {...(action ? { action } : {})}
    />
  );
}

/** The device is offline. Distinguished from a server failure because the fix differs. */
export function InventoryOffline({ onRetry }: { onRetry?: () => void }): ReactElement {
  return (
    <ErrorState
      tone="warning"
      title="You appear to be offline"
      description="The stock list did not load because this device has no connection. Nothing was changed. Reconnect and try again — the shelf is still where you left it."
      {...(onRetry ? { onRetry, retryLabel: "Try again" } : {})}
    />
  );
}

/**
 * A real empty state. Callers must supply a title and a description — an empty
 * region is never left as whitespace, and never as a bare "0 results".
 */
export function InventoryPanelEmpty({
  title,
  description,
  icon,
  action,
  secondaryAction,
}: {
  title: ReactNode;
  description: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}): ReactElement {
  return (
    <EmptyState
      icon={icon ?? <PackageOpen className="size-8" />}
      title={title}
      description={description}
      {...(action ? { action } : {})}
      {...(secondaryAction ? { secondaryAction } : {})}
    />
  );
}

/** A polite live region for result counts and save confirmations. */
export function InventoryStatusLine({
  children,
  assertive = false,
  className,
}: {
  children: ReactNode;
  /** `true` interrupts; leave false for counts and confirmations. */
  assertive?: boolean;
  className?: string;
}): ReactElement {
  return (
    <p
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      className={className ?? "text-sm text-muted-foreground"}
    >
      {children}
    </p>
  );
}

/**
 * The honesty note.
 *
 * This screen shows real ledger figures, and real ledger figures are only as
 * accurate as the last person who counted. Saying so on the screen is the
 * difference between a stock system the owner trusts and one they quietly stop
 * believing in. It is not a disclaimer — it is a statement of what the numbers
 * are worth today.
 */
export function CatalogueConfidenceNote({
  showCountLink = true,
  countLabel = "Run a stock count",
}: {
  showCountLink?: boolean;
  countLabel?: string;
}): ReactElement {
  return (
    <Alert tone="info" size="sm" title="What these numbers are worth">
      <p className="leading-relaxed">
        On-hand and available come straight from the stock ledger — every entry is a movement with a reason
        and a name against it. They are only as accurate as the last count and the last delivery, so check a
        figure before you promise it to a customer.
      </p>
      {showCountLink ? (
        <p className="mt-2">
          <Link
            href="/inventory/counts"
            className="font-bold text-foreground underline decoration-2 underline-offset-4 hover:decoration-brand-500"
          >
            {countLabel}
          </Link>{" "}
          <span className="text-muted-foreground">when the shelf and the screen disagree.</span>
        </p>
      ) : null}
    </Alert>
  );
}

/** Banner for a server that has no data seeded yet — never fake rows. */
export function NoCatalogueYet({ detail }: { detail: ReactNode }): ReactElement {
  return (
    <Alert tone="warning" title="The catalogue is empty" icon={<TriangleAlert className="size-5" />}>
      <div className="space-y-2 leading-relaxed">
        <p>{detail}</p>
        <p>
          Nothing is being guessed here. This screen will not invent a product list to fill the space —
          an empty catalogue has to be loaded with real items, by someone who knows the shop.
        </p>
      </div>
    </Alert>
  );
}