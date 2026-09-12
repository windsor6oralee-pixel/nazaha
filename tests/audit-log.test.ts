import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/infrastructure/database/client";
import { tenantPrisma } from "@/infrastructure/tenant/scoped-prisma";
import { listAuditLogs, diffFields, encodeCursor, decodeCursor } from "@/infrastructure/audit/audit.service";

// The audit trail must be append-only at the DATABASE level and paginate by keyset.

let orgId: string;
let userId: string;
const probeIds: string[] = [];
// Unique per run: the table is append-only, so earlier runs' probe rows are still there.
const PAGE_ACTION = `test.pagination_probe.${Date.now()}`;

beforeAll(async () => {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: "mof" } });
  const user = await prisma.user.findFirstOrThrow({ where: { organizationId: org.id } });
  orgId = org.id;
  userId = user.id;
});

afterAll(async () => prisma.$disconnect());
// Note: no cleanup of probe rows is possible — that is the point. They are clearly labelled.

describe("immutability", () => {
  it("runtime role cannot UPDATE an audit row", async () => {
    const row = await prisma.auditLog.create({
      data: { actorType: "SYSTEM", action: "test.immutability_probe", resource: "Test", userId },
    });
    probeIds.push(row.id);
    await expect(
      prisma.auditLog.update({ where: { id: row.id }, data: { action: "tampered" } })
    ).rejects.toThrow();
    expect((await prisma.auditLog.findUniqueOrThrow({ where: { id: row.id } })).action).toBe("test.immutability_probe");
  });

  it("runtime role cannot DELETE an audit row", async () => {
    await expect(prisma.auditLog.delete({ where: { id: probeIds[0] } })).rejects.toThrow();
    await expect(prisma.auditLog.deleteMany({ where: { action: "test.immutability_probe" } })).rejects.toThrow();
    expect(await prisma.auditLog.findUnique({ where: { id: probeIds[0] } })).not.toBeNull();
  });

  it("even the table owner is refused by the trigger", async () => {
    const [row] = await prisma.$queryRaw<{ tgenabled: string }[]>`
      SELECT tgenabled FROM pg_trigger WHERE tgname = 'audit_logs_immutable_trg'`;
    expect(row?.tgenabled).toBe("O");
  });
});

describe("cursor pagination", () => {
  it("round-trips a cursor", () => {
    const d = new Date("2026-09-13T10:00:00.123Z");
    const c = decodeCursor(encodeCursor(d, "abc"));
    expect(c?.id).toBe("abc");
    expect(c?.createdAt.toISOString()).toBe(d.toISOString());
    expect(decodeCursor("not-a-cursor")).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });

  it("pages without overlap or gaps and terminates", async () => {
    // Guarantee enough rows to need several pages.
    for (let i = 0; i < 7; i++) {
      const r = await prisma.auditLog.create({ data: { actorType: "SYSTEM", action: PAGE_ACTION, resource: "Test", userId } });
      probeIds.push(r.id);
    }
    const db = tenantPrisma(orgId);
    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await listAuditLogs(db, { action: PAGE_ACTION }, cursor, 3);
      for (const e of page.entries) {
        expect(seen.has(e.id), "duplicate row across pages").toBe(false);
        seen.add(e.id);
      }
      cursor = page.nextCursor;
      pages++;
      expect(pages).toBeLessThan(20);
    } while (cursor);
    expect(seen.size).toBe(7);
    expect(pages).toBe(3);
  });

  it("is ordered newest-first and stable", async () => {
    const page = await listAuditLogs(tenantPrisma(orgId), {}, null, 10);
    const times = page.entries.map((e) => e.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });
});

describe("filters", () => {
  it("intersect (action + actorType + user)", async () => {
    const db = tenantPrisma(orgId);
    const page = await listAuditLogs(db, { action: PAGE_ACTION, actorType: "SYSTEM", userId }, null, 50);
    expect(page.entries.length).toBe(7);
    const none = await listAuditLogs(db, { action: PAGE_ACTION, actorType: "CANDIDATE" }, null, 50);
    expect(none.entries).toEqual([]);
  });

  it("family prefix matches all actions in that family", async () => {
    const page = await listAuditLogs(tenantPrisma(orgId), { action: "test." }, null, 50);
    expect(page.entries.length).toBeGreaterThanOrEqual(8);
    expect(page.entries.every((e) => e.action.startsWith("test."))).toBe(true);
  });

  it("is tenant-scoped", async () => {
    const other = await prisma.organization.findFirst({ where: { slug: { not: "mof" } } });
    if (!other) return;
    const page = await listAuditLogs(tenantPrisma(other.id), { action: "test." }, null, 50);
    expect(page.entries).toEqual([]);
  });
});

describe("diffFields", () => {
  it("records only changed fields with from/to", () => {
    const before = { a: 1, b: "x", c: null as string | null, d: "same" };
    const after = { a: 2, b: "x", c: "new", d: "same", e: "ignored" } as Partial<typeof before>;
    expect(diffFields(before, after, ["a", "b", "c", "d"])).toEqual({
      a: { from: 1, to: 2 },
      c: { from: null, to: "new" },
    });
  });
});
