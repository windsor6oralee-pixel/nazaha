/**
 * POST /api/hr/import-batches/[id]/archive — freeze a terminal batch.
 * ARCHIVED batches accept no further transitions.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { archiveImportBatch } from "@/infrastructure/services/import-batch.service";

export const runtime = "nodejs";

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const result = await archiveImportBatch(ctx.organizationId, id);
  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, batch: result.batch });
}
