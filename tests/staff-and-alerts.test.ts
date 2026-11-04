import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { compare } from "bcryptjs";
import { prisma } from "@/infrastructure/database/client";
import { tenantPrisma } from "@/infrastructure/tenant/scoped-prisma";
import { provisionOrganization } from "@/infrastructure/platform/provisioning.service";
import { createStaff, listStaff, updateStaff, StaffError } from "@/infrastructure/services/staff.service";
import { createCandidate } from "@/infrastructure/services/candidate.service";
import { isPrincipalActive, verifyHRCredentials } from "@/infrastructure/auth/credentials.service";

/*
 * إدارة موظفي الجهة، وتنبيهات المرشحين تحت RLS.
 * كل شيء هنا يعمل بدور التشغيل nazaha_app، فلا ينجح إلا ما تسمح به سياسات الجهة.
 */

const STAMP = Date.now();
const PASSWORD = "StrongPass123!";
let orgId: string;
let otherOrgId: string;
let adminId: string;

beforeAll(async () => {
  const org = await provisionOrganization({
    nameAr: "شركة اختبار الموظفين", slug: `staff-${STAMP}`, type: "PRIVATE",
    admin: { email: `staff-admin-${STAMP}@test.local`, nameAr: "المدير", password: PASSWORD },
  });
  orgId = org.organizationId;
  adminId = org.adminUserId;
  otherOrgId = (await provisionOrganization({
    nameAr: "شركة مجاورة", slug: `staff-other-${STAMP}`, type: "PRIVATE",
    admin: { email: `staff-other-${STAMP}@test.local`, nameAr: "مدير مجاور", password: PASSWORD },
  })).organizationId;
});

afterAll(async () => {
  await prisma.organization.updateMany({ where: { id: { in: [orgId, otherOrgId] } }, data: { isActive: false } });
  await prisma.$disconnect();
});

describe("staff management", () => {
  let officerId: string;

  it("creates a staff account that can sign in", async () => {
    const email = `Staff-Officer-${STAMP}@Test.Local`;
    const user = await createStaff(orgId, adminId, { email, nameAr: "موظف جديد", role: "hr_officer", password: PASSWORD });
    officerId = user.id;
    expect(user).toMatchObject({ email: email.toLowerCase(), role: "hr_officer", isActive: true });
    expect(await verifyHRCredentials(email, PASSWORD)).toMatchObject({ id: officerId, role: "hr_officer" });
    expect(await prisma.auditLog.count({ where: { action: "user.created", resourceId: officerId } })).toBe(1);
  });

  it("rejects weak passwords and duplicate e-mails", async () => {
    await expect(createStaff(orgId, adminId, { email: `weak-${STAMP}@test.local`, nameAr: "ضعيف", role: "hr_officer", password: "short" }))
      .rejects.toMatchObject({ status: 422 });
    await expect(createStaff(orgId, adminId, { email: `staff-other-${STAMP}@test.local`, nameAr: "مكرر", role: "hr_officer", password: PASSWORD }))
      .rejects.toMatchObject({ status: 409 });
  });

  it("lists only this tenant's staff", async () => {
    const emails = (await listStaff(orgId)).map((u) => u.email);
    expect(emails).toContain(`staff-admin-${STAMP}@test.local`);
    expect(emails).not.toContain(`staff-other-${STAMP}@test.local`);
  });

  it("cannot touch another tenant's user", async () => {
    const foreign = await prisma.user.findFirstOrThrow({ where: { organizationId: otherOrgId } });
    await expect(updateStaff(orgId, adminId, foreign.id, { isActive: false })).rejects.toMatchObject({ status: 404 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: foreign.id } })).isActive).toBe(true);
  });

  it("changing a role ends the open session", async () => {
    // A session opened after the account was created…
    await new Promise((r) => setTimeout(r, 5));
    const issued = new Date();
    const principal = { sessionType: "hr_user" as const, id: officerId, organizationId: orgId, sessionIssuedAt: issued };
    expect(await isPrincipalActive(principal)).toBe(true);
    const updated = await updateStaff(orgId, adminId, officerId, { role: "hr_manager" });
    expect(updated.role).toBe("hr_manager");
    expect(await isPrincipalActive(principal)).toBe(false);
  });

  it("resets a password and clears the lockout", async () => {
    await prisma.user.update({ where: { id: officerId }, data: { failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 60_000) } });
    await updateStaff(orgId, adminId, officerId, { password: "AnotherPass456!" });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: officerId } });
    expect(row.lockedUntil).toBeNull();
    expect(await compare("AnotherPass456!", row.passwordHash)).toBe(true);
  });

  it("protects the admin from locking themselves out", async () => {
    await expect(updateStaff(orgId, adminId, adminId, { isActive: false })).rejects.toBeInstanceOf(StaffError);
    await expect(updateStaff(orgId, adminId, adminId, { role: "hr_officer" })).rejects.toMatchObject({ status: 409 });
  });

  it("never leaves the tenant without an active admin", async () => {
    const second = await createStaff(orgId, adminId, { email: `staff-admin2-${STAMP}@test.local`, nameAr: "مدير ثانٍ", role: "admin", password: PASSWORD });
    // Another admin exists, so the first can be demoted by the second…
    await updateStaff(orgId, second.id, adminId, { role: "hr_manager" });
    // …but the last remaining admin cannot be deactivated.
    await expect(updateStaff(orgId, officerId, second.id, { isActive: false })).rejects.toMatchObject({ status: 409 });
  });
});

describe("candidate alerts under RLS", () => {
  let applicationId: string;

  beforeAll(async () => {
    const c = await createCandidate({
      nameAr: "مرشح التنبيه", nationalId: `3${String(STAMP).slice(-9)}`, email: `alert-${STAMP}@test.local`,
      jobTitle: "مصمم", department: "التسويق", acceptanceDate: new Date("2026-10-01"),
      organizationId: orgId, createdByUserId: adminId,
    });
    applicationId = c.applicationId;
  });

  it("HR can create an alert and the candidate's tenant can read it", async () => {
    const db = tenantPrisma(orgId);
    const alert = await db.candidateAlert.create({
      data: { organizationId: orgId, applicationId, sentByUserId: adminId, titleAr: "تذكير", bodyAr: "ارفع الهوية", priority: "HIGH" },
    });
    const pending = await db.candidateAlert.findMany({ where: { applicationId, acknowledgedAt: null } });
    expect(pending.map((a) => a.id)).toContain(alert.id);
  });

  it("another tenant sees nothing", async () => {
    const rows = await tenantPrisma(otherOrgId).candidateAlert.findMany({ where: { applicationId } });
    expect(rows).toEqual([]);
  });
});
