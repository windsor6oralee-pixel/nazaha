import { NextResponse } from "next/server";
import { sendInvitation } from "@/infrastructure/services/invitation.service";
import { requireHR, tenantPrisma, deny } from "@/infrastructure/tenant";

// SMTP handshakes against Gmail can take several seconds — the Vercel 10 s
// default would often cut the response, leaving the UI hanging.
export const maxDuration = 60;
export const runtime = "nodejs";

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
    return NextResponse.json({
      success: true,
      email: result.email,
      delivered: result.delivered,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "فشل إرسال الدعوة";
    console.error("[resend-invitation]", message);
    // 502 is more honest than 500 — the DB is fine, the mail transport failed.
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
