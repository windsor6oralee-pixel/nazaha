import { NextResponse } from "next/server";
import { requireHR, tenantPrisma } from "@/infrastructure/tenant";

const ONLINE_THRESHOLD_MS = 90_000; // 90 s

export async function GET() {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;

  const db = tenantPrisma(ctx.organizationId);
  const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS);

  const rows = await db.candidate.findMany({
    where: {
      organizationId: ctx.organizationId,
      lastAccessAt: { gte: cutoff },
    },
    select: {
      id: true,
      nameAr: true,
      lastAccessAt: true,
      applications: {
        select: { id: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { lastAccessAt: "desc" },
  });

  const online = rows.map((r) => ({
    candidateId: r.id,
    nameAr: r.nameAr,
    applicationId: r.applications[0]?.id ?? null,
    lastAccessAt: r.lastAccessAt,
  }));

  return NextResponse.json({ count: online.length, candidates: online });
}
