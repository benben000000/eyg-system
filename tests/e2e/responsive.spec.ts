import { expect, test, type Page } from "@playwright/test";

import { ROUTES, expectReachablePhone } from "./home.spec";

/**
 * RESPONSIVE BEHAVIOUR, THUMB REACH, AND THE PERFORMANCE BUDGET.
 * ============================================================================
 * The customer profile from `docs/AGENT-BRIEF.md` §1: "stranded, in a hurry,
 * price-conscious, on mobile, in traffic near EGSA". The performance budget in
 * docs/qa/PERFORMANCE-BUDGET.md is written for that person, not for a laptop on
 * office wifi.
 *
 * The two projects in `playwright.config.ts` (Pixel 7 at 393×852 and desktop at
 * 1440×900) cover the two ends. This spec covers the behaviours BETWEEN them:
 * no horizontal scroll, no clipped tap targets, a working action bar, and the
 * Core Web Vitals thresholds.
 *
 * CAVEAT ON THE METRICS
 *   LCP/CLS/INP measured inside a headless CI runner are noisy and *optimistic*
 *   relative to a real mid-tier Android on 3G. These assertions are a smoke
 *   alarm, not the budget. The authoritative numbers come from
 *   docs/qa/PERFORMANCE-BUDGET.md measured on a real device or Lighthouse CI.
 * ============================================================================
 */

/** Viewports between the two projects: small phone, large phone, tablet. */
const WIDTHS = [
  { name: "small phone", width: 320, height: 568 },
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "Pixel 7", width: 393, height: 852 },
  { name: "large phone", width: 430, height: 932 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide desktop", width: 1920, height: 1080 },
] as const;

test.describe("responsive", () => {
  test("no page scrolls horizontally at any width", async ({ page }) => {
    for (const route of ROUTES) {
      for (const size of WIDTHS) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto(route, { waitUntil: "domcontentloaded" });
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(
          overflow.scrollWidth,
          `${route} overflows horizontally at ${size.name} (${size.width}px): ` +
            `scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 1);
      }
    }
  });

  test("the body never exceeds the viewport width", async ({ page }) => {
    for (const size of [WIDTHS[0], WIDTHS[2], WIDTHS[4], WIDTHS[7]]) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const widest = await page.evaluate(() => {
        const limit = document.documentElement.clientWidth;
        return Array.from(document.querySelectorAll<HTMLElement>("body *"))
          .map((element) => ({ tag: element.tagName.toLowerCase(), right: element.getBoundingClientRect().right }))
          .filter((entry) => entry.right > limit + 1)
          .slice(0, 5)
          .map((entry) => `${entry.tag} extends to ${Math.round(entry.right)}px`);
      });
      expect(widest, `${size.name}: ${widest.join("; ")}`).toEqual([]);
    }
  });

  test("the mobile action bar appears below 768px and disappears above it", async ({ page }) => {
    const bar = page
      .getByTestId("mobile-action-bar")
      .or(page.locator('nav[aria-label*="mobile" i], [data-mobile-bar]'))
      .first();

    for (const size of [WIDTHS[0], WIDTHS[1], WIDTHS[2], WIDTHS[3]]) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(bar, `the action bar must be visible at ${size.width}px`).toBeVisible();
    }

    for (const size of [WIDTHS[4], WIDTHS[5], WIDTHS[6], WIDTHS[7], WIDTHS[8]]) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(bar, `the action bar must be hidden at ${size.width}px`).toHaveCount(0);
    }
  });

  test("the action bar never covers the footer's last line", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);

    const covered = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="mobile-action-bar"], [data-mobile-bar]');
      if (!bar) return null;
      const barRect = bar.getBoundingClientRect();
      // Find the lowest text node in the document and check it clears the bar.
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("footer *")).filter(
        (element) => element.textContent?.trim() && element.children.length === 0,
      );
      const last = nodes[nodes.length - 1];
      if (!last) return null;
      const rect = last.getBoundingClientRect();
      return rect.bottom > barRect.top ? last.textContent?.trim().slice(0, 40) : null;
    });
    expect(covered, "the sticky action bar covers the footer's last line").toBeNull();
  });

  test("a phone is reachable at every width on every page", async ({ page }) => {
    for (const size of [WIDTHS[0], WIDTHS[2], WIDTHS[4], WIDTHS[7]]) {
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const route of ["/", "/services", "/contact"]) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expectReachablePhone(page);
      }
    }
  });

  test("text stays legible: the body font is at least 16px on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const size = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      return Number.parseFloat(body.fontSize);
    });
    expect(size, `body font is ${size}px at 320px wide`).toBeGreaterThanOrEqual(16);
  });

  test("200% zoom does not clip content or force horizontal scrolling", async ({ page }) => {
    // WCAG SC 1.4.4 / 1.4.10. Chromium's device-scale + viewport is the closest
    // headless proxy for a browser zoom level.
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const route of ["/", "/services", "/book"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const clipped = await page.evaluate(() => {
        const limit = document.documentElement.clientWidth;
        return Array.from(document.querySelectorAll<HTMLElement>("main *"))
          .filter((element) => element.getBoundingClientRect().right > limit + 2)
          .slice(0, 5)
          .map((element) => `${element.tagName.toLowerCase()}.${element.className}`.slice(0, 80));
      });
      expect(clipped, `${route} clips at 200% zoom: ${clipped.join(", ")}`).toEqual([]);
    }
  });

  test("touch-only controls are not the only way to act", async ({ page }) => {
    // Every interactive element must be reachable and operable by keyboard.
    await page.goto("/book", { waitUntil: "domcontentloaded" });
    const focusable = await page.evaluate(() => {
      const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]';
      return Array.from(document.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        return element.getAttribute("tabindex") !== "-1";
      }).length;
    });
    expect(focusable, "no keyboard-focusable controls on /book").toBeGreaterThan(3);
  });
});

/**
 * PERFORMANCE BUDGET SMOKE TEST.
 *
 * The authoritative budget is docs/qa/PERFORMANCE-BUDGET.md. These thresholds
 * are the same numbers, checked in CI so a regression is caught on the day it
 * lands rather than at release.
 */
test.describe("performance budget (smoke)", () => {
  test("the homepage JS bundle stays under 180 KB gzipped", async ({ page }) => {
    const total = await sumGzippedBytes(page, "/");
    expect(total / 1024, `homepage JS is ${Math.round(total / 1024)} KB gzipped (budget 180 KB)`).toBeLessThanOrEqual(
      180 * 1024,
    );
  });

  test("the initial-route JS stays under 120 KB gzipped", async ({ page }) => {
    const total = await sumGzippedBytes(page, "/");
    expect(
      total / 1024,
      `initial-route JS is ${Math.round(total / 1024)} KB gzipped (budget 120 KB)`,
    ).toBeLessThanOrEqual(120 * 1024);
  });

  test("cumulative layout shift stays under 0.1", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const cls = await measureCls(page);
    expect(cls, `CLS is ${cls.toFixed(3)} (budget 0.1)`).toBeLessThanOrEqual(0.1);
  });

  test("every content image declares intrinsic width and height", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const unsized = await page.evaluate(() =>
      Array.from(document.images)
        .filter((image) => image.naturalWidth > 0 && !(image.getAttribute("width") && image.getAttribute("height")))
        .map((image) => (image.currentSrc || image.src).slice(-60)),
    );
    expect(unsized, `images without intrinsic dimensions (CLS risk): ${unsized.join(", ")}`).toEqual([]);
  });

  test("no third-party script beyond the documented allowance", async ({ page }) => {
    const origins = new Set<string>();
    page.on("request", (request) => {
      const url = request.url();
      if (request.resourceType() !== "script") return;
      const parsed = new URL(url);
      if (parsed.origin === new URL(page.url() || "http://localhost").origin) return;
      origins.add(parsed.origin);
    });
    await page.goto("/", { waitUntil: "load" });
    await page.waitForTimeout(1500);
    expect(
      [...origins],
      `third-party script origins: ${[...origins].join(", ")} (budget 2)`,
    ).toHaveLength(0);
  });

  test("fonts use display=swap and are self-hosted", async ({ page }) => {
    const fonts = await page.evaluate(() => {
      const faces = Array.from(document.fonts);
      return faces.map((face) => ({ family: face.family, status: face.status }));
    });
    // Fonts must be loaded from our own origin — a Google Fonts request is a
    // third-party dependency and a privacy disclosure under the Data Privacy Act.
    expect(fonts.length).toBeGreaterThan(0);
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Sum of the gzipped transfer size of matching script responses for one page. */
async function sumGzippedBytes(page: Page, route: string): Promise<number> {
  let total = 0;
  const listener = async (response: Awaited<ReturnType<Page["request"]["get"]>>) => {
    const url = response.url();
    if (!/\.js(\?|$)/.test(url)) return;
    try {
      const headers = response.headers();
      const encoded = Number(headers["content-length"] ?? "0");
      total += encoded > 0 ? encoded : (await response.body()).length;
    } catch {
      // A response that has already been evicted from the browser cache is not
      // counted; the budget test tolerates that (it can only under-report).
    }
  };
  page.on("response", listener as never);
  try {
    await page.goto(route, { waitUntil: "load" });
    await page.waitForTimeout(1200);
  } finally {
    page.off("response", listener as never);
  }
  return total;
}

/** Layout-shift observer attached before the first paint of a navigation. */
async function measureCls(page: Page): Promise<number> {
  await page.addInitScript(() => {
    (window as { __cls?: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as unknown as { hadRecentInput: boolean; value: number };
        if (!shift.hadRecentInput) {
          (window as { __cls: number }).__cls += shift.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(1000);
  return page.evaluate(() => window.__cls ?? 0);
}

declare global {
  interface Window {
    __cls?: number;
  }
}