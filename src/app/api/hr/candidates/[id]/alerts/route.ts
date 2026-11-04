import { NextRequest, NextResponse } from "next/server";
import { requireHR, tenantPrisma } from "@/infrastructure/tenant";
import { getOrgNotifier, templates } from "@/infrastructure/notifications";
import { getDefaultFor, getEmailTemplate } from "@/infrastructure/email-templates/template.service";
interface Body {
  titleAr?: unknown;
  bodyAr?: unknown;
  priority?: unknown;
  /** Optional — when present, merges that EmailTemplate's subject/body into the e-mail. */
  templateId?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager", "hr_officer"] });
  if (ctx instanceof NextResponse) return ctx;

  const { id: candidateId } = await params;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const titleAr = typeof body.titleAr === "string" ? body.titleAr.trim() : "";
  const bodyAr = typeof body.bodyAr === "string" ? body.bodyAr.trim() : "";
  const priority = body.priority === "HIGH" ? "HIGH" : "NORMAL";

  if (!titleAr || titleAr.length < 2) {
    return NextResponse.json({ error: "عنوان الرسالة مطلوب" }, { status: 422 });
  }
  if (!bodyAr || bodyAr.length < 2) {
    return NextResponse.json({ error: "نص الرسالة مطلوب" }, { status: 422 });
  }

  const db = tenantPrisma(ctx.organizationId);

  const application = await db.application.findFirst({
    where: { candidateId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      candidate: { select: { nameAr: true, email: true } },
    },
  });
  if (!application) {
    return NextResponse.json({ error: "المرشح غير موجود" }, { status: 404 });
  }

  const alert = await db.candidateAlert.create({
    data: {
      organizationId: ctx.organizationId,
      applicationId: application.id,
      sentByUserId: ctx.userId,
      titleAr,
      bodyAr,
      priority,
    },
  });

  // Mirror the in-app alert to the candidate's inbox — fire-and-forget so a
  // flaky SMTP never fails the HR request. The in-app notification is already
  // persisted above; the e-mail is a best-effort secondary channel.
  if (application.candidate.email) {
    // Template resolution order:
    //   1. explicit templateId from the UI (verified to belong to this org)
    //   2. the org's default ALERT template
    //   3. built-in `templates.hrAlert` baseline — same shape as before.
    (async () => {
      const explicit = typeof body.templateId === "string" && body.templateId
        ? await getEmailTemplate(ctx.organizationId, body.templateId).catch(() => null)
        : null;
      const picked = explicit ?? (await getDefaultFor(ctx.organizationId, "ALERT").catch(() => null));

      const { renderVariables, buildContext } = await import("@/infrastructure/directives/variables");
      // Fetch org name + full candidate bits so {{organization.nameAr}} / {{candidate.jobTitle}} resolve.
      const extras = await db.candidate.findFirst({
        where: { id: candidateId },
        select: { jobTitle: true, department: true, organization: { select: { nameAr: true, nameEn: true } } },
      });
      const vctx = buildContext({
        candidate: {
          nameAr: application.candidate.nameAr,
          email:  application.candidate.email,
          jobTitle:   extras?.jobTitle   ?? "",
          department: extras?.department ?? "",
        },
        organization: { nameAr: extras?.organization.nameAr ?? "", nameEn: extras?.organization.nameEn ?? null },
        hr: { nameAr: "" },
      });

      const notifier = await getOrgNotifier(ctx.organizationId);
      if (picked) {
        const subject = renderVariables(picked.subjectAr, vctx) || `📣 ${titleAr}`;
        // Template-chosen body is the shell; the HR-typed message is kept too so
        // the candidate sees both the saved framing and this run's content.
        const shell = renderVariables(picked.bodyAr, vctx);
        const html  = templates.hrAlert({
          candidateName: application.candidate.nameAr,
          titleAr,
          bodyAr: `${shell}\n\n---\n${bodyAr}`,
          priority,
        }).html;
        await notifier.send({ to: application.candidate.email, subject, html });
      } else {
        await notifier.send({
          to: application.candidate.email,
          ...templates.hrAlert({
            candidateName: application.candidate.nameAr,
            titleAr,
            bodyAr,
            priority,
          }),
        });
      }
    })().catch(() => null);
  }

  return NextResponse.json({ ok: true, alertId: alert.id }, { status: 201 });
}
