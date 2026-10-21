import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/infrastructure/database/client";
import { getHRStats } from "@/infrastructure/repositories/candidate.repository";
import { mapAppStatus } from "@/infrastructure/repositories/mappers";
import { parseStatusFilter, STATUS_FILTER_KEYS } from "@/lib/candidate-filter";

/*
 * عدّادات لوحة الموارد البشرية:
 *  - العدّ يتبع **المرشح** لا الطلب، ويأخذ حالة آخر طلب له — نفس الحالة التي
 *    تعرضها قائمة المرشحين، فيطابق العدّاد ما يراه المستخدم بعد الضغط عليه.
 *  - التحويل من حالات قاعدة البيانات إلى مفاتيح الواجهة يجب أن يبقى واحداً:
 *    `APPROVED` (مقبول) ≠ `COMPLETED` (مكتمل)، والمنسحب يُعرض «مرفوض».
 */

const SLUG = `hr-stats-test-${Date.now()}`;

let orgId: string;
let workflowId: string;
const candidateIds: string[] = [];

async function createCandidate(nationalId: string, nameAr: string) {
  const c = await prisma.candidate.create({
    data: {
      organizationId: orgId,
      nationalId,
      nameAr,
      email: `${nationalId}@example.com`,
      jobTitle: "اختبار",
      department: "اختبار",
      acceptanceDate: new Date("2026-01-01"),
    },
  });
  candidateIds.push(c.id);
  return c;
}

async function createApplication(
  candidateId: string,
  status: "PENDING" | "IN_PROGRESS" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "COMPLETED" | "WITHDRAWN",
  createdAt: Date,
) {
  return prisma.application.create({
    data: {
      candidateId,
      organizationId: orgId,
      workflowId,
      status,
      createdAt,
    },
  });
}

beforeAll(async () => {
  const mof = await prisma.organization.findFirstOrThrow({ where: { slug: "mof" } });
  workflowId = (
    await prisma.workflow.findFirstOrThrow({ where: { organizationId: mof.id } })
  ).id;

  orgId = (
    await prisma.organization.create({
      data: { nameAr: "جهة اختبار العدّادات", slug: SLUG },
    })
  ).id;

  const day = 24 * 60 * 60 * 1000;
  const base = new Date("2026-03-01T09:00:00.000Z");

  const approved = await createCandidate("900000101", "مرشح مقبول");
  await createApplication(approved.id, "APPROVED", base);

  const completed = await createCandidate("900000102", "مرشح مكتمل");
  await createApplication(completed.id, "COMPLETED", base);

  const inProgress = await createCandidate("900000103", "مرشح قيد الإنجاز");
  await createApplication(inProgress.id, "IN_PROGRESS", base);

  const underReview = await createCandidate("900000104", "مرشح تحت المراجعة");
  await createApplication(underReview.id, "UNDER_REVIEW", base);

  const pending = await createCandidate("900000105", "مرشح بانتظار الإجراء");
  await createApplication(pending.id, "PENDING", base);

  const rejected = await createCandidate("900000106", "مرشح مرفوض");
  await createApplication(rejected.id, "REJECTED", base);

  const withdrawn = await createCandidate("900000107", "مرشح منسحب");
  await createApplication(withdrawn.id, "WITHDRAWN", base);

  // بلا أي طلب — يُعرض «قيد الانتظار» في القائمة.
  await createCandidate("900000108", "مرشح بلا طلب");

  // طلبان: قديم مرفوض وأحدث مقبول — يُعدّ مرة واحدة تحت «مقبول».
  const resubmitted = await createCandidate("900000109", "مرشح أعاد التقديم");
  await createApplication(resubmitted.id, "REJECTED", new Date(base.getTime() - day));
  await createApplication(resubmitted.id, "APPROVED", base);
});

afterAll(async () => {
  await prisma.application.deleteMany({ where: { organizationId: orgId } });
  await prisma.candidate.deleteMany({ where: { organizationId: orgId } });
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => null);
  await prisma.$disconnect();
});

describe("توزيع حالات المرشحين", () => {
  it("يعدّ كل مرشح مرة واحدة تحت حالة آخر طلب له", async () => {
    const stats = await getHRStats(orgId);

    expect(stats.total).toBe(9);
    expect(stats.approved).toBe(2); // المقبول + من أعاد التقديم
    expect(stats.completed).toBe(1);
    expect(stats.inProgress).toBe(1);
    expect(stats.underReview).toBe(1);
    expect(stats.pendingAction).toBe(2); // طلب معلّق + مرشح بلا طلب
    expect(stats.rejected).toBe(2); // المرفوض + المنسحب
  });

  it("لا يحتسب طلباً واحداً مرتين", async () => {
    const stats = await getHRStats(orgId);
    const sum =
      stats.approved +
      stats.completed +
      stats.inProgress +
      stats.underReview +
      stats.pendingAction +
      stats.rejected;
    expect(sum).toBe(stats.total);
  });
});

describe("تحويل حالة الطلب إلى مفاتيح الواجهة", () => {
  it("يفصل المقبول عن المكتمل", () => {
    expect(mapAppStatus("APPROVED")).toBe("approved");
    expect(mapAppStatus("COMPLETED")).toBe("completed");
  });

  it("يعرض المنسحب ضمن المرفوض", () => {
    expect(mapAppStatus("REJECTED")).toBe("rejected");
    expect(mapAppStatus("WITHDRAWN")).toBe("rejected");
  });

  it("يعامل الحالة غير المعروفة كقيد الانتظار", () => {
    expect(mapAppStatus("NOT_A_STATUS")).toBe("pending");
    expect(mapAppStatus(null)).toBe("pending");
    expect(mapAppStatus(undefined)).toBe("pending");
  });
});

describe("قراءة ?status= من الرابط", () => {
  it("يقبل مفاتيح التصفية المعروفة فقط", () => {
    for (const key of STATUS_FILTER_KEYS) {
      expect(parseStatusFilter(key)).toBe(key);
    }
    expect(parseStatusFilter("all")).toBe("all");
  });

  it("يتجاهل القيم غير المعروفة أو المكرّرة", () => {
    expect(parseStatusFilter("hacked")).toBe("all");
    expect(parseStatusFilter(undefined)).toBe("all");
    expect(parseStatusFilter(["approved", "rejected"])).toBe("approved");
  });
});
