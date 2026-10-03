"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider } from "./ToastProvider";
import { AnalyticsProvider } from "./AnalyticsProvider";
import { TooltipProvider } from "@/components/ui/Tooltip";

/**
 * The single client boundary for the whole app.
 *
 * Everything else in the tree stays a Server Component. Keep it that way —
 * every leaf added here is JavaScript every Balanga commuter on 3G downloads.
 */
export function Providers({
  children,
  nonce,
}: {
  children: ReactNode;
  nonce?: string;
}): React.ReactElement {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem
      enableColorScheme
      storageKey="theme"
      nonce={nonce}
    >
      <ToastProvider>
        <TooltipProvider>
          {children}
          <AnalyticsProvider nonce={nonce} />
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
