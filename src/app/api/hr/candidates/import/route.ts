/**
 * POST /api/hr/candidates/import
 * Bulk-imports candidates from a JSON array.
 * Each row: { name, email, nationalId?, jobTitle?, department?, acceptanceDate? }
 * Returns per-row results so the UI can show success/failure breakdown.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { createCandidate } from "@/infrastructure/services/candidate.service";
import { randomBytes } from "crypto";

interface ImportRow {
  name: string;
  email: string;
  nationalId?: string;
  jobTitle?: string;
  department?: string;
  acceptanceDate?: string;
}

interface RowResult {
  row: number;
  name: string;
  email: string;
  status: "success" | "error";
  error?: string;
}

function uniqueId(): string {
  return "IMP-" + randomBytes(5).toString("hex").toUpperCase();
}

export async function POST(req: NextRequest) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager", "hr_officer"] });
  if (ctx instanceof NextResponse) return ctx;

  let rows: ImportRow[];
  try {
    rows = await req.json();
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: "لا توجد بيانات للاستيراد" }, { status: 400 });
    if (rows.length > 1000)
      return NextResponse.json({ error: "الحد الأقصى 1000 سجل في المرة الواحدة" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "تنسيق الطلب غير صالح" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    if (!row.email?.includes("@")) {
      results.push({ row: rowNum, name: row.name ?? "", email: row.email ?? "", status: "error", error: "البريد الإلكتروني غير صالح" });
      continue;
    }
    if (!row.name?.trim()) {
      results.push({ row: rowNum, name: "", email: row.email, status: "error", error: "الاسم مطلوب" });
      continue;
    }

    try {
      await createCandidate({
        nameAr:         row.name.trim(),
        nationalId:     uniqueId(),
        email:          row.email.trim().toLowerCase(),
        jobTitle:       row.jobTitle?.trim() || "موظف",
        department:     row.department?.trim() || "عام",
        acceptanceDate: new Date(row.acceptanceDate || today),
        organizationId: ctx.organizationId,
        createdByUserId: ctx.userId,
      });
      results.push({ row: rowNum, name: row.name, email: row.email, status: "success" });
    } catch (err) {
      results.push({
        row: rowNum,
        name: row.name,
        email: row.email,
        status: "error",
        error: err instanceof Error ? err.message : "خطأ غير معروف",
      });
    }
  }

  const succeeded = results.filter(r => r.status === "success").length;
  const failed    = results.filter(r => r.status === "error").length;

  return NextResponse.json({ succeeded, failed, results });
}
