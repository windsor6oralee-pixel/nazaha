import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  BASE_URL,
  OUT_DIR,
  PLATFORM_EMAIL,
  PLATFORM_PASSWORD,
  STAFF_PASSWORD,
} from "./config";

/**
 * ضبط كلمة المرور من حساب مشغّل المنصة.
 *
 * يثبت ثلاثة أشياء: أن المشغّل يستطيع ضبط كلمة مرور أي حساب، أن كلمة المرور
 * الجديدة تعمل فعلاً، وأن الجلسة القديمة للحساب المُعدَّل تُبطل فوراً.
 */
/** حساب مشرف جهة — نعدّله ثم نعيده كما كان. */
const TARGET_EMAIL = process.env.E2E_RESET_TARGET_EMAIL ?? "admin@dga.gov.sa";
const NEW_PASSWORD = process.env.E2E_RESET_NEW_PASSWORD ?? "Nazaha@Reset2026!";

async function shot(page: Page, name: string) {
  await mkdir(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

async function signInStaff(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/hr", { timeout: 30_000 });
}

async function signInPlatform(page: Page, email: string) {
  await page.goto("/platform/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PLATFORM_PASSWORD);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/platform", { timeout: 30_000 });
}

/** يضبط كلمة مرور حساب من داخل بوابة المنصة. */
async function resetPasswordAsPlatform(page: Page, email: string, password: string) {
  await page.goto("/platform/accounts");
  await expect(page.getByRole("heading", { name: "حسابات الدخول" })).toBeVisible();

  // صف الحساب المطلوب — داخل مجموعة «موظفو الجهات».
  const row = page.locator("li", { has: page.locator(`text=${email}`) }).last();
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: /ضبط كلمة المرور|تغيير كلمة مروري/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type="password"], input[type="text"]').first().fill(password);
  await dialog.getByRole("button", { name: "حفظ كلمة المرور" }).click();
  await expect(dialog.getByText(/تم ضبط كلمة المرور|تم تغيير كلمة المرور/)).toBeVisible();
}

test.describe("platform operator resets a staff password", () => {
  test.afterAll(async ({ browser }) => {
    // إعادة كلمة المرور الأصلية حتى لا يتأثر باقي الاختبارات.
    const ctx = await browser.newContext({ baseURL: BASE_URL, locale: "ar-SA" });
    const page = await ctx.newPage();
    try {
      await signInPlatform(page, PLATFORM_EMAIL);
      await resetPasswordAsPlatform(page, TARGET_EMAIL, STAFF_PASSWORD);
    } finally {
      await ctx.close();
    }
  });

  test("the operator sees every account and can set any password", async ({ page }) => {
    await signInPlatform(page, PLATFORM_EMAIL);
    await page.goto("/platform/accounts");

    await expect(page.getByRole("heading", { name: "حسابات الدخول" })).toBeVisible();
    await expect(page.getByText("مشغّلو المنصة")).toBeVisible();
    await expect(page.getByText("موظفو الجهات")).toBeVisible();
    await expect(page.getByText(TARGET_EMAIL).first()).toBeVisible();
    await expect(page.getByText(PLATFORM_EMAIL).first()).toBeVisible();
    await shot(page, "07-platform-accounts");

    // حساب المشغّل نفسه يمكن تغيير كلمة مروره من نفس الصفحة.
    await expect(page.getByRole("button", { name: "تغيير كلمة مروري" }).first()).toBeVisible();
  });

  test("the new password works and the old session dies", async ({ browser }) => {
    // جلسة قديمة للحساب المستهدف، تُفتح قبل الضبط.
    const victimCtx = await browser.newContext({ baseURL: BASE_URL, locale: "ar-SA" });
    const victim = await victimCtx.newPage();
    await signInStaff(victim, TARGET_EMAIL, STAFF_PASSWORD);
    await expect(victim).toHaveURL((u) => u.pathname === "/hr");

    // المشغّل يغيّر كلمة المرور.
    const opCtx = await browser.newContext({ baseURL: BASE_URL, locale: "ar-SA" });
    const op = await opCtx.newPage();
    await signInPlatform(op, PLATFORM_EMAIL);
    await resetPasswordAsPlatform(op, TARGET_EMAIL, NEW_PASSWORD);
    await opCtx.close();

    // الجلسة القديمة لم تعد تصل إلى البوابة.
    await victim.goto("/hr/candidates");
    await expect(victim).toHaveURL((u) => u.pathname.startsWith("/auth/login"), { timeout: 30_000 });

    // كلمة المرور الجديدة تعمل.
    const freshCtx = await browser.newContext({ baseURL: BASE_URL, locale: "ar-SA" });
    const fresh = await freshCtx.newPage();
    await signInStaff(fresh, TARGET_EMAIL, NEW_PASSWORD);
    await expect(fresh).toHaveURL((u) => u.pathname === "/hr");
    await freshCtx.close();

    // وكلمة المرور القديمة لم تعد تعمل.
    const oldCtx = await browser.newContext({ baseURL: BASE_URL, locale: "ar-SA" });
    const old = await oldCtx.newPage();
    await old.goto("/auth/login");
    await old.locator('input[type="email"]').fill(TARGET_EMAIL);
    await old.locator('input[type="password"]').fill(STAFF_PASSWORD);
    await old.getByRole("button", { name: "دخول", exact: true }).click();
    await expect(old).toHaveURL((u) => u.pathname.startsWith("/auth/login"), { timeout: 30_000 });
    await oldCtx.close();

    await victimCtx.close();
  });
});
