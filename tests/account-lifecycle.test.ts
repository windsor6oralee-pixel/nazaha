import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "@/infrastructure/database/client";
import {
  verifyHRCredentials,
  verifyCandidateCredentials,
  isPrincipalActive,
} from "@/infrastructure/auth/credentials.service";

// Closes Vuln 3: suspending an organization (or a user) must lock out logins
// immediately AND invalidate live sessions on their next request.

const HR_EMAIL = "salma.rashidi@mof.gov.sa";
const HR_PASSWORD = process.env.SEED_DEV_HR_PASSWORD ?? "change-me-dev-only";
// The seeded candidate account — the seed writes the login e-mail + the hash.
const CANDIDATE_EMAIL = "ahmed.omari@example.com";
const CANDIDATE_PASSWORD = process.env.SEED_DEV_CANDIDATE_PASSWORD ?? "change-me-dev-only";

let orgId: string;
let userId: string;
let candidateId: string;
let originalChangedAt: Date | null = null;
let originalCandidateChangedAt: Date | null = null;

async function setOrgActive(active: boolean) {
  await prisma.organization.update({ where: { id: orgId }, data: { isActive: active } });
}
async function setUserActive(active: boolean) {
  await prisma.user.update({ where: { id: userId }, data: { isActive: active } });
}
/** تصفير عدّاد المحاولات ورفع القفل — حتى لا يسرّب اختبارٌ أثره على آخر. */
async function resetCandidateLockout() {
  await prisma.candidate.update({
    where: { id: candidateId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

beforeAll(async () => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: HR_EMAIL }, select: { id: true, organizationId: true, passwordChangedAt: true } });
  orgId = user.organizationId;
  userId = user.id;

  const candidate = await prisma.candidate.findFirstOrThrow({
    where: { organizationId: orgId, nationalId: "1098765432" },
    select: { id: true, passwordChangedAt: true },
  });
  candidateId = candidate.id;

  // الجلسات في هذا الملف بلا تاريخ إصدار، فأي «تغيير كلمة مرور» سابق يجعلها
  // باطلة احتياطاً. نُلغي الطابع لنختبر الإيقاف وحده.
  originalChangedAt = user.passwordChangedAt;
  originalCandidateChangedAt = candidate.passwordChangedAt;
  await prisma.user.update({ where: { id: userId }, data: { passwordChangedAt: null } });
  await prisma.candidate.update({ where: { id: candidateId }, data: { passwordChangedAt: null } });
});

afterEach(async () => {
  await setOrgActive(true);
  await setUserActive(true);
  await resetCandidateLockout();
});

afterAll(async () => {
  await prisma.user.update({ where: { id: userId }, data: { passwordChangedAt: originalChangedAt } });
  await prisma.candidate.update({ where: { id: candidateId }, data: { passwordChangedAt: originalCandidateChangedAt } });
  await prisma.$disconnect();
});

describe("login", () => {
  it("HR login works for an active user in an active organization", async () => {
    expect(await verifyHRCredentials(HR_EMAIL, HR_PASSWORD)).toMatchObject({ sessionType: "hr_user", organizationId: orgId });
  });

  it("HR login is refused when the organization is suspended", async () => {
    await setOrgActive(false);
    expect(await verifyHRCredentials(HR_EMAIL, HR_PASSWORD)).toBeNull();
  });

  it("HR login is refused when the user is deactivated", async () => {
    await setUserActive(false);
    expect(await verifyHRCredentials(HR_EMAIL, HR_PASSWORD)).toBeNull();
  });

  it("HR login is refused for a wrong password (no throw)", async () => {
    expect(await verifyHRCredentials(HR_EMAIL, "definitely-wrong")).toBeNull();
  });

  it("candidate login is refused when the organization is suspended", async () => {
    await setOrgActive(false);
    expect(await verifyCandidateCredentials(CANDIDATE_EMAIL, CANDIDATE_PASSWORD)).toBeNull();
  });

  it("candidate login works with the account's e-mail and password", async () => {
    expect(await verifyCandidateCredentials(CANDIDATE_EMAIL, CANDIDATE_PASSWORD)).toMatchObject({
      sessionType: "candidate",
      organizationId: orgId,
      id: candidateId,
    });
  });

  it("candidate login is refused for a wrong password", async () => {
    expect(await verifyCandidateCredentials(CANDIDATE_EMAIL, "definitely-wrong")).toBeNull();
  });
});

describe("live sessions", () => {
  it("an existing HR session dies when the organization is suspended", async () => {
    const principal = { sessionType: "hr_user" as const, id: userId, organizationId: orgId };
    expect(await isPrincipalActive(principal)).toBe(true);
    await setOrgActive(false);
    expect(await isPrincipalActive(principal)).toBe(false);
  });

  it("an existing HR session dies when the user is deactivated", async () => {
    const principal = { sessionType: "hr_user" as const, id: userId, organizationId: orgId };
    await setUserActive(false);
    expect(await isPrincipalActive(principal)).toBe(false);
  });

  it("an existing candidate session dies when the organization is suspended", async () => {
    const principal = { sessionType: "candidate" as const, id: candidateId, organizationId: orgId };
    expect(await isPrincipalActive(principal)).toBe(true);
    await setOrgActive(false);
    expect(await isPrincipalActive(principal)).toBe(false);
  });

  it("a session whose organizationId claim does not match the database is rejected", async () => {
    expect(await isPrincipalActive({ sessionType: "hr_user", id: userId, organizationId: "some-other-org" })).toBe(false);
  });

  it("platform admins are subject to their own account state", async () => {
    const admin = await prisma.platformAdmin.findFirst();
    if (!admin) return; // لا يوجد مشغّل منصة في قاعدة الاختبار
    const principal = { sessionType: "platform_admin" as const, id: admin.id, organizationId: "" };
    expect(await isPrincipalActive(principal)).toBe(true);

    await prisma.platformAdmin.update({ where: { id: admin.id }, data: { isActive: false } });
    expect(await isPrincipalActive(principal)).toBe(false);

    await prisma.platformAdmin.update({ where: { id: admin.id }, data: { isActive: true } });
    expect(await isPrincipalActive(principal)).toBe(true);
  });
});
