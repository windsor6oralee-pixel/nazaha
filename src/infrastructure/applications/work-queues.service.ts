/*
 * قوائم العمل — «ما الذي ينتظر قراراً مني الآن؟».
 *
 * كل قائمة استعلام واحد مع عدّ وأقدم العناصر أولاً (الأطول انتظاراً أولى
 * بالمتابعة). كلها داخل نطاق الجهة عبر tenantPrisma.
 */
import type { Prisma } from "@prisma/client";
import { tenantPrisma, withTenantTransaction, type TenantTx } from "@/infrastructure/tenant/scoped-prisma";

export type WorkQueueKey =
  | "documents_to_review"
  | "awaiting_approval"
  | "awaiting_contract"
  | "awaiting_signature"
  | "ready_to_complete"
  | "offer_not_accepted"
  | "inactive_candidates";

export interface WorkQueueItem {
  applicationId: string;
  candidateId: string;
  nameAr: string;
  jobTitle: string;
  since: Date;
  /** أيام الانتظار حتى لحظة القراءة. */
  waitingDays: number;
}

export interface WorkQueue {
  key: WorkQueueKey;
  labelAr: string;
  hintAr: string;
  /** من يتصرف: الموارد البشرية أم المرشح. */
  owner: "hr" | "candidate";
  count: number;
  items: WorkQueueItem[];
}

/** مرشح في مرحلة الاستكمال لم يدخل منذ هذه المدة يُعدّ متوقفاً. */
export const INACTIVE_DAYS = 7;
const DEFAULT_LIMIT = 5;

interface QueueDef {
  key: WorkQueueKey;
  labelAr: string;
  hintAr: string;
  owner: WorkQueue["owner"];
  where: (now: Date) => Prisma.ApplicationWhereInput;
  /** الحقل الذي يقيس مدة الانتظار. */
  since: "statusChangedAt" | "updatedAt" | "createdAt";
}

export const QUEUE_DEFS: QueueDef[] = [
  {
    key: "documents_to_review",
    labelAr: "مستندات بانتظار المراجعة",
    hintAr: "رفعها المرشح وتنتظر اعتمادك أو رفضك",
    owner: "hr",
    where: () => ({ status: { in: ["IN_PROGRESS", "UNDER_REVIEW"] }, documents: { some: { status: { in: ["UPLOADED", "UNDER_REVIEW"] } } } }),
    since: "updatedAt",
  },
  {
    key: "awaiting_approval",
    labelAr: "ملفات بانتظار الاعتماد",
    hintAr: "اكتملت مستنداتها المطلوبة وتنتظر قرار مدير الموارد البشرية",
    owner: "hr",
    where: () => ({ status: "UNDER_REVIEW" }),
    since: "statusChangedAt",
  },
  {
    key: "awaiting_contract",
    labelAr: "معتمدون بلا عقد",
    hintAr: "اعتُمد الملف ولم يُصدر عقد العمل بعد",
    owner: "hr",
    where: () => ({ status: "APPROVED", contracts: { none: { status: { in: ["PENDING_SIGNATURE", "FULLY_SIGNED"] } } } }),
    since: "statusChangedAt",
  },
  {
    key: "awaiting_signature",
    labelAr: "عقود بانتظار توقيع المرشح",
    hintAr: "أُصدر العقد ولم يوقّعه المرشح",
    owner: "candidate",
    where: () => ({ status: "APPROVED", contracts: { some: { status: "PENDING_SIGNATURE" } } }),
    since: "statusChangedAt",
  },
  {
    key: "ready_to_complete",
    labelAr: "جاهزون لإكمال الانضمام",
    hintAr: "وقّعوا العقد — أكمل رحلتهم عند مباشرتهم العمل",
    owner: "hr",
    where: () => ({ status: "APPROVED", contracts: { some: { status: "FULLY_SIGNED" } } }),
    since: "statusChangedAt",
  },
  {
    key: "offer_not_accepted",
    labelAr: "لم يقبلوا العرض بعد",
    hintAr: "دُعوا ولم يقبلوا العرض الوظيفي — ذكّرهم أو أعد إرسال الدعوة",
    owner: "candidate",
    where: () => ({ status: "PENDING" }),
    since: "createdAt",
  },
  {
    key: "inactive_candidates",
    labelAr: `بلا نشاط منذ ${INACTIVE_DAYS} أيام`,
    hintAr: "في مرحلة الاستكمال ولم يدخلوا المنصة مؤخراً",
    owner: "candidate",
    where: (now) => ({
      status: "IN_PROGRESS",
      candidate: {
        OR: [
          { lastAccessAt: null },
          { lastAccessAt: { lt: new Date(now.getTime() - INACTIVE_DAYS * 24 * 60 * 60 * 1000) } },
        ],
      },
    }),
    since: "updatedAt",
  },
];

async function readQueue(tx: TenantTx, def: QueueDef, now: Date, limit: number): Promise<WorkQueue> {
  const where = def.where(now);
  const [count, rows] = await Promise.all([
    tx.application.count({ where }),
    tx.application.findMany({
      where,
      take: limit,
      // statusChangedAt is null for rows that predate it — they have waited longest.
      orderBy: [
        def.since === "statusChangedAt" ? { statusChangedAt: { sort: "asc", nulls: "first" } } : { [def.since]: "asc" },
        { createdAt: "asc" },
      ],
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        statusChangedAt: true,
        candidate: { select: { id: true, nameAr: true, jobTitle: true } },
      },
    }),
  ]);
  return {
    key: def.key,
    labelAr: def.labelAr,
    hintAr: def.hintAr,
    owner: def.owner,
    count,
    items: rows.map((r) => ({
      applicationId: r.id,
      candidateId: r.candidate.id,
      nameAr: r.candidate.nameAr,
      jobTitle: r.candidate.jobTitle,
      since: r[def.since] ?? r.createdAt,
      waitingDays: Math.max(0, Math.floor((now.getTime() - (r[def.since] ?? r.createdAt).getTime()) / 86_400_000)),
    })),
  };
}

export async function getWorkQueues(organizationId: string, opts: { limit?: number; now?: Date } = {}): Promise<WorkQueue[]> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const db = tenantPrisma(organizationId);
  // تسلسلياً داخل معاملة واحدة: اتصال واحد عليه سياق الجهة.
  return withTenantTransaction(db, organizationId, async (tx) => {
    const out: WorkQueue[] = [];
    for (const def of QUEUE_DEFS) out.push(await readQueue(tx, def, now, limit));
    return out;
  });
}
