#!/usr/bin/env node
/**
 * Mints a fresh candidate invitation code and prints it.
 *
 * Invitation codes are single-use, so every run of the candidate flow needs a
 * new one. This logs in as the tenant admin, asks for the invitation to be
 * resent, and reads the rotated code off the candidate profile — the same
 * flow an HR user performs in the browser.
 *
 *   E2E_BASE_URL   target deployment (default: local dev server on :3002)
 *   TEST_PASSWORD  password of the HR account (required — no default)
 *   HR_EMAIL       HR account used to rotate the code (default: admin@mof.gov.sa)
 */
import { chromium } from "@playwright/test";
import { BASE_URL, PASSWORD, HR_EMAIL, CANDIDATE_NAME } from "../e2e/config";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: BASE_URL });
  const page = await ctx.newPage();

  await page.goto("/auth/login");
  await page.locator('input[type="email"]').fill(HR_EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/hr", { timeout: 30_000 });

  await page.goto("/hr/candidates");
  const link = page.getByRole("link", { name: `عرض ملف ${CANDIDATE_NAME}` }).first();
  await link.waitFor({ state: "visible", timeout: 30_000 });
  const candidateId = (await link.getAttribute("href"))?.split("/").pop() ?? "";
  if (!candidateId) throw new Error(`لم يُعثر على ملف المرشح «${CANDIDATE_NAME}»`);

  const res = await page.request.post(`/api/candidates/${candidateId}/resend-invitation`);
  if (!res.ok()) throw new Error(`فشل إرسال الدعوة (HTTP ${res.status()})`);

  await page.goto(`/hr/candidates/${candidateId}`);
  const code = (await page.locator('[aria-labelledby="invitation-code-title"] div.break-all').innerText()).trim();
  if (!/^[0-9a-f]{64}$/.test(code)) throw new Error("لم يُقرأ رمز الدعوة من صفحة الملف");

  await browser.close();
  console.log(code);
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
