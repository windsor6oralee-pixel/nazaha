/**
 * PATCH  /api/admin/directive-templates/[id] — edit a template
 * DELETE /api/admin/directive-templates/[id] — remove a template
 */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import {
  updateDirectiveTemplate,
  deleteDirectiveTemplate,
} from "@/infrastructure/directives/directive.service";

const ADMIN_ROLES = ["admin", "hr_manager"];

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { title?: string; body?: string; type?: "INFO" | "URGENT" | "APPOINTMENT" };
  try {
    const tpl = await updateDirectiveTemplate(ctx.organizationId, id, body.title ?? "", body.body ?? "", body.type);
    return NextResponse.json({ template: tpl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "فشل التحديث" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  await deleteDirectiveTemplate(ctx.organizationId, id);
  return NextResponse.json({ ok: true });
}
