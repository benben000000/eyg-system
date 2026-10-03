"use client";

import Script from "next/script";
import { GA_MEASUREMENT_ID, ANALYTICS_ENABLED } from "./analytics";

/**
 * Google Analytics 4, loaded with `afterInteractive` and **only** when
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set. In development nothing is requested
 * at all, so local work never pollutes the property.
 *
 * `nonce` is forwarded so the inline bootstrap satisfies the CSP the middleware
 * builds. Leave it undefined when the middleware is not in play.
 */
export function AnalyticsProvider({ nonce }: { nonce?: string }): React.ReactElement | null {
  if (!ANALYTICS_ENABLED) return null;

  return (
    <>
      <Script
        id="ga-src"
        strategy="afterInteractive"
        nonce={nonce}
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script id="ga-init" strategy="afterInteractive" nonce={nonce}>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', ${JSON.stringify(GA_MEASUREMENT_ID)}, { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
