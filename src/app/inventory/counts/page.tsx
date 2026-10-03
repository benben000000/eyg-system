import type { Metadata } from "next";
import type { ReactElement } from "react";

import { CountStart } from "@/components/inventory/CountStart";

/**
 * `/inventory/counts` - start a cycle count, or pick up an unfinished one.
 *
 * Route order note: this static segment wins over `/inventory/[id]`, so a count
 * is never mistaken for a product.
 *
 * `robots` is inherited from the inventory layout: noindex, nofollow.
 */

export const metadata: Metadata = {
  title: "Stock count",
};

export default function CountsPage(): ReactElement {
  return <CountStart />;
}