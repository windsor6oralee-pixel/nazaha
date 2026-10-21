import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { BASE_URL, OUT_DIR, STAFF_PASSWORD, HR_EMAIL, CANDIDATE_NAME } from "./config";

/**
 * WhatsApp contact affordance for the candidate portal.
 *
 * The button is driven by `Organization.contactPhone`, so this walkthrough sets
 * a number on the tenant, signs the candidate in with a fresh invitation code,
 * and checks the button appears with a working wa.me link — then puts the
 * tenant back the way it found it.
 *
 * The tenant is restored in afterAll as well, so a failed assertion never
 * leaves a number behind.
 */

/** Temporary number used only while this spec runs. Restored afterwards. */
const TEMP_PHONE = "0501234567";
const TEMP_DIGITS = "966501234567";

async function shot(page: Page, name: string) {
  await mkdir(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

async function signInStaff(page: Page) {
  await page.goto("/auth/login");
  await page.locator('input[type="email"]').fill(HR_EMAIL);
  await page.locator('input[type="password"]').fill(STAFF_PASSWORD);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/hr", { timeout: 30_000 });
}

async function signInCandidate(page: Page, token: string) {
  await page.goto("/auth/candidate");
  await page.getByPlaceholder("الصق الرمز هنا...").fill(token);
  await page.getByRole("button", { name: "الدخول إلى ملفي" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/candidate", { timeout: 30_000 });
}

/** Rotates the invitation code and returns it — codes are single-use. */
async function mintToken(page: Page): Promise<string> {
  await page.goto("/hr/candidates");
  const profileLink = page.getByRole("link", { name: `عرض ملف ${CANDIDATE_NAME}` }).first();
  await expect(profileLink).toBeVisible();
  const candidateId = (await profileLink.getAttribute("href"))?.split("/").pop() ?? "";
  expect(candidateId).not.toBe("");

  const res = await page.request.post(`/api/candidates/${candidateId}/resend-invitation`);
  expect(res.ok()).toBeTruthy();

  await page.goto(`/hr/candidates/${candidateId}`);
  const code = (await page.locator('[aria-labelledby="invitation-code-title"] div.break-all').innerText()).trim();
  expect(code).toMatch(/^[0-9a-f]{64}$/);
  return code;
}

// The tenant always goes back to "no number configured", whatever happens.
test.afterAll(async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE_URL, locale: "ar-SA" });
  const page = await ctx.newPage();
  try {
    await signInStaff(page);
    await page.request.patch("/api/admin/organization", { data: { contactPhone: null } });
  } catch {
    // Nothing more to do — the field is optional and the app tolerates it.
  }
  await ctx.close();
});

test("HR admin sets the contact number through the organisation profile", async ({ page }) => {
  await signInStaff(page);

  await page.goto("/admin/organization");
  const field = page.locator('input[type="tel"]');
  await expect(field).toBeVisible();

  await field.fill(TEMP_PHONE);
  await page.getByRole("button", { name: "حفظ هوية الجهة" }).click();
  await expect(page.getByText("تم حفظ هوية الجهة بنجاح")).toBeVisible({ timeout: 15_000 });

  const profile = await page.request.get("/api/admin/organization");
  expect(profile.ok()).toBeTruthy();
  const body = (await profile.json()) as { contactPhone: string | null };
  expect(body.contactPhone).toBe(TEMP_PHONE);

  await shot(page, "07-whatsapp--admin-organization");
});

test("candidate sees the WhatsApp button after signing in with the invitation code", async ({ page }) => {
  // The HR session mints a fresh code, then the candidate signs in with it.
  const staff = await page.context().newPage();
  await signInStaff(staff);
  const token = await mintToken(staff);
  await staff.close();

  await signInCandidate(page, token);

  // The card on the dashboard.
  const card = page.getByText("تواصل معنا عبر واتساب");
  await expect(card).toBeVisible();

  const openChat = page.getByRole("link", { name: "افتح المحادثة على واتساب" });
  await expect(openChat).toBeVisible();
  const href = await openChat.getAttribute("href");
  expect(href).toContain(`https://wa.me/${TEMP_DIGITS}`);
  // The message is prefilled for the tenant.
  expect(href).toContain("text=");
  expect(decodeURIComponent(href ?? "")).toContain(CANDIDATE_NAME);

  // The button in the sidebar, so it is reachable from every candidate page.
  const pill = page.getByRole("link", { name: "تواصل عبر واتساب" });
  await expect(pill).toBeVisible();
  expect(await pill.getAttribute("href")).toContain(`https://wa.me/${TEMP_DIGITS}`);

  await shot(page, "07-whatsapp--candidate-dashboard");

  // Still there on the other candidate pages.
  await page.goto("/candidate/documents");
  await expect(page.getByRole("link", { name: "تواصل عبر واتساب" })).toBeVisible();
  await shot(page, "07-whatsapp--candidate-documents");
});

test("the button disappears once the tenant clears the number", async ({ page }) => {
  await signInStaff(page);
  const res = await page.request.patch("/api/admin/organization", { data: { contactPhone: null } });
  expect(res.ok()).toBeTruthy();

  // A fresh code, because the previous one was consumed by the sign-in.
  const token = await mintToken(page);
  await signInCandidate(page, token);

  await expect(page.getByRole("link", { name: "تواصل عبر واتساب" })).toHaveCount(0);
  await expect(page.getByText("تواصل معنا عبر واتساب")).toHaveCount(0);
  await shot(page, "07-whatsapp--candidate-no-number");
});
