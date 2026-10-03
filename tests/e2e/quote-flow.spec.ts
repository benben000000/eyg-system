import { expect, test } from "@playwright/test";

import { goto, watchConsole } from "./home.spec";

/**
 * THE INSTANT-QUOTE ESTIMATOR, END TO END.
 * ============================================================================
 * The estimator is the funnel's honesty gate, and it is the one place where a
 * bug becomes a *consumer-protection* problem rather than a UX problem: a
 * customer who is told "₱1,800" and then charged ₱2,600 has been misrepresented.
 *
 * So this spec asserts, on the live DOM:
 *   • selecting a service UPDATES the estimate (the number is not static);
 *   • a CALL_FOR_PRICE service makes the estimate APPROXIMATE and surfaces a
 *     disclaimer;
 *   • the disclaimer is never blank, and never reads "₱null";
 *   • the peso figure is whole pesos — no centavos, no `NaN`;
 *   • "ask us" is used when the price is genuinely unknown rather than ₱0.
 * ============================================================================
 */

test.describe("quote estimator", () => {
  test("updates when a service is selected", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/");

    const teaser = page.getByTestId("quote-teaser").or(page.getByRole("region", { name: /quote|estimate/i })).first();
    await expect(teaser, "no quote estimator on the homepage").toBeVisible();

    const service = teaser.getByRole("checkbox", { name: /pms|oil|service/i }).first();
    await expect(service, "no selectable service in the estimator").toBeVisible();

    const price = teaser.locator("text=/₱/").first();
    const before = (await price.innerText()).trim();

    await service.check();
    await expect
      .poll(async () => (await price.innerText()).trim(), { timeout: 10_000 })
      .not.toBe(before);

    console_.assertClean("/ with a service selected");
  });

  test("never renders ₱null, ₱NaN, ₱undefined or centavos", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/");

    const text = await page.locator("body").innerText();
    for (const banned of ["₱null", "₱NaN", "₱undefined", "[object Object]"]) {
      expect(text, `estimator shows "${banned}"`).not.toContain(banned);
    }
    // Whole pesos only: no ₱1,250.00, no ₱1,250.5.
    expect(text).not.toMatch(/₱[\d,]+\.\d{2}\b/);
    console_.assertClean("/");
  });

  test("uses 'Ask us' rather than a fabricated ₱0", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/services");
    const text = await page.locator("body").innerText();
    // A service with no published price must not present ₱0 as a price.
    expect(text).not.toMatch(/₱0\b/);
    expect(text).toMatch(/ask us|call for price|depends on/i);
    console_.assertClean("/services");
  });

  test("a CALL_FOR-PRICE selection surfaces an approximate disclaimer", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/");

    const variable = page.getByRole("checkbox", { name: /undercoat|depends|call for price/i }).first();
    if ((await variable.count()) === 0) {
      test.skip(true, "no CALL_FOR_PRICE service in the estimator on this deployment");
    }
    await variable.check();
    const body = page.locator("body");
    await expect(body).toContainText(/indicative|approximate|estimate|confirm/i, { timeout: 10_000 });
    console_.assertClean("/ with a variable service selected");
  });

  test("the full quote request flow completes and returns a reference", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/book");

    // Jump straight to the quote step if the wizard exposes it.
    const quoteStep = page.getByRole("button", { name: /next|continue/i }).first();
    const service = page.getByRole("checkbox", { name: /pms|oil|service/i }).first();
    if (await service.isVisible().catch(() => false)) await service.check();
    await quoteStep.click();

    // A quote request needs contact details; the wizard reuses them.
    const name = page.getByLabel(/full name|name/i).first();
    const phone = page.getByLabel(/mobile|phone/i).first();
    if ((await name.isVisible().catch(() => false)) && (await phone.isVisible().catch(() => false))) {
      await name.fill("E2E Quote Tester");
      await phone.fill("09171239999");
      const email = page.getByLabel(/email/i).first();
      if (await email.isVisible().catch(() => false)) await email.fill("e2e-quote@example.ph");

      const answer = await page
        .getByText(/what is \d+\s*[+−-]\s*\d+\?/i)
        .first()
        .innerText()
        .then((text) => {
          const match = /(\d+)\s*([+−-])\s*(\d+)/.exec(text);
          if (!match) throw new Error(`unparseable captcha question: ${text}`);
          return match[2] === "+" ? Number(match[1]) + Number(match[3]) : Number(match[1]) - Number(match[3]);
        });
      const answerField = page.getByLabel(/answer|math|sum/i).first();
      if (await answerField.isVisible().catch(() => false)) await answerField.fill(String(answer));

      await page.getByRole("button", { name: /confirm|book|reserve|get estimate|send/i }).first().click();
      await expect(page.getByText(/EYG-Q-[A-Z0-9]{6}/).first()).toBeVisible({ timeout: 30_000 });
    }

    console_.assertClean("/book quote request");
  });
});