/**
 * INVENTORY AUTH NOTICE
 * ============================================================================
 * A3 owns this file. Rendered by `src/app/inventory/layout.tsx` INSTEAD of the
 * inventory UI whenever there is no live staff session.
 *
 * Why a notice and not a redirect: the middleware's shallow guard only covers
 * `/admin` and `/api/admin`, so `/inventory` reaches this layout unprotected and
 * has to gate itself. Redirecting to `/admin/login` would hand the operator a
 * 404 on a shop whose sign-in page is built separately — a dead end with a
 * customer watching. So the gate is honest and self-explanatory instead: it says
 * what this is, that stock was not touched, and what to do.
 *
 * The API is independently guarded by A2's `withAdmin`, so this page is not the
 * thing standing between the ledger and the public. It is the thing standing
 * between an operator and a confusing empty screen.
 *
 * No hooks, no "use client" — this is a Server Component.
 * ============================================================================
 */

import type { ReactElement } from "react";
import { Alert, Badge, Card, CardContent, LinkButton } from "@/components/ui";
import { ShieldAlert } from "lucide-react";

export interface InventoryAuthNoticeProps {
  /**
   * Where the operator was heading. Rendered as plain text for support, and used
   * as the `next` hint. Defaults to the list, which always exists.
   */
  attemptedPath?: string;
}

export function InventoryAuthNotice({ attemptedPath = "/inventory" }: InventoryAuthNoticeProps): ReactElement {
  return (
    <div className="bg-surface-muted py-10 sm:py-16">
      <div className="mx-auto w-full max-w-prose px-4 sm:px-6">
        <p className="eyg-eyebrow text-brand-800 data-[theme=dark]:text-brand-400">Staff area</p>
        <h1 className="mt-2 text-h1">Inventory</h1>

        <Card className="mt-6" padding="md">
          <CardContent className="space-y-5">
            <Alert tone="warning" title="Sign in to open the stock list">
              <p className="leading-relaxed">
                This screen is for staff. Nothing was changed and nothing was read — you are looking at a
                locked door, not at an empty shelf.
              </p>
            </Alert>

            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-0.5 text-brand-800 data-[theme=dark]:text-brand-400">
                <ShieldAlert className="size-6" />
              </span>
              <div className="min-w-0 space-y-2">
                <p className="font-bold">What to do</p>
                <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
                  <li>Sign in with your staff account on the staff sign-in page.</li>
                  <li>Open this address again. It will load once your session is live.</li>
                </ol>
                <p className="text-sm text-muted-foreground">
                  Staff access is restricted to the shop&rsquo;s allowed networks. On a phone outside the
                  shop this screen stays locked, and that is deliberate: stock figures include what the shop
                  paid for each item, which is not public information.
                </p>
              </div>
            </div>

            <p className="font-mono text-xs text-muted-foreground">Requested page: {attemptedPath}</p>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              {/* A reload of THIS page. Real href, real destination, never "#". */}
              <LinkButton href={attemptedPath} variant="outline" size="md">
                Try again
              </LinkButton>
              <Badge tone="outline" size="sm">
                Internal use only
              </Badge>
              <span className="text-sm text-muted-foreground">
                If this keeps happening, ask the owner to check that your staff account is still active.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}