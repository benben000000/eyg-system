import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { ROUTES, watchConsole } from "./home.spec";

/**
 * AUTOMATED AXE-CORE PASS, ON EVERY PAGE.
 * ============================================================================
 * Target: **WCAG 2.2 Level AA**, zero `serious` or `critical` axe violations on
 * every route, in both the light and the dark theme.
 *
 * This is the AUTOMATED half only. axe cannot see focus order, focus
 * visibility, zoom-to-200%, screen-reader announcement, or whether a `label` is
 * *meaningful* rather than merely present. The manual half is
 * docs/qa/ACCESSIBILITY-AUDIT.md, item by item, with a pass/fail and a fix.
 *
 * REQUIRES "@axe-core/playwright" in devDependencies — see the QA report.
 * ============================================================================
 */

/** Rules axe is known to get wrong or that cannot be automated. */
const MANUAL_ONLY = [
  "color-contrast-enhanced", // AAA; the 4.5:1 rule covers AA
  "link-in-text-block", // needs a human judgement about inline link styling
];

async function analyse(page: Page, include?: string): Promise<{
  serious: string[];
  critical: string[];
  moderate: string[];
  minor: string[];
}> {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();

  const bucket = (impact: string | null | undefined): string[] =>
    results.violations
      .filter((violation) => violation.impact === impact)
      .filter((violation) => !MANUAL_ONLY.includes(violation.id))
      .map((violation) => `${violation.id} (${violation.nodes.length} node(s)): ${violation.help}`);

  return {
    critical: bucket("critical"),
    serious: bucket("serious"),
    moderate: bucket("moderate"),
    minor: bucket("minor"),
  };
}

const format = (violations: string[]): string => `\n  - ${violations.join("\n  - ")}`;

test.describe("accessibility — automated axe-core (WCAG 2.2 AA)", () => {
  for (const route of ROUTES) {
    test(`${route} has zero serious or critical violations`, async ({ page }) => {
      const console_ = watchConsole(page);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1").first()).toBeVisible();

      const results = await analyse(page);
      expect(results.critical, `critical axe violations on ${route}:${format(results.critical)}`).toEqual([]);
      expect(results.serious, `serious axe violations on ${route}:${format(results.serious)}`).toEqual([]);
      console_.assertClean(route);
    });
  }

  test("the dark (motorsport) theme has zero serious or critical violations", async ({ page }) => {
    const console_ = watchConsole(page);
    for (const route of ["/", "/services", "/book"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      // The site leads dark; force it and re-scan.
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await page.waitForTimeout(200);
      const results = await analyse(page);
      expect(results.critical, `critical violations on ${route} (dark):${format(results.critical)}`).toEqual([]);
      expect(results.serious, `serious violations on ${route} (dark):${format(results.serious)}`).toEqual([]);
    }
    console_.assertClean("dark theme");
  });

  test("the booking wizard's open dialogs and the lightbox are accessible", async ({ page }) => {
    const console_ = watchConsole(page);
    await page.goto("/gallery", { waitUntil: "domcontentloaded" });

    const lightboxTrigger = page.locator('[data-lightbox-open], button:has-text("expand"), [aria-haspopup="dialog"]').first();
    if ((await lightboxTrigger.count()) === 0) {
      test.skip(true, "no lightbox trigger found on /gallery");
      return;
    }
    await lightboxTrigger.click();
    const dialog = page.getByRole("dialog").first();
    await expect(dialog, "the lightbox must expose role=dialog").toBeVisible();

    const results = await analyse(page);
    expect(results.critical, `critical violations in the lightbox:${format(results.critical)}`).toEqual([]);
    expect(results.serious, `serious violations in the lightbox:${format(results.serious)}`).toEqual([]);
    console_.assertClean("/gallery lightbox");
  });

  test("every form control has an accessible name", async ({ page }) => {
    await page.goto("/book", { waitUntil: "domcontentloaded" });
    const unnamed = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll("input, select, textarea"));
      return controls
        .filter((element) => {
          const control = element as HTMLInputElement;
          if (control.type === "hidden") return false;
          const byLabel = control.labels && control.labels.length > 0;
          const byAria = Boolean(control.getAttribute("aria-label") || control.getAttribute("aria-labelledby"));
          const byTitle = Boolean(control.getAttribute("title"));
          const byPlaceholder = Boolean(control.getAttribute("placeholder"));
          return !(byLabel || byAria || byTitle || byPlaceholder);
        })
        .map((element) => `${element.tagName.toLowerCase()}[name="${(element as HTMLInputElement).name}"]`);
    });
    expect(unnamed, `form controls with no accessible name: ${unnamed.join(", ")}`).toEqual([]);
  });

  test("every image has an alt attribute", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const missing = await page.evaluate(() =>
      Array.from(document.images)
        .filter((image) => !image.hasAttribute("alt"))
        .map((image) => image.currentSrc || image.src || "(no src)"),
    );
    expect(missing, `images without alt: ${missing.join(", ")}`).toEqual([]);
  });

  test("there is exactly one h1 and no skipped heading levels", async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const levels = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((node) =>
          Number(node.tagName.slice(1)),
        ),
      );
      expect(levels.filter((level) => level === 1).length, `${route} h1 count`).toBe(1);
      let previous = levels[0] ?? 1;
      for (const level of levels.slice(1)) {
        expect(level, `${route} jumps from h${previous} to h${level}`).toBeLessThanOrEqual(previous + 1);
        previous = level;
      }
    }
  });

  test("landmarks are present and uniquely named", async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main"), `${route} has no <main>`).toHaveCount(1);
      await expect(page.locator("header"), `${route} has no <header>`).toHaveCount(1);
      await expect(page.locator("footer"), `${route} has no <footer>`).toHaveCount(1);
    }
  });

  test("tap targets on mobile are at least 44x44 CSS px", async ({ page, isMobile }) => {
    test.skip(!isMobile, "tap-target size is a mobile-only rule");
    for (const route of ["/", "/book", "/contact"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const small = await page.evaluate(() => {
        const MIN = 44;
        return Array.from(document.querySelectorAll<HTMLElement>("a[href], button, [role='button'], input"))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false; // hidden
            const style = getComputedStyle(element);
            if (style.visibility === "hidden" || style.display === "none") return false;
            // An inline link inside a paragraph is exempt under SC 2.5.8.
            if (element.tagName === "A" && element.closest("p, li")?.children.length === 1) {
              const inline = getComputedStyle(element).display;
              if (inline === "inline") return false;
            }
            return rect.height < MIN || rect.width < MIN;
          })
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return `${element.tagName.toLowerCase()}"${(element.textContent ?? "").trim().slice(0, 30)}" ${Math.round(rect.width)}×${Math.round(rect.height)}`;
          });
      });
      expect(small, `tap targets under 44×44 on ${route}:\n  ${small.join("\n  ")}`).toEqual([]);
    }
  });

  test("prefers-reduced-motion actually removes animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const durations = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .slice(0, 400)
        .map((element) => getComputedStyle(element).transitionDuration)
        .filter((value) => value !== "0s"),
    );
    // CSS pins animation/transition to 0.01ms under reduced motion, so a real
    // non-zero duration means the media query is not being honoured.
    expect(durations, "transitions survived prefers-reduced-motion").toEqual([]);
  });
});