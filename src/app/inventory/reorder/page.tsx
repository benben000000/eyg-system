import type { Metadata } from "next";
import type { ReactElement } from "react";

import { ReorderTable } from "@/components/inventory/ReorderTable";

/**
 * `/inventory/reorder` - what to order, from whom, and what it costs.
 *
 * `robots` is inherited from the inventory layout: noindex, nofollow.
 */

export const metadata: Metadata = {
  title: "Reorder",
};

export default function ReorderPage(): ReactElement {
  return <ReorderTable />;
}