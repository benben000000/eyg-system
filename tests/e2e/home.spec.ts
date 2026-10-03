import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

/**
 * Shared E2E helpers.
 *
 * WHY THEY LIVE HERE AND NOT IN `tests/e2e/helpers.ts`: the QA brief allows the
 * agent to create only a fixed list of files, so the helper set is exported from
 * this spec and imported by the others. Playwright treats a `.spec.ts` file as a
 * module with a side effect of registering its own tests; importing the
 * *helpers* from it is safe because `test()` calls are only made inside the
 * `test.describe` blocks in this file.
 */

/** Collects console errors and unhandled rejections for the life of a page. */
export interface ConsoleWatcher {
  errors: string[];
  pageErrors: string[];
  /** Assert nothing was collected. Called at the end of every test. */
  assertClean(context: string): void;
}

/**
 * Starts collecting console noise. Every spec MUST call `assertClean` before it
 * ends: `docs/AGENT-BRIEF.md` §5 lists "unhandled promise rejections" and
 * "console noise in prod" as hard "never"s, and an uncaught rejection in a
 * Server Component boundary stays invisible until a customer hits that route.
 */
export function watchConsole(page: Page): ConsoleWatcher {
  const errors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message: ConsoleMessage) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // A missing favicon or a blocked third-party pixel is noise, not a defect.
    if (/favicon|ERR_INTERNET_DISCONNECTED|Failed to load resource/i.test(text)) return;
    errors.push(text);
  });

  page.on("pageerror", (error) => {
    pageErrors.push(`${error.name}: ${error.message}`);
  });

  return {
    errors,
    pageErrors,
    assertClean(context: string) {
      expect(pageErrors, `unhandled error on ${context}`).toEqual([]);
      expect(errors, `console.error on ${context}`).toEqual([]);
    },
  };
}

/** The canonical internal routes from `docs/AGENT-BRIEF.md` §3. */
export const ROUTES = [
  "/",
  "/services",
  "/book",
  "/deals",
  "/contact",
  "/gallery",
  "/about",
  "/privacy",
  "/terms",
] as const;

/** Navigates and waits for enough of the page to assert on. */
export async function goto(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `${path} returned no response`).not.toBeNull();
  expect(response!.status(), `${path} status`).toBeLessThan(400);
  await expect(page.locator("h1").first()).toBeVisible();
}

/**
 * The hard rule from `docs/AGENT-BRIEF.md` §4: "a phone number must be
 * reachable within one thumb-reach on every viewport, always."
 */
export async function expectReachablePhone(page: Page): Promise<void> {
  const tel = page.locator('a[href^="tel:"]').first();
  await expect(tel, "no tel: link on this page").toBeVisible();
  const href = await tel.getAttribute("href");
  expect(href).toMatch(/^\+?\d{8,15}$/);
}

/** Scrolls to the bottom so a sticky footer bar is actually in view. */
export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(150);
}

// ─────────────────────────────────────────────────────────────────────────────
// HOMEPAGE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("homepage", () => {
  test("loads, has exactly one h1, and is clean in the console", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/");

    const h1 = page.locator("h1");
    await expect(h1, "the homepage must have an h1").toHaveCount(1);

    await expect(page).toHaveTitle(/EYG/i);
    console_.assertClean("/");
  });

  test("shows the emergency banner and a phone link", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/");

    // The emergency banner is the single highest-value element on the site for a
    // stranded customer: it must exist on EVERY viewport.
    const banner = page.locator('[data-testid="emergency-banner"], section[aria-label*="roadside" i], a[href*="wa.me"]').first();
    await expect(banner, "no emergency / roadside affordance on the homepage").toBeVisible();

    await expectReachablePhone(page);
    console_.assertClean("/");
  });

  test("has no dead links — every href is a real route or a real external URL", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/");
    const hrefs = await page.locator("a[href]").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href") ?? ""),
    );
    for (const href of hrefs) {
      expect(href, "dead `#` link").not.toBe("#");
      expect(href, "empty href").not.toBe("");
      expect(href, "javascript: link").not.toMatch(/^javascript:/i);
      expect(href, "Lorem/TODO placeholder").not.toMatch(/lorem|todo-verify|placeholder/i);
    }
    console_.assertClean("/");
  });

  test("renders no untranslated template or placeholder text", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/");
    const text = (await page.locator("body").innerText()).toLowerCase();
    for (const banned of ["lorem ipsum", "todo-verify", "undefined", "[object object]", "nan"]) {
      expect(text, `homepage shows "${banned}"`).not.toContain(banned);
    }
    // `TODO-VERIFY` facts must not be shipped as live claims.
    expect(text).not.toContain("todo-verify");
    console_.assertClean("/");
  });

  test("states the shop's real address somewhere a customer can read it", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/");
    const body = await page.locator("body").innerText();
    expect(body).toMatch(/EGSA Fourlanes/i);
    expect(body).toMatch(/Balanga/i);
    console_.assertClean("/");
  });
});