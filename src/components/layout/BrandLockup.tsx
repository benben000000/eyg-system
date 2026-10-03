"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { BUSINESS } from "@/config/site";

/* ────────────────────────────────────────────────────────────────────────────
   LOGO SOURCE — SINGLE SWAP POINT
   ────────────────────────────────────────────────────────────────────────────
   The brand agent owns `public/brand/`. `logo-primary.svg` (585×168) is
   committed, so `USE_LOGO_IMAGE` is `true` and the header, footer and hero all
   render the real mark.

   The SVG is served with `unoptimized` on purpose: Next's image optimizer
   refuses SVG unless `images.dangerouslyAllowSVG` is set in `next.config.ts`
   (orchestrator-owned), so optimising it would 400. `unoptimized` emits a plain
   `<img>` with the intrinsic path — which is exactly right for a vector logo.

   If the file is ever renamed or removed, the `onError` fallback below swaps in
   the text lockup automatically, so the header can never show a broken image.
   ──────────────────────────────────────────────────────────────────────────── */
export const LOGO_SRC = "/brand/logo-primary.svg";
export const USE_LOGO_IMAGE = true;

/** Intrinsic aspect ratio of `logo-primary.svg` (585 / 168). */
const LOGO_ASPECT = 585 / 168;

export const LOGO_ALT = `${BUSINESS.legalName} logo`;

export interface BrandLockupProps extends React.ComponentPropsWithoutRef<"span"> {
  /** Rendered width in px. Height follows the SVG's intrinsic ratio. */
  width?: number;
  /** `inverse` forces white — for the transparent header over the ink hero. */
  tone?: "default" | "inverse";
  /** Draw the `.eyg-stripe` underline device (text lockup only). */
  stripe?: boolean;
}

/**
 * The brand mark. `<Image>` when `USE_LOGO_IMAGE` is on and the file loads,
 * otherwise the matching text lockup. Explicit width/height either way — no CLS.
 */
export function BrandLockup({
  width = 132,
  tone = "default",
  stripe = true,
  className,
  ...props
}: BrandLockupProps): React.ReactElement {
  const [failed, setFailed] = React.useState(false);
  const height = Math.round(width / LOGO_ASPECT);
  const useImage = USE_LOGO_IMAGE && !failed;

  if (useImage) {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)} {...props}>
        <Image
          src={LOGO_SRC}
          alt={LOGO_ALT}
          width={width}
          height={height}
          priority
          unoptimized
          className="h-auto w-auto"
          style={{ width, height }}
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  const primary = tone === "inverse" ? "text-white" : "text-foreground";

  return (
    <span
      className={cn("inline-flex shrink-0 flex-col", stripe && "eyg-stripe pb-1", className)}
      style={{ width }}
      {...props}
    >
      <span
        className={cn(
          "block font-display text-h3 font-extrabold italic leading-[0.95] tracking-tight",
          primary,
        )}
      >
        EYG TIRE
      </span>
      <span className="mt-1 block font-sans text-eyebrow font-bold uppercase leading-none tracking-[0.22em] text-brand-500">
        &amp; Auto Care
      </span>
    </span>
  );
}
