import type { Metadata } from "next";
import type { ReactElement } from "react";

import { CountSession } from "@/components/inventory/CountSession";

/**
 * `/inventory/counts/[id]` - one cycle count: count it, review it, post it.
 *
 * The id is a cuid, so it is not guessable and not bookmarkable. Next 15 makes
 * `params` a Promise, so it is awaited before the client component takes over.
 *
 * `robots` is inherited from the inventory layout: noindex, nofollow.
 */

export const metadata: Metadata = {
  title: "Counting",
};

export interface CountPageProps {
  params: Promise<{ id: string }>;
}

export default async function CountPage({ params }: CountPageProps): Promise<ReactElement> {
  const { id } = await params;
  return <CountSession countId={id} />;
}