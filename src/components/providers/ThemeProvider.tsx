"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

/**
 * next-themes wrapper.
 *
 * The site leads dark (the mark is yellow on black) but light mode is fully
 * supported — a bright garage at 1pm is a real use case.
 *
 * `nonce` is forwarded so the library's own pre-paint script is allowed by the
 * CSP built in `middleware.ts`. The layout ALSO ships its own blocking head
 * script with the same nonce, so the theme is correct even before this
 * hydrates.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps): React.ReactElement {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
