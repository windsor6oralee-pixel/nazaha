/**
 * POST /api/hr/import-batches/[id]/validate — validation pass.
 * PENDING/VALIDATING → VALIDATING → READY. No mail, no accounts.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { validateImportBatch } from "@/infrastructure/services/import-batch.service";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager", "hr_officer"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const result = await validateImportBatch(ctx.organizationId, id);
  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ...result, ok: true });
}
