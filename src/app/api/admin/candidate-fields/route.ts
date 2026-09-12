import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import {
  listFieldDefinitions,
  createFieldDefinition,
  validateDefinition,
  type FieldDefinitionInput,
} from "@/infrastructure/custom-fields/field.service";

const ADMIN_ROLES = ["admin", "hr_manager"];

export async function GET() {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ fields: await listFieldDefinitions(ctx.organizationId) });
}

export async function POST(req: Request) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => null)) as Partial<FieldDefinitionInput> | null;
  if (!body) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });

  const error = validateDefinition(body);
  if (error) return NextResponse.json({ error }, { status: 422 });

  try {
    const field = await createFieldDefinition(ctx.organizationId, body as FieldDefinitionInput);
    return NextResponse.json({ field }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "فشل الإنشاء" }, { status: 409 });
  }
}
