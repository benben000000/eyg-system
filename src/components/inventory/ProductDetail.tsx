"use client";

/**
 * INVENTORY - PRODUCT DETAIL
 * ============================================================================
 * A3 owns this file. The screen an operator opens when a customer is asking
 * "do you have one in 205/55R16?".
 *
 * It answers, in this order, because that is the order the questions arrive:
 *   1. Is it here?          -> the stock block, first, with a plain sentence
 *   2. Is it worth selling? -> money, because a thin tyre margin is survival
 *   3. Is it too old?       -> the tyre block, with a DOT age range
 *   4. Why does it say 4?   -> the full ledger, every entry, uneditable
 *
 * NO OPTIMISTIC UI
 * The five action buttons all open one dialog, and each of those only changes
 * this screen after the server confirms. On a completed movement the product is
 * re-read from the server; nothing is patched locally from the number typed.
 * ============================================================================
 */

import * as React from "react";
import Link from "next/link";
import { Alert, Breadcrumbs, Button, Skeleton, useToast } from "@/components/ui";
import { ArrowLeft, ClipboardList, TriangleAlert } from "lucide-react";

import { fetchProduct, patchProduct } from "@/components/inventory/api";
import { qty, qtySpoken } from "@/components/inventory/format";
import { InventoryOffline, InventoryPanelError, InventoryStatusLine } from "@/components/inventory/FourStates";
import { MovementDialog, type MovementIntent } from "@/components/inventory/MovementDialog";
import { MovementLedger } from "@/components/inventory/MovementLedger";
import {
  MoneyBlock,
  ProductHeaderBlock,
  ShelfLifeBlock,
  StockBlock,
  TyreBlock,
} from "@/components/inventory/ProductFacts";
import { ReorderLevelDialog } from "@/components/inventory/ReorderLevelDialog";
import { toProductRef } from "@/components/inventory/types";
import type { ProductDto } from "@/lib/inventory-types";
import { useIdempotentSubmit } from "@/hooks/useIdempotentSubmit";

type DetailState =
  | { kind: "loading" }
  | { kind: "ready"; product: ProductDto }
  | { kind: "failed"; title: string; message: string; notFound: boolean }
  | { kind: "offline" };

export interface ProductDetailProps {
  productId: string;
}

export function ProductDetail({ productId }: ProductDetailProps): React.ReactElement {
  const toast = useToast();

  const [state, setState] = React.useState<DetailState>({ kind: "loading" });
  const [reloadToken, setReloadToken] = React.useState(0);
  const [intent, setIntent] = React.useState<MovementIntent | null>(null);
  const [reorderOpen, setReorderOpen] = React.useState(false);

  const { submit: runPatch, isPending: patchPending, error: patchError } =
    useIdempotentSubmit<ProductDto>();

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((previous) => (previous.kind === "ready" ? previous : { kind: "loading" }));

    void fetchProduct(productId, controller.signal)
      .then((outcome) => {
        if (cancelled) return;
        if (outcome.kind === "ok") {
          setState({ kind: "ready", product: outcome.data });
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
          title: "This product did not load",
          message: "That request ended before it finished. Nothing was changed.",
          notFound: false,
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [productId, reloadToken]);

  const retry = React.useCallback((): void => setReloadToken((token) => token + 1), []);

  const onToggleActive = async (): Promise<void> => {
    if (state.kind !== "ready") return;
    const next = !state.product.isActive;

    const envelope = await runPatch(async (signal) => {
      const outcome = await patchProduct(productId, { isActive: next }, signal);
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

    // A duplicate tap returns null: nothing was applied twice, so say nothing.
    if (envelope === null) return;

    if (envelope.ok) {
      setState({ kind: "ready", product: envelope.data });
      toast.success(
        envelope.data.isActive ? "Product reactivated" : "Product deactivated",
        `${envelope.data.name} is now ${envelope.data.isActive ? "active" : "inactive"}.`,
      );
      return;
    }

    toast.error("That change did not save", envelope.error.message);
  };

  if (state.kind === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton shape="title" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton shape="card" className="h-72" />
          <Skeleton shape="card" className="h-72" />
        </div>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          Loading the product...
        </p>
      </div>
    );
  }

  if (state.kind === "offline") {
    return <InventoryOffline onRetry={retry} />;
  }

  if (state.kind === "failed") {
    return (
      <div className="space-y-4">
        <BackToStock />
        <InventoryPanelError
          title={state.title}
          description={state.message}
          {...(state.notFound ? {} : { onRetry: retry })}
          {...(state.notFound
            ? {
                action: (
                  <Link
                    href="/inventory"
                    className="text-sm font-bold text-foreground underline decoration-2 underline-offset-4"
                  >
                    Open the stock list
                  </Link>
                ),
              }
            : {})}
        />
      </div>
    );
  }

  const product = state.product;
  const productRef = toProductRef(product);
  const inactive = !product.isActive;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        jsonLd={false}
        aria-label="Inventory breadcrumb"
        items={[{ name: "Stock", href: "/inventory" }, { name: product.name }]}
      />

      <ProductHeaderBlock
        product={product}
        activeToggle={
          <div className="flex flex-col items-stretch gap-2">
            <Button
              type="button"
              role="switch"
              aria-checked={product.isActive}
              variant={product.isActive ? "outline" : "danger"}
              size="md"
              loading={patchPending}
              disabled={patchPending}
              onClick={() => void onToggleActive()}
            >
              {product.isActive ? "Active - tap to deactivate" : "Inactive - tap to activate"}
            </Button>
            <p className="max-w-56 text-xs text-muted-foreground">
              Deactivating stops stock being moved in or out. The ledger stays exactly as it is.
            </p>
            {patchError !== null ? (
              <p role="alert" className="text-xs font-semibold text-destructive">
                {patchError}
              </p>
            ) : null}
          </div>
        }
      />

      {inactive ? (
        <Alert tone="warning" title="This product is inactive" icon={<TriangleAlert className="size-5" />}>
          <p className="leading-relaxed">
            Stock cannot be received, consumed, adjusted or held while it is inactive. Reactivate it above, or
            count the remaining stock out and record the reason.
          </p>
        </Alert>
      ) : null}

      {/* Actions. Every one opens the same dialog with a different intent. */}
      <section aria-label="Stock actions" className="rounded-card border border-border bg-surface p-4 sm:p-5">
        <h2 className="text-eyebrow font-bold uppercase tracking-widest text-muted-foreground">Actions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every action writes one ledger entry with a mandatory reason, and only changes the figures once the
          server has confirmed it.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            type="button"
            variant="accent"
            size="lg"
            disabled={inactive}
            onClick={() => setIntent("RECEIVE")}
          >
            Receive
          </Button>
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={inactive}
            onClick={() => setIntent("CONSUME")}
          >
            Consume
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={inactive}
            onClick={() => setIntent("ADJUST")}
          >
            Adjust
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={inactive}
            onClick={() => setIntent("RESERVE")}
          >
            Reserve
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => setReorderOpen(true)}>
            Set reorder level
          </Button>
          <Link
            href="/inventory/counts"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-eyebrow border border-ink-400 px-6 font-bold hover:bg-surface-muted"
          >
            <ClipboardList aria-hidden="true" className="size-4" />
            Stock count
          </Link>
        </div>

        <InventoryStatusLine className="mt-3">
          Currently {qtySpoken(product.stock.available, product.unit)} available,{" "}
          {qtySpoken(product.stock.reserved, product.unit)} reserved against bookings.
        </InventoryStatusLine>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <StockBlock product={product} />
        <MoneyBlock product={product} />
        <TyreBlock product={product} />
        <ShelfLifeBlock product={product} />
      </div>

      {product.kind === "TYRE" && product.size !== null ? (
        <p className="text-sm text-muted-foreground">
          Search for the next customer&rsquo;s tyre by typing the size -{" "}
          <span className="font-mono">{product.size}</span> - into the stock search. Sizes are indexed, so a rim
          diameter finds the tyre even when the brand is not known.
        </p>
      ) : null}

      <MovementLedger productId={product.id} productName={product.name} unit={product.unit} />

      {intent !== null ? (
        <MovementDialog
          open
          onOpenChange={(open) => {
            if (!open) setIntent(null);
          }}
          product={productRef}
          intent={intent}
          onCompleted={() => {
            // Re-read from the server. The dialog already showed the confirmed
            // figures; this refreshes every block on the page behind it.
            setReloadToken((token) => token + 1);
          }}
        />
      ) : null}

      {reorderOpen ? (
        <ReorderLevelDialog
          open
          onOpenChange={(open) => {
            if (!open) setReorderOpen(false);
          }}
          product={product}
          onCompleted={(updated) => {
            setState({ kind: "ready", product: updated });
            toast.success(
              "Reorder level saved",
              `${updated.name} now warns at ${qty(updated.reorderPoint, updated.unit)}.`,
            );
          }}
        />
      ) : null}
    </div>
  );
}

function BackToStock(): React.ReactElement {
  return (
    <Link
      href="/inventory"
      className="inline-flex min-h-11 items-center gap-2 font-bold text-foreground underline decoration-2 underline-offset-4 hover:decoration-brand-500"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to the stock list
    </Link>
  );
}

export default ProductDetail;