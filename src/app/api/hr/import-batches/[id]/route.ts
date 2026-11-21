/**
 * GET /api/hr/import-batches/[id] — batch detail with all items and counts.
 * Organization-scoped server-side (tenant isolation), not just UI hiding.
 */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { getImportBatch } from "@/infrastructure/services/import-batch.service";

export const runtime = "nodejs";

interface Params { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager", "hr_officer"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const batch = await getImportBatch(ctx.organizationId, id);
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
  return NextResponse.json({ batch });
}
