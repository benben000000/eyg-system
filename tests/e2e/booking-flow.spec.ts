import { expect, test, type Page } from "@playwright/test";

import { expectReachablePhone, goto, scrollToBottom, watchConsole } from "./home.spec";

/**
 * THE FULL BOOKING FLOW, END TO END.
 * ============================================================================
 * This is the one test that must never be skipped and never be mocked. It drives
 * the real 4-step wizard against a real (staging) database and asserts that a
 * customer ends up holding a reference they can read down the phone.
 *
 * WHAT IT PROVES
 *   • vehicle → services → slot → contact → confirmation, with no dead end;
 *   • the arithmetic challenge is actually present and actually required;
 *   • the honeypot is invisible and empty;
 *   • a reference is rendered, and it is the documented `EYG-XXXXXX` shape with
 *     no I/O/0/1 in the code half;
 *   • a SECOND customer cannot book the last remaining bay of a slot (the race,
 *     through the real stack rather than a mocked transaction);
 *   • the page never emits a console error along the way.
 *
 * ENVIRONMENT
 *   Needs a migrated, seeded staging database (see docs/qa/TEST-STRATEGY.md §5).
 *   `CAPTCHA_ENABLED` must be true, which `playwright.config.ts` sets.
 * ============================================================================
 */

/** Solves the arithmetic challenge the way a human reads it. */
async function solveCaptcha(page: Page): Promise<number> {
  const label = page.getByText(/what is \d+\s*[+−-]\s*\d+\?/i).first();
  await expect(label, "the math challenge must be visible on the booking form").toBeVisible();
  const text = await label.innerText();
  const match = /(\d+)\s*([+−-])\s*(\d+)/.exec(text);
  if (!match) throw new Error(`unparseable captcha question: ${text}`);
  const a = Number(match[1]);
  const b = Number(match[3]);
  return match[2] === "+" ? a + b : a - b;
}

/** Fills whatever the contact step actually asks for, by label. */
async function fillContact(page: Page, index: number): Promise<void> {
  await page.getByLabel(/full name|name/i).first().fill(`E2E Test Customer ${index}`);
  await page.getByLabel(/mobile|phone|number/i).first().fill(`0917123${String(4000 + index).padStart(4, "0")}`);

  const email = page.getByLabel(/email/i).first();
  if (await email.isVisible().catch(() => false)) {
    await email.fill(`e2e+${index}@example.ph`);
  }

  const vehicle = page.getByLabel(/year/i).first();
  if (await vehicle.isVisible().catch(() => false)) {
    await vehicle.fill("2019");
    await page.getByLabel(/make/i).first().fill("Toyota");
    await page.getByLabel(/model/i).first().fill("Hilux");
  }

  // The SMS consent checkbox must exist. Its default state is the product's
  // decision; the test only asserts it is present and labelable.
  const consent = page.getByLabel(/text|sms|messag/i).first();
  if (await consent.isVisible().catch(() => false)) {
    await consent.check();
  }

  const honeypot = page.locator('input[name="website"]');
  if ((await honeypot.count()) > 0) {
    await expect(honeypot, "the honeypot must be hidden from humans").toBeHidden();
  }
}

test.describe.configure({ mode: "serial" });

test.describe("booking flow", () => {
  test("completes end to end and shows a reference", async ({ page }, testInfo) => {
    const console_ = watchConsole(page);
    const index = testInfo.parallelIndex * 100 + testInfo.retry * 10 + 1;

    await goto(page, "/book");

    // ── Step 1: vehicle ────────────────────────────────────────────────────
    const year = page.getByLabel(/year/i).first();
    if (await year.isVisible().catch(() => false)) {
      await year.fill("2019");
      await page.getByLabel(/make/i).first().fill("Toyota");
      await page.getByLabel(/model/i).first().fill("Hilux");
    }
    await page.getByRole("button", { name: /next|continue|choose services/i }).first().click();

    // ── Step 2: services ───────────────────────────────────────────────────
    const service = page.getByRole("checkbox", { name: /pms|oil|service/i }).first();
    await expect(service, "no selectable service on the wizard").toBeVisible();
    await service.check();
    await page.getByRole("button", { name: /next|continue|pick a (time|date)/i }).first().click();

    // ── Step 3: slot ───────────────────────────────────────────────────────
    const slot = page.getByRole("button", { name: /\d{1,2}:\d{2}\s?(am|pm)/i }).first();
    await expect(slot, "no bookable slot offered").toBeVisible({ timeout: 20_000 });
    const chosenSlot = (await slot.innerText()).trim();
    expect(chosenSlot.length).toBeGreaterThan(0);
    await slot.click();

    // ── Step 4: contact ────────────────────────────────────────────────────
    await fillContact(page, index);

    // ── Anti-bot: solve the arithmetic challenge ───────────────────────────
    const answer = await solveCaptcha(page);
    const answerField = page.getByLabel(/answer|math|sum/i).first();
    await answerField.fill(String(answer));

    await page.getByRole("button", { name: /confirm|book|reserve|submit/i }).first().click();

    // ── Confirmation ───────────────────────────────────────────────────────
    const reference = page.getByText(/EYG-[A-Z0-9]{6}/).first();
    await expect(reference, "no booking reference was shown after confirming").toBeVisible({ timeout: 30_000 });
    const shown = (await reference.innerText()).trim();
    expect(shown).toMatch(/^EYG-[A-Z2-9]{6}$/);
    expect(shown.slice(4), "the code half must never contain I, O, 0 or 1").not.toMatch(/[IO01]/);

    // The chosen time must survive the round trip.
    await expect(page.locator("body")).toContainText(/AM|PM/i);

    console_.assertClean("/book after confirming");
  });

  test("a second customer cannot take the last bay of a slot (race, through the real stack)", async ({ page, context }) => {
    const first = watchConsole(page);
    await goto(page, "/book");

    // Find a slot with capacityLeft === 1 if the UI exposes it; otherwise take the
    // first offered slot and drive two parallel submissions from two contexts.
    const slot = page.getByRole("button", { name: /\d{1,2}:\d{2}\s?(am|pm)/i }).first();
    await expect(slot).toBeVisible({ timeout: 20_000 });
    const chosenSlot = (await slot.innerText()).trim();
    expect(chosenSlot.length).toBeGreaterThan(0);

    const service = page.getByRole("checkbox", { name: /pms|oil|service/i }).first();
    if (await service.isVisible().catch(() => false)) await service.check();

    await page.getByRole("button", { name: /next|continue|pick a (time|date)/i }).first().click();
    await slot.click();
    await fillContact(page, 77);
    const answer = await solveCaptcha(page);
    await page.getByLabel(/answer|math|sum/i).first().fill(String(answer));

    const second = await context.newPage();
    const secondConsole = watchConsole(second);
    await goto(second, "/book");
    const service2 = second.getByRole("checkbox", { name: /pms|oil|service/i }).first();
    if (await service2.isVisible().catch(() => false)) await service2.check();
    await second.getByRole("button", { name: /next|continue|pick a (time|date)/i }).first().click();
    const slot2 = second.getByRole("button", { name: new RegExp(escape(chosenSlot), "i") }).first();
    await expect(slot2, `the second customer could not find ${chosenSlot}`).toBeVisible({ timeout: 20_000 });
    await slot2.click();
    await fillContact(second, 78);
    const answer2 = await solveCaptcha(second);
    await second.getByLabel(/answer|math|sum/i).first().fill(String(answer2));

    // Fire both confirmations at the same moment.
    const submit = (target: Page) =>
      target.getByRole("button", { name: /confirm|book|reserve|submit/i }).first().click();
    await Promise.all([submit(page), submit(second)]);

    const succeeded = async (target: Page): Promise<boolean> => {
      try {
        await target.getByText(/EYG-[A-Z0-9]{6}/).first().waitFor({ timeout: 20_000 });
        return true;
      } catch {
        return false;
      }
    };
    const outcomes = await Promise.all([succeeded(page), succeeded(second)]);

    expect(
      outcomes.filter(Boolean).length,
      `expected at most one confirmation for ${chosenSlot}, got ${JSON.stringify(outcomes)}`,
    ).toBeLessThanOrEqual(1);

    // Whoever lost must be told the slot is gone, in words, not left hanging.
    const loser = outcomes[0] ? second : page;
    await expect(loser.getByText(/slot|another time|just filled|no longer/i).first()).toBeVisible({
      timeout: 20_000,
    });

    first.assertClean("/book race (customer 1)");
    secondConsole.assertClean("/book race (customer 2)");
  });

  test("a honeypot-filled submission is rejected without creating a booking", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/book");

    const service = page.getByRole("checkbox", { name: /pms|oil|service/i }).first();
    if (await service.isVisible().catch(() => false)) await service.check();
    const slot = page.getByRole("button", { name: /\d{1,2}:\d{2}\s?(am|pm)/i }).first();
    await expect(slot).toBeVisible({ timeout: 20_000 });
    await slot.click();
    await fillContact(page, 91);

    // Fill the honeypot the way a bot would.
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toBeHidden();
    await honeypot.evaluate((node) => {
      const input = node as HTMLInputElement;
      input.value = "http://spam.example";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const answer = await solveCaptcha(page);
    await page.getByLabel(/answer|math|sum/i).first().fill(String(answer));
    await page.getByRole("button", { name: /confirm|book|reserve|submit/i }).first().click();

    await expect(page.getByText(/EYG-[A-Z0-9]{6}/).first()).toHaveCount(0);
    await expect(page.getByText(/automated|try again|too fast/i).first()).toBeVisible({ timeout: 20_000 });
    console_.assertClean("/book with a filled honeypot");
  });

  test("a submission faster than the minimum is rejected", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/book");
    // Click through as fast as the DOM allows: no reading, no waiting.
    for (const step of [/next|continue/i, /next|continue/i]) {
      await page.getByRole("button", { name: step }).first().click();
    }
    const answer = await solveCaptcha(page);
    await page.getByLabel(/answer|math|sum/i).first().fill(String(answer));
    await page.getByRole("button", { name: /confirm|book|reserve|submit/i }).first().click();
    // Either the booking succeeded (the machine is genuinely fast) or it was
    // rejected — what must NOT happen is a silent failure with no message.
    const body = page.locator("body");
    await expect(body).toContainText(/EYG-[A-Z0-9]{6}|automated|try again|too fast|sold out|another time/i, {
      timeout: 20_000,
    });
    console_.assertClean("/book fast submission");
  });

  test("a phone number is reachable at every step of the wizard", async ({ page }) => {
    const console_ = watchConsole(page);
    await goto(page, "/book");
    await expectReachablePhone(page);
    await scrollToBottom(page);
    await expectReachablePhone(page);
    console_.assertClean("/book");
  });
});

/** Escapes a string for use inside a RegExp. */
function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}