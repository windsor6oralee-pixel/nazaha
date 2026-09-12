import { NextResponse } from "next/server";
import { sendInvitation } from "@/infrastructure/services/invitation.service";
import { requireHR, tenantPrisma, deny } from "@/infrastructure/tenant";

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;
  const db = tenantPrisma(ctx.organizationId);

  const { id } = await params;

  const candidate = await db.candidate.findUnique({ where: { id }, select: { id: true } });
  if (!candidate) return deny(404, "المرشح غير موجود");

  try {
    const result = await sendInvitation(id);
    const devToken = process.env.NODE_ENV !== "production" ? result.rawToken : undefined;
    return NextResponse.json({ success: true, email: result.email, devToken });
  } catch (err: unknown) {
    console.error("[resend-invitation]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل إرسال الدعوة" },
      { status: 500 }
    );
  }
}
