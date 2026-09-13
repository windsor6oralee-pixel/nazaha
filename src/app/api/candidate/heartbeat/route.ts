import { NextResponse } from "next/server";
import { requireCandidate, tenantPrisma } from "@/infrastructure/tenant";

export async function POST() {
  const ctx = await requireCandidate();
  if (ctx instanceof NextResponse) return ctx;

  const db = tenantPrisma(ctx.organizationId);
  await db.candidate.update({
    where: { id: ctx.candidateId },
    data: { lastAccessAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
