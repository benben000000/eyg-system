"use client";

import * as React from "react";
import {
  CONTACT_PENDING_NOTE,
  MESSENGER_HREF,
  PHONE_DISPLAY,
  PHONE_HREF,
  WHATSAPP_HREF,
} from "@/components/layout/business";
import { BUSINESS } from "@/config/site";

/**
 * LAST-RESORT ERROR BOUNDARY.
 *
 * This component REPLACES the root layout, so it must render its own
 * `<html>` and `<body>` and it must not depend on anything that could itself
 * be the reason the app crashed. Concretely, that means:
 *
 *  • No `@/components/ui/*` — no cva, no Radix, no Slot.
 *  • No `next/link` — plain `<a>`, so there is no router context requirement.
 *  • No `useTheme`, no analytics, no providers.
 *  • Plain Tailwind token classes. All `@theme` tokens are emitted on `:root` by
 *    `globals.css`, so they resolve even though the root layout never rendered.
 *    (The `--font-saira` / `--font-barlow` variables will be missing, which is
 *    why the font stack names real fallbacks.)
 *
 * The phone number is the most prominent thing on the page. A customer stranded
 * at the roadside must never be stuck behind a stack trace.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  React.useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    }
  }, [error]);

  return (
    <html lang="en-PH">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          backgroundColor: "#06060a",
          color: "#ffffff",
          fontFamily:
            'var(--font-barlow, "Barlow"), system-ui, -apple-system, "Segoe UI", sans-serif',
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            borderTop: "6px solid #fcc605",
            width: "100%",
            flex: "1 1 auto",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ margin: "0 auto", padding: "2rem 1.25rem", maxWidth: "44rem", width: "100%" }}>
            <p
              style={{
                margin: 0,
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#fcc605",
              }}
            >
              Site error
            </p>

            <h1
              style={{
                margin: "0.5rem 0 0",
                fontFamily: 'var(--font-saira, "Arial Black"), system-ui, sans-serif',
                fontWeight: 900,
                fontSize: "clamp(1.75rem, 1.2rem + 2.4vw, 2.75rem)",
                lineHeight: 1.06,
                letterSpacing: "-0.02em",
              }}
            >
              The website broke, not your booking.
            </h1>

            <p style={{ marginTop: "1rem", fontSize: "1.0625rem", lineHeight: 1.65, color: "#c7c7cd" }}>
              We hit an unexpected error loading this page. Anything you already booked with us is
              safe. Reload, or call the shop — a person will pick up and finish the job for you.
            </p>

            {/* The escape hatch. Most prominent element on the page. */}
            <div style={{ marginTop: "2rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              {PHONE_HREF ? (
                <a
                  href={PHONE_HREF}
                  style={{
                    display: "inline-flex",
                    minHeight: "3.5rem",
                    alignItems: "center",
                    gap: "0.5rem",
                    borderRadius: "2px",
                    backgroundColor: "#fcc605",
                    color: "#06060a",
                    padding: "0 1.5rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    textDecoration: "none",
                  }}
                >
                  Call {PHONE_DISPLAY}
                </a>
              ) : (
                <span
                  data-unverified="true"
                  style={{
                    display: "inline-flex",
                    minHeight: "3.5rem",
                    alignItems: "center",
                    borderRadius: "2px",
                    border: "1px solid #3d3d47",
                    color: "#a0a0a9",
                    padding: "0 1.5rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Number being confirmed
                </span>
              )}

              {WHATSAPP_HREF ? (
                <a
                  href={WHATSAPP_HREF}
                  style={outlineButton}
                >
                  Message on WhatsApp
                </a>
              ) : null}

              <a href={MESSENGER_HREF} style={outlineButton}>
                Message on Messenger
              </a>

              <button
                type="button"
                onClick={reset}
                style={{
                  minHeight: "3.5rem",
                  borderRadius: "2px",
                  border: "1px solid #3d3d47",
                  background: "transparent",
                  color: "#ffffff",
                  padding: "0 1.5rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                }}
              >
                Reload the page
              </button>
            </div>

            {!PHONE_HREF ? (
              <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#a0a0a9" }}>
                {CONTACT_PENDING_NOTE}
              </p>
            ) : null}

            <hr style={{ margin: "2rem 0", border: 0, borderTop: "1px solid #2a2a32" }} />

            <p style={{ margin: 0, fontSize: "0.9375rem", color: "#a0a0a9" }}>
              {BUSINESS.legalName} — {BUSINESS.address.street}, {BUSINESS.address.district},{" "}
              {BUSINESS.address.province} {BUSINESS.address.postalCode}
            </p>

            {error.digest && process.env.NODE_ENV === "development" ? (
              <p style={{ marginTop: "0.75rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#71717e" }}>
                digest: {error.digest}
              </p>
            ) : null}
          </div>
        </div>
      </body>
    </html>
  );
}

const outlineButton: React.CSSProperties = {
  display: "inline-flex",
  minHeight: "3.5rem",
  alignItems: "center",
  gap: "0.5rem",
  borderRadius: "2px",
  border: "1px solid #52525e",
  color: "#ffffff",
  padding: "0 1.5rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  textDecoration: "none",
};
