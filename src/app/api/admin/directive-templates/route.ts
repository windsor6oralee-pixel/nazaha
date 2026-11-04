/**
 * GET  /api/admin/directive-templates — list this org's templates
 * POST /api/admin/directive-templates — create a new template
 */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import {
  listDirectiveTemplates,
  createDirectiveTemplate,
} from "@/infrastructure/directives/directive.service";

const ADMIN_ROLES = ["admin", "hr_manager"];

export async function GET() {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;
  const templates = await listDirectiveTemplates(ctx.organizationId);
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;
  const body = (await req.json().catch(() => ({}))) as { title?: string; body?: string; type?: "INFO" | "URGENT" | "APPOINTMENT" };
  try {
    const tpl = await createDirectiveTemplate(ctx.organizationId, body.title ?? "", body.body ?? "", body.type ?? "INFO");
    return NextResponse.json({ template: tpl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "فشل إنشاء القالب" }, { status: 400 });
  }
}
