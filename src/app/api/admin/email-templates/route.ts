/**
 * GET  /api/admin/email-templates          — list all templates for this org
 * POST /api/admin/email-templates          — create a new template
 */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import {
  listEmailTemplates,
  createEmailTemplate,
  ensureDefaultTemplates,
  type EmailTemplateKind,
} from "@/infrastructure/email-templates/template.service";

const KINDS: readonly EmailTemplateKind[] = ["INVITATION", "ALERT", "HEALTH_CERT", "GENERIC"];
function isKind(v: unknown): v is EmailTemplateKind {
  return typeof v === "string" && (KINDS as readonly string[]).includes(v);
}

export async function GET() {
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;
  await ensureDefaultTemplates(ctx.organizationId);
  const rows = await listEmailTemplates(ctx.organizationId);
  return NextResponse.json({ templates: rows });
}

export async function POST(req: Request) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => ({}))) as {
    kind?: unknown; nameAr?: unknown; subjectAr?: unknown; bodyAr?: unknown;
    isDefault?: unknown; isActive?: unknown;
  };

  if (!isKind(body.kind))                                       return NextResponse.json({ error: "نوع القالب غير صالح" }, { status: 422 });
  if (typeof body.nameAr    !== "string" || !body.nameAr.trim())    return NextResponse.json({ error: "اسم القالب مطلوب" }, { status: 422 });
  if (typeof body.subjectAr !== "string" || !body.subjectAr.trim()) return NextResponse.json({ error: "عنوان البريد مطلوب" }, { status: 422 });
  if (typeof body.bodyAr    !== "string" || !body.bodyAr.trim())    return NextResponse.json({ error: "نص الرسالة مطلوب" }, { status: 422 });

  const row = await createEmailTemplate(ctx.organizationId, ctx.userId, {
    kind:      body.kind,
    nameAr:    body.nameAr,
    subjectAr: body.subjectAr,
    bodyAr:    body.bodyAr,
    isDefault: !!body.isDefault,
    isActive:  body.isActive !== false,
  });
  return NextResponse.json({ template: row }, { status: 201 });
}
