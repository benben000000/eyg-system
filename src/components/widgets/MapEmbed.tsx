"use client";

/**
 * MAP EMBED — lazy, consent-aware, and always backed by a plain address.
 * ============================================================================
 * BEHAVIOUR
 *  - The third-party iframe is NEVER created until the visitor asks for it.
 *    A design-system rule in this project bans blocking interstitials, so the
 *    gate is *inline and reversible*: a designed placeholder with a real
 *    "Show the map" button, sitting exactly where the map will be. No cookie
 *    wall, no overlay, no scroll trap.
 *  - Once loaded it is a plain `<iframe loading="lazy" referrerPolicy="no-referrer-when-downgrade">`
 *    with an accessible title, so it costs nothing on a ₱3,000 Android.
 *  - "Open in Google Maps" and "Open in Waze" are always visible as real
 *    `<a target="_blank" rel="noopener noreferrer">` — they work with no JS.
 *  - The plain-text address is always in the DOM (not JS-generated), so a
 *    no-JS visitor and a screen reader both get it.
 *  - `directions_clicked` fires with the provider as a property.
 * ============================================================================
 */
import { useState } from "react";
import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { ADDRESS_ONE_LINE, BUSINESS, LINKS } from "@/config/site";
import { events } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button, ButtonLink, WidgetCard } from "@/components/widgets/internal/ui";

export interface MapEmbedProps {
  /** Defaults to `LINKS.mapsEmbed` from `site.ts`. */
  src?: string;
  title?: string;
  /** `aspect-video` by default so nothing shifts on load. */
  aspectClassName?: string;
  /** Start with the map already loaded (pages where the map IS the content). */
  autoLoad?: boolean;
  className?: string;
  /** Hide the card chrome and render just the embed. */
  bare?: boolean;
}

export default function MapEmbed({
  src = LINKS.mapsEmbed,
  title = `Map showing ${BUSINESS.legalName} at ${ADDRESS_ONE_LINE}`,
  aspectClassName = "aspect-[4/3] sm:aspect-video",
  autoLoad = false,
  className,
  bare = false,
}: MapEmbedProps) {
  const [loaded, setLoaded] = useState(autoLoad);

  const body = (
    <>
      {/* ── The map, or the honest placeholder that stands in for it ─────── */}
      <div className={cn("relative w-full overflow-hidden rounded-card bg-surface-muted", aspectClassName)}>
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <MapPin aria-hidden="true" className="size-8 text-brand-500" focusable="false" />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              We load the map from Google only when you ask for it — that keeps this page fast on a
              slow connection.
            </p>
            <Button onClick={() => setLoaded(true)}>
              <MapPin aria-hidden="true" className="size-4" focusable="false" />
              Show the map
            </Button>
          </div>
        )}
      </div>

      {/* ── The address, in plain text, for no-JS and for screen readers ── */}
      <address className="not-italic">
        <p className="text-sm font-bold text-foreground">{BUSINESS.address.street}</p>
        <p className="text-sm text-muted-foreground">
          {BUSINESS.address.district}, {BUSINESS.address.province} {BUSINESS.address.postalCode},{" "}
          {BUSINESS.address.countryName}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {BUSINESS.address.landmark}
        </p>
      </address>

      <div className="flex flex-wrap gap-2">
        <ButtonLink
          href={LINKS.directionsGoogle}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => events.directions("google")}
        >
          <Navigation aria-hidden="true" className="size-4" focusable="false" />
          Get directions
          <ExternalLink aria-hidden="true" className="size-3" focusable="false" />
        </ButtonLink>
        <ButtonLink
          href={LINKS.directionsWaze}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          onClick={() => events.directions("waze")}
        >
          <Navigation aria-hidden="true" className="size-4" focusable="false" />
          Open in Waze
          <ExternalLink aria-hidden="true" className="size-3" focusable="false" />
        </ButtonLink>
      </div>
    </>
  );

  if (bare) return <div className={cn("flex flex-col gap-3", className)}>{body}</div>;

  return (
    <WidgetCard as="section" className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-1">
        <p className="eyg-eyebrow text-muted-foreground">Find us</p>
        <h2 className="text-h3 text-foreground">EGSA Fourlanes, Tuyo</h2>
      </div>
      {body}
    </WidgetCard>
  );
}

export { MapEmbed };