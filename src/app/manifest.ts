import type { MetadataRoute } from "next";
import { BUSINESS, SITE } from "@/config/site";

/**
 * PWA manifest. Served at `/manifest.webmanifest` and linked from the root
 * layout's `manifest` metadata field.
 *
 * Icons point at the brand agent's `public/brand/` output. Until those land the
 * entries are still valid (the manifest tolerates a missing icon), so nothing
 * here 500s.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BUSINESS.legalName} — ${BUSINESS.descriptor}`,
    short_name: BUSINESS.shortName,
    description: `${BUSINESS.tagline} Book a service bay in ${BUSINESS.address.district}, ${BUSINESS.address.province}.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: SITE.themeColorDark,
    theme_color: SITE.themeColorDark,
    lang: SITE.locale,
    dir: "ltr",
    categories: ["automotive", "business", "productivity"],
    icons: [
      {
        src: "/brand/logo-primary.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/brand/logo-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/brand/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcuts: [
      { name: "Book a service bay", url: "/book" },
      { name: "Services & prices", url: "/services" },
      { name: "Deals & clearance", url: "/deals" },
    ],
  };
}
