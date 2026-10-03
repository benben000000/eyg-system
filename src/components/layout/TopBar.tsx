"use client";

import * as React from "react";
import { MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADDRESS_SHORT, PHONE_DISPLAY, PHONE_HREF } from "./business";
import { OpenStatusPill } from "./OpenStatusPill";
import type { OpenStatus } from "./hours";
import { track } from "@/components/providers/analytics";

/** Distance scrolled before the mobile strip collapses out of the way. */
const COLLAPSE_AFTER = 80;

export interface TopBarProps {
  /**
   * Open/closed status computed on the server. Required: the first client render
   * has to match the server HTML or hydration breaks.
   */
  status: OpenStatus;
  className?: string;
}

/**
 * The thin strip above the header: live status + address + tap-to-call.
 *
 * On mobile it collapses as soon as the user scrolls down, because on a phone
 * the persistent action bar at the bottom already carries the phone number and
 * vertical space is the scarcest thing on the page. rAF-throttled, passive
 * listener, one state write per frame at most.
 */
export function TopBar({ status, className }: TopBarProps): React.ReactElement {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    let ticking = false;
    const read = () => {
      ticking = false;
      const next = window.scrollY > COLLAPSE_AFTER;
      setCollapsed((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "border-b border-ink-800 bg-ink-950 text-white",
        "max-h-12 overflow-hidden transition-[max-height] duration-200 ease-snap md:max-h-none",
        collapsed ? "max-h-0 border-b-0" : "max-h-12",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-page items-center justify-between gap-4 px-4 py-2 sm:px-6 md:py-2 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <OpenStatusPill initial={status} variant="soft" />
          <p className="hidden min-w-0 items-center gap-1.5 truncate text-sm text-ink-200 sm:flex">
            <MapPin aria-hidden="true" className="size-4 shrink-0 text-brand-500" />
            <span className="truncate">{ADDRESS_SHORT}</span>
          </p>
        </div>

        {PHONE_HREF ? (
          <a
            href={PHONE_HREF}
            onClick={() => track("call_clicked", { placement: "top_bar" })}
            className="eyg-eyebrow inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-eyebrow px-1 py-1 text-brand-500 underline decoration-transparent underline-offset-4 transition-colors hover:decoration-brand-500"
          >
            <Phone aria-hidden="true" className="size-4" />
            <span className="sr-only">Call the shop: </span>
            <span className="hidden md:inline">{PHONE_DISPLAY}</span>
            <span className="md:hidden">Call</span>
          </a>
        ) : (
          <span className="eyg-eyebrow shrink-0 text-ink-300" data-unverified="true">
            Number being confirmed
          </span>
        )}
      </div>
    </div>
  );
}
