import { createHash } from "node:crypto";
import { compare, hash } from "bcryptjs";
import type { ApplicationStatus } from "@prisma/client";
import type { SessionType } from "@/types/next-auth";
import { prisma } from "@/infrastructure/database/client";
import { validatePassword } from "@/lib/password";

// Credential verification lives here (not inside the NextAuth config) so it can be
// unit-tested directly. Each verifier returns the session principal or null; it never
// throws for a wrong credential.

export interface AuthPrincipal {
  id: string;
  email: string;
  nameAr: string;
  role: string;
  sessionType: SessionType;
  organizationId: string;
  applicationId?: string;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60_000; // 15 minutes

export async function verifyHRCredentials(email: string, password: string): Promise<AuthPrincipal | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { role: true, organization: { select: { isActive: true } } },
  });
  if (!user || !user.isActive || !user.organization.isActive) return null;

  // Lockout check — return null without revealing whether the account exists
  if (user.lockedUntil && user.lockedUntil > new Date()) return null;

  const passwordOk = await compare(password, user.passwordHash);
  if (!passwordOk) {
    const attempts = user.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });
    return null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { actorType: "USER", action: "user.login", resource: "User", resourceId: user.id, userId: user.id },
  });

  return {
    id: user.id,
    email: user.email,
    nameAr: user.nameAr,
    role: user.role.name,
    sessionType: "hr_user",
    organizationId: user.organizationId,
  };
}

/**
 * حالات الطلب التي يُسمح فيها بدخول المرشح إلى بوابته.
 *
 * الحالات النهائية (مرفوض/منسحب/مكتمل) تُغلق الباب: لا معنى لحساب دخول لمن
 * انتهت علاقته بالجهة. الباقي — قيد المراجعة أو مقبول — دخوله مشروع.
 */
const CANDIDATE_LOGIN_STATUSES: ApplicationStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "UNDER_REVIEW",
  "APPROVED",
];

/** أحدث طلب نشط للمرشح — هو الذي يحدّد حالة «مقبول» في النظام. */
async function findActiveApplication(candidateId: string) {
  return prisma.application.findFirst({
    where: { candidateId, status: { in: CANDIDATE_LOGIN_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * دخول المرشح ببريد وكلمة مرور.
 *
 * ثلاث شروط مجتمعة: الحساب مفعّل (له كلمة مرور)، والجهة ما زالت نشطة، وله
 * طلب نشط. كلمة المرور تُقارن بـ bcrypt، والمقارنة الفاشلة تُحسب محاولةً
 * حتى يُقفل الحساب بعد خمس محاولات.
 */
export async function verifyCandidateCredentials(
  email: string,
  password: string,
): Promise<AuthPrincipal | null> {
  const loginEmail = email.trim().toLowerCase();
  if (!loginEmail || !password) return null;

  const candidate = await prisma.candidate.findUnique({
    where: { loginEmail },
    include: { organization: { select: { isActive: true } } },
  });
  // حساب غير مفعّل أو جهة معطّلة — نردّ null دون كشف السبب.
  if (!candidate || !candidate.passwordHash || !candidate.organization.isActive) return null;

  if (candidate.lockedUntil && candidate.lockedUntil > new Date()) return null;

  const passwordOk = await compare(password, candidate.passwordHash);
  if (!passwordOk) {
    const attempts = candidate.failedLoginAttempts + 1;
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });
    return null;
  }

  const application = await findActiveApplication(candidate.id);
  // لا طلب نشط ⇒ لا دخول، حتى لو كانت كلمة المرور صحيحة.
  if (!application) return null;

  const now = new Date();
  await prisma.candidate.update({
    where: { id: candidate.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
      lastAccessAt: now,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorType: "CANDIDATE",
      action: "candidate.login",
      resource: "Candidate",
      resourceId: candidate.id,
      candidateId: candidate.id,
      applicationId: application.id,
    },
  });

  return {
    id: candidate.id,
    email: candidate.email,
    nameAr: candidate.nameAr,
    role: "candidate",
    sessionType: "candidate",
    organizationId: candidate.organizationId,
    applicationId: application.id,
  };
}

/** سبب فشل تفعيل حساب المرشح — يُترجم إلى رسالة في الواجهة. */
export type CandidateAccountErrorCode =
  | "INVALID_CODE"
  | "EMAIL_TAKEN"
  | "WEAK_PASSWORD"
  | "NO_ACTIVE_APPLICATION";

/** خطأ تفعيل حساب المرشح. */
export class CandidateAccountError extends Error {
  constructor(
    readonly code: CandidateAccountErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CandidateAccountError";
  }
}

/**
 * تفعيل حساب المرشح برمز الدعوة.
 *
 * رمز الدعوة هنا ليس وسيلة دخول بل **إثبات هوية لمرة واحدة**: يتحوّل إلى
 * حساب دائم (بريد + كلمة مرور) ثم يُوسم «مُستخدم» فلا يعود صالحاً.
 */
export async function activateCandidateAccount(
  rawToken: string,
  loginEmail: string,
  password: string,
): Promise<{ candidateId: string; loginEmail: string }> {
  const email = loginEmail.trim().toLowerCase();

  const problem = validatePassword(password);
  if (problem) throw new CandidateAccountError("WEAK_PASSWORD", problem);
  if (!email) throw new CandidateAccountError("EMAIL_TAKEN", "بريد الدخول مطلوب");

  const token = await prisma.verificationToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { candidate: { include: { organization: { select: { isActive: true } } } } },
  });
  if (!token || token.usedAt || token.expiresAt < new Date()) {
    throw new CandidateAccountError(
      "INVALID_CODE",
      "رمز التفعيل غير صحيح أو منتهي الصلاحية — اطلب رمزاً جديداً من الموارد البشرية.",
    );
  }

  const candidate = token.candidate;
  if (!candidate.organization.isActive) {
    throw new CandidateAccountError("INVALID_CODE", "حساب الجهة غير نشط.");
  }

  const application = await findActiveApplication(candidate.id);
  if (!application) {
    throw new CandidateAccountError(
      "NO_ACTIVE_APPLICATION",
      "لا يوجد طلب نشط لهذا الحساب — راجع الموارد البشرية في جهتك.",
    );
  }

  const taken = await prisma.candidate.findUnique({
    where: { loginEmail: email },
    select: { id: true },
  });
  if (taken && taken.id !== candidate.id) {
    throw new CandidateAccountError("EMAIL_TAKEN", "هذا البريد مسجَّل في حساب آخر.");
  }

  const passwordHash = await hash(password, 12);
  const now = new Date();

  await prisma.$transaction([
    prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        loginEmail: email,
        passwordHash,
        accountActivatedAt: now,
        passwordChangedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.verificationToken.update({ where: { id: token.id }, data: { usedAt: now } }),
  ]);

  await prisma.auditLog.create({
    data: {
      actorType: "CANDIDATE",
      action: "candidate.account_activated",
      resource: "Candidate",
      resourceId: candidate.id,
      candidateId: candidate.id,
      applicationId: application.id,
    },
  });

  return { candidateId: candidate.id, loginEmail: email };
}

export async function verifyPlatformCredentials(email: string, password: string): Promise<AuthPrincipal | null> {
  const admin = await prisma.platformAdmin.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!admin || !admin.isActive) return null;

  if (admin.lockedUntil && admin.lockedUntil > new Date()) return null;

  const passwordOk = await compare(password, admin.passwordHash);
  if (!passwordOk) {
    const attempts = admin.failedLoginAttempts + 1;
    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });
    return null;
  }

  await prisma.platformAdmin.update({
    where: { id: admin.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { actorType: "SYSTEM", action: "platform_admin.login", resource: "PlatformAdmin", resourceId: admin.id },
  });

  return {
    id: admin.id,
    email: admin.email,
    nameAr: admin.nameAr,
    role: "platform_admin",
    sessionType: "platform_admin",
    organizationId: "",
  };
}

// ── Per-request liveness ─────────────────────────────────────────────────────
// JWT sessions outlive database state, so tenant context re-checks that both the
// organization and (for staff) the user are still active.
//
// No caching: a cached answer would let a session live for up to the cache TTL
// after its password was reset — and password resets are exactly the moment a
// stale session must not survive. The check is one indexed primary-key lookup,
// and the shell no longer asks for the context a second time.

/**
 * يحوّل تاريخ الجلسة إلى Date.
 *
 * الجلسة تمرّ عبر JSON داخل NextAuth، فقد يعود تاريخها نصاً لا كائن Date.
 */
export function toSessionDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * حالة الحساب — لا حالة الجلسة.
 *
 * الفصل مقصود: «الحساب نشط؟» حالة قاعدة البيانات، أما «هل هذه الجلسة أقدم من
 * تغيير كلمة المرور؟» فحساب خالص يتم لكل طلب.
 */
export function isSessionStale(
  sessionIssuedAt: Date | string | null | undefined,
  passwordChangedAt: Date | null | undefined,
): boolean {
  if (!passwordChangedAt) return false;
  const issued = toSessionDate(sessionIssuedAt);
  // جلسة بلا تاريخ إصدار لا يمكن تقدير عمرها — تُبطَل احتياطاً.
  if (!issued) return true;
  return issued.getTime() < passwordChangedAt.getTime();
}

export async function isPrincipalActive(principal: {
  sessionType: SessionType;
  id: string;
  organizationId: string;
  sessionIssuedAt?: Date | string | null;
}): Promise<boolean> {
  if (principal.sessionType === "platform_admin") {
    const a = await prisma.platformAdmin.findUnique({
      where: { id: principal.id },
      select: { isActive: true, passwordChangedAt: true },
    });
    return !!a && a.isActive && !isSessionStale(principal.sessionIssuedAt, a.passwordChangedAt);
  }

  if (principal.sessionType === "hr_user") {
    const u = await prisma.user.findUnique({
      where: { id: principal.id },
      select: {
        isActive: true,
        organizationId: true,
        passwordChangedAt: true,
        organization: { select: { isActive: true } },
      },
    });
    return (
      !!u &&
      u.isActive &&
      u.organization.isActive &&
      u.organizationId === principal.organizationId &&
      !isSessionStale(principal.sessionIssuedAt, u.passwordChangedAt)
    );
  }

  const c = await prisma.candidate.findUnique({
    where: { id: principal.id },
    select: {
      organizationId: true,
      passwordChangedAt: true,
      accountActivatedAt: true,
      organization: { select: { isActive: true } },
    },
  });
  // المرشح يدخل بحساب مفعّل (له كلمة مرور)، وتغيير كلمته يُبطل جلساته
  // القديمة — كما في كل دور آخر.
  return (
    !!c &&
    c.organization.isActive &&
    c.organizationId === principal.organizationId &&
    !!c.accountActivatedAt &&
    !isSessionStale(principal.sessionIssuedAt, c.passwordChangedAt)
  );
}
