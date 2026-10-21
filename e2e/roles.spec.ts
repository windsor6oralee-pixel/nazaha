import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  BASE_URL,
  OUT_DIR,
  PLATFORM_EMAIL,
  PLATFORM_PASSWORD,
  STAFF_PASSWORD,
  CANDIDATE_NAME,
} from "./config";

/**
 * Role-matrix walkthrough.
 *
 * Signs in through the real sign-in forms of every role, checks what that role
 * is allowed to see, and writes one screenshot per role/page into E2E_OUT_DIR.
 *
 * The accounts are the ones created by scripts/create_test_accounts.ts.
 */
const MOF_NAME = "وزارة المالية";
const DGA_NAME = "هيئة الحكومة الرقمية";

/** Staff roles — mirrors the matrix built by scripts/create_test_accounts.ts. */
const STAFF_ROLES = [
  {
    key: "02-tenant-admin-mof",
    email: "admin@mof.gov.sa",
    label: "مدير النظام — وزارة المالية",
    org: MOF_NAME,
    seesCandidate: true,
    adminMenu: true,
    profile: true,
    pages: ["/hr", "/hr/candidates", "/hr/candidates/new", "/hr/reports", "/admin"],
  },
  {
    key: "03-hr-manager",
    email: "salma.rashidi@mof.gov.sa",
    label: "مدير الموارد البشرية",
    org: MOF_NAME,
    seesCandidate: true,
    adminMenu: true,
    pages: ["/hr", "/hr/candidates", "/hr/reports", "/admin"],
  },
  {
    key: "04-hr-officer",
    email: "faisal.mansour@mof.gov.sa",
    label: "موظف الموارد البشرية",
    org: MOF_NAME,
    seesCandidate: true,
    adminMenu: false,
    pages: ["/hr", "/hr/candidates", "/hr/reports"],
  },
  {
    key: "05-tenant-admin-dga",
    email: "admin@dga.gov.sa",
    label: "مشرف — هيئة الحكومة الرقمية",
    org: DGA_NAME,
    seesCandidate: false,
    adminMenu: true,
    pages: ["/hr", "/hr/candidates"],
  },
];

// ── helpers ────────────────────────────────────────────────────────────────

async function shot(page: Page, name: string) {
  await mkdir(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

/** "/hr/candidates" → "candidates", "/candidate" → "dashboard". */
function slug(p: string) {
  const s = p.replace(/^\/(hr|candidate)\/?/, "").replace(/\//g, "-");
  return s || "dashboard";
}

/** Signs in through the real HR form and waits for the portal shell. */
async function signInStaff(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(STAFF_PASSWORD);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/hr", { timeout: 30_000 });
}

/** Signs in through the real platform-operator form. */
async function signInPlatform(page: Page, email: string) {
  await page.goto("/platform/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PLATFORM_PASSWORD);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/platform", { timeout: 30_000 });
}

/** Signs in with an invitation code through the candidate portal. */
async function signInCandidate(page: Page, token: string) {
  await page.goto("/auth/candidate");
  await page.getByPlaceholder("الصق الرمز هنا...").fill(token);
  await page.getByRole("button", { name: "الدخول إلى ملفي" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/candidate", { timeout: 30_000 });
}

// ── fixture: a fresh invitation code ───────────────────────────────────────

let candidateToken = "";

/**
 * Invitation codes are single-use, so a fresh one is minted through the HR
 * portal before the candidate run: the HR admin asks for a resend and reads the
 * rotated code off the candidate profile.
 */
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({
    baseURL: BASE_URL,
    locale: "ar-SA",
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  await signInStaff(page, "admin@mof.gov.sa");
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
  candidateToken = code;

  await ctx.close();
});

// ── the matrix ─────────────────────────────────────────────────────────────

test("portals render their sign-in screens", async ({ page }) => {
  await page.goto("/platform/login");
  await shot(page, "00-portal-platform-login");

  await page.goto("/auth/login");
  await shot(page, "00-portal-hr-login");

  await page.goto("/auth/candidate");
  await shot(page, "00-portal-candidate-login");
});

test("platform operator sees every tenant", async ({ page }) => {
  await signInPlatform(page, PLATFORM_EMAIL);
  await expect(page.getByRole("heading", { name: "الجهات المشتركة" })).toBeVisible();
  await expect(page.getByText(MOF_NAME).first()).toBeVisible();
  await expect(page.getByText(DGA_NAME).first()).toBeVisible();
  await shot(page, "01-platform-operator--platform");
});

for (const role of STAFF_ROLES) {
  test(`${role.label} — ${role.email}`, async ({ page }) => {
    await signInStaff(page, role.email);

    // The tenant is branded into the shell, so the org name is on screen.
    await expect(page.getByText(role.org).first()).toBeVisible();

    // The admin menu only exists for admin + hr_manager.
    const adminLink = page.getByRole("link", { name: "الإعدادات" });
    if (role.adminMenu) await expect(adminLink).toHaveCount(1);
    else await expect(adminLink).toHaveCount(0);

    for (const p of role.pages) {
      await page.goto(p);
      await expect(page).toHaveURL((u) => u.pathname === p || u.pathname.startsWith(`${p}/`));
      await shot(page, `${role.key}--${slug(p)}`);
    }

    // Tenant isolation: only the Ministry of Finance owns this candidate.
    await page.goto("/hr/candidates");
    if (role.seesCandidate) {
      await expect(page.getByText(CANDIDATE_NAME).first()).toBeVisible();
    } else {
      await expect(page.getByText(CANDIDATE_NAME)).toHaveCount(0);
    }

    if (role.profile) {
      const link = page.getByRole("link", { name: `عرض ملف ${CANDIDATE_NAME}` }).first();
      await link.click();
      await expect(page).toHaveURL(/\/hr\/candidates\/.+/);
      await expect(page.getByText("رمز الدعوة")).toBeVisible();
      await shot(page, `${role.key}--candidate-profile`);
    }
  });
}

test("HR officer is kept out of the administration area", async ({ page }) => {
  await signInStaff(page, "faisal.mansour@mof.gov.sa");
  await expect(page.getByRole("link", { name: "الإعدادات" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(page).toHaveURL((u) => u.pathname === "/hr");
});

test("candidate walks through the journey portal", async ({ page }) => {
  await signInCandidate(page, candidateToken);
  await expect(page.getByText(CANDIDATE_NAME).first()).toBeVisible();
  await shot(page, "06-candidate--dashboard");

  await page.goto("/candidate/documents");
  await expect(page).toHaveURL((u) => u.pathname === "/candidate/documents");
  await shot(page, "06-candidate--documents");

  await page.goto("/candidate/contract");
  await expect(page).toHaveURL((u) => u.pathname === "/candidate/contract");
  await shot(page, "06-candidate--contract");
});
