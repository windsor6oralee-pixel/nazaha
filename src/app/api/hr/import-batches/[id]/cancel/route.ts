/**
 * POST /api/hr/import-batches/[id]/cancel — pre-execution cancellation only.
 * Terminal / executing batches cannot be cancelled (409 from the service).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { cancelImportBatch } from "@/infrastructure/services/import-batch.service";

export const runtime = "nodejs";

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const result = await cancelImportBatch(ctx.organizationId, id);
  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, batch: result.batch });
}
