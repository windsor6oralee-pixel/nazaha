import { NextResponse } from "next/server";
import { requireCandidate, tenantPrisma } from "@/infrastructure/tenant";

export async function GET() {
  const ctx = await requireCandidate();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.applicationId) return NextResponse.json({ alerts: [] });

  const db = tenantPrisma(ctx.organizationId);
  const alerts = await db.candidateAlert.findMany({
    where: {
      applicationId: ctx.applicationId,
      acknowledgedAt: null,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      titleAr: true,
      bodyAr: true,
      priority: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ alerts });
}
