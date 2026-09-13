import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/infrastructure/database/client";
// Imported directly (not via the barrel) so the test never pulls in next-auth.
import { tenantPrisma, withTenantTransaction, type TenantPrisma } from "@/infrastructure/tenant/scoped-prisma";

// Application-layer isolation: tenantPrisma must make cross-tenant reads return nothing,
// cross-tenant writes touch nothing, and creates land in the caller's tenant.

const SLUG = `iso-test-${Date.now()}`;

let orgA: string;
let orgB: string;
let dbA: TenantPrisma;
let dbB: TenantPrisma;
let appA: string;
let docA: string;
let candA: string;
let createdCandidateB: string | null = null;

beforeAll(async () => {
  const a = await prisma.organization.findFirstOrThrow({ where: { slug: "mof" } });
  orgA = a.id;
  const app = await prisma.application.findFirstOrThrow({ where: { organizationId: orgA } });
  appA = app.id;
  docA = (await prisma.document.findFirstOrThrow({ where: { applicationId: appA } })).id;
  candA = app.candidateId;

  orgB = (await prisma.organization.create({ data: { nameAr: "جهة اختبار العزل", slug: SLUG } })).id;
  dbA = tenantPrisma(orgA);
  dbB = tenantPrisma(orgB);
});

afterAll(async () => {
  if (createdCandidateB) await prisma.candidate.delete({ where: { id: createdCandidateB } }).catch(() => null);
  await prisma.organization.delete({ where: { id: orgB } }).catch(() => null);
  await prisma.$disconnect();
});

describe("same-tenant access", () => {
  it("findUnique works with the injected tenant filter (extended where-unique)", async () => {
    expect(await dbA.application.findUnique({ where: { id: appA } })).not.toBeNull();
    expect(await dbA.document.findUnique({ where: { id: docA } })).not.toBeNull();
    expect(await dbA.candidate.findUnique({ where: { id: candA } })).not.toBeNull();
  });

  it("relation-scoped models are reachable", async () => {
    expect(await dbA.document.count()).toBeGreaterThan(0);
    expect(await dbA.workflowStep.count()).toBeGreaterThan(0);
  });

  it("withTenantTransaction keeps the tenant for every operation inside", async () => {
    const r = await withTenantTransaction(dbA, orgA, async (tx) => ({
      candidates: await tx.candidate.count(),
      documents: await tx.document.count(),
      foreign: await tx.candidate.findUnique({ where: { id: "nope" } }),
    }));
    expect(r.candidates).toBeGreaterThan(0);
    expect(r.documents).toBeGreaterThan(0);
    expect(r.foreign).toBeNull();
  });
});

describe("repository lookups (Vuln 1 regression)", () => {
  it("getCandidateById requires the caller's organization", async () => {
    const { getCandidateById, getContractForApplication, getCandidateByApplicationId } =
      await import("@/infrastructure/repositories/candidate.repository");
    expect(await getCandidateById(orgA, candA)).not.toBeNull();
    expect(await getCandidateById(orgB, candA)).toBeNull();
    expect(await getCandidateByApplicationId(orgB, appA)).toBeNull();
    expect(await getContractForApplication(orgB, appA)).toBeNull();
  });
});

describe("cross-tenant reads", () => {
  it.each([
    ["application.findUnique", () => dbB.application.findUnique({ where: { id: appA } })],
    ["document.findUnique",    () => dbB.document.findUnique({ where: { id: docA } })],
    ["candidate.findUnique",   () => dbB.candidate.findUnique({ where: { id: candA } })],
    ["preboardingChannel",     () => dbB.preboardingChannel.findUnique({ where: { applicationId: appA } })],
  ])("%s → null", async (_name, fn) => {
    expect(await fn()).toBeNull();
  });

  it.each([
    ["application.findMany", () => dbB.application.findMany()],
    ["user.findMany",        () => dbB.user.findMany()],
    ["auditLog.findMany",    () => dbB.auditLog.findMany()],
    ["contract.findMany",    () => dbB.contract.findMany()],
  ])("%s → []", async (_name, fn) => {
    expect(await fn()).toEqual([]);
  });

  it("counts are zero", async () => {
    expect(await dbB.document.count()).toBe(0);
    expect(await dbB.candidate.count()).toBe(0);
  });
});

describe("cross-tenant writes", () => {
  it("updateMany affects 0 rows and leaves data untouched", async () => {
    const r = await dbB.document.updateMany({ where: { id: docA }, data: { nameAr: "HACKED" } });
    expect(r.count).toBe(0);
    expect((await prisma.document.findUniqueOrThrow({ where: { id: docA } })).nameAr).not.toBe("HACKED");
  });

  it("update throws (record not found)", async () => {
    await expect(dbB.application.update({ where: { id: appA }, data: { status: "WITHDRAWN" } })).rejects.toThrow();
    expect((await prisma.application.findUniqueOrThrow({ where: { id: appA } })).status).not.toBe("WITHDRAWN");
  });

  it("delete throws (record not found)", async () => {
    await expect(dbB.document.delete({ where: { id: docA } })).rejects.toThrow();
    expect(await prisma.document.findUnique({ where: { id: docA } })).not.toBeNull();
  });
});

describe("creates", () => {
  it("land in the caller's tenant and are invisible to other tenants", async () => {
    const c = await dbB.candidate.create({
      data: {
        nationalId: "9999999999", nameAr: "اختبار", email: "iso@test.local",
        jobTitle: "x", department: "y", acceptanceDate: new Date(),
        organizationId: orgB,
      },
    });
    createdCandidateB = c.id;
    expect(c.organizationId).toBe(orgB);
    expect(await dbA.candidate.findUnique({ where: { id: c.id } })).toBeNull();
    expect(await dbB.candidate.findUnique({ where: { id: c.id } })).not.toBeNull();
  });

  it("cannot be redirected to another tenant by passing organizationId explicitly", async () => {
    await expect(
      dbB.candidate.create({
        data: {
          nationalId: "8888888888", nameAr: "تسلل", email: "leak@test.local",
          jobTitle: "x", department: "y", acceptanceDate: new Date(),
          organizationId: orgA,
        },
      })
    ).resolves.toMatchObject({ organizationId: orgB });
    await prisma.candidate.deleteMany({ where: { nationalId: "8888888888" } });
  });
});
