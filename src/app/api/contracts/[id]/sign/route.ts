import { NextRequest, NextResponse } from "next/server";
import { getNotifier, templates } from "@/infrastructure/notifications";
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
          candidate: { select: { nameAr: true, jobTitle: true } },
          organization: { select: { users: { select: { email: true }, take: 1 } } },
          onboardingProcess: {
            select: {
              id: true,
              steps: {
                where: { workflowStep: { order: { in: [3, 4, 5] } } },
                select: { id: true, workflowStep: { select: { order: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!contract) return deny(404, "العقد غير موجود");
  if (contract.status !== "PENDING_SIGNATURE") {
    return NextResponse.json({ error: "هذا العقد ليس بانتظار التوقيع" }, { status: 422 });
  }
  // Refuse to sign if the frozen content no longer matches its recorded hash.
  if (!contract.renderedHtml || !contract.contentHash || hashContent(contract.renderedHtml) !== contract.contentHash) {
    return NextResponse.json({ error: "محتوى العقد غير سليم — يرجى التواصل مع الموارد البشرية" }, { status: 409 });
  }

  const ipAddress = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? undefined;
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

    // Progress onboarding steps (step 4 → COMPLETED, step 5 → IN_PROGRESS)
    const proc = contract.application.onboardingProcess;
    if (proc) {
      for (const step of proc.steps) {
        const order = (step as any).workflowStep?.order;
        if (order === 3) {
          await tx.onboardingStep.update({ where: { id: step.id }, data: { status: "COMPLETED" } });
        }
        if (order === 4) {
          await tx.onboardingStep.update({ where: { id: step.id }, data: { status: "COMPLETED" } });
        }
        if (order === 5) {
          await tx.onboardingStep.update({ where: { id: step.id }, data: { status: "IN_PROGRESS" } });
        }
      }
    }

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

  // ── 4. Notify HR (fire-and-forget) ────────────────────────
  const hrEmail = contract.application.organization.users[0]?.email;
  if (hrEmail) {
    const notifier = getNotifier();
    notifier.send({
      to: hrEmail,
      ...templates.contractSigned({
        candidateName: contract.application.candidate.nameAr,
        jobTitle: contract.application.candidate.jobTitle,
        signedAt: new Date().toISOString(),

      }),
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
