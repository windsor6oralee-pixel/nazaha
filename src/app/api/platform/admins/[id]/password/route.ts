import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/infrastructure/tenant";
import {
  PasswordPolicyError,
  setPlatformAdminPassword,
} from "@/infrastructure/platform/account.service";

interface Params { params: Promise<{ id: string }> }

/** يضبط كلمة مرور مشغّل منصة (أو حسابه هو) — مشغّل منصة فقط. */
export async function PATCH(req: Request, { params }: Params) {
  const ctx = await requirePlatformAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  if (!body || typeof body.password !== "string") {
    return NextResponse.json({ error: "كلمة المرور مطلوبة" }, { status: 400 });
  }

  try {
    const admin = await setPlatformAdminPassword({
      adminId: id,
      password: body.password,
      actor: { id: ctx.adminId, email: ctx.email },
    });
    return NextResponse.json({ ok: true, email: admin.email, nameAr: admin.nameAr });
  } catch (e) {
    if (e instanceof PasswordPolicyError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
  }
}
