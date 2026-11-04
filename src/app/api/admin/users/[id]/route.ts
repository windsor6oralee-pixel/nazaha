import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { isSystemRole, StaffError, updateStaff, type UpdateStaffInput } from "@/infrastructure/services/staff.service";

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await requireHR({ roles: ["admin"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });

  const input: UpdateStaffInput = {};
  if (body.nameAr !== undefined) {
    if (typeof body.nameAr !== "string") return NextResponse.json({ error: "الاسم غير صالح" }, { status: 422 });
    input.nameAr = body.nameAr;
  }
  if (body.phone !== undefined) {
    if (body.phone !== null && typeof body.phone !== "string") return NextResponse.json({ error: "رقم الجوال غير صالح" }, { status: 422 });
    input.phone = body.phone as string | null;
  }
  if (body.role !== undefined) {
    if (!isSystemRole(body.role)) return NextResponse.json({ error: "الدور غير صالح" }, { status: 422 });
    input.role = body.role;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") return NextResponse.json({ error: "قيمة التفعيل غير صالحة" }, { status: 422 });
    input.isActive = body.isActive;
  }
  if (body.password !== undefined) {
    if (typeof body.password !== "string") return NextResponse.json({ error: "كلمة المرور غير صالحة" }, { status: 422 });
    input.password = body.password;
  }

  try {
    const user = await updateStaff(ctx.organizationId, ctx.userId, id, input);
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof StaffError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/users/:id]", err);
    return NextResponse.json({ error: "تعذّر تحديث الحساب" }, { status: 500 });
  }
}
