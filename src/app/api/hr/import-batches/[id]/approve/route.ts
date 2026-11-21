/**
 * POST /api/hr/import-batches/[id]/approve — READY → APPROVED.
 * Blocked while unresolved CONFLICT items exist (service enforces it too).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { approveImportBatch } from "@/infrastructure/services/import-batch.service";

export const runtime = "nodejs";

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  // Approval is a privileged action — officers may prepare, managers approve.
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const result = await approveImportBatch(ctx.organizationId, id, ctx.userId);
  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, batch: result.batch });
}
