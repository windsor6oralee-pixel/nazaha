import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/client";

// Database-layer guarantees. These deliberately use the RAW client (no application
// filter at all) so a regression in the extension layer cannot mask an RLS regression.

const setOrg = (id: string) => prisma.$executeRaw(Prisma.sql`SELECT set_config('app.current_org', ${id}, TRUE)`);

let orgId: string;
let applicationId: string;

beforeAll(async () => {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: "mof" } });
  const app = await prisma.application.findFirstOrThrow({ where: { organizationId: org.id } });
  orgId = org.id;
  applicationId = app.id;
});

afterAll(async () => prisma.$disconnect());

describe("runtime database role", () => {
  it("is neither a superuser nor RLS-bypassing (otherwise every policy below is silently ignored)", async () => {
    const [row] = await prisma.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean; current_user: string }[]>`
      SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(row.rolsuper, `${row.current_user} must not be a superuser`).toBe(false);
    expect(row.rolbypassrls, `${row.current_user} must not bypass RLS`).toBe(false);
  });

  it("has RLS enabled and forced on every tenant table", async () => {
    const rows = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND relkind = 'r'
        AND relname NOT IN ('_prisma_migrations', 'platform_admins', 'permissions', 'role_permissions')`;
    const unprotected = rows.filter((r) => !r.relrowsecurity || !r.relforcerowsecurity).map((r) => r.relname);
    expect(unprotected).toEqual([]);
  });
});

describe("row-level security policies", () => {
  it("returns nothing for a foreign tenant context — even with no application filter", async () => {
    const [, candidates] = await prisma.$transaction([setOrg("no-such-org"), prisma.candidate.findMany()]);
    const [, documents] = await prisma.$transaction([setOrg("no-such-org"), prisma.document.findMany()]);
    const [, orgs] = await prisma.$transaction([setOrg("no-such-org"), prisma.organization.findMany()]);
    expect(candidates).toEqual([]);
    expect(documents).toEqual([]);
    expect(orgs).toEqual([]);
  });

  it("returns the tenant's own rows when its context is set", async () => {
    const [, candidates] = await prisma.$transaction([setOrg(orgId), prisma.candidate.findMany()]);
    const [, documents] = await prisma.$transaction([setOrg(orgId), prisma.document.findMany()]);
    expect(candidates.length).toBeGreaterThan(0);
    expect(documents.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.organizationId === orgId)).toBe(true);
  });

  it("blocks inserting a child row under a parent that belongs to another tenant (WITH CHECK)", async () => {
    await expect(
      prisma.$transaction([
        setOrg("no-such-org"),
        prisma.document.create({ data: { type: "NATIONAL_ID", nameAr: "rls-probe", applicationId } }),
      ])
    ).rejects.toThrow();
    const leaked = await prisma.document.count({ where: { nameAr: "rls-probe" } });
    expect(leaked).toBe(0);
  });

  it("blocks updating another tenant's rows (0 rows affected, no error)", async () => {
    const [, result] = await prisma.$transaction([
      setOrg("no-such-org"),
      prisma.candidate.updateMany({ where: { organizationId: orgId }, data: { department: "HACKED" } }),
    ]);
    expect(result.count).toBe(0);
    expect(await prisma.candidate.count({ where: { department: "HACKED" } })).toBe(0);
  });

  it("scopes the context to the transaction only (SET LOCAL semantics)", async () => {
    await prisma.$transaction([setOrg("no-such-org"), prisma.candidate.findMany()]);
    const after = await prisma.candidate.count();
    expect(after).toBeGreaterThan(0);
  });
});
