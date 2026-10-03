import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

import { Container } from "@/components/ui";
import { InventoryAuthNotice } from "@/components/inventory/InventoryAuthNotice";
import { InventoryNav } from "@/components/inventory/InventoryNav";
import { currentSession } from "@/lib/server/auth";

/**
 * INVENTORY SHELL (A3)
 * ============================================================================
 * The chrome for every operator screen: a four-section nav, a gated gate, and
 * nothing else. Every number, every figure and every mutation lives under a
 * child route.
 *
 * ── NOINDEX ────────────────────────────────────────────────────────────────
 * `robots` here is inherited by every child route that does not override it, so
 * one declaration covers the list, the detail pages, the counts, the reorder
 * list and the ageing watch. This is a stock system: it contains cost prices
 * and it must never appear in a search result, a preview card or an archive.
 * `src/app/robots.ts` is orchestrator-owned and does not yet list `/inventory`
 * — see the report; `noindex` metadata is the real defence, disallow is belt and
 * braces.
 *
 * ── WHY THE GATE IS HERE AND NOT ONLY IN THE API ────────────────────────────
 * `ADMIN_PREFIXES` in `src/lib/session-cookie.ts` covers `/admin` and
 * `/api/admin`. `/inventory` is neither, so the middleware's shallow guard does
 * not fire and this layout has to gate itself with the authoritative session
 * check. A2 independently guards every `/api/inventory/**` route with
 * `withAdmin`, so this is the operator-facing lock, not the security boundary.
 *
 * ── WHY NO SECOND `<main>` ─────────────────────────────────────────────────
 * The root layout already owns `<main id="main">` and the skip link points at
 * it. A nested `<main>` is invalid and breaks landmark navigation for everyone.
 * This is a labelled `<section>` instead.
 * ============================================================================
 */

export const metadata: Metadata = {
  title: { absolute: "Inventory — EYG staff" },
  description: "Staff stock control for EYG Tire & Auto Care. Internal use only.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

/**
 * Always dynamic. `currentSession()` reads cookies, but being explicit also stops
 * a future router-cache change from ever serving one operator's figures to
 * another.
 */
export const dynamic = "force-dynamic";

export default async function InventoryLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  const session = await currentSession();

  if (!session) {
    return <InventoryAuthNotice />;
  }

  return (
    <div className="bg-surface-muted pb-action-bar pt-6 sm:pt-8">
      <Container size="page" as="div" className="px-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <p className="eyg-eyebrow text-brand-800 data-[theme=dark]:text-brand-400">Staff · inventory</p>
          <p className="text-sm text-muted-foreground">
            Internal screen. Cost prices and margins are shown here on purpose — they are how a bay decides
            what to sell.
          </p>
        </div>

        <div className="mt-4">
          <InventoryNav signedInAs={`${session.user.name} (${session.user.role.toLowerCase().replace("_", " ")})`} />
        </div>

        <section aria-label="Inventory" className="mt-6">
          {children}
        </section>
      </Container>
    </div>
  );
}