import { NextRequest, NextResponse } from "next/server";
import { requireAuth, tenantPrisma, deny, type TenantContext, type TenantPrisma } from "@/infrastructure/tenant";

type Params = { params: Promise<{ applicationId: string }> };

// Resolves the application inside the caller's tenant; candidates must also own it.
async function resolveApplication(db: TenantPrisma, ctx: TenantContext, applicationId: string) {
  return db.application.findUnique({
    where: {
      id: applicationId,
      ...(ctx.kind === "candidate" ? { candidateId: ctx.candidateId } : {}),
    },
    select: { id: true },
  });
}

// ── GET: fetch messages ─────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await requireAuth();
  if (ctx instanceof NextResponse) return ctx;
  const db = tenantPrisma(ctx.organizationId);

  const { applicationId } = await params;
  const app = await resolveApplication(db, ctx, applicationId);
  if (!app) return deny(404, "الطلب غير موجود");

  const channel = await db.preboardingChannel.findUnique({
    where: { applicationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (channel) {
    const unreadSender = ctx.kind === "candidate" ? "HR" : "CANDIDATE";
    await db.preboardingMessage.updateMany({
      where: { channelId: channel.id, senderType: unreadSender, isRead: false },
      data: { isRead: true },
    });
  }

  return NextResponse.json({
    channel: channel ? { id: channel.id, bidirectional: channel.bidirectional } : null,
    messages: channel?.messages ?? [],
  });
}

// ── POST: send a message ────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireAuth();
  if (ctx instanceof NextResponse) return ctx;
  const db = tenantPrisma(ctx.organizationId);

  const { applicationId } = await params;
  const app = await resolveApplication(db, ctx, applicationId);
  if (!app) return deny(404, "الطلب غير موجود");

  const body = await req.json().catch(() => ({}));
  const { type, content, fileName, filePath } = body as {
    type: string;
    content?: string;
    fileName?: string;
    filePath?: string;
  };

  if (!type) return NextResponse.json({ error: "نوع الرسالة مطلوب" }, { status: 400 });

  const isCandidate = ctx.kind === "candidate";

  let channel = await db.preboardingChannel.findUnique({ where: { applicationId } });

  if (!channel) {
    if (isCandidate) return deny(403, "لم يُفتح هذا القسم بعد");
    channel = await db.preboardingChannel.create({ data: { applicationId } });
  }

  if (isCandidate) {
    if (!channel.bidirectional && type !== "PING_RESPONSE" && type !== "FILE_REQUEST")
      return deny(403, "لا يمكنك بدء محادثة — انتظر مسؤول الموارد البشرية");
    if (type === "PING" || type === "FILE_REQUEST")
      return deny(403, "هذا الإجراء متاح للموارد البشرية فقط");
  }

  const message = await db.preboardingMessage.create({
    data: {
      channelId: channel.id,
      senderType: isCandidate ? "CANDIDATE" : "HR",
      senderId: isCandidate ? ctx.candidateId : ctx.userId,
      type: type as any,
      content: content ?? null,
      fileName: fileName ?? null,
      filePath: filePath ?? null,
    },
  });

  return NextResponse.json({ message }, { status: 201 });
}
