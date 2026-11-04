import { NextRequest, NextResponse } from "next/server";
import { getOrgNotifier, templates } from "@/infrastructure/notifications";
import { syncApplicationProgress } from "@/infrastructure/applications/lifecycle.service";
import { requireCandidate, tenantPrisma, withTenantTransaction, deny } from "@/infrastructure/tenant";
import { hashContent } from "@/infrastructure/contracts/template-renderer";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── 1. Candidate only ──────────────────────────────────────
  const ctx = await requireCandidate();
  if (ctx instanceof NextResponse) return ctx;
  const db = tenantPrisma(ctx.organizationId);

  const { id: contractId } = await params;

  let body: { fullName: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  if (!body.fullName?.trim()) {
    return NextResponse.json({ error: "الاسم الكامل مطلوب للتوقيع" }, { status: 400 });
  }

  // ── 2. Fetch contract ──────────────────────────────────────
  const contract = await db.contract.findUnique({
    where: { id: contractId, application: { candidateId: ctx.candidateId } },
    include: {
      application: {
        select: {
          id: true,
          candidateId: true,
          status: true,
          candidate: { select: { nameAr: true, jobTitle: true } },
        },
      },
    },
  });

  if (!contract) return deny(404, "العقد غير موجود");
  if (contract.application.status !== "APPROVED") {
    return NextResponse.json({ error: "لا يمكن توقيع العقد في هذه المرحلة من الطلب" }, { status: 409 });
  }
  if (contract.status !== "PENDING_SIGNATURE") {
    return NextResponse.json({ error: "هذا العقد ليس بانتظار التوقيع" }, { status: 422 });
  }
  // Refuse to sign if the frozen content no longer matches its recorded hash.
  if (!contract.renderedHtml || !contract.contentHash || hashContent(contract.renderedHtml) !== contract.contentHash) {
    return NextResponse.json({ error: "محتوى العقد غير سليم — يرجى التواصل مع الموارد البشرية" }, { status: 409 });
  }

  // The client-facing hop is the first entry; the rest are proxies.
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const applicationId = contract.application.id;

  // ── 3. Transaction: create signature + update contract + progress steps ──
  await withTenantTransaction(db, ctx.organizationId, async (tx) => {
    // Create signature record
    await tx.signature.create({
      data: {
        contractId,
        signerType: "CANDIDATE",
        method: "TYPED",
        signatureData: body.fullName.trim(),
        contentHash: contract.contentHash,
        ipAddress,
        userAgent,
        candidateId: ctx.candidateId,
        signedAt: new Date(),
      },
    });

    // Update contract status
    await tx.contract.update({
      where: { id: contractId },
      data: { status: "FULLY_SIGNED" },
    });

    // Signature and orientation steps follow the contract (by step type, not order).
    await syncApplicationProgress(tx, applicationId, { kind: "CANDIDATE", candidateId: ctx.candidateId });

    // Audit
    await tx.auditLog.create({
      data: {
        actorType: "CANDIDATE",
        candidateId: ctx.candidateId,
        action: "contract.signed",
        resource: "Contract",
        resourceId: contractId,
        applicationId,
        metadata: { method: "TYPED", nameUsed: body.fullName.trim() },
      },
    });
  });

  // ── 4. Notify the organization's HR managers (fire-and-forget) ──
  Promise.all([
    db.user.findMany({
      where: { isActive: true, role: { name: { in: ["admin", "hr_manager"] } } },
      select: { email: true },
    }),
    getOrgNotifier(ctx.organizationId),
  ]).then(([managers, notifier]) => {
    const message = templates.contractSigned({
      candidateName: contract.application.candidate.nameAr,
      jobTitle: contract.application.candidate.jobTitle,
      signedAt: new Date().toISOString(),
    });
    for (const m of managers) notifier.send({ to: m.email, ...message }).catch(() => null);
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
