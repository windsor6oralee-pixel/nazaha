/**
 * PATCH  /api/admin/email-templates/[id] — update fields
 * DELETE /api/admin/email-templates/[id] — soft-delete (isActive=false)
 */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import {
  updateEmailTemplate,
  deleteEmailTemplate,
  type EmailTemplateKind,
} from "@/infrastructure/email-templates/template.service";

const KINDS: readonly EmailTemplateKind[] = ["INVITATION", "ALERT", "HEALTH_CERT", "GENERIC"];
function isKind(v: unknown): v is EmailTemplateKind {
  return typeof v === "string" && (KINDS as readonly string[]).includes(v);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Parameters<typeof updateEmailTemplate>[2] = {};
  if ("kind"      in body) { if (!isKind(body.kind)) return NextResponse.json({ error: "نوع القالب غير صالح" }, { status: 422 }); patch.kind = body.kind; }
  if ("nameAr"    in body) { if (typeof body.nameAr    !== "string" || !body.nameAr.trim())    return NextResponse.json({ error: "اسم القالب مطلوب" },  { status: 422 }); patch.nameAr    = body.nameAr; }
  if ("subjectAr" in body) { if (typeof body.subjectAr !== "string" || !body.subjectAr.trim()) return NextResponse.json({ error: "عنوان البريد مطلوب" }, { status: 422 }); patch.subjectAr = body.subjectAr; }
  if ("bodyAr"    in body) { if (typeof body.bodyAr    !== "string")                            return NextResponse.json({ error: "نص الرسالة مطلوب" },  { status: 422 }); patch.bodyAr    = body.bodyAr; }
  if ("isDefault" in body)   patch.isDefault = !!body.isDefault;
  if ("isActive"  in body)   patch.isActive  = !!body.isActive;

  try {
    const row = await updateEmailTemplate(ctx.organizationId, id, patch);
    return NextResponse.json({ template: row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "فشل التحديث" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  await deleteEmailTemplate(ctx.organizationId, id);
  return NextResponse.json({ ok: true });
}
