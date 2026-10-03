"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

/**
 * Accessible theme switcher: a real radio group, so arrow keys work and the
 * current choice is always announced. Rendered as a segmented control.
 */
export function ThemeToggle({ className }: { className?: string }): React.ReactElement {
  const { theme, setTheme, resolvedTheme } = useTheme();
  // `next-themes` cannot know the server-rendered theme, so the control renders
  // a stable placeholder until it has mounted. This also keeps the footer's
  // height from changing on hydration.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const active = mounted ? (theme ?? "system") : "dark";

  return (
    <fieldset className={cn("min-w-0 border-0 p-0", className)}>
      <legend className="eyg-eyebrow mb-2 text-muted-foreground">Colour theme</legend>
      <div className="flex gap-1 rounded-pill border border-border bg-surface p-1">
        {OPTIONS.map(({ value, label, Icon }) => {
          const selected = active === value;
          return (
            <label
              key={value}
              className={cn(
                "flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-pill px-2 text-eyebrow transition-colors",
                selected
                  ? "bg-ink-950 text-white"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={selected}
                onChange={() => setTheme(value)}
                className="sr-only"
              />
              <Icon aria-hidden="true" className="size-4" />
              <span className={cn(selected && "font-bold")}>{label}</span>
              {selected ? <span className="sr-only">(current theme)</span> : null}
            </label>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {mounted && resolvedTheme
          ? `${resolvedTheme === "dark" ? "Dark" : "Light"} theme is active.`
          : "Theme is loading."}
      </p>
    </fieldset>
  );
}
