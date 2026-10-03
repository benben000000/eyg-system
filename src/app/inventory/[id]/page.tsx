import type { Metadata } from "next";
import type { ReactElement } from "react";

import { ProductDetail } from "@/components/inventory/ProductDetail";

/**
 * `/inventory/[id]` - one product, its stock, its money, its tyre data and its
 * full movement ledger.
 *
 * Next 15 makes route `params` a Promise, so it is awaited before the client
 * component is handed the id. The id is a cuid, not a slug, so it is never
 * user-facing and never appears in a URL anyone should bookmark.
 *
 * `robots` is inherited from the inventory layout: noindex, nofollow.
 */

export const metadata: Metadata = {
  title: "Product",
};

export interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps): Promise<ReactElement> {
  const { id } = await params;
  return <ProductDetail productId={id} />;
}