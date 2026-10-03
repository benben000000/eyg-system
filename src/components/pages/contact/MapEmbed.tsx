/**
 * EYG — LAZY MAP EMBED
 * ============================================================================
 * A third-party iframe is the single heaviest thing on this site, and it is also
 * the least useful until the customer actually wants it. So:
 *
 *   • it is NOT loaded on first paint — the customer presses "Show the map"
 *   • once loaded it is `loading="lazy"` and keeps a fixed aspect-ratio box, so
 *     it cannot push the page around when it arrives (zero CLS)
 *   • behind the button there is a designed static placeholder with the address
 *     and both one-tap directions links, so it is still useful with the embed
 *     blocked, offline, or with an ad-blocker
 *   • `<noscript>` shows the same placeholder plus a direct Google Maps link
 *
 * The iframe title is descriptive. It is not decorative, and it is not
 * "Google Map".
 * ============================================================================
 */

"use client";

import * as React from "react";
import { BUSINESS, LINKS, ADDRESS_ONE_LINE } from "@/config/site";
import { Button, ButtonLink } from "@/components/pages/_shims";
import { ExternalLink, MapPin, Navigation } from "@/components/pages/_icons";

export interface MapEmbedProps {
  /** Pre-built embed URL from `LINKS.mapsEmbed`. */
  src: string;
  /** Static placeholder height, matching the embed's aspect ratio. */
  width?: number;
  height?: number;
}

export function MapEmbed({
  src,
  width = 800,
  height = 600,
}: MapEmbedProps): React.ReactElement {
  const [loaded, setLoaded] = React.useState(false);
  const placeholderLabel = `Map showing ${BUSINESS.legalName} at ${ADDRESS_ONE_LINE}`;
  const title = `Map of ${BUSINESS.legalName}, ${BUSINESS.address.street}, ${BUSINESS.address.district}`;

  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden rounded-panel border border-border bg-surface"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {loaded ? (
          <iframe
            src={src}
            title={title}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <StaticMapPlaceholder label={placeholderLabel} />
        )}
      </div>

      {!loaded ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="primary" size="md" onClick={() => setLoaded(true)}>
            <MapPin aria-hidden="true" className="size-4" />
            Show the map
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The map loads from Google only when you ask for it, so nothing is
            requested from Google before then.
          </p>
        </div>
      ) : null}

      <noscript>
        <div className="rounded-card border-2 border-dashed border-border-strong bg-surface-muted p-4">
          <p className="text-sm font-bold">The interactive map needs JavaScript.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {placeholderLabel}. Use either link below to open it in your maps app.
          </p>
          <p className="mt-3 flex flex-wrap gap-2">
            <a
              href={LINKS.directionsGoogle}
              className="inline-flex min-h-12 items-center gap-2 rounded-eyebrow border-2 border-border-strong bg-surface px-5 font-display text-sm font-extrabold uppercase tracking-wide"
            >
              <Navigation aria-hidden="true" className="size-4" />
              Google Maps
            </a>
            <a
              href={LINKS.directionsWaze}
              className="inline-flex min-h-12 items-center gap-2 rounded-eyebrow border-2 border-border-strong bg-surface px-5 font-display text-sm font-extrabold uppercase tracking-wide"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              Waze
            </a>
          </p>
        </div>
      </noscript>
    </div>
  );
}

/**
 * The designed static placeholder. It carries the same information as the embed
 * and it is the thing a customer actually needs when they are driving — the
 * address, the landmark, and a tap to navigate.
 */
function StaticMapPlaceholder({ label }: { label: string }): React.ReactElement {
  return (
    <div
      role="img"
      aria-label={label}
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface-muted p-6 text-center"
    >
      <div aria-hidden="true" className="eyg-hazard h-2 w-full" />
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-pill bg-surface text-brand-500 ring-2 ring-border-strong"
      >
        <MapPin className="size-7" />
      </span>
      <div className="max-w-sm space-y-2">
        <p className="font-display text-lg font-extrabold">{BUSINESS.legalName}</p>
        <address className="text-sm not-italic leading-relaxed text-muted-foreground">
          {BUSINESS.address.street}
          <br />
          {BUSINESS.address.district}, {BUSINESS.address.province} {BUSINESS.address.postalCode}
        </address>
      </div>
      <ButtonLink href={LINKS.directionsGoogle} variant="primary" size="md">
        <Navigation aria-hidden="true" className="size-4" />
        Get directions
      </ButtonLink>
      <ButtonLink href={LINKS.directionsWaze} variant="secondary" size="md">
        Open in Waze
      </ButtonLink>
    </div>
  );
}
