import { NextRequest, NextResponse } from "next/server";
import { getNotifier, templates } from "@/infrastructure/notifications";
import { requireHR, tenantPrisma, withTenantTransaction, deny } from "@/infrastructure/tenant";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── 1. Auth — HR only ──────────────────────────────────────
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;
  const db = tenantPrisma(ctx.organizationId);

  const { id: documentId } = await params;

  // ── 2. Parse body ──────────────────────────────────────────
  let body: { action: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const { action, reason } = body;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action يجب أن يكون approve أو reject" }, { status: 400 });
  }
  if (action === "reject" && !reason?.trim()) {
    return NextResponse.json({ error: "سبب الرفض مطلوب" }, { status: 400 });
  }

  // ── 3. Fetch document ──────────────────────────────────────
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: {
      application: {
        select: {
          id: true,
          candidateId: true,
          status: true,
          candidate: { select: { nameAr: true, email: true, jobTitle: true } },
        },
      },
    },
  });

  if (!document) return deny(404, "المستند غير موجود");

  // Must have an uploaded file to review
  if (!["UPLOADED", "UNDER_REVIEW"].includes(document.status)) {
    return NextResponse.json(
      { error: "لا يمكن مراجعة مستند بهذه الحالة" },
      { status: 422 }
    );
  }

  const newDocStatus = action === "approve" ? "APPROVED" : "REJECTED";
  const applicationId = document.application.id;

  // ── 4. Transaction: update doc + create review + maybe update application ──
  const [updatedDoc] = await withTenantTransaction(db, ctx.organizationId, async (tx) => {
    // Update document status
    const updated = await tx.document.update({
      where: { id: documentId },
      data: {
        status: newDocStatus,
        ...(action === "reject" ? { filePath: null, uploadedAt: null } : {}),
      },
      select: { id: true, status: true, type: true, nameAr: true },
    });

    // Create review record
    await tx.documentReview.create({
      data: {
        decision: action === "approve" ? "APPROVED" : "REJECTED",
        reason: reason ?? null,
        documentId,
        reviewerId: ctx.userId,
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        actorType: "USER",
        userId: ctx.userId,
        action: action === "approve" ? "document.approved" : "document.rejected",
        resource: "Document",
        resourceId: documentId,
        applicationId,
        candidateId: document.application.candidateId,
        metadata: { reason: reason ?? null },
      },
    });

    // Auto-transition application: if all required docs are now APPROVED → UNDER_REVIEW
    if (action === "approve") {
      const allDocs = await tx.document.findMany({
        where: { applicationId },
        select: { status: true, isRequired: true },
      });

      const requiredDocs = allDocs.filter((d) => d.isRequired);
      const allRequiredApproved = requiredDocs.every((d) => d.status === "APPROVED");

      if (
        allRequiredApproved &&
        requiredDocs.length > 0 &&
        document.application.status === "IN_PROGRESS"
      ) {
        await tx.application.update({
          where: { id: applicationId },
          data: { status: "UNDER_REVIEW" },
        });

        await tx.auditLog.create({
          data: {
            actorType: "USER",
            userId: ctx.userId,
            action: "application.documents_complete",
            resource: "Application",
            resourceId: applicationId,
            applicationId,
            candidateId: document.application.candidateId,
            metadata: { trigger: "all_required_docs_approved" },
          },
        });
      }
    }

    return [updated];
  });

  // ── 5. Send notification (fire-and-forget — never block the response) ──
  const candidate = document.application.candidate;
  const notifier = getNotifier();

  if (action === "approve") {
    // Check if this was the last required doc (re-query after transaction)
    const remaining = await db.document.count({
      where: { applicationId, isRequired: true, NOT: { status: "APPROVED" } },
    });

    if (remaining === 0) {
      notifier.send({
        to: candidate.email,
        ...templates.allDocumentsApproved({
          candidateName: candidate.nameAr,
          jobTitle: candidate.jobTitle,
        }),
      }).catch(() => null);
    } else {
      notifier.send({
        to: candidate.email,
        ...templates.documentApproved({
          candidateName: candidate.nameAr,
          documentName: document.nameAr,
        }),
      }).catch(() => null);
    }
  } else {
    notifier.send({
      to: candidate.email,
      ...templates.documentRejected({
        candidateName: candidate.nameAr,
        documentName: document.nameAr,
        reason: reason!,
      }),
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, document: updatedDoc });
}
