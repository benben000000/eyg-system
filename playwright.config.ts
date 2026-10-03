import { defineConfig, devices } from "@playwright/test";

/**
 * QA & SECURITY AGENT — Playwright configuration.
 * ============================================================================
 * OWNERSHIP: `playwright.config.ts`, `tests/e2e/**`.
 *
 * WHAT THIS SUITE IS FOR
 * ----------------------
 * The Vitest suite proves logic. This suite proves the parts only a browser can:
 * does the page actually render on a ₱3,000 Android over 3G, is the phone
 * reachable with one thumb, does the 4-step wizard complete end to end, does a
 * bad URL render the 404 page, and — the one everyone forgets — does ANY page
 * emit a `console.error` or an unhandled rejection.
 *
 * PROJECTS
 *   mobile  — 393×852 (Pixel-class), DPR 3, touch, mobile UA + `isMobile`.
 *             The primary target: the brief says the customer is on a phone, in
 *             traffic, near EGSA Fourlanes.
 *   desktop — 1440×900, Chromium, no touch.
 *
 * WEB SERVER
 *   `next build && next start` — a real production build, not `next dev`. A dev
 *   server does not exercise the same chunking, the same CSP nonce flow, or the
 *   same error boundaries, so a dev-only pass proves very little.
 *
 * ENVIRONMENT REQUIREMENTS (documented in docs/qa/TEST-STRATEGY.md §5)
 *   • A migrated Postgres reachable at DATABASE_URL, seeded with the catalogue,
 *     BUSINESS_HOURS, promos and at least one service with a published price.
 *   • AUTH_SECRET / PII_ENCRYPTION_KEY / WEBHOOK_SIGNING_SECRET set to real
 *     values (tests/setup.ts refuses placeholder values; the same discipline
 *     applies here).
 *   • CAPTCHA_ENABLED=true so the wizard is exercised with the challenge ON.
 *
 * DEPENDENCIES REQUIRED IN package.json (see the QA report):
 *   "@playwright/test": "^1.49.0"
 *   "@axe-core/playwright": "^4.10.0"
 *   Optional but recommended: "axe-core" (peer of the above).
 *   Plus `npx playwright install --with-deps chromium` on the runner.
 * ============================================================================
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results/playwright",
  fullyParallel: false, // the booking flow mutates shared state; keep it serial
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }], ["junit", { outputFile: "playwright-report/results.xml" }]]
    : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry", // full DOM + network + console on the first retry
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // A real customer is on a phone; never assert on a UA the site special-cases.
    ignoreHTTPSErrors: false,
  },

  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        locale: "en-PH",
        timezoneId: "Asia/Manila",
      },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        locale: "en-PH",
        timezoneId: "Asia/Manila",
      },
    },
  ],

  webServer: {
    command: process.env.E2E_SKIP_BUILD === "1" ? `next start --port ${PORT}` : `npm run build && next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      // Deterministic, non-placeholder values — the QA guard rejects shortcuts.
      AUTH_SECRET: "e2e-only-auth-secret-9f2c7b41d6a35e08b7c4d1902fa63c85",
      PII_ENCRYPTION_KEY: "e2e-only-pii-key-4d7a1e93c05b286fa1d4703e9b6c2581",
      WEBHOOK_SIGNING_SECRET: "whsec_e2e_only_9f2c7b41d6a35e08b7c4d1902fa63c",
      CAPTCHA_ENABLED: "true",
      CAPTCHA_TTL_SECONDS: "600",
      LOG_LEVEL: "warn",
      // Never let an E2E run send a real SMS or email.
      TWILIO_ACCOUNT_SID: "",
      TWILIO_AUTH_TOKEN: "",
      RESEND_API_KEY: "",
    },
  },
});