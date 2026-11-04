/** GET /api/hr/candidates/[id]/emails — email log for one candidate (newest first). */
import { NextResponse } from "next/server";
import { requireHR, tenantPrisma, deny } from "@/infrastructure/tenant";
import { listEmailsForCandidate } from "@/infrastructure/notifications/email-log.service";

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const db = tenantPrisma(ctx.organizationId);
  const c = await db.candidate.findUnique({ where: { id }, select: { id: true } });
  if (!c) return deny(404);
  const rows = await listEmailsForCandidate(id, 50);
  return NextResponse.json({ rows });
}
