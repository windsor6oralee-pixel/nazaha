import { NextResponse } from "next/server";
import {
  activateCandidateAccount,
  CandidateAccountError,
} from "@/infrastructure/auth/credentials.service";

/**
 * تفعيل حساب المرشح لأول مرة.
 *
 * رمز التفعيل هنا ليس وسيلة دخول بل **إثبات هوية لمرة واحدة**: يتحوّل إلى
 * حساب دائم (بريد + كلمة مرور)، ثم يُوسم «مُستخدم» فلا يعود صالحاً.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { code?: unknown; email?: unknown; password?: unknown }
    | null;

  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!code || !email || !password) {
    return NextResponse.json(
      { error: "رمز التفعيل والبريد الإلكتروني وكلمة المرور مطلوبة." },
      { status: 400 },
    );
  }

  try {
    const result = await activateCandidateAccount(code, email, password);
    return NextResponse.json({ ok: true, email: result.loginEmail });
  } catch (error) {
    if (error instanceof CandidateAccountError) {
      const status =
        error.code === "EMAIL_TAKEN" ? 409 : error.code === "WEAK_PASSWORD" ? 422 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[candidate/setup]", error);
    return NextResponse.json(
      { error: "تعذّر تفعيل الحساب — حاول مرة أخرى." },
      { status: 500 },
    );
  }
}
