import { NextResponse } from "next/server";
import { requireHR, tenantPrisma } from "@/infrastructure/tenant";
import { getCandidateExportRows } from "@/infrastructure/reports/reports.service";
import { formatValue } from "@/infrastructure/custom-fields/field.service";

const STATUS_AR: Record<string, string> = {
  PENDING: "معلق", IN_PROGRESS: "قيد الإنجاز", UNDER_REVIEW: "قيد المراجعة",
  APPROVED: "معتمد", COMPLETED: "مكتمل", REJECTED: "مرفوض", WITHDRAWN: "منسحب",
};
const CONTRACT_AR: Record<string, string> = { PENDING_SIGNATURE: "بانتظار التوقيع", FULLY_SIGNED: "موقَّع" };

function cell(v: unknown): string {
  const s = v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;

  const { defs, rows } = await getCandidateExportRows(tenantPrisma(ctx.organizationId), ctx.organizationId);

  const header = [
    "الاسم", "رقم الهوية", "البريد", "الجوال", "المسمى الوظيفي", "الإدارة",
    "تاريخ القبول", "تاريخ المباشرة", "حالة الطلب", "تاريخ الاكتمال", "المستندات المعتمدة", "إجمالي المستندات", "العقد",
    ...defs.map((d) => d.labelAr),
  ];

  const lines = rows.map((r) => [
    r.nameAr, r.nationalId, r.email, r.phone, r.jobTitle, r.department,
    r.acceptanceDate, r.expectedStartDate, r.status ? STATUS_AR[r.status] ?? r.status : "", r.completedAt,
    r.docsApproved, r.docsTotal, r.contractStatus ? CONTRACT_AR[r.contractStatus] ?? r.contractStatus : "",
    ...defs.map((d) => formatValue({ type: d.type as never }, r.custom?.[d.id] ?? null).replace(/^—$/, "")),
  ].map(cell).join(","));

  // BOM so Excel opens Arabic UTF-8 correctly.
  const body = "\uFEFF" + [header.map(cell).join(","), ...lines].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidates-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
