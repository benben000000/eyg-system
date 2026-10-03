import type { Metadata, Viewport } from "next";
import type { ReactElement, ReactNode } from "react";
import { headers } from "next/headers";
import { Barlow, Saira } from "next/font/google";

import "./globals.css";

import { BUSINESS, SITE } from "@/config/site";
import { localBusinessJsonLd, websiteJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/ui/JsonLd";
import { Providers } from "@/components/providers/Providers";
import { SkipLink } from "@/components/layout/SkipLink";
import { TopBar } from "@/components/layout/TopBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileActionBar } from "@/components/layout/MobileActionBar";
import { getOpenStatus } from "@/components/layout/hours";

/* ── Fonts ──────────────────────────────────────────────────────────────────
   Saira for display (heavy forward-italic, matching the wordmark), Barlow for
   body/UI. `globals.css` already references `--font-saira` / `--font-barlow`,
   so the variables are the whole integration.

   `adjustFontFallback` is left on: Next measures the fallback against the real
   font and emits a size-adjusted `@font-face`, which is what keeps the swap
   from nudging the layout.
   ────────────────────────────────────────────────────────────────────────── */
const saira = Saira({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
  preload: true,
  variable: "--font-saira",
  adjustFontFallback: true,
  fallback: ["Arial Black", "Arial", "system-ui", "sans-serif"],
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: true,
  variable: "--font-barlow",
  adjustFontFallback: true,
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
});

/**
 * Blocking, pre-paint theme script.
 *
 * Runs before the body parses so `data-theme` is already correct on the first
 * paint — no flash of the wrong theme. It reads the same `localStorage` key
 * next-themes uses, so the two never disagree. `next-themes` renders a second
 * copy of this logic (with the same nonce) once React hydrates; both are
 * idempotent.
 *
 * The nonce comes from the CSP that `src/middleware.ts` builds.
 */
const themeBootstrap = `(function(){try{var s=localStorage.getItem("theme");var t=(s==="light"||s==="dark")?s:"dark";var e=document.documentElement;e.setAttribute("data-theme",t);e.style.colorScheme=t;}catch(_){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${BUSINESS.legalName} — Tire Shop & Auto Care in ${BUSINESS.address.district}, ${BUSINESS.address.province}`,
    template: "%s | EYG Tire & Auto Care",
  },
  description: `Tire change, PMS, wheel alignment, brakes, undercoating and car aircon in ${BUSINESS.address.district}, ${BUSINESS.address.province}. Book a service bay or call the shop.`,
  applicationName: BUSINESS.legalName,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: BUSINESS.shortName,
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: true, address: true, email: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: BUSINESS.legalName,
    locale: "en_PH",
    url: SITE.url,
    title: `${BUSINESS.legalName} — ${BUSINESS.tagline}`,
    description: `Tire shop and auto care centre in ${BUSINESS.address.district}, ${BUSINESS.address.province}. Book a service bay online or call the shop.`,
    images: [{ url: "/brand/logo-og.png", width: 1200, height: 630, alt: BUSINESS.legalName }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BUSINESS.legalName} — ${BUSINESS.tagline}`,
    description: `Tire shop and auto care centre in ${BUSINESS.address.district}, ${BUSINESS.address.province}.`,
    images: ["/brand/logo-og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "automotive",
  other: { "geo.region": "PH-03", "geo.placename": `${BUSINESS.address.district}, ${BUSINESS.address.province}` },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Required for `env(safe-area-inset-*)` to be non-zero on notched phones.
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: SITE.themeColorLight },
    { media: "(prefers-color-scheme: dark)", color: SITE.themeColorDark },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactElement> {
  // `headers()` is async in Next 15. The CSP nonce is attached to every inline
  // script in the app by the middleware; read it once here and thread it down.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const status = getOpenStatus(new Date());

  return (
    <html
      lang="en-PH"
      suppressHydrationWarning
      className={`${saira.variable} ${barlow.variable}`}
    >
      {/* The App Router owns `<head>`. This layout used to render its own, to hold
       * the theme bootstrap script, which is not a supported thing to do — so it is
       * gone and the script moved to the top of `<body>`, where an inline script
       * still runs before any visible content is parsed. The CSP nonce is
       * unaffected.
       *
       * This did NOT fix the metadata placement, and the reason is worth writing
       * down because two plausible explanations have already been measured and
       * ruled out:
       *
       *   `<title>`, `<meta name="description">`, `<link rel="canonical">` and the
       *   Open Graph tags are all rendered in the BODY, at the end of the
       *   document, where `document.head` cannot see them. Lighthouse scores
       *   `meta-description` 0 for exactly that reason, and SEO sits at 91 with no
       *   individual SEO audit failing — the category has nothing to score.
       *
       *     measured: </head> closes at byte 2,564; <title> begins at 109,371 —
       *     immediately after React's LAST boundary-reveal script, `$RC("B:5",
       *     "S:5")`. The shell had already closed </head> by then.
       *
       *   Ruled out by measurement. Each of these was changed and every page was
       *   re-fetched; each one changed nothing, and each is listed so nobody spends
       *   the afternoon re-testing it:
       *     - this custom <head>                              removing it: no change
       *     - the root src/app/loading.tsx Suspense boundary  removing it: no change
       *     - output: "standalone" in next.config.ts          removing it: no change
       *   And each of these was reproduced with a throwaway probe route that
       *   rendered its metadata CORRECTLY, in <head>:
       *     - export const dynamic = "force-dynamic"
       *     - an await in the page component
       *     - an await inside <Suspense>
       *     - awaiting searchParams
       *   So dynamic rendering is NOT the cause. It is the await itself.
       *
       *   Confirmed by two further measurements: replacing this layout's
       *   `await headers()` with a literal nonce puts `/` in <head> (title at byte
       *   1,980, </head> at 4,954). Re-introducing the same await one level down, in
       *   a child component, puts it straight back in the body — and so does
       *   wrapping that child in <Suspense>, which is the next thing anyone will try.
       *
       *   That is the whole finding: ANY `await headers()` anywhere in the render
       *   tree moves this site's metadata into the body, because the document
       *   suspends before the shell flushes.
       *
       * THE FIX WAS BUILT, MEASURED, AND REVERTED. Hash-authorising the inline
       *   scripts instead of noncing them does put the metadata in <head> — and
       *   refuses 70 of the 71 inline scripts on `/`, because Next delivers the
       *   React Server Component payload as per-request inline <script> tags whose
       *   text cannot be hashed in advance. React never hydrates. Next's docs say it
       *   applies the nonce to its own scripts automatically; measured here, 0 of
       *   18 chunks were nonced, and the same bug is still reported against Next
       *   16.2.10 (vercel/next.js#95433), so upgrading is not the answer either.
       *
       * Full write-up, with the reproduction and the three ways out:
       *   docs/inventory-decision-log.md §18
       *
       * DO NOT "TIDY" THE SCRIPT BACK INTO A <head> BLOCK, AND DO NOT MOVE THE
       * NONCE READ DOWN A LEVEL BELIEVING IT ESCAPES THE PROBLEM. Both were tried,
       * and so was deleting the nonce in favour of hashes. All three were measured. */}
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <Providers nonce={nonce}>
          <SkipLink targetId="main" />
          <TopBar status={status} />
          <Header />
          <main id="main" tabIndex={-1} className="min-h-[60dvh] focus-visible:outline-0">
            {children}
          </main>
          <Footer />
          <MobileActionBar />
        </Providers>

        <JsonLd data={localBusinessJsonLd()} id="ld-business" />
        <JsonLd data={websiteJsonLd()} id="ld-website" />
      </body>
    </html>
  );
}
