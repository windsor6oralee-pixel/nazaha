import { NextRequest, NextResponse } from "next/server";
import { requireCandidate, tenantPrisma } from "@/infrastructure/tenant";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireCandidate();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.applicationId) return NextResponse.json({ error: "لا يوجد طلب" }, { status: 400 });

  const { id } = await params;
  const db = tenantPrisma(ctx.organizationId);

  const alert = await db.candidateAlert.findFirst({
    where: { id, applicationId: ctx.applicationId, acknowledgedAt: null },
  });
  if (!alert) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  await db.candidateAlert.update({
    where: { id },
    data: { acknowledgedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
