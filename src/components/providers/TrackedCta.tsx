"use client";

import * as React from "react";
import Link from "next/link";
import { LinkButton, type ButtonProps } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { track, type AnalyticsEvent } from "./analytics";

type Variant = NonNullable<ButtonProps["variant"]>;
type Size = NonNullable<ButtonProps["size"]>;

export interface TrackedCtaProps {
  href: string;
  /** The funnel event fired on click. */
  event: AnalyticsEvent;
  params?: Record<string, string | number | boolean | undefined>;
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** Force `target="_blank"`. Defaults to true for `http(s)` only. */
  external?: boolean;
  /**
   * Render an unstyled `<a>` / `next/link` that still tracks. Use this when the
   * call site is inside a heading, a card title, or a marquee where the
   * button chrome would be wrong.
   */
  unstyled?: boolean;
}

/**
 * A CTA that fires a funnel event.
 *
 * WHY THIS EXISTS: a Server Component cannot render an element with an
 * `onClick` prop — React rejects function props crossing the server/client
 * boundary, and the same rule applies to `next/link` (a client component). Any
 * server-rendered call to action that needs tracking therefore has to hand the
 * handler to a client leaf. This is that leaf: every prop it takes is
 * serialisable, so a Server Component can render it directly.
 *
 * The tracking is a no-op unless `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set in a
 * production build, so nothing fires on a dev machine.
 */
export function TrackedCta({
  href,
  event,
  params,
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  leadingIcon,
  trailingIcon,
  external,
  unstyled = false,
}: TrackedCtaProps): React.ReactElement {
  const handleClick = () => track(event, params);
  const openInNewTab = external ?? /^(https?:)?\/\//i.test(href);

  if (unstyled) {
    const shared = {
      className: cn(className),
      onClick: handleClick,
    };
    const inner = (
      <>
        {leadingIcon}
        {children}
        {trailingIcon}
      </>
    );
    return openInNewTab ? (
      <a href={href} {...shared} target="_blank" rel="noopener noreferrer">
        {inner}
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    ) : (
      <Link href={href} {...shared}>
        {inner}
      </Link>
    );
  }

  return (
    <LinkButton
      href={href}
      onClick={handleClick}
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      className={className}
      leadingIcon={leadingIcon}
      trailingIcon={trailingIcon}
      external={external}
    >
      {children}
    </LinkButton>
  );
}

export default TrackedCta;
