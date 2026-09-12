import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import {
  updateFieldDefinition,
  deleteFieldDefinition,
  validateDefinition,
} from "@/infrastructure/custom-fields/field.service";

const ADMIN_ROLES = ["admin", "hr_manager"];
interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });

  const error = validateDefinition(body, true);
  if (error) return NextResponse.json({ error }, { status: 422 });

  try {
    const field = await updateFieldDefinition(ctx.organizationId, id, body);
    return NextResponse.json({ field });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "فشل التحديث" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  try {
    const result = await deleteFieldDefinition(ctx.organizationId, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "فشل الحذف" }, { status: 404 });
  }
}
