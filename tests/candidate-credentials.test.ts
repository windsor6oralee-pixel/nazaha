import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { hash as bcryptHash } from "bcryptjs";
import { createHash } from "node:crypto";
import { prisma } from "@/infrastructure/database/client";
import {
  activateCandidateAccount,
  CandidateAccountError,
  isPrincipalActive,
  verifyCandidateCredentials,
} from "@/infrastructure/auth/credentials.service";

/*
 * حساب دخول المرشح: بريد + كلمة مرور.
 *
 * المرشح لم يعد يدخل برمز دعوة، بل بحساب دائم. الرمز بقي — لكنه «تفعيل»
 * لمرة واحدة: يحوّل نفسه إلى حساب.
 */

const PASSWORD = "CandidatePass2026!";
const LOGIN_EMAIL = "candidate-auth-test@nazaha.local";
const OTHER_LOGIN_EMAIL = "candidate-auth-test-2@nazaha.local";

let candidateId: string;
let orgId: string;

beforeAll(async () => {
  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: "mof" },
    select: { id: true },
  });
  orgId = org.id;

  const workflow = await prisma.workflow.findFirstOrThrow({
    where: { organizationId: orgId },
    select: { id: true },
  });

  // سمة اختبار ثابتة: سجل التدقيق غير قابل للحذف، فحذف المرشح بعد أول
  // تسجيل دخول مستحيل — تبقى السمة بين التشغيلات وتُعاد تهيئتها في كل مرة.
  const candidate = await prisma.candidate.upsert({
    where: { organizationId_nationalId: { organizationId: orgId, nationalId: "900000001" } },
    update: {},
    create: {
      nationalId: "900000001",
      nameAr: "مرشح اختبار الدخول",
      email: LOGIN_EMAIL,
      jobTitle: "اختبار",
      department: "اختبار",
      acceptanceDate: new Date(),
      organizationId: orgId,
    },
    select: { id: true },
  });
  candidateId = candidate.id;

  const existing = await prisma.application.findFirst({
    where: { candidateId },
    select: { id: true },
  });
  if (!existing) {
    await prisma.application.create({
      data: {
        candidateId,
        organizationId: orgId,
        workflowId: workflow.id,
        status: "APPROVED",
      },
    });
  }
});

/** يعيد الحساب إلى حالة «بلا كلمة مرور» — أي حساب لم يُفعّل بعد. */
async function resetAccount() {
  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      loginEmail: null,
      passwordHash: null,
      accountActivatedAt: null,
      passwordChangedAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
    },
  });
}

async function giveAccount(password = PASSWORD) {
  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      loginEmail: LOGIN_EMAIL,
      passwordHash: await bcryptHash(password, 12),
      accountActivatedAt: new Date(),
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}

beforeEach(resetAccount);

// لا تنظيف للسمات: سجل التدقيق append-only (حتى المالك لا يستطيع حذفه)،
// وحذفه يمنع حذف المرشح نفسه. السمة تبقى مُسمّاةً بوضوح في قائمة المرشحين.
afterAll(async () => {
  await prisma.$disconnect();
});

describe("verifyCandidateCredentials", () => {
  it("accepts the right e-mail and password and returns the principal", async () => {
    await giveAccount();
    const principal = await verifyCandidateCredentials(LOGIN_EMAIL, PASSWORD);
    expect(principal).toMatchObject({
      id: candidateId,
      sessionType: "candidate",
      role: "candidate",
      organizationId: orgId,
    });
    expect(principal?.applicationId).toBeTruthy();
  });

  it("ignores case and surrounding spaces in the e-mail", async () => {
    await giveAccount();
    expect(await verifyCandidateCredentials(`  ${LOGIN_EMAIL.toUpperCase()} `, PASSWORD)).not.toBeNull();
  });

  it("refuses a wrong password and counts the attempt", async () => {
    await giveAccount();
    expect(await verifyCandidateCredentials(LOGIN_EMAIL, "definitely-wrong")).toBeNull();
    const row = await prisma.candidate.findUniqueOrThrow({
      where: { id: candidateId },
      select: { failedLoginAttempts: true },
    });
    expect(row.failedLoginAttempts).toBe(1);
  });

  it("locks the account after five wrong passwords", async () => {
    await giveAccount();
    for (let i = 0; i < 5; i++) {
      expect(await verifyCandidateCredentials(LOGIN_EMAIL, "definitely-wrong")).toBeNull();
    }
    // حتى كلمة المرور الصحيحة تُرفض أثناء القفل.
    expect(await verifyCandidateCredentials(LOGIN_EMAIL, PASSWORD)).toBeNull();
    const row = await prisma.candidate.findUniqueOrThrow({
      where: { id: candidateId },
      select: { lockedUntil: true },
    });
    expect(row.lockedUntil).toBeInstanceOf(Date);
  });

  it("resets the counter and stamps the login on success", async () => {
    await giveAccount();
    await verifyCandidateCredentials(LOGIN_EMAIL, "definitely-wrong");
    await verifyCandidateCredentials(LOGIN_EMAIL, PASSWORD);
    const row = await prisma.candidate.findUniqueOrThrow({
      where: { id: candidateId },
      select: { failedLoginAttempts: true, lockedUntil: true, lastLoginAt: true },
    });
    expect(row.failedLoginAttempts).toBe(0);
    expect(row.lockedUntil).toBeNull();
    expect(row.lastLoginAt).toBeInstanceOf(Date);
  });

  it("refuses a candidate whose account was never activated", async () => {
    await resetAccount();
    expect(await verifyCandidateCredentials(LOGIN_EMAIL, PASSWORD)).toBeNull();
  });

  it("refuses an unknown e-mail", async () => {
    expect(await verifyCandidateCredentials("nobody@nazaha.local", PASSWORD)).toBeNull();
  });

  it("refuses the candidate when the organization is suspended", async () => {
    await giveAccount();
    await prisma.organization.update({ where: { id: orgId }, data: { isActive: false } });
    try {
      expect(await verifyCandidateCredentials(LOGIN_EMAIL, PASSWORD)).toBeNull();
    } finally {
      await prisma.organization.update({ where: { id: orgId }, data: { isActive: true } });
    }
  });
});

describe("activateCandidateAccount", () => {
  /** ينشئ رمز تفعيل صالحاً لهذا المرشح. */
  async function issueCode(): Promise<string> {
    const raw = `activation-code-${Math.random().toString(16).slice(2)}${Date.now()}`;
    await prisma.verificationToken.create({
      data: {
        tokenHash: createHash("sha256").update(raw).digest("hex"),
        candidateId,
        purpose: "LOGIN",
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    return raw;
  }

  it("turns the code into a permanent account and marks the code used", async () => {
    const code = await issueCode();
    const result = await activateCandidateAccount(code, LOGIN_EMAIL, PASSWORD);
    expect(result).toMatchObject({ candidateId, loginEmail: LOGIN_EMAIL });

    const row = await prisma.candidate.findUniqueOrThrow({
      where: { id: candidateId },
      select: { passwordHash: true, accountActivatedAt: true },
    });
    expect(row.passwordHash).toBeTruthy();
    expect(row.accountActivatedAt).toBeInstanceOf(Date);

    // الحساب صار قابلاً للدخول بالبيانات الجديدة.
    expect(await verifyCandidateCredentials(LOGIN_EMAIL, PASSWORD)).not.toBeNull();
  });

  it("refuses a code that was already used", async () => {
    const code = await issueCode();
    await activateCandidateAccount(code, LOGIN_EMAIL, PASSWORD);
    await expect(activateCandidateAccount(code, LOGIN_EMAIL, PASSWORD)).rejects.toMatchObject({
      code: "INVALID_CODE",
    });
  });

  it("refuses an unknown code", async () => {
    await expect(
      activateCandidateAccount("not-a-real-code", LOGIN_EMAIL, PASSWORD),
    ).rejects.toBeInstanceOf(CandidateAccountError);
  });

  it("refuses an expired code", async () => {
    const raw = `expired-activation-code-${Date.now()}`;
    await prisma.verificationToken.create({
      data: {
        tokenHash: createHash("sha256").update(raw).digest("hex"),
        candidateId,
        purpose: "LOGIN",
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await expect(activateCandidateAccount(raw, LOGIN_EMAIL, PASSWORD)).rejects.toMatchObject({
      code: "INVALID_CODE",
    });
  });

  it("refuses a weak password", async () => {
    const code = await issueCode();
    await expect(activateCandidateAccount(code, LOGIN_EMAIL, "short")).rejects.toMatchObject({
      code: "WEAK_PASSWORD",
    });
  });

  it("refuses a login e-mail already taken by another candidate", async () => {
    await giveAccount();
    const other = await prisma.candidate.upsert({
      where: { organizationId_nationalId: { organizationId: orgId, nationalId: "900000002" } },
      update: {},
      create: {
        nationalId: "900000002",
        nameAr: "مرشح آخر",
        email: "candidate-auth-test-other@nazaha.local",
        jobTitle: "اختبار",
        department: "اختبار",
        acceptanceDate: new Date(),
        organizationId: orgId,
        loginEmail: OTHER_LOGIN_EMAIL,
        passwordHash: await bcryptHash(PASSWORD, 12),
        accountActivatedAt: new Date(),
      },
      select: { id: true },
    });

    const code = await issueCode();
    try {
      await expect(
        activateCandidateAccount(code, OTHER_LOGIN_EMAIL, PASSWORD),
      ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    } finally {
      // لا سجلّ تدقيق هنا (الفشل قبل الكتابة) — فالحذف ممكن.
      await prisma.candidate.deleteMany({ where: { id: other.id } });
    }
  });
});

describe("candidate sessions", () => {
  it("is live only while the account is activated", async () => {
    await giveAccount();
    const principal = {
      sessionType: "candidate" as const,
      id: candidateId,
      organizationId: orgId,
      sessionIssuedAt: new Date(Date.now() + 60_000),
    };
    expect(await isPrincipalActive(principal)).toBe(true);

    await prisma.candidate.update({
      where: { id: candidateId },
      data: { accountActivatedAt: null },
    });
    expect(await isPrincipalActive(principal)).toBe(false);
  });

  it("dies when the password changes after the session was issued", async () => {
    await giveAccount();
    const older = {
      sessionType: "candidate" as const,
      id: candidateId,
      organizationId: orgId,
      sessionIssuedAt: new Date(Date.now() - 60_000),
    };
    const newer = { ...older, sessionIssuedAt: new Date(Date.now() + 60_000) };

    await prisma.candidate.update({
      where: { id: candidateId },
      data: { passwordChangedAt: new Date() },
    });
    expect(await isPrincipalActive(older)).toBe(false);
    expect(await isPrincipalActive(newer)).toBe(true);
  });
});
