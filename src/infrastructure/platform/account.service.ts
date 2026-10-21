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
