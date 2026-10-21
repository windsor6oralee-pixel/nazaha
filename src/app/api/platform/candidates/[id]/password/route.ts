import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/infrastructure/tenant";
import {
  PasswordPolicyError,
  setCandidatePassword,
} from "@/infrastructure/platform/account.service";

interface Params { params: Promise<{ id: string }> }

/** يضبط كلمة مرور مرشح — مشغّل المنصة فقط. */
export async function PATCH(req: Request, { params }: Params) {
  const ctx = await requirePlatformAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  if (!body || typeof body.password !== "string") {
    return NextResponse.json({ error: "كلمة المرور مطلوبة" }, { status: 400 });
  }

  try {
    const candidate = await setCandidatePassword({
      candidateId: id,
      password: body.password,
      actor: { id: ctx.adminId, email: ctx.email },
    });
    return NextResponse.json({
      ok: true,
      email: candidate.loginEmail,
      nameAr: candidate.nameAr,
      organizationName: candidate.organizationName,
      created: candidate.created,
    });
  } catch (e) {
    if (e instanceof PasswordPolicyError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
  }
}
