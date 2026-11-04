/** GET /api/hr/applications/[id]/directive/history — archived directives (newest first). */
import { NextResponse } from "next/server";
import { requireHR, tenantPrisma, deny } from "@/infrastructure/tenant";
import { listDirectiveHistory } from "@/infrastructure/directives/directive.service";

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const db = tenantPrisma(ctx.organizationId);
  const app = await db.application.findUnique({ where: { id }, select: { id: true } });
  if (!app) return deny(404);
  const history = await listDirectiveHistory(id, 20);
  return NextResponse.json({ history });
}
