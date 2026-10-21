import { hash as bcryptHash } from "bcryptjs";
import { prisma } from "@/infrastructure/database/client";
import { recordAudit } from "@/infrastructure/audit/audit.service";
import { validatePassword } from "@/lib/password";

/*
 * حسابات الدخول — منظور مشغّل المنصة.
 *
 * مشغّل المنصة هو أعلى سلطة في المنصة: يرى كل الجهات ويضبط كلمات مرور
 * موظفيها ومشرفيها. لذلك كل عملية هنا تُسجَّل في سجل التدقيق، وتُبطل
 * الجلسات القائمة للحساب المعني (الجلسات رموز موقّعة لا تُسقط من قاعدة
 * البيانات، فيُبطَلها المقارنة بين تاريخ إصدار الجلسة وتاريخ التغيير).
 */

export interface PlatformAdminAccount {
  id: string;
  nameAr: string;
  email: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  createdAt: Date;
}

export interface TenantUserAccount {
  id: string;
  nameAr: string;
  email: string;
  isActive: boolean;
  roleName: string;
  organizationId: string;
  organizationName: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  createdAt: Date;
}

/** حساب دخول مرشح — قد يكون غير مفعّل بعد (لا حساب دخول له أصلاً). */
export interface CandidateAccount {
  id: string;
  nameAr: string;
  /** بريد التواصل الذي أدخلته الموارد البشرية. */
  contactEmail: string;
  /** بريد الدخول — فارغ قبل تفعيل الحساب. */
  loginEmail: string | null;
  organizationName: string;
  hasAccount: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  accountActivatedAt: Date | null;
  createdAt: Date;
}

/** خطأ سياسة كلمة المرور — يترجمه المسار إلى 422. */
export class PasswordPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordPolicyError";
  }
}

export async function listPlatformAdmins(): Promise<PlatformAdminAccount[]> {
  return prisma.platformAdmin.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      nameAr: true,
      email: true,
      isActive: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      lastLoginAt: true,
      passwordChangedAt: true,
      createdAt: true,
    },
  });
}

export async function listTenantUsers(): Promise<TenantUserAccount[]> {
  const rows = await prisma.user.findMany({
    orderBy: [{ organization: { nameAr: "asc" } }, { nameAr: "asc" }],
    select: {
      id: true,
      nameAr: true,
      email: true,
      isActive: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      lastLoginAt: true,
      passwordChangedAt: true,
      createdAt: true,
      organizationId: true,
      organization: { select: { nameAr: true } },
      role: { select: { name: true, nameAr: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    nameAr: r.nameAr,
    email: r.email,
    isActive: r.isActive,
    roleName: r.role.nameAr || r.role.name,
    organizationId: r.organizationId,
    organizationName: r.organization.nameAr,
    failedLoginAttempts: r.failedLoginAttempts,
    lockedUntil: r.lockedUntil,
    lastLoginAt: r.lastLoginAt,
    passwordChangedAt: r.passwordChangedAt,
    createdAt: r.createdAt,
  }));
}

/**
 * تاريخ "تغيّر كلمة المرور".
 *
 * بالملي ثانية مثل تاريخ فتح الجلسة تماماً، فلا تقع بينهما فجوة ثانية كما
 * كان الحال مع `iat` (دقته ثانية واحدة) — فالجلسة الأقدم تُبطل والجلسة
 * الأحدث تبقى بلا لبس.
 */
function changedAt() {
  return new Date();
}

/**
 * حسابات دخول المرشحين.
 *
 * بلا حدّ صارم: المشغّل يرى المرشحين الأحدث — منهم من فعّل حسابه
 * (سطر قابل لضبط كلمة المرور) ومن لم يفعّل بعد (حساب غير موجود أصلاً).
 */
export async function listCandidateAccounts(limit = 100): Promise<CandidateAccount[]> {
  const rows = await prisma.candidate.findMany({
    orderBy: [{ accountActivatedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      nameAr: true,
      email: true,
      loginEmail: true,
      passwordHash: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      lastLoginAt: true,
      passwordChangedAt: true,
      accountActivatedAt: true,
      createdAt: true,
      organization: { select: { nameAr: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    nameAr: r.nameAr,
    contactEmail: r.email,
    loginEmail: r.loginEmail,
    organizationName: r.organization.nameAr,
    hasAccount: !!r.passwordHash && !!r.loginEmail,
    failedLoginAttempts: r.failedLoginAttempts,
    lockedUntil: r.lockedUntil,
    lastLoginAt: r.lastLoginAt,
    passwordChangedAt: r.passwordChangedAt,
    accountActivatedAt: r.accountActivatedAt,
    createdAt: r.createdAt,
  }));
}

/**
 * ضبط كلمة مرور مرشح.
 *
 * إن لم يكن للحساب دخول بعد، تُنشأ كلمة المرور له الآن ويصبح الحساب مفعّلاً
 * (بريد الدخول = بريد التواصل إن كان متاحاً). كلمة المرور تُخزَّن مشفّرة ولا
 * تعود في الاستجابة — يسلّمها المشغّل لصاحب الحساب.
 */
export async function setCandidatePassword(input: {
  candidateId: string;
  password: string;
  actor: { id: string; email: string | null };
}): Promise<{ id: string; loginEmail: string; nameAr: string; organizationName: string; created: boolean }> {
  const invalid = validatePassword(input.password);
  if (invalid) throw new PasswordPolicyError(invalid);

  const candidate = await prisma.candidate.findUnique({
    where: { id: input.candidateId },
    select: {
      id: true,
      nameAr: true,
      email: true,
      loginEmail: true,
      accountActivatedAt: true,
      organization: { select: { nameAr: true } },
    },
  });
  if (!candidate) throw new PasswordPolicyError("الحساب غير موجود");

  // بريد الدخول: القائم، وإلا بريد التواصل (إن كان متاحاً ولم يُؤخذ).
  let loginEmail = candidate.loginEmail;
  let created = false;
  if (!loginEmail) {
    const wanted = candidate.email.trim().toLowerCase();
    const taken = await prisma.candidate.findUnique({
      where: { loginEmail: wanted },
      select: { id: true },
    });
    if (taken && taken.id !== candidate.id) {
      throw new PasswordPolicyError(
        "تعذّر إنشاء الحساب: بريد التواصل مسجَّل في حساب آخر — فعّل الحساب برمز الدعوة أو بريد دخول مختلف.",
      );
    }
    loginEmail = wanted;
    created = true;
  }

  const passwordHash = await bcryptHash(input.password, 12);
  const now = changedAt();

  const updated = await prisma.candidate.update({
    where: { id: candidate.id },
    data: {
      loginEmail,
      passwordHash,
      passwordChangedAt: now,
      // الحساب يُعتبر مفعّلاً فور ضبط كلمة مروره.
      accountActivatedAt: candidate.accountActivatedAt ?? now,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    select: {
      id: true,
      nameAr: true,
      loginEmail: true,
      organization: { select: { nameAr: true } },
    },
  });

  await recordAudit({
    actorType: "SYSTEM",
    action: "candidate.password_reset",
    resource: "Candidate",
    resourceId: updated.id,
    candidateId: updated.id,
    metadata: {
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      targetEmail: updated.loginEmail,
      targetOrganization: updated.organization.nameAr,
      created,
    },
  });

  return {
    id: updated.id,
    loginEmail: updated.loginEmail ?? "",
    nameAr: updated.nameAr,
    organizationName: updated.organization.nameAr,
    created,
  };
}

export async function setPlatformAdminPassword(input: {
  adminId: string;
  password: string;
  actor: { id: string; email: string | null };
}): Promise<{ id: string; email: string; nameAr: string }> {
  const invalid = validatePassword(input.password);
  if (invalid) throw new PasswordPolicyError(invalid);

  const passwordHash = await bcryptHash(input.password, 12);
  const admin = await prisma.platformAdmin.update({
    where: { id: input.adminId },
    data: {
      passwordHash,
      passwordChangedAt: changedAt(),
      // إعادة الضبط ترفع أي قفل قائم وتجعل الحساب قابلاً للدخول فوراً.
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    select: { id: true, email: true, nameAr: true },
  });

  await recordAudit({
    actorType: "SYSTEM",
    action: "platform_admin.password_reset",
    resource: "PlatformAdmin",
    resourceId: admin.id,
    metadata: {
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      targetEmail: admin.email,
      self: input.actor.id === admin.id,
    },
  });

  return admin;
}

export async function setTenantUserPassword(input: {
  userId: string;
  password: string;
  actor: { id: string; email: string | null };
}): Promise<{ id: string; email: string; nameAr: string; organizationName: string }> {
  const invalid = validatePassword(input.password);
  if (invalid) throw new PasswordPolicyError(invalid);

  const passwordHash = await bcryptHash(input.password, 12);
  const user = await prisma.user.update({
    where: { id: input.userId },
    data: {
      passwordHash,
      passwordChangedAt: changedAt(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    select: {
      id: true,
      email: true,
      nameAr: true,
      organization: { select: { nameAr: true } },
    },
  });

  await recordAudit({
    actorType: "SYSTEM",
    action: "user.password_reset",
    resource: "User",
    resourceId: user.id,
    metadata: {
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      targetEmail: user.email,
      targetOrganization: user.organization.nameAr,
    },
  });

  return { ...user, organizationName: user.organization.nameAr };
}
