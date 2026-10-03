import * as React from "react";

export interface JsonLdProps {
  /** A schema.org object. Serialised with `<` escaped so it can never break out. */
  data: Record<string, unknown>;
  /** Optional stable id. */
  id?: string;
}

/**
 * Renders a JSON-LD block. Server Component by design — schema must be in the
 * initial HTML for crawls that do not execute JavaScript.
 *
 * Keep this import out of `"use client"` files.
 */
export function JsonLd({ data, id }: JsonLdProps): React.ReactElement {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" id={id} dangerouslySetInnerHTML={{ __html: json }} />;
}
