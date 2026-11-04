import { NextResponse } from "next/server";
import { requireCandidate } from "@/infrastructure/tenant";
import { acceptOffer, LifecycleError } from "@/infrastructure/applications/lifecycle.service";

export async function POST() {
  const ctx = await requireCandidate();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.applicationId) return NextResponse.json({ error: "لا يوجد طلب" }, { status: 400 });

  try {
    const result = await acceptOffer({
      organizationId: ctx.organizationId,
      candidateId: ctx.candidateId,
      applicationId: ctx.applicationId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof LifecycleError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[offer/accept]", err);
    return NextResponse.json({ error: "تعذّر قبول العرض" }, { status: 500 });
  }
}
