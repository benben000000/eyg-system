import type { Metadata } from "next";
import type { ReactElement } from "react";

import { StockList } from "@/components/inventory/StockList";

/**
 * `/inventory` — the stock list, and the screen an operator lands on.
 *
 * Deliberately thin. The `<h1>` lives inside `<StockList />` rather than here,
 * because the low-stock count in the title is live data: a server-rendered
 * heading would show a number the client had already replaced. Next still
 * server-renders the client component, so the heading is in the initial HTML.
 *
 * `robots` is inherited from `src/app/inventory/layout.tsx` (noindex, nofollow).
 */

export const metadata: Metadata = {
  title: "Stock",
};

export default function InventoryIndexPage(): ReactElement {
  return <StockList />;
}