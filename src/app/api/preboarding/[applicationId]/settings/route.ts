import { NextRequest, NextResponse } from "next/server";
import { requireHR, tenantPrisma, deny } from "@/infrastructure/tenant";

type Params = { params: Promise<{ applicationId: string }> };

// PATCH: toggle bidirectional (HR/admin only)
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;
  const db = tenantPrisma(ctx.organizationId);

  const { applicationId } = await params;
  const { bidirectional } = await req.json().catch(() => ({}));

  const app = await db.application.findUnique({ where: { id: applicationId }, select: { id: true } });
  if (!app) return deny(404, "الطلب غير موجود");

  const channel = await db.preboardingChannel.upsert({
    where: { applicationId },
    update: { bidirectional: !!bidirectional },
    create: { applicationId, bidirectional: !!bidirectional },
  });

  return NextResponse.json({ bidirectional: channel.bidirectional });
}
