/**
 * EmailTemplate service — CRUD over the unified template library, plus a
 * `getDefaultFor(kind)` helper so send flows can look up "the current default
 * invitation template for this org" without re-implementing selection logic.
 *
 * Tenancy: every call takes organizationId first; never trust a client-supplied
 * template id without re-checking it belongs to the caller's org.
 */
import { prisma } from "../database/client";
import type { EmailTemplateKind } from "@prisma/client";

export type { EmailTemplateKind };

export interface EmailTemplateRow {
  id: string;
  kind: EmailTemplateKind;
  nameAr: string;
  subjectAr: string;
  bodyAr: string;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: Date;
}

export async function listEmailTemplates(organizationId: string, kind?: EmailTemplateKind): Promise<EmailTemplateRow[]> {
  return prisma.emailTemplate.findMany({
    where: { organizationId, isActive: true, ...(kind ? { kind } : {}) },
    orderBy: [{ kind: "asc" }, { isDefault: "desc" }, { nameAr: "asc" }],
    select: { id: true, kind: true, nameAr: true, subjectAr: true, bodyAr: true, isDefault: true, isActive: true, updatedAt: true },
  });
}

export async function getEmailTemplate(organizationId: string, id: string): Promise<EmailTemplateRow | null> {
  const row = await prisma.emailTemplate.findFirst({
    where: { id, organizationId },
    select: { id: true, kind: true, nameAr: true, subjectAr: true, bodyAr: true, isDefault: true, isActive: true, updatedAt: true },
  });
  return row;
}

export async function getDefaultFor(organizationId: string, kind: EmailTemplateKind): Promise<EmailTemplateRow | null> {
  return prisma.emailTemplate.findFirst({
    where: { organizationId, kind, isActive: true, isDefault: true },
    select: { id: true, kind: true, nameAr: true, subjectAr: true, bodyAr: true, isDefault: true, isActive: true, updatedAt: true },
  });
}

export interface UpsertEmailTemplateInput {
  kind: EmailTemplateKind;
  nameAr: string;
  subjectAr: string;
  bodyAr: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export async function createEmailTemplate(organizationId: string, userId: string, input: UpsertEmailTemplateInput): Promise<EmailTemplateRow> {
  // "default" is exclusive per (org, kind) — flipping one on must flip others off.
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.emailTemplate.updateMany({
        where: { organizationId, kind: input.kind, isDefault: true },
        data:  { isDefault: false },
      });
    }
    const row = await tx.emailTemplate.create({
      data: {
        organizationId,
        kind: input.kind,
        nameAr: input.nameAr.trim(),
        subjectAr: input.subjectAr.trim(),
        bodyAr: input.bodyAr,
        isDefault: !!input.isDefault,
        isActive: input.isActive !== false,
        createdByUserId: userId,
      },
      select: { id: true, kind: true, nameAr: true, subjectAr: true, bodyAr: true, isDefault: true, isActive: true, updatedAt: true },
    });
    return row;
  });
}

export async function updateEmailTemplate(organizationId: string, id: string, input: Partial<UpsertEmailTemplateInput>): Promise<EmailTemplateRow> {
  const existing = await prisma.emailTemplate.findFirst({ where: { id, organizationId }, select: { kind: true } });
  if (!existing) throw new Error("القالب غير موجود");

  const nextKind = input.kind ?? existing.kind;
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.emailTemplate.updateMany({
        where: { organizationId, kind: nextKind, isDefault: true, NOT: { id } },
        data:  { isDefault: false },
      });
    }
    const row = await tx.emailTemplate.update({
      where: { id },
      data: {
        ...(input.kind       ? { kind: input.kind } : {}),
        ...(input.nameAr     ? { nameAr: input.nameAr.trim() } : {}),
        ...(input.subjectAr  ? { subjectAr: input.subjectAr.trim() } : {}),
        ...(input.bodyAr     !== undefined ? { bodyAr: input.bodyAr } : {}),
        ...(input.isDefault  !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.isActive   !== undefined ? { isActive: input.isActive } : {}),
      },
      select: { id: true, kind: true, nameAr: true, subjectAr: true, bodyAr: true, isDefault: true, isActive: true, updatedAt: true },
    });
    return row;
  });
}

export async function deleteEmailTemplate(organizationId: string, id: string): Promise<void> {
  // Soft delete so references stay resolvable in historical logs.
  const existing = await prisma.emailTemplate.findFirst({ where: { id, organizationId }, select: { id: true } });
  if (!existing) return;
  await prisma.emailTemplate.update({ where: { id }, data: { isActive: false, isDefault: false } });
}

// ─── Defaults ────────────────────────────────────────────────────────────────

/**
 * Seeds the per-org default template library if nothing exists yet. Called on
 * first open of /admin/email-templates so a brand-new tenant immediately sees
 * useful starters instead of a blank list.
 */
export async function ensureDefaultTemplates(organizationId: string): Promise<void> {
  const count = await prisma.emailTemplate.count({ where: { organizationId } });
  if (count > 0) return;

  const defaults: UpsertEmailTemplateInput[] = [
    {
      kind: "INVITATION",
      nameAr: "دعوة قبول وظيفي — افتراضي",
      subjectAr: "مرحباً {{candidate.firstName}} — بيانات دخولك إلى {{organization.nameAr}}",
      bodyAr:
        "عزيزي/عزيزتي {{candidate.firstName}}،\n\n" +
        "يسعدنا تهنئتك على قبولك لوظيفة {{candidate.jobTitle}} في قسم {{candidate.department}} لدى {{organization.nameAr}}.\n\n" +
        "اسم المستخدم: {{candidate.email}}\n" +
        "كلمة المرور المؤقتة ترسل في جسم الدعوة الآلية.\n\n" +
        "يُرجى تسجيل الدخول لاستكمال بيانات الانضمام ورفع المستندات المطلوبة.",
      isDefault: true,
    },
    {
      kind: "ALERT",
      nameAr: "تنبيه عام — افتراضي",
      subjectAr: "📣 رسالة من فريق الموارد البشرية — {{organization.nameAr}}",
      bodyAr:
        "عزيزي/عزيزتي {{candidate.firstName}}،\n\n" +
        "لديك رسالة جديدة من فريق الموارد البشرية. يُرجى الدخول إلى منصة نزاهة للاطّلاع عليها والإقرار بالاستلام.",
      isDefault: true,
    },
    {
      kind: "HEALTH_CERT",
      nameAr: "تذكير الشهادة الصحية — افتراضي",
      subjectAr: "⚕️ تذكير: الشهادة الصحية مطلوبة — {{candidate.firstName}}",
      bodyAr:
        "عزيزي/عزيزتي {{candidate.firstName}}،\n\n" +
        "ضمن متطلبات انضمامك إلى {{organization.nameAr}}، يلزمك تقديم الشهادة الصحية المعتمدة من جهة مرخّصة.\n" +
        "يُرجى رفع الشهادة من خلال حسابك على منصة نزاهة قبل تاريخ المباشرة.",
      isDefault: true,
    },
    {
      kind: "GENERIC",
      nameAr: "رسالة حرّة — افتراضي",
      subjectAr: "رسالة من {{organization.nameAr}}",
      bodyAr:
        "عزيزي/عزيزتي {{candidate.firstName}}،\n\n" +
        "اكتب هنا نص الرسالة…",
      isDefault: true,
    },
  ];

  await prisma.$transaction(
    defaults.map((d) => prisma.emailTemplate.create({
      data: {
        organizationId,
        kind: d.kind,
        nameAr: d.nameAr,
        subjectAr: d.subjectAr,
        bodyAr: d.bodyAr,
        isDefault: !!d.isDefault,
        isActive: true,
      },
    })),
  );
}
