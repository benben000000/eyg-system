"use client";

import * as React from "react";
import { MessageCircle, Phone, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/Modal";
import {
  CONTACT_PENDING_NOTE,
  MESSENGER_HREF,
  PHONE_DISPLAY,
  PHONE_HREF,
  WHATSAPP_HREF,
} from "./business";
import { track } from "@/components/providers/analytics";

export interface MobileActionBarProps {
  className?: string;
}

/** Fired by the booking flow on success so the bar gets out of the way. */
export const HIDE_ACTION_BAR_EVENT = "eyg:booking-complete";

/**
 * The persistent floating bar for phones: 📞 Call Shop Now + 💬 Message.
 *
 * Hard rule from the brief — a phone number must be within one thumb-reach on
 * every mobile viewport, always. This is that surface.
 *
 *  • `fixed`, below `md` only. It does not exist on desktop.
 *  • Height is `var(--mobile-action-bar-height)` + `env(safe-area-inset-bottom)`.
 *  • `z-index: var(--z-mobile-bar)`.
 *  • Slides away while scrolling DOWN, returns on scroll UP and as soon as the
 *    user stops — so it never covers the thing they are reading.
 *  • Auto-hides for the rest of the session after a successful booking.
 *  • Never covers an in-progress form: any focused input/textarea/select inside
 *    a form keeps the bar hidden.
 *  • The slide is a transform transition, neutralised by the global
 *    `prefers-reduced-motion` rule.
 *
 * "Message" opens a small sheet with BOTH Messenger and WhatsApp, because
 * Messenger has no universal deep link — one destination per platform, chosen
 * by the person holding the phone.
 */
export function MobileActionBar({ className }: MobileActionBarProps): React.ReactElement {
  const [visible, setVisible] = React.useState(true);
  const [formFocused, setFormFocused] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // Hide after a successful booking.
  React.useEffect(() => {
    const hide = () => setVisible(false);
    window.addEventListener(HIDE_ACTION_BAR_EVENT, hide);
    return () => window.removeEventListener(HIDE_ACTION_BAR_EVENT, hide);
  }, []);

  // Hide while a form control has focus.
  React.useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("form")) setFormFocused(true);
    };
    const onFocusOut = (event: FocusEvent) => {
      const target = event.relatedTarget;
      const stillInForm =
        target instanceof HTMLElement && target.closest("form") !== null;
      if (!stillInForm) setFormFocused(false);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // Directional scroll behaviour with a settle timer.
  React.useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    let settle = 0;

    const settleUp = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => setVisible(true), 120);
    };

    const read = () => {
      ticking = false;
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      // Ignore rubber-band and sub-pixel noise.
      if (Math.abs(delta) < 6) return;
      if (delta > 0) {
        setVisible(false);
        window.clearTimeout(settle);
      } else {
        setVisible(true);
        settleUp();
      }
      lastY = y;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(read);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(settle);
      ticking = false;
    };
  }, []);

  const hidden = !visible || formFocused;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-[var(--z-mobile-bar)] md:hidden",
        "pb-[env(safe-area-inset-bottom,0px)] transition-transform duration-300 ease-snap",
        hidden ? "translate-y-full" : "translate-y-0",
        className,
      )}
    >
      <div
        role="region"
        aria-label="Quick actions"
        className="flex h-[var(--mobile-action-bar-height)] items-center gap-2 border-t border-border-strong bg-ink-950/95 px-3 shadow-lift backdrop-blur-md"
      >
        {PHONE_HREF ? (
          <Button
            asChild
            variant="accent"
            size="lg"
            className="flex-1"
            fullWidth={false}
          >
            <a
              href={PHONE_HREF}
              onClick={() => track("call_clicked", { placement: "mobile_action_bar" })}
              aria-label={`Call shop now, ${PHONE_DISPLAY}`}
            >
              <Phone aria-hidden="true" className="size-5" />
              Call Shop Now
            </a>
          </Button>
        ) : (
          <span
            data-unverified="true"
            className="eyg-eyebrow flex min-h-12 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-eyebrow border border-white/25 text-white/60"
          >
            <TriangleAlert aria-hidden="true" className="size-5" />
            Number being confirmed
          </span>
        )}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="lg" className="flex-1 border-white/40 text-white hover:border-white hover:bg-white/10" aria-label="Message us on Messenger or WhatsApp">
              <MessageCircle aria-hidden="true" className="size-5" />
              Message
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            title="Message EYG Tire &amp; Auto Care"
            description="Pick the app you already have open. We usually reply the same day."
          >
            <ul className="flex flex-col gap-3">
              <li>
                {WHATSAPP_HREF ? (
                  <Button asChild variant="accent" size="lg" fullWidth>
                    <a
                      href={WHATSAPP_HREF}
                      onClick={() => track("whatsapp_clicked", { placement: "mobile_action_bar_sheet" })}
                    >
                      <MessageCircle aria-hidden="true" className="size-5" />
                      Message on WhatsApp
                    </a>
                  </Button>
                ) : null}
              </li>
              <li>
                <Button asChild variant="outline" size="lg" fullWidth>
                  <a
                    href={MESSENGER_HREF}
                    onClick={() => track("messenger_clicked", { placement: "mobile_action_bar_sheet" })}
                  >
                    <MessageCircle aria-hidden="true" className="size-5" />
                    Message on Messenger
                  </a>
                </Button>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/people/EYG-Tire-Auto-Care/61582418828014/"
                  className="text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Or comment on our Facebook page
                </a>
              </li>
              {!PHONE_HREF ? (
                <li className="rounded-card border border-brand-600 bg-ink-900 p-3 text-sm text-brand-300">
                  {CONTACT_PENDING_NOTE}
                </li>
              ) : null}
            </ul>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
