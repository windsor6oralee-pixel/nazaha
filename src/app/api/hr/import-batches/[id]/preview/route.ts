/**
 * POST /api/hr/import-batches/[id]/preview — matching preview (read/write on
 * ImportItem only). NEVER touches Candidate rows: it only records WHICH rule
 * would match, so conflicts surface before approval.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { previewImportMatching } from "@/infrastructure/services/import-batch.service";

export const runtime = "nodejs";
export const maxDuration = 180;

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager", "hr_officer"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const result = await previewImportMatching(ctx.organizationId, id);
  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ...result, ok: true });
}
