/*
 * إدارة موظفي الجهة — يتولاها مدير النظام في الجهة نفسها.
 *
 * قاعدتان لا تُكسران: لا يعطّل المدير نفسه ولا يخفض دوره، ولا تبقى الجهة
 * بلا مدير نظام نشط واحد على الأقل.
 */
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { tenantPrisma, withTenantTransaction, type TenantTx } from "@/infrastructure/tenant/scoped-prisma";
import { SYSTEM_ROLES, type SystemRoleName } from "@/infrastructure/services/role.service";
import { validatePassword } from "@/lib/password";

export class StaffError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 422,
    message: string,
  ) {
    super(message);
    this.name = "StaffError";
  }
}

export interface StaffMember {
  id: string;
  email: string;
  nameAr: string;
  phone: string | null;
  role: SystemRoleName;
  roleAr: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
  /** مقفل الآن بسبب محاولات دخول فاشلة. */
  isLocked: boolean;
  createdAt: Date;
}

const ROLE_NAMES = new Set<string>(SYSTEM_ROLES.map((r) => r.name));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isSystemRole(v: unknown): v is SystemRoleName {
  return typeof v === "string" && ROLE_NAMES.has(v);
}

const SELECT = {
  id: true, email: true, nameAr: true, phone: true, isActive: true,
  lastLoginAt: true, lockedUntil: true, createdAt: true,
  role: { select: { name: true, nameAr: true } },
} as const;

type Row = Prisma.UserGetPayload<{ select: typeof SELECT }>;

function toMember(u: Row): StaffMember {
  return {
    id: u.id, email: u.email, nameAr: u.nameAr, phone: u.phone,
    role: u.role.name as SystemRoleName, roleAr: u.role.nameAr,
    isActive: u.isActive, lastLoginAt: u.lastLoginAt, lockedUntil: u.lockedUntil,
    isLocked: !!u.lockedUntil && u.lockedUntil.getTime() > Date.now(), createdAt: u.createdAt,
  };
}

export async function listStaff(organizationId: string): Promise<StaffMember[]> {
  const rows = await tenantPrisma(organizationId).user.findMany({
    select: SELECT,
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });
  return rows.map(toMember);
}

async function roleId(tx: TenantTx, name: SystemRoleName): Promise<string> {
  const role = await tx.role.findFirst({ where: { name }, select: { id: true } });
  if (!role) throw new StaffError(422, "الدور غير موجود في هذه الجهة");
  return role.id;
}

async function activeAdminCount(tx: TenantTx, excludeUserId?: string) {
  return tx.user.count({
    where: { isActive: true, role: { name: "admin" }, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
  });
}

export interface CreateStaffInput {
  email: string;
  nameAr: string;
  phone?: string | null;
  role: SystemRoleName;
  password: string;
}

export function validateCreateStaff(input: Partial<Record<keyof CreateStaffInput, unknown>>): string | null {
  if (typeof input.nameAr !== "string" || input.nameAr.trim().length < 2) return "الاسم مطلوب";
  if (typeof input.email !== "string" || !EMAIL_RE.test(input.email.trim())) return "البريد الإلكتروني غير صالح";
  if (!isSystemRole(input.role)) return "الدور غير صالح";
  if (input.phone != null && typeof input.phone !== "string") return "رقم الجوال غير صالح";
  return validatePassword(typeof input.password === "string" ? input.password : null);
}

export async function createStaff(organizationId: string, actorUserId: string, input: CreateStaffInput): Promise<StaffMember> {
  const problem = validateCreateStaff(input);
  if (problem) throw new StaffError(422, problem);
  const passwordHash = await hash(input.password, 12);
  const db = tenantPrisma(organizationId);

  try {
    return await withTenantTransaction(db, organizationId, async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.trim().toLowerCase(),
          nameAr: input.nameAr.trim(),
          phone: input.phone?.trim() || null,
          passwordHash,
          passwordChangedAt: new Date(),
          organizationId,
          roleId: await roleId(tx, input.role),
          isActive: true,
        },
        select: SELECT,
      });
      await tx.auditLog.create({
        data: {
          actorType: "USER", userId: actorUserId,
          action: "user.created", resource: "User", resourceId: user.id,
          metadata: { email: user.email, role: input.role },
        },
      });
      return toMember(user);
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new StaffError(409, "هذا البريد مسجّل لحساب آخر");
    }
    throw e;
  }
}

export interface UpdateStaffInput {
  nameAr?: string;
  phone?: string | null;
  role?: SystemRoleName;
  isActive?: boolean;
  password?: string;
}

export async function updateStaff(
  organizationId: string,
  actorUserId: string,
  userId: string,
  input: UpdateStaffInput,
): Promise<StaffMember> {
  if (input.nameAr !== undefined && input.nameAr.trim().length < 2) throw new StaffError(422, "الاسم مطلوب");
  if (input.role !== undefined && !isSystemRole(input.role)) throw new StaffError(422, "الدور غير صالح");
  if (input.password !== undefined) {
    const problem = validatePassword(input.password);
    if (problem) throw new StaffError(422, problem);
  }
  const passwordHash = input.password !== undefined ? await hash(input.password, 12) : null;
  const db = tenantPrisma(organizationId);

  return withTenantTransaction(db, organizationId, async (tx) => {
    const current = await tx.user.findUnique({ where: { id: userId }, select: SELECT });
    if (!current) throw new StaffError(404, "الموظف غير موجود");

    const self = userId === actorUserId;
    if (self && input.isActive === false) throw new StaffError(409, "لا يمكنك تعطيل حسابك");
    if (self && input.role !== undefined && input.role !== current.role.name) {
      throw new StaffError(409, "لا يمكنك تغيير دورك بنفسك");
    }

    const losesAdmin =
      current.role.name === "admin" && current.isActive &&
      ((input.role !== undefined && input.role !== "admin") || input.isActive === false);
    if (losesAdmin && (await activeAdminCount(tx, userId)) === 0) {
      throw new StaffError(409, "يجب أن يبقى في الجهة مدير نظام نشط واحد على الأقل");
    }

    const now = new Date();
    const data: Prisma.UserUpdateInput = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (input.nameAr !== undefined && input.nameAr.trim() !== current.nameAr) {
      data.nameAr = input.nameAr.trim();
      changes.nameAr = { from: current.nameAr, to: data.nameAr };
    }
    if (input.phone !== undefined && (input.phone?.trim() || null) !== current.phone) {
      data.phone = input.phone?.trim() || null;
      changes.phone = { from: current.phone, to: data.phone };
    }
    if (input.role !== undefined && input.role !== current.role.name) {
      data.role = { connect: { id: await roleId(tx, input.role) } };
      changes.role = { from: current.role.name, to: input.role };
    }
    if (input.isActive !== undefined && input.isActive !== current.isActive) {
      data.isActive = input.isActive;
      changes.isActive = { from: current.isActive, to: input.isActive };
    }
    if (passwordHash) {
      // تغيير كلمة المرور يُبطل كل الجلسات المفتوحة ويرفع أي قفل.
      Object.assign(data, { passwordHash, passwordChangedAt: now, failedLoginAttempts: 0, lockedUntil: null });
    }
    // تغيير الدور أو التعطيل يجب أن يسري فوراً: الجلسة تحمل الدور في الرمز.
    if ((changes.role || changes.isActive) && !passwordHash) data.passwordChangedAt = now;

    if (Object.keys(data).length === 0) return toMember(current);

    const updated = await tx.user.update({ where: { id: userId }, data, select: SELECT });
    await tx.auditLog.create({
      data: {
        actorType: "USER", userId: actorUserId,
        action: passwordHash && Object.keys(changes).length === 0 ? "user.password_reset" : "user.updated",
        resource: "User", resourceId: userId,
        metadata: { changes, ...(passwordHash ? { passwordReset: true } : {}) },
      },
    });
    return toMember(updated);
  });
}
