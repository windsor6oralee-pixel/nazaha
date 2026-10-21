import { NextResponse } from "next/server";
import { AuthError } from "next-auth";
import { signIn } from "@/infrastructure/auth/auth";

/**
 * دخول المرشح ببريد إلكتروني وكلمة مرور.
 *
 * الجلسات تُنشأ عبر NextAuth نفسه (نفس المسار الذي تستخدمه بقية الأدوار)،
 * فتبقى القواعد واحدة: قفل بعد خمس محاولات، قاعدة حيّة، وأدوار محدّدة.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null;

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "البريد الإلكتروني وكلمة المرور مطلوبان." },
      { status: 400 },
    );
  }

  try {
    // `redirect: false` يمنع NextAuth من تحويل المسار — نقرأ النتيجة بأنفسنا.
    await signIn("candidate-credentials", {
      email,
      password,
      redirectTo: "/candidate",
      redirect: false,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      // بيانات دخول غير صحيحة — لا نقول أيّها بالضبط.
      return NextResponse.json(
        { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." },
        { status: 401 },
      );
    }
    console.error("[candidate/login]", error);
    return NextResponse.json(
      { error: "تعذّر تسجيل الدخول — حاول مرة أخرى." },
      { status: 500 },
    );
  }
}
