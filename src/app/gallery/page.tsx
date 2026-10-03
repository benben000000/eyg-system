/**
 * EYG — /gallery  ·  BEFORE & AFTER
 * ============================================================================
 * Filterable grid, a keyboard-operable lightbox, and real before/after
 * comparisons.
 *
 * A NOTE ON PHOTOGRAPHY, because it matters:
 * There is no owned photography in this repository, and stock photos must never
 * be presented as this shop's work. So every record in `src/content/catalog.ts`
 * carries `src: null` and `needsOwnerPhoto: true`, plus a real, descriptive `alt`
 * string written for the photograph the owner is expected to shoot. Until those
 * files are uploaded, the grid renders a designed `BrandPlate` at the exact aspect
 * ratio of the real image — so uploading the photos later causes zero layout
 * shift and no code change.
 *
 * `alt` is a required field on `GalleryImage`, so an image with no description
 * cannot be constructed. That is the enforcement; this comment is only the
 * explanation.
 * ============================================================================
 */

import type { Metadata } from "next";
import { pageSeo, breadcrumbJsonLd } from "@/lib/seo";
import { getGalleryImages, GALLERY_CATEGORIES } from "@/content/catalog";
import { ButtonLink, Container, Eyebrow, Section } from "@/components/pages/_shims";
import { Divider } from "@/components/ui/Divider";
import { JsonLd } from "@/components/ui/JsonLd";
import { Breadcrumb, CtaBand, PageHeader } from "@/components/pages/_shared";
import { GalleryGrid } from "@/components/pages/gallery/GalleryGrid";
import { Camera, Eye, ShieldCheck, Sparkles } from "@/components/pages/_icons";

export const metadata: Metadata = pageSeo({
  title: "Before & After — Tyre, Brake and Bay Photos",
  description:
    "Real before-and-after work from our Balanga City bay: tyres, wheel alignment, brakes, engine bays and diagnostics. No stock photos, no borrowed pictures.",
  path: "/gallery",
  keywords: [
    "before and after tyre change Balanga",
    "wheel alignment photo Bataan",
    "brake pad replacement pictures",
    "auto care workshop Balanga gallery",
  ],
});

export default async function GalleryPage(): Promise<React.ReactElement> {
  const images = await getGalleryImages();
  const isEmpty = images.length === 0;
  const pairs = images.filter((i) => i.pair).length;

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Gallery", path: "/gallery" },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} id="ld-breadcrumb-gallery" />

      <PageHeader
        eyebrow="Before & after"
        title="The work, not the marketing"
        lede={
          <>
            Tyres, alignment, brakes, engine bays and the diagnostics behind them. We
            photograph the job before and after because a measurement you cannot see is
            just a claim.
          </>
        }
        actions={
          <>
            <ButtonLink href="/book" variant="cta" size="lg">
              Book a bay
            </ButtonLink>
            <ButtonLink href="/services" variant="secondary" size="lg">
              See services &amp; prices
            </ButtonLink>
          </>
        }
        footnote="Every photo here is taken in our own bay. We do not use stock images, and we do not use anyone else&rsquo;s work."
      />

      <Container className="pt-6">
        <Breadcrumb trail={crumbs} />
      </Container>

      <Section labelledBy="gallery-heading" space="md">
        <Container className="space-y-10">
          <div className="max-w-prose space-y-3">
            <Eyebrow>The gallery</Eyebrow>
            <h2 id="gallery-heading" className="text-h2">
              {isEmpty
                ? "Nothing published yet"
                : `${images.length} ${images.length === 1 ? "photo" : "photos"} across ${GALLERY_CATEGORIES.length - 1} categories`}
            </h2>
            <p className="text-body-lg text-muted-foreground">
              {isEmpty
                ? "We would rather leave this empty than fill it with pictures that are not ours. Check back, or come and see the bay."
                : pairs > 0
                  ? `${pairs} of these are before-and-after pairs you can drag open. Filter by what you want to see, or open any photo full size with the arrow keys.`
                  : "Filter by what you want to see, or open any photo full size with the arrow keys."}
            </p>
          </div>

          <GalleryGrid images={images} isEmpty={isEmpty} />
        </Container>
      </Section>

      <Divider variant="checker" inset="none" />

      <Section labelledBy="honest-photos-heading" space="md" tone="muted">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-12">
            <div className="space-y-3">
              <Eyebrow>Why this page is honest about being empty</Eyebrow>
              <h2 id="honest-photos-heading" className="text-h2">
                No stock photos. No borrowed bays.
              </h2>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {HONESTY_POINTS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="space-y-2 rounded-card border border-border bg-surface p-5">
                  <p className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
                    <Icon aria-hidden="true" className="size-4 text-brand-500" />
                    {title}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      <CtaBand
        title="See it on your own car"
        body="A photo of somebody else's tyre tells you very little. Book a slot, and we will show you the measurement on your own car, in writing, before anything is done."
        primary={{ label: "Book a bay", href: "/book" }}
        secondary={{ label: "See services & pricing", href: "/services" }}
      />
    </>
  );
}

const HONESTY_POINTS: ReadonlyArray<{ icon: typeof Camera; title: string; body: string }> = [
  {
    icon: Camera,
    title: "Our bay or not at all",
    body: "Every photograph on this page is taken in the EYG bay in Tuyo. The tyres, the plates and the tools in frame are the ones your car goes onto.",
  },
  {
    icon: Sparkles,
    title: "Before and after, honestly",
    body: "Some jobs barely change the look of anything — a brake fluid flush, a rotation. We show those too, with the measurement, rather than pretending the car looks brand new.",
  },
  {
    icon: ShieldCheck,
    title: "No customer plates",
    body: "We do not publish a customer's plate number, face or vehicle identifying detail. Where a shot needs a car, the identifying parts are out of frame.",
  },
  {
    icon: Eye,
    title: "You can check the claim",
    body: "A photograph proves a job happened. It does not prove the job was done properly — that is what the written service record and the workmanship guarantee are for.",
  },
];
