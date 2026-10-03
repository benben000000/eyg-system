import { expect, test } from "@playwright/test";

import { ROUTES, expectReachablePhone, goto, scrollToBottom, watchConsole } from "./home.spec";

/**
 * NAVIGATION, CTAs, ERROR STATES AND THE MOBILE ACTION BAR.
 * ============================================================================
 * The conversion ladder in `docs/AGENT-BRIEF.md` §4 is the whole business:
 *
 *   LANE A EMERGENCY  tap-to-call / WhatsApp → human answers → done
 *   LANE B PLANNED    instant quote → pick slot → book → SMS confirm
 *   LANE C RE-ENGAGE  a promo → claim → routed to /book with the promo applied
 *
 * A nav link that 404s, a CTA that goes nowhere, a `/deals` page that does not
 * carry its code into `/book`, or a missing mobile action bar each break one of
 * those lanes. This file walks all of them.
 * ============================================================================
 */

test.describe("navigation and CTAs", () => {
  test("every nav link resolves with a 200 and no console errors", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/");

    const links = await page.locator("header a[href], nav a[href]").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href") ?? ""),
    );
    expect(links.length, "no navigation links found").toBeGreaterThan(3);

    const internal = [...new Set(links.filter((href) => href.startsWith("/") && !href.startsWith("//")))];
    for (const href of internal) {
      const response = await page.request.get(href);
      expect(response.status(), `${href} returned ${response.status()}`).toBe(200);
    }

    for (const route of ROUTES) {
      console_.assertClean(route);
    }
  });

  test("every page returns 200 with exactly one h1", async ({ page }) => {
    for (const route of ROUTES) {
      const console_ = watchConsole(page);
      await goto(page, route);
      await expect(page.locator("h1"), `${route} h1 count`).toHaveCount(1);
      console_.assertClean(route);
    }
  });

  test("a bad URL renders the 404 page, not a stack trace", async ({ page }) => {
    const console_ = watchConsole(page);
    const response = await page.goto("/this-page-does-not-exist-eyg-qa", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(404);
    await expect(page.locator("h1").first()).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/Application error|at Object\.|NODE_ENV|\.tsx?:\d+:\d+/);
    // The 404 must still offer the phone: a lost customer on a 404 is a lost
    // customer.
    await expectReachablePhone(page);
    console_.assertClean("404");
  });

  test("the primary CTA reaches /book", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/");
    const cta = page
      .getByRole("link", { name: /book a bay|book now|book (your )?(appointment|service)|reserve/i })
      .first();
    await expect(cta, "no primary 'book' CTA on the homepage").toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/book/);
    await expect(page.locator("h1").first()).toBeVisible();
    console_.assertClean("/ → /book");
  });

  test("the /deals page carries a promo code into /book (LANE C)", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/deals");
    const claim = page.getByRole("link", { name: /claim|book|book now|use (this|code)/i }).first();
    await expect(claim, "no claim CTA on /deals").toBeVisible();
    const href = await claim.getAttribute("href");
    if (href && href.startsWith("/book")) {
      expect(href, "a promo must travel into /book as a query param").toMatch(/[?&]promo=[A-Z0-9]+/i);
    } else {
      await claim.click();
      await expect(page).toHaveURL(/\/book/);
      expect(page.url(), "the promo code must survive the handoff").toMatch(/[?&]promo=/i);
    }
    console_.assertClean("/deals → /book");
  });

  test("the mobile action bar is visible on mobile and absent on desktop", async ({ page, isMobile }) => {
    const console_ = watchConsole(page);
    await goto(page, "/");

    const bar = page
      .getByTestId("mobile-action-bar")
      .or(page.locator('nav[aria-label*="mobile" i], [data-mobile-bar]'))
      .first();

    if (isMobile) {
      await expect(bar, "the mobile action bar must exist on a phone").toBeVisible();
      // And it must be thumb-reachable: within the bottom 30% of the viewport.
      const box = await bar.boundingBox();
      const viewport = page.viewportSize();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height, "the action bar must sit at the bottom of the screen").toBeGreaterThan(
        viewport!.height * 0.7,
      );
      // Both lanes must be reachable from it.
      await expect(bar.locator('a[href^="tel:"]')).toHaveCount(1);
      await expect(bar.getByRole("link", { name: /book/i }).first()).toBeVisible();
    } else {
      await expect(bar, "the mobile action bar must NOT render on desktop").toHaveCount(0);
      // …but the phone must still be reachable in the header/footer.
      await scrollToBottom(page);
      await expectReachablePhone(page);
    }
    console_.assertClean("/ action bar");
  });

  test("no external link opens without rel=noopener", async ({ page }) => {
    await goto(page, "/");
    const offenders = await page.locator('a[target="_blank"]').evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const rel = (node as HTMLAnchorElement).getAttribute("rel") ?? "";
          return !/\bnoopener\b/.test(rel);
        })
        .map((node) => (node as HTMLAnchorElement).getAttribute("href") ?? ""),
    );
    expect(offenders, `target=_blank without rel=noopener: ${offenders.join(", ")}`).toEqual([]);
  });

  test("the skip link is the first thing in the tab order", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/");
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return { text: (active?.textContent ?? "").trim(), href: active?.getAttribute("href") ?? "" };
    });
    expect(first.text, "the first Tab must land on the skip link").toMatch(/skip/i);
    console_.assertClean("/ skip link");
  });

  test("a 200-level maintenance page is not accidentally shown", async ({ page }) => {
    const console_ = watchConsole(page);
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByText(/maintenance|we are closed for maintenance/i)).toHaveCount(0);
    console_.assertClean("/ maintenance");
  });
});