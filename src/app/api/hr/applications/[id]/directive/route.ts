/**
 * GET  /api/hr/applications/[id]/directive — current directive (or null)
 * PUT  /api/hr/applications/[id]/directive — upsert the directive
 * DELETE /api/hr/applications/[id]/directive — clear the directive
 */
import { NextResponse } from "next/server";
import { requireHR, tenantPrisma, deny } from "@/infrastructure/tenant";
import {
  getDirectiveForApplication,
  upsertDirective,
  deleteDirective,
} from "@/infrastructure/directives/directive.service";

interface Ctx { params: Promise<{ id: string }> }

async function assertApplicationBelongsToTenant(applicationId: string, organizationId: string): Promise<boolean> {
  const db = tenantPrisma(organizationId);
  const app = await db.application.findUnique({ where: { id: applicationId }, select: { id: true } });
  return !!app;
}

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  if (!(await assertApplicationBelongsToTenant(id, ctx.organizationId))) return deny(404);

  const directive = await getDirectiveForApplication(id);
  return NextResponse.json({ directive });
}

export async function PUT(req: Request, { params }: Ctx) {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  if (!(await assertApplicationBelongsToTenant(id, ctx.organizationId))) return deny(404);

  const body = (await req.json().catch(() => ({}))) as {
    title?: string; body?: string; allowReply?: boolean;
    notifyByEmail?: boolean; type?: "INFO" | "URGENT" | "APPOINTMENT";
  };
  try {
    const directive = await upsertDirective(id, ctx.userId, {
      type:  body.type,
      title: body.title ?? "",
      body:  body.body  ?? "",
      allowReply: !!body.allowReply,
      notifyByEmail: !!body.notifyByEmail,
    });
    return NextResponse.json({ directive });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "فشل حفظ التوجيه" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  if (!(await assertApplicationBelongsToTenant(id, ctx.organizationId))) return deny(404);

  await deleteDirective(id);
  return NextResponse.json({ ok: true });
}
