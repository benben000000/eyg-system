import type { Metadata } from "next";
import type { ReactElement } from "react";

import { AgingTable } from "@/components/inventory/AgingTable";

/**
 * `/inventory/aging` - tyre DOT age and shelf life.
 *
 * `robots` is inherited from the inventory layout: noindex, nofollow.
 */

export const metadata: Metadata = {
  title: "Ageing",
};

export default function AgingPage(): ReactElement {
  return <AgingTable />;
}