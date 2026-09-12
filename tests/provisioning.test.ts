import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/infrastructure/database/client";
import { tenantPrisma } from "@/infrastructure/tenant/scoped-prisma";
import { provisionOrganization, validateProvisionInput } from "@/infrastructure/platform/provisioning.service";

// Tenant provisioning must be all-or-nothing and must produce a tenant that is
// isolated from the very first row.

const STAMP = Date.now();
const created: string[] = [];

async function removeTenant(organizationId: string) {
  await prisma.auditLog.deleteMany({ where: { resourceId: organizationId } });
  await prisma.user.deleteMany({ where: { organizationId } });
  await prisma.contractTemplate.deleteMany({ where: { organizationId } });
  await prisma.workflowStepDocument.deleteMany({ where: { workflowStep: { workflow: { organizationId } } } });
  await prisma.workflowStep.deleteMany({ where: { workflow: { organizationId } } });
  await prisma.workflow.deleteMany({ where: { organizationId } });
  await prisma.role.deleteMany({ where: { organizationId } });
  await prisma.organization.delete({ where: { id: organizationId } });
}

afterAll(async () => {
  for (const id of created) await removeTenant(id).catch(() => null);
  await prisma.$disconnect();
});

describe("input validation", () => {
  it.each([
    ["bad slug",        { nameAr: "جهة", slug: "Bad Slug", type: "GOVERNMENT", admin: { email: "a@b.c", nameAr: "م", password: "StrongPass123!" } }],
    ["bad type",        { nameAr: "جهة", slug: "ok-slug", type: "ALIEN",      admin: { email: "a@b.c", nameAr: "م", password: "StrongPass123!" } }],
    ["short password",  { nameAr: "جهة", slug: "ok-slug", type: "PRIVATE",    admin: { email: "a@b.c", nameAr: "م", password: "short" } }],
    ["bad admin email", { nameAr: "جهة", slug: "ok-slug", type: "PRIVATE",    admin: { email: "nope",  nameAr: "م", password: "StrongPass123!" } }],
  ])("rejects %s", (_n, input) => {
    expect(validateProvisionInput(input as never)).toBeTypeOf("string");
  });
});

describe("provisionOrganization", () => {
  it("creates org + 3 system roles + 5-step workflow + 2 templates + first admin in one go", async () => {
    const r = await provisionOrganization({
      nameAr: "جهة اختبار التجهيز", slug: `prov-ok-${STAMP}`, type: "PRIVATE",
      admin: { email: `prov-admin-${STAMP}@test.local`, nameAr: "مشرف", password: "StrongPass123!" },
    });
    created.push(r.organizationId);

    expect(r).toMatchObject({ roles: 3, workflowSteps: 5, templates: 2 });
    expect(await prisma.role.count({ where: { organizationId: r.organizationId, isSystem: true } })).toBe(3);
    expect(await prisma.workflow.count({ where: { organizationId: r.organizationId, isDefault: true } })).toBe(1);
    expect(await prisma.workflowStepDocument.count({ where: { workflowStep: { workflow: { organizationId: r.organizationId } } } })).toBe(7);
    expect(await prisma.contractTemplate.count({ where: { organizationId: r.organizationId, isActive: true } })).toBe(2);

    const admin = await prisma.user.findUniqueOrThrow({ where: { id: r.adminUserId }, include: { role: true } });
    expect(admin.role.name).toBe("admin");
    expect(admin.organizationId).toBe(r.organizationId);
  });

  it("the new tenant is isolated from existing tenants immediately", async () => {
    const mof = await prisma.organization.findFirstOrThrow({ where: { slug: "mof" } });
    const mofCandidate = await prisma.candidate.findFirstOrThrow({ where: { organizationId: mof.id } });
    const db = tenantPrisma(created[0]);
    expect(await db.candidate.findUnique({ where: { id: mofCandidate.id } })).toBeNull();
    expect(await db.candidate.count()).toBe(0);
    expect(await db.contractTemplate.count()).toBe(2);
  });

  it("rolls back everything when the admin email already exists", async () => {
    const existing = await prisma.user.findFirstOrThrow({ select: { email: true } });
    const slug = `prov-fail-${STAMP}`;
    const before = await prisma.organization.count();

    await expect(
      provisionOrganization({
        nameAr: "جهة ستفشل", slug, type: "GOVERNMENT",
        admin: { email: existing.email, nameAr: "x", password: "StrongPass123!" },
      })
    ).rejects.toThrow();

    expect(await prisma.organization.findUnique({ where: { slug } })).toBeNull();
    expect(await prisma.role.count({ where: { organization: { slug } } })).toBe(0);
    expect(await prisma.workflow.count({ where: { organization: { slug } } })).toBe(0);
    expect(await prisma.contractTemplate.count({ where: { organization: { slug } } })).toBe(0);
    expect(await prisma.organization.count()).toBe(before);
  });

  it("rejects a duplicate slug without leaving partial rows", async () => {
    const before = await prisma.organization.count();
    await expect(
      provisionOrganization({
        nameAr: "تكرار", slug: `prov-ok-${STAMP}`, type: "GOVERNMENT",
        admin: { email: `dup-${STAMP}@test.local`, nameAr: "x", password: "StrongPass123!" },
      })
    ).rejects.toThrow();
    expect(await prisma.organization.count()).toBe(before);
    expect(await prisma.user.findUnique({ where: { email: `dup-${STAMP}@test.local` } })).toBeNull();
  });
});
