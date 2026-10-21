import { defineConfig } from "@playwright/test";

/**
 * Playwright configuration for the Nazaha role-matrix walkthrough.
 *
 * The suite drives a real browser against a real deployment and writes one
 * screenshot per role, so it needs a reachable target plus the accounts
 * created by scripts/create_test_accounts.ts.
 *
 *   E2E_BASE_URL   target deployment (default: local dev server on :3002)
 *   E2E_OUT_DIR    where screenshots are written (default: screenshots/roles)
 *   TEST_PASSWORD  password shared by the test accounts
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3002";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./.playwright/artifacts",
  // The candidate invitation token is single-use and every role shares one
  // database, so the matrix has to run serially and in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "ar-SA",
    timezoneId: "Asia/Riyadh",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
