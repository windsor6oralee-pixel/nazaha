import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { prisma } from "@/infrastructure/database/client";
import {
  isPrincipalActive,
  isSessionStale,
} from "@/infrastructure/auth/credentials.service";
import { authConfig } from "@/infrastructure/auth/auth.config";

// تغيير كلمة المرور يجب أن يُبطل الجلسات المفتوحة فوراً.
// الجلسات رموز موقّعة (JWT) فلا تُسقط من قاعدة البيانات، فالمقارنة بين
// تاريخ إصدار الجلسة وتاريخ تغيير كلمة المرور هي ما يبطلها.

const HR_EMAIL = "salma.rashidi@mof.gov.sa";
const TEST_ADMIN_EMAIL = "revocation-test@nazaha.local";

let orgId: string;
let userId: string;
let adminId: string;
let candidateId: string;
let originalChangedAt: Date | null = null;

beforeAll(async () => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: HR_EMAIL },
    select: { id: true, organizationId: true, passwordChangedAt: true },
  });
  userId = user.id;
  orgId = user.organizationId;
  originalChangedAt = user.passwordChangedAt;

  const candidate = await prisma.candidate.findFirstOrThrow({
    where: { organizationId: orgId, nationalId: "1098765432" },
    select: { id: true },
  });
  candidateId = candidate.id;

  const admin = await prisma.platformAdmin.upsert({
    where: { email: TEST_ADMIN_EMAIL },
    update: { passwordChangedAt: null },
    create: { email: TEST_ADMIN_EMAIL, passwordHash: "not-a-real-hash", nameAr: "حساب اختبار الإبطال" },
  });
  adminId = admin.id;
});

afterEach(async () => {
  await prisma.user.update({ where: { id: userId }, data: { passwordChangedAt: originalChangedAt } });
  await prisma.platformAdmin.update({ where: { id: adminId }, data: { passwordChangedAt: null } });
});

afterAll(async () => {
  await prisma.platformAdmin.deleteMany({ where: { email: TEST_ADMIN_EMAIL } });
  await prisma.$disconnect();
});

describe("isSessionStale", () => {
  it("never stales when the password was never changed", () => {
    expect(isSessionStale(new Date(), null)).toBe(false);
    expect(isSessionStale(undefined, null)).toBe(false);
  });

  it("stales a session issued before the change", () => {
    const changed = new Date("2026-01-02T00:00:00Z");
    expect(isSessionStale(new Date("2026-01-01T23:59:59Z"), changed)).toBe(true);
  });

  it("keeps a session issued after the change", () => {
    const changed = new Date("2026-01-02T00:00:00Z");
    expect(isSessionStale(new Date("2026-01-02T00:00:01Z"), changed)).toBe(false);
  });

  it("stales a session whose issue time is unknown (fail-safe)", () => {
    expect(isSessionStale(undefined, new Date())).toBe(true);
    expect(isSessionStale(null, new Date())).toBe(true);
  });
});

describe("the session-issued-at claim", () => {
  // `iat` لا يصلح: NextAuth يعيد توقيع الرمز في كل طلب فتُحدَّث قيمته.
  // لذلك يُختم الرمز بد clam مخصّص يُضبط مرة واحدة عند الدخول.
  const jwt = authConfig.callbacks?.jwt as unknown as (args: {
    token: Record<string, unknown>;
    user?: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;

  it("is stamped at sign-in", async () => {
    const before = Date.now();
    const token = await jwt({
      token: {},
      user: { id: "u1", nameAr: "موظف", role: "admin", sessionType: "hr_user", organizationId: "o1" },
    });
    expect(typeof token.sessionIssuedAt).toBe("number");
    expect(token.sessionIssuedAt as number).toBeGreaterThanOrEqual(before);
  });

  it("survives the later requests that carry no user", async () => {
    const token = await jwt({ token: { sessionIssuedAt: 1_700_000_000_000 } });
    expect(token.sessionIssuedAt).toBe(1_700_000_000_000);
  });
});

describe("live sessions after a password change", () => {
  it("kills an HR session issued before the change and keeps a newer one", async () => {
    const changed = new Date();
    await prisma.user.update({ where: { id: userId }, data: { passwordChangedAt: changed } });

    const before = { sessionType: "hr_user" as const, id: userId, organizationId: orgId };
    const after = { ...before, sessionIssuedAt: new Date(Date.now() + 60_000) };
    const older = { ...before, sessionIssuedAt: new Date(Date.now() - 60_000) };

    expect(await isPrincipalActive(older)).toBe(false);
    // الجلسة الجديدة تبقى صالحة: التقييم لكل جلسة على حدة.
    expect(await isPrincipalActive(after)).toBe(true);
  });

  it("kills a platform-admin session issued before the change and keeps a newer one", async () => {
    const changed = new Date();
    await prisma.platformAdmin.update({ where: { id: adminId }, data: { passwordChangedAt: changed } });

    const before = { sessionType: "platform_admin" as const, id: adminId, organizationId: "" };
    const after = { ...before, sessionIssuedAt: new Date(Date.now() + 60_000) };
    const older = { ...before, sessionIssuedAt: new Date(Date.now() - 60_000) };

    expect(await isPrincipalActive(older)).toBe(false);
    expect(await isPrincipalActive(after)).toBe(true);
  });

  it("keeps every session when the password was never changed", async () => {
    await prisma.user.update({ where: { id: userId }, data: { passwordChangedAt: null } });
    const older = {
      sessionType: "hr_user" as const,
      id: userId,
      organizationId: orgId,
      sessionIssuedAt: new Date(Date.now() - 60_000),
    };
    expect(await isPrincipalActive(older)).toBe(true);
  });

  it("kills a candidate session issued before the change and keeps a newer one", async () => {
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { passwordChangedAt: new Date() },
    });

    const before = { sessionType: "candidate" as const, id: candidateId, organizationId: orgId };
    const after = { ...before, sessionIssuedAt: new Date(Date.now() + 60_000) };
    const older = { ...before, sessionIssuedAt: new Date(Date.now() - 60_000) };

    expect(await isPrincipalActive(older)).toBe(false);
    expect(await isPrincipalActive(after)).toBe(true);

    await prisma.candidate.update({ where: { id: candidateId }, data: { passwordChangedAt: null } });
  });

  it("kills a candidate session that has no account any more", async () => {
    const before = await prisma.candidate.findUniqueOrThrow({
      where: { id: candidateId },
      select: { accountActivatedAt: true },
    });

    await prisma.candidate.update({
      where: { id: candidateId },
      data: { accountActivatedAt: null },
    });
    const principal = {
      sessionType: "candidate" as const,
      id: candidateId,
      organizationId: orgId,
      sessionIssuedAt: new Date(Date.now() + 60_000),
    };
    expect(await isPrincipalActive(principal)).toBe(false);

    await prisma.candidate.update({
      where: { id: candidateId },
      data: { accountActivatedAt: before.accountActivatedAt },
    });
  });
});
