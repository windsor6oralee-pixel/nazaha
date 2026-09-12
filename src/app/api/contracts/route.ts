import { NextRequest, NextResponse } from "next/server";
import type { ContractType } from "@prisma/client";
import { getNotifier } from "@/infrastructure/notifications";
import { requireHR, tenantPrisma, deny } from "@/infrastructure/tenant";
import { renderContractForCandidate } from "@/infrastructure/contracts/contract-template.service";

const CONTRACT_TYPES = new Set<ContractType>([
  "EMPLOYMENT_CONTRACT", "CONFIDENTIALITY_AGREEMENT", "IT_POLICY_ACKNOWLEDGEMENT", "CONFLICT_OF_INTEREST", "CUSTOM",
]);

export async function POST(request: NextRequest) {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;
  const db = tenantPrisma(ctx.organizationId);

  let body: { applicationId: string; type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const { applicationId, type = "EMPLOYMENT_CONTRACT" } = body;
  if (!CONTRACT_TYPES.has(type as ContractType)) {
    return NextResponse.json({ error: "نوع العقد غير صالح" }, { status: 422 });
  }
  const contractType = type as ContractType;

  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      candidate: {
        select: { id: true, nameAr: true, nationalId: true, email: true, jobTitle: true, department: true, expectedStartDate: true },
      },
      organization: { select: { nameAr: true } },
    },
  });
  if (!app) return deny(404, "الطلب غير موجود");

  const existing = await db.contract.findFirst({
    where: { applicationId, type: contractType, status: { in: ["PENDING_SIGNATURE", "FULLY_SIGNED"] } },
  });
  if (existing) {
    return NextResponse.json({ error: "يوجد عقد نشط بالفعل", contractId: existing.id }, { status: 409 });
  }

  let rendered;
  try {
    rendered = await renderContractForCandidate({
      organizationId: ctx.organizationId,
      type: contractType,
      candidate: app.candidate,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "تعذّر توليد العقد" }, { status: 422 });
  }

  const contract = await db.contract.create({
    data: {
      type: contractType,
      nameAr: rendered.nameAr,
      status: "PENDING_SIGNATURE",
      organizationId: ctx.organizationId,
      applicationId,
      templateId: rendered.templateId,
      renderedHtml: rendered.renderedHtml,
      contentHash: rendered.contentHash,
      generatedAt: new Date(),
    },
    select: { id: true, nameAr: true, status: true, generatedAt: true, contentHash: true },
  });

  await db.auditLog.create({
    data: {
      actorType: "USER",
      userId: ctx.userId,
      action: "contract.created",
      resource: "Contract",
      resourceId: contract.id,
      applicationId,
      candidateId: app.candidateId,
      metadata: { templateId: rendered.templateId, contentHash: rendered.contentHash },
    },
  });

  getNotifier().send({
    to: app.candidate.email,
    subject: `📋 عقدك جاهز للتوقيع — ${app.candidate.jobTitle}`,
    html: contractReadyEmail(app.candidate.nameAr, app.candidate.jobTitle, app.organization.nameAr),
  }).catch(() => null);

  return NextResponse.json({ ok: true, contract }, { status: 201 });
}

function contractReadyEmail(name: string, jobTitle: string, orgName: string): string {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>
    body{font-family:Tahoma,Arial,sans-serif;background:#F5F3EC;margin:0;padding:24px;direction:rtl;}
    .card{background:#fff;border-radius:12px;max-width:560px;margin:0 auto;padding:32px;}
    .header{background:#013A2B;border-radius:8px;padding:20px 24px;margin-bottom:24px;}
    .header h1{color:#C9A94A;margin:0;font-size:20px;}
    .body{font-size:15px;line-height:1.7;}
    .highlight{background:#F0FAF5;border-right:4px solid #013A2B;border-radius:4px;padding:12px 16px;margin:16px 0;}
    .footer{margin-top:24px;font-size:12px;color:#888;text-align:center;}
  </style></head><body><div class="card">
    <div class="header"><h1>نزاهة التوظيف</h1></div>
    <div class="body">
      <p>عزيزي/عزيزتي <strong>${name}</strong>،</p>
      <p>يسعدنا إبلاغك بأن عقد عملك لوظيفة <strong>${jobTitle}</strong> في <strong>${orgName}</strong> أصبح جاهزاً للمراجعة والتوقيع.</p>
      <div class="highlight">يُرجى تسجيل الدخول إلى المنصة لمراجعة العقد والتوقيع عليه إلكترونياً.</div>
    </div>
    <div class="footer">هذا البريد آلي — يُرجى عدم الرد عليه</div>
  </div></body></html>`;
}
