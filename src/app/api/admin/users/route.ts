import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { createStaff, listStaff, StaffError, validateCreateStaff, type CreateStaffInput } from "@/infrastructure/services/staff.service";

// إدارة الموظفين لمدير النظام وحده: مدير الموارد البشرية لا يمنح نفسه أو غيره صلاحيات.
const STAFF_ADMIN = ["admin"];

export async function GET() {
  const ctx = await requireHR({ roles: STAFF_ADMIN });
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ users: await listStaff(ctx.organizationId) });
}

export async function POST(req: Request) {
  const ctx = await requireHR({ roles: STAFF_ADMIN });
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => null)) as Partial<Record<keyof CreateStaffInput, unknown>> | null;
  if (!body) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  const problem = validateCreateStaff(body);
  if (problem) return NextResponse.json({ error: problem }, { status: 422 });

  try {
    const user = await createStaff(ctx.organizationId, ctx.userId, body as unknown as CreateStaffInput);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof StaffError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/users]", err);
    return NextResponse.json({ error: "تعذّر إنشاء الحساب" }, { status: 500 });
  }
}
