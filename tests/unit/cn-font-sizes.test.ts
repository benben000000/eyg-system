// @vitest-environment node
/**
 * QA & SECURITY AGENT — `cn()` must not delete colours.
 * ============================================================================
 * The bug this exists to prevent:
 *
 *     cn("bg-brand-500 text-ink-950 px-3 py-1 text-eyebrow")
 *
 * used to produce
 *
 *     "bg-brand-500 px-3 py-1 text-eyebrow"
 *
 * with `text-ink-950` gone. tailwind-merge classifies `text-eyebrow` as a text
 * COLOUR, because it is not one of Tailwind's own size keywords, so both landed in
 * the same group and the later one won.
 *
 * The visible result was not a missing class in a diff. `text-eyebrow` sets no
 * colour, so the element inherited `--color-foreground` — white, because the site
 * leads dark. On the brand yellow of a services badge that is 1.59:1. Lighthouse
 * reported it as `color-contrast` on /services, three elements, and the component
 * looked correct in the source.
 *
 * Two things are asserted here, and the second is the one that matters:
 *
 *   1. the sizes this project defines are treated as sizes, and
 *   2. the list `cn()` knows about is COMPLETE against `globals.css`.
 *
 * Without (2) the failure is silent and permanent: someone adds `--text-caption`
 * to the theme, it starts colliding with colours, and nothing reports it.
 * ============================================================================
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));

/** Every `--text-<name>:` declared in the theme, from the source of truth. */
function themeTextSizes(): string[] {
  const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
  const names = new Set<string>();
  for (const m of css.matchAll(/--text-([a-z0-9-]+)\s*:/g)) {
    // `noUncheckedIndexedAccess` makes the capture group `string | undefined`, and
    // the group is not optional in this pattern — but saying so with `!` would be
    // asserting something the compiler cannot check.
    const name = m[1];
    if (name !== undefined) names.add(name);
  }
  // `--text-eyebrow--line-height` and friends are modifiers on the size itself, not
  // separate sizes. The regex captures them as `eyebrow--line-height`, so they are
  // dropped by the double hyphen rather than by a lookup that would have to know
  // every modifier name.
  return [...names].filter((n) => !n.includes("--")).sort();
}

describe("cn() and this project's custom font sizes", () => {
  const sizes = themeTextSizes();

  it("finds the sizes in the theme at all (guards the parser, not the code)", () => {
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes).toContain("eyebrow");
  });

  it.each(sizes)("treats text-%s as a font size, so it cannot delete a colour", (size: string) => {
    const out = cn(`text-ink-950`, `text-${size}`);
    expect(out, `cn('text-ink-950','text-${size}') dropped the colour`).toContain("text-ink-950");
    expect(out).toContain(`text-${size}`);
  });

  it("still drops a real colour when two colours collide, which is its job", () => {
    // The behaviour cn() exists for: last one wins, among things of the same kind.
    expect(cn("text-ink-950", "text-brand-900")).toBe("text-brand-900");
  });

  it("keeps a size and a colour together, which is the combination that broke", () => {
    const out = cn(
      "inline-flex items-center rounded-eyebrow border font-bold uppercase",
      "border-brand-500 bg-brand-500 text-ink-950",
      "px-3 py-1 text-eyebrow",
    );
    expect(out).toContain("text-ink-950");
    expect(out).toContain("text-eyebrow");
    expect(out).toContain("bg-brand-500");
  });

  it("lets a caller's colour override the component default, on a sized element", () => {
    // `cn(badgeVariants(...), className)` is how every component in this project
    // composes. The override must still work once the size is recognised.
    const component = cn("bg-brand-500 text-ink-950 px-2 py-0.5 text-eyebrow");
    const overridden = cn(component, "text-racing-100");
    expect(overridden).toContain("text-racing-100");
    expect(overridden).not.toContain("text-ink-950");
    expect(overridden).toContain("text-eyebrow");
  });
});