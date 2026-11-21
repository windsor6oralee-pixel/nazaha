/**
 * /api/hr/import-batches — list and create import batches.
 *
 * POST creates the batch + items ONLY. It performs no matching, no candidate
 * writes, no account creation and no e-mail (upload ≠ import ≠ invitation).
 * كلمة المرور في الصف تُخزَّن مشفَّرة على العنصر فقط — تصبح كلمة دخول
 * المرشح عند تنفيذ الدفعة، ولا تظهر نصاً صريحاً في أي استجابة.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { createImportBatch, listImportBatches } from "@/infrastructure/services/import-batch.service";
import type { ImportBatchStatus } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_ROWS = 10_000;
const BATCH_ROLES = ["admin", "hr_manager", "hr_officer"];

interface RowInput {
  itemKey?: unknown;
  nationalId?: unknown;
  email?: unknown;
  nameAr?: unknown;
  jobTitle?: unknown;
  department?: unknown;
  acceptanceDate?: unknown;
  password?: unknown;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function parseDate(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function newReference(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `IMP-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

export async function GET(request: NextRequest) {
  const ctx = await requireHR({ roles: BATCH_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  const status = request.nextUrl.searchParams.get("status") as ImportBatchStatus | null;
  const validStatuses: ImportBatchStatus[] = [
    "PENDING", "VALIDATING", "READY", "APPROVED", "EXECUTING",
    "COMPLETED", "PARTIAL", "FAILED", "CANCELLED", "ARCHIVED",
  ];
  const batches = await listImportBatches(ctx.organizationId, {
    ...(status && validStatuses.includes(status) ? { status } : {}),
  });
  return NextResponse.json({ batches });
}

export async function POST(request: NextRequest) {
  const ctx = await requireHR({ roles: BATCH_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  const body = (await request.json().catch(() => null)) as {
    reference?: unknown;
    sourceFileName?: unknown;
    rows?: unknown;
  } | null;
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "صيغة الطلب غير صالحة: مطلوب مصفوفة rows" }, { status: 400 });
  }
  if (body.rows.length === 0) {
    return NextResponse.json({ error: "الدفعة فارغة" }, { status: 400 });
  }
  if (body.rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `الحد الأقصى ${MAX_ROWS} صف في الدفعة` }, { status: 400 });
  }

  const items = (body.rows as RowInput[]).map((r, i) => {
    const nameAr = str(r.nameAr);
    const email = str(r.email);
    const nationalId = str(r.nationalId);
    const password = str(r.password);
    if (!nameAr) {
      // Row-level validation errors are surfaced here — nothing is stored.
      throw new RowError(`الصف ${i + 1}: الاسم مطلوب`);
    }
    if (!email) {
      throw new RowError(`الصف ${i + 1}: البريد الإلكتروني مطلوب لحساب الدخول`);
    }
    if (!password) {
      throw new RowError(`الصف ${i + 1}: كلمة المرور مطلوبة`);
    }
    return {
      itemKey: str(r.itemKey) ?? `row-${i + 1}`,
      nationalId,
      email,
      nameAr,
      jobTitle: str(r.jobTitle),
      department: str(r.department),
      acceptanceDate: parseDate(r.acceptanceDate),
      password,
    };
  });

  try {
    const result = await createImportBatch({
      organizationId: ctx.organizationId,
      reference: str(body.reference) ?? newReference(),
      sourceFileName: str(body.sourceFileName) ?? undefined,
      createdByUserId: ctx.userId,
      items,
    });
    if (!result.ok) {
      const status = result.error === "BATCH_ALREADY_EXISTS" ? 409 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true, batch: result.batch }, { status: 201 });
  } catch (e) {
    if (e instanceof RowError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[import-batches/create]", e);
    return NextResponse.json({ error: "تعذّر إنشاء الدفعة" }, { status: 500 });
  }
}

class RowError extends Error {}
