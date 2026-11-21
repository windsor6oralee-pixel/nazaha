/**
 * تطبيق بيانات الدخول الرسمية من قائمة المقبولين للتوظيف.
 *
 * القائمة (بريد إلكتروني + كلمة مرور لكل صف) هي المصدر الرسمي الوحيد لحسابات
 * المقبولين: كل مرشح في القائمة يحصل على حساب دائم جاهز للدخول فوراً — بلا
 * رمز دعوة وبلا إرسال أي بريد.
 *
 * applySheetCredentials تكتب:
 *   - loginEmail            = بريد الشيت (منزوع الأحرف الكبيرة، فريد)
 *   - passwordHash          = bcrypt لكلمة الشيت كما هي (بلا فحص سياسة)
 *   - accountActivatedAt    = الآن — التفعيل فوري
 *   - passwordChangedAt     = الآن (تُبطِل جلسات الحساب القديمة)
 *   - failedLoginAttempts   = 0   ·   lockedUntil = null
 *
 * وتسجّل العملية في سجل التدقيق باسم `candidate.credentials_imported`
 * — بلا أي أثر لكلمة المرور نفسها.
 *
 * لا يُرسَل أي بريد من هنا: تسليم البيانات يتم من القائمة مباشرة.
 */
import { hash } from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../database/client";

export class CandidateProvisioningError extends Error {
  constructor(
    readonly code: "EMAIL_TAKEN" | "MISSING_PASSWORD" | "NO_WORKFLOW",
    message: string,
  ) {
    super(message);
    this.name = "CandidateProvisioningError";
  }
}

export interface SheetCredentialOptions {
  /** تمرير معاملة مفتوحة ليجري كل شيء ذرّياً مع إنشاء المرشح. */
  tx?: Prisma.TransactionClient;
  /** مصدر الحدث في سجل التدقيق (import_batch / direct_import / script). */
  source?: string;
  /** المستخدم الذي نفّذ الاستيراد — يُسجَّل في سجل التدقيق إن وُجد. */
  userId?: string | null;
}

/**
 * ضبط حساب مرشح ببيانات القائمة الرسمية: بريد الدخول + كلمة المرور كما هي +
 * تفعيل فوري. ترمي `EMAIL_TAKEN` إن كان البريد محجوزاً لحساب مرشح آخر.
 *
 * بلا `tx` تعمل بمعاملتها الخاصة؛ مع `tx` تشارك معاملة النداء (ذرّية مع
 * إنشاء المرشح في نفس الاستيراد).
 */
export async function applySheetCredentials(
  candidateId: string,
  loginEmail: string,
  password: string,
  opts: SheetCredentialOptions = {},
): Promise<void> {
  const email = loginEmail.trim().toLowerCase();
  if (!email) throw new CandidateProvisioningError("EMAIL_TAKEN", "بريد الدخول مطلوب");
  if (!password) throw new CandidateProvisioningError("MISSING_PASSWORD", "كلمة المرور مطلوبة");

  const db = opts.tx ?? prisma;

  const clash = await db.candidate.findUnique({
    where: { loginEmail: email },
    select: { id: true },
  });
  if (clash && clash.id !== candidateId) {
    throw new CandidateProvisioningError("EMAIL_TAKEN", `البريد ${email} مستخدم لحساب مرشح آخر`);
  }

  const passwordHash = await hash(password, 12);
  const now = new Date();

  await db.candidate.update({
    where: { id: candidateId },
    data: {
      loginEmail: email,
      passwordHash,
      accountActivatedAt: now,
      passwordChangedAt: now,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await db.auditLog.create({
    data: {
      actorType: opts.userId ? "USER" : "SYSTEM",
      action: "candidate.credentials_imported",
      resource: "Candidate",
      resourceId: candidateId,
      candidateId,
      userId: opts.userId ?? null,
      metadata: { source: opts.source ?? "accepted_sheet", activated: true },
    },
  });
}

/**
 * البحث عن مرشح في الجهة بالبريد (بريد التواصل أو بريد الدخول) —
 * أساس قاعدة «القائمة هي المصدر الرسمي»: صف موجود يُحدَّث حسابه لا يُكرَّر.
 */
export async function findAcceptedCandidate(
  organizationId: string,
  email: string,
): Promise<{ id: string } | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  return prisma.candidate.findFirst({
    where: { organizationId, OR: [{ email: e }, { loginEmail: e }] },
    select: { id: true },
  });
}

/**
 * تأمين وجود طلب توظيف فعّال للمرشح قبل تسليم الحساب.
 *
 * القاعدة محافظة: إن لم يكن للمرشح **أي** طلب يُنشأ طلب بحالة APPROVED
 * (+ تهيئة الخطوات والوثائق) ليصبح الدخول ممكناً. أما الطلبات القائمة —
 * بأي حالة — فلا تُمَس: قرارات الموارد البشرية لا تُعاد كتابتها من الاستيراد.
 */
export async function ensureImportApplication(
  candidateId: string,
  organizationId: string,
  opts: SheetCredentialOptions = {},
): Promise<{ applicationId: string | null; created: boolean }> {
  const db = opts.tx ?? prisma;

  const existing = await db.application.findFirst({
    where: { candidateId },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { applicationId: existing.id, created: false };

  const workflow = await db.workflow.findFirst({
    where: { organizationId, isDefault: true, isActive: true },
    include: { steps: { orderBy: { order: "asc" as const }, include: { documentRequirements: true } } },
  });
  if (!workflow) {
    throw new CandidateProvisioningError("NO_WORKFLOW", "لا يوجد سير عمل افتراضي للمنظمة");
  }

  const application = await db.application.create({
    data: {
      candidateId,
      organizationId,
      workflowId: workflow.id,
      status: "APPROVED",
      approvedAt: new Date(),
    },
    select: { id: true },
  });

  await db.onboardingProcess.create({
    data: {
      applicationId: application.id,
      steps: {
        create: workflow.steps.map((s) => ({ workflowStepId: s.id, status: "PENDING" as const })),
      },
    },
  });

  const docs = workflow.steps.flatMap((s) =>
    s.documentRequirements.map((req) => ({
      type: req.documentType,
      nameAr: req.nameAr,
      isRequired: req.isRequired,
      applicationId: application.id,
    })),
  );
  if (docs.length > 0) await db.document.createMany({ data: docs });

  await db.auditLog.create({
    data: {
      actorType: opts.userId ? "USER" : "SYSTEM",
      action: "candidate.import_application_created",
      resource: "Application",
      resourceId: application.id,
      candidateId,
      applicationId: application.id,
      userId: opts.userId ?? null,
      metadata: { source: opts.source ?? "accepted_sheet" },
    },
  });

  return { applicationId: application.id, created: true };
}
