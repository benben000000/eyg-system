import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

interface Route {
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
}

/**
 * Every indexable route from the locked page map.
 *
 * Priority reflects commercial intent, not page depth: `/book` outranks
 * `/gallery` because booking is the primary conversion for the whole site.
 *
 * Excluded on purpose: `/admin` (staff), `/api/**` (not a page), `/offline` and
 * `/maintenance` (status pages, both `noindex`), and the error boundaries
 * (Next does not route them).
 */
const ROUTES: ReadonlyArray<Route> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/book", changeFrequency: "weekly", priority: 0.9 },
  { path: "/services", changeFrequency: "weekly", priority: 0.85 },
  { path: "/deals", changeFrequency: "weekly", priority: 0.8 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.75 },
  { path: "/gallery", changeFrequency: "monthly", priority: 0.6 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return ROUTES.map((route) => ({
    url: `${SITE.url}${route.path === "/" ? "" : route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
