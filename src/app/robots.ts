import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

/**
 * Generated from the locked page map in `docs/AGENT-BRIEF.md` §3.
 *
 * The staff area and the API are disallowed, and `/maintenance` is disallowed so
 * a temporary closure never gets indexed. Status pages carry `noindex` metadata
 * on their own, which is the real defence; robots.txt is belt and braces.
 */
/**
 * `/inventory` is the staff stock system — cost prices, margins, supplier
 * names and every movement on record. It must never be crawlable, and it must
 * never appear in the sitemap. The page layout also emits `noindex, nofollow`
 * for the whole segment, which is the real defence; this is belt and braces.
 */
const DISALLOWED = ["/admin", "/inventory", "/api/", "/maintenance", "/offline"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED,
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
