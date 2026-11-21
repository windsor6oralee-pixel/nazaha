/**
 * POST /api/hr/import-batches/[id]/execute — APPROVED → EXECUTING → terminal.
 *
 * Applies the official accepted-candidates sheet: creates candidates +
 * APPROVED applications for MATCHED_NEW items and writes the sheet credentials
 * (loginEmail + password as-is) with IMMEDIATE activation for both matched
 * kinds. NO e-mail is sent — the sheet delivers the credentials.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { executeImportBatch } from "@/infrastructure/services/import-batch.service";

export const runtime = "nodejs";
export const maxDuration = 300;

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  try {
    const result = await executeImportBatch(ctx.organizationId, id, {
      createdByUserId: ctx.userId,
    });
    if (!result.ok) {
      const status = result.error === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ...result, ok: true });
  } catch (e) {
    console.error("[import-batches/execute]", e);
    return NextResponse.json({ error: "تعذّر تنفيذ الدفعة" }, { status: 500 });
  }
}
