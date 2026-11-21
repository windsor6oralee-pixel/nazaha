/**
 * GET /api/hr/import-batches/[id]/items/[itemId] — one item with its full
 * e-mail attempt history (every row: status, idempotency key, crash marker).
 */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { getImportItemWithAttempts } from "@/infrastructure/services/import-batch.service";

export const runtime = "nodejs";

interface Params { params: Promise<{ id: string; itemId: string }> }

export async function GET(_request: Request, { params }: Params) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager", "hr_officer"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id, itemId } = await params;

  const found = await getImportItemWithAttempts(ctx.organizationId, id, itemId);
  if (!found) return NextResponse.json({ error: "العنصر غير موجود" }, { status: 404 });

  return NextResponse.json({ item: found.item, attempts: found.attempts });
}
