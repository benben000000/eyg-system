"use client";

import * as React from "react";
import { MessageCircle, Phone, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import {
  CONTACT_PENDING_NOTE,
  MESSENGER_HREF,
  PHONE_DISPLAY,
  PHONE_HREF,
  WHATSAPP_HREF,
} from "./business";
import { track } from "@/components/providers/analytics";

const STORAGE_KEY = "eyg:emergency-banner-dismissed";

/** `useLayoutEffect` in the browser (runs before paint → no CLS), `useEffect` on the server. */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export interface EmergencyBannerProps {
  /** The homepage is the only page that shows the banner, and the only page
   *  where it can be dismissed. */
  dismissible?: boolean;
  className?: string;
}

/**
 * LANE A — EMERGENCY. "Stranded or need towing? Tap here."
 *
 *  • `role="region"` + `aria-label` → a findable landmark.
 *  • Ink band, brand-yellow hazard hatch rail, yellow border. Text is white on
 *    ink and the CTAs are brand yellow, so contrast clears AA.
 *  • **No CLS.** The server always renders the banner, and the dismissal check
 *    runs in a layout effect (before paint), so a returning visitor who already
 *    dismissed it never sees the page jump.
 *  • Dismissal lives in `sessionStorage` — never a cookie, never on disk.
 *  • It is NEVER the only route to a phone number: the header call button, the
 *    top strip and the mobile action bar all stay one tap away, and while the
 *    number is unconfirmed it offers Messenger instead of a dead `tel:`.
 */
export function EmergencyBanner({
  dismissible = false,
  className,
}: EmergencyBannerProps): React.ReactElement | null {
  const [dismissed, setDismissed] = React.useState(false);

  useIsomorphicLayoutEffect(() => {
    if (!dismissible) return;
    try {
      if (window.sessionStorage.getItem(STORAGE_KEY) === "1") setDismissed(true);
    } catch {
      // Storage blocked (private mode). Showing the banner is the safe default.
    }
  }, [dismissible]);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Non-fatal: the banner simply returns next navigation.
    }
  };

  return (
    <section
      role="region"
      aria-label="Emergency roadside assistance"
      className={cn(
        "relative isolate overflow-hidden border-y-2 border-brand-500 bg-ink-950 text-white",
        className,
      )}
    >
      {/* Hazard hatch rail — the brand device reserved for urgency. */}
      <div aria-hidden="true" className="eyg-hazard absolute inset-y-0 left-0 w-2 sm:w-3" />

      <div className="mx-auto flex w-full max-w-page flex-col gap-3 py-3 pl-6 pr-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-4 sm:pl-8 sm:pr-4 lg:px-10">
        <p className="flex min-w-0 items-center gap-3">
          <TriangleAlert aria-hidden="true" className="size-6 shrink-0 text-brand-500 sm:size-7" />
          <span className="min-w-0">
            <span className="eyg-eyebrow block text-brand-500">Emergency</span>
            <span className="block text-base font-extrabold leading-tight sm:text-h3">
              Stranded or need towing? Tap here for emergency assistance.
            </span>
          </span>
        </p>

        <div className="flex shrink-0 items-center gap-2 pl-9 sm:pl-0">
          {PHONE_HREF ? (
            <Button asChild variant="accent" size="md">
              <a href={PHONE_HREF} onClick={() => track("emergency_tapped", { channel: "call" })}>
                <Phone aria-hidden="true" className="size-5" />
                Call now
                <span className="sr-only"> — {PHONE_DISPLAY}</span>
              </a>
            </Button>
          ) : null}

          {WHATSAPP_HREF ? (
            <Button
              asChild
              variant="outline"
              size="md"
              className="border-white/40 text-white hover:border-white hover:bg-white/10"
            >
              <a
                href={WHATSAPP_HREF}
                onClick={() => track("whatsapp_clicked", { placement: "emergency_banner" })}
              >
                <MessageCircle aria-hidden="true" className="size-5" />
                Message
              </a>
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              size="md"
              className="border-white/40 text-white hover:border-white hover:bg-white/10"
            >
              <a
                href={MESSENGER_HREF}
                onClick={() => track("messenger_clicked", { placement: "emergency_banner" })}
              >
                <MessageCircle aria-hidden="true" className="size-5" />
                Message us
              </a>
            </Button>
          )}

          {dismissible ? (
            <IconButton
              label="Dismiss the emergency notice"
              variant="ghost"
              size="md"
              onClick={dismiss}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <X aria-hidden="true" className="size-5" />
            </IconButton>
          ) : null}
        </div>

        {!PHONE_HREF ? <span className="sr-only">{CONTACT_PENDING_NOTE}</span> : null}
      </div>
    </section>
  );
}
