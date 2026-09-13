import { NextRequest, NextResponse } from "next/server";
import { requireHR, tenantPrisma } from "@/infrastructure/tenant";
interface Body {
  titleAr?: unknown;
  bodyAr?: unknown;
  priority?: unknown;
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
    select: { id: true },
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

  return NextResponse.json({ ok: true, alertId: alert.id }, { status: 201 });
}
