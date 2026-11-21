/**
 * POST /api/hr/candidates/import
 * Bulk-imports candidates from the OFFICIAL accepted-candidates sheet (JSON rows).
 * Each row: { name, email, password, nationalId?, jobTitle?, department?, acceptanceDate? }
 *
 * القائمة هي المصدر الرسمي: كل صف يمنح المرشح حساب دخول دائم —
 * loginEmail = البريد، كلمة المرور كما هي في الشيت، وتفعيل فوري — بلا رمز
 * دعوة وبلا إرسال أي بريد. صف موجود بنفس البريد يُحدَّث حسابه لا يُكرَّر.
 *
 * Returns per-row results so the UI can show success/failure breakdown.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { createCandidate } from "@/infrastructure/services/candidate.service";
import {
  applySheetCredentials,
  ensureImportApplication,
  findAcceptedCandidate,
} from "@/infrastructure/services/candidate-provisioning.service";
import { randomBytes } from "crypto";

// Bulk imports create + activate dozens of candidates per chunk.
// Give the serverless function enough headroom.
export const maxDuration = 300;
export const runtime = "nodejs";

interface ImportRow {
  name: string;
  email: string;
  password: string;
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
  const auditCtx = { userId: ctx.userId, source: "direct_import" as const };

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
    if (!row.password) {
      results.push({ row: rowNum, name: row.name, email: row.email, status: "error", error: "كلمة المرور مطلوبة" });
      continue;
    }

    const email = row.email.trim().toLowerCase();
    try {
      const existing = await findAcceptedCandidate(ctx.organizationId, email);
      if (existing) {
        // القائمة هي المصدر الرسمي: الحساب القائم يُجدَّث ببيانات الشيت.
        await ensureImportApplication(existing.id, ctx.organizationId, auditCtx);
        await applySheetCredentials(existing.id, email, row.password, auditCtx);
      } else {
        const created = await createCandidate({
          nameAr:         row.name.trim(),
          nationalId:     uniqueId(),
          email,
          jobTitle:       row.jobTitle?.trim() || "موظف",
          department:     row.department?.trim() || "عام",
          acceptanceDate: new Date(row.acceptanceDate || today),
          organizationId: ctx.organizationId,
          createdByUserId: ctx.userId,
        });
        await applySheetCredentials(created.candidateId, email, row.password, auditCtx);
      }
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
