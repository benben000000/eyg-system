/**
 * EYG — GALLERY FILTER + GRID
 * ============================================================================
 * Client-side filtering over the already-rendered grid. The filter is a real
 * `<button aria-pressed>` group, not a `<select>`, so it is operable one-handed
 * on a phone and works on a keyboard.
 *
 * WHY NOT A `?category=` URL FILTER HERE: unlike `/services`, the gallery is not
 * a search landing page, and a filter that re-renders the whole grid on every
 * tap is slower on a ₱3,000 Android over 3G than hiding six cards. The full set
 * is in the initial HTML, so it is indexable and works before hydration.
 *
 * ALT TEXT IS NOT OPTIONAL. Every record in `src/content/catalog.ts` carries
 * descriptive `alt` written for the photograph the owner is expected to shoot.
 * `GalleryPhoto` enforces the rule at the type level: `alt` is a required
 * `string`, and there is no code path that renders an image without one.
 * ============================================================================
 */

"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { GalleryFilterSlug, GalleryImage } from "@/content/catalog";
import { GALLERY_CATEGORIES } from "@/content/catalog";
import { BrandPlate } from "@/components/pages/_shared";
import { ButtonLink, EmptyState } from "@/components/pages/_shims";
import { BeforeAfterComparison } from "@/components/pages/gallery/BeforeAfterSlider";
import { Lightbox, type LightboxItem } from "@/components/pages/gallery/Lightbox";
import { Camera, Check, Maximize2 } from "@/components/pages/_icons";
import { FUNNEL_EVENTS, trackFunnel } from "@/components/pages/_telemetry";

type ActiveFilter = GalleryFilterSlug | "all";

export interface GalleryGridProps {
  images: readonly GalleryImage[];
  /** True when there is genuinely nothing published. */
  isEmpty: boolean;
}

export function GalleryGrid({ images, isEmpty }: GalleryGridProps): React.ReactElement {
  const [active, setActive] = React.useState<ActiveFilter>("all");
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  const counts = React.useMemo(() => {
    const map = new Map<ActiveFilter, number>();
    map.set("all", images.length);
    for (const cat of GALLERY_CATEGORIES) {
      if (cat.slug === "all") continue;
      map.set(cat.slug, images.filter((i) => i.categories.includes(cat.slug)).length);
    }
    return map;
  }, [images]);

  const visible = React.useMemo(
    () => (active === "all" ? images : images.filter((i) => i.categories.includes(active))),
    [active, images],
  );

  const lightboxItems: LightboxItem[] = React.useMemo(
    () => visible.map((i) => ({ id: i.id, alt: i.alt, caption: i.caption, image: i })),
    [visible],
  );

  if (isEmpty) {
    return (
      <div className="space-y-4">
        <p className="max-w-prose text-muted-foreground">
          We have not put any photographs on this page. That is a deliberate choice: a
          shop that shows stock images of somebody else&rsquo;s bay and calls it its
          own work has told you it does not care whether you trust it.
        </p>
        <EmptyState
          title="No photos published yet"
          body="The work is real and so is the shop. Come and see the bay, or book a slot and judge us afterwards."
          icon={<Camera aria-hidden="true" className="size-6" />}
          action={
            <>
              <ButtonLink href="/book" variant="cta" size="md">
                Book a bay
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary" size="md">
                Find us &amp; opening hours
              </ButtonLink>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Filter ───────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div
          role="group"
          aria-label="Filter photos by what they show"
          className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {GALLERY_CATEGORIES.map((cat) => {
            const slug = cat.slug as ActiveFilter;
            const selected = active === slug;
            const count = counts.get(slug) ?? 0;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => {
                  setActive(slug);
                  setLightboxIndex(null);
                  trackFunnel(FUNNEL_EVENTS.galleryFilter, { filter: slug });
                }}
                aria-pressed={selected}
                className={cn(
                  "inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-pill border-2 px-4 py-2 text-sm transition-colors",
                  selected
                    ? "border-brand-500 bg-brand-500 font-bold text-ink-950"
                    : "border-border-strong bg-surface text-foreground hover:border-brand-500 hover:text-brand-500",
                )}
              >
                {selected ? <Check aria-hidden="true" className="size-3.5" /> : null}
                {cat.name}
                <span
                  className={cn(
                    "tabular rounded-pill px-1.5 text-xs font-bold",
                    selected ? "bg-ink-950/15 text-ink-950" : "bg-surface-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Showing {visible.length} of {images.length} {images.length === 1 ? "photo" : "photos"}
          {active === "all" ? "." : ` tagged ${GALLERY_CATEGORIES.find((c) => c.slug === active)?.name}.`}
        </p>
      </div>

      {/* ── Comparisons ──────────────────────────────────────────────────── */}
      {visible.some((i) => i.pair) ? (
        <section aria-labelledby="comparisons-heading" className="space-y-5">
          <div className="max-w-prose space-y-2">
            <h3 id="comparisons-heading" className="text-h2">
              Before &amp; after
            </h3>
            <p className="text-muted-foreground">
              Drag the handle, or use the arrow keys on it. Each pair is two real jobs
              on the same vehicle — the measurement is on the job card, not just the
              photograph.
            </p>
          </div>
          <ul className="grid gap-8 lg:grid-cols-2">
            {visible
              .filter((i) => i.pair)
              .map((image) => (
                <li key={image.id}>
                  <BeforeAfterComparison
                    image={image}
                    onOpen={() => {
                      const idx = visible.findIndex((v) => v.id === image.id);
                      setLightboxIndex(idx >= 0 ? idx : null);
                      trackFunnel(FUNNEL_EVENTS.galleryCompare, { id: image.id });
                    }}
                  />
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {/* ── The grid ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="grid-heading" className="space-y-5">
        <h3 id="grid-heading" className="sr-only">
          {active === "all" ? "All photos" : "Filtered photos"}
        </h3>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((image, index) => (
            <li key={image.id}>
              <GalleryCard
                image={image}
                onOpen={() => {
                  setLightboxIndex(index);
                  trackFunnel(FUNNEL_EVENTS.galleryLightboxOpen, { id: image.id });
                }}
              />
            </li>
          ))}
        </ul>
      </section>

      {lightboxIndex !== null && lightboxItems[lightboxIndex] ? (
        <Lightbox
          items={lightboxItems}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD
// ─────────────────────────────────────────────────────────────────────────────

function GalleryCard({
  image,
  onOpen,
}: {
  image: GalleryImage;
  onOpen: () => void;
}): React.ReactElement {
  return (
    <figure className="group flex h-full flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-plate transition-shadow hover:shadow-lift">
      <button
        type="button"
        onClick={onOpen}
        className="relative block w-full overflow-hidden text-left"
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
      >
        <GalleryPhoto image={image} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 100vw" />
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-pill bg-ink-950/80 text-brand-500 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Maximize2 className="size-4" />
        </span>
        <span className="sr-only">Open &ldquo;{image.caption}&rdquo; larger</span>
      </button>
      <figcaption className="flex flex-1 flex-col gap-1.5 border-t border-border p-4">
        <p className="text-sm leading-relaxed">{image.caption}</p>
        {image.needsOwnerPhoto ? (
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Awaiting the shop&rsquo;s own photo
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}

/**
 * Renders the real photograph when the owner has uploaded one, and the designed
 * `BrandPlate` placeholder when they have not.
 *
 * The `alt` prop is required on `GalleryImage`, so there is no way to render this
 * with an empty description by accident. `next/image` always gets explicit
 * `width`/`height` and a `sizes` hint, so the box is reserved before the bytes
 * arrive (zero CLS), and the placeholder occupies the same aspect ratio.
 */
export function GalleryPhoto({
  image,
  sizes,
  className,
}: {
  image: GalleryImage;
  sizes: string;
  className?: string;
}): React.ReactElement {
  const blur = useTokenBlurUrl();
  const source = image.src;
  if (!source || image.needsOwnerPhoto) {
    return (
      <div className="size-full">
        {/* `BrandPlate` is decorative; the real content is this machine-readable
            description, which is the same `alt` the photograph will carry. */}
        <BrandPlate
          label={image.caption}
          alt={image.alt}
          width={image.width}
          height={image.height}
        />
      </div>
    );
  }
  return (
    <Image
      src={source}
      alt={image.alt}
      width={image.width}
      height={image.height}
      sizes={sizes}
      className={cn("size-full object-cover", className)}
      placeholder={blur ? "blur" : "empty"}
      blurDataURL={blur ?? undefined}
    />
  );
}

/**
 * Builds a 1×1 blur placeholder from a DESIGN TOKEN, not a literal colour.
 *
 * The token is read from the document at runtime, so the placeholder follows the
 * active theme (dark is the default on this site) and no hex value is hardcoded
 * anywhere. Until the read completes, `placeholder="empty"` is used over the same
 * `bg-surface-muted` surface the grid reserves, so nothing shifts.
 */
function useTokenBlurUrl(): string | null {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    try {
      const token = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-surface-muted")
        .trim();
      if (!token || cancelled) return;
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='${token}'/></svg>`;
      setUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    } catch {
      // `getComputedStyle` is unavailable in some embedding contexts; the empty
      // placeholder is a perfectly good fallback.
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return url;
}
