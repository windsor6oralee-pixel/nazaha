"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { NazahaLogo } from "@/components/ui/NazahaLogo";

const errorMessages: Record<string, { title: string; body: string; action: string; href: string }> = {
  Configuration: {
    title: "خطأ في الإعدادات",
    body: "هناك مشكلة في إعداد نظام المصادقة. يرجى التواصل مع مسؤول النظام.",
    action: "العودة للصفحة الرئيسية",
    href: "/",
  },
  AccessDenied: {
    title: "الوصول مرفوض",
    body: "ليس لديك صلاحية للوصول إلى هذه الصفحة.",
    action: "تسجيل الدخول",
    href: "/auth/login",
  },
  Verification: {
    title: "رمز منتهي الصلاحية",
    body: "انتهت صلاحية رمز الدخول أو تم استخدامه بالفعل. تواصل مع الموارد البشرية للحصول على رابط جديد.",
    action: "المحاولة مرة أخرى",
    href: "/auth/candidate",
  },
  Default: {
    title: "خطأ في تسجيل الدخول",
    body: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
    action: "تسجيل الدخول",
    href: "/auth/login",
  },
};

function AuthErrorPageInner() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") ?? "Default";
  const info = errorMessages[errorCode] ?? errorMessages.Default;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--color-beige)" }} dir="rtl">

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <NazahaLogo variant="dark" size="md" />
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-8 text-center"
          style={{ borderColor: "var(--color-border)" }}>

          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--color-error-bg)" }}>
            <AlertCircle className="w-7 h-7" style={{ color: "var(--color-error)" }} />
          </div>

          <h1 className="text-xl font-bold mb-2" style={{ color: "var(--color-dark)" }}>
            {info.title}
          </h1>
          <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--color-text-muted)" }}>
            {info.body}
          </p>

          <a href={info.href}
            className="inline-flex items-center justify-center w-full py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "var(--color-primary)", color: "white" }}>
            {info.action}
          </a>

          {errorCode !== "Default" && (
            <p className="mt-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
              رمز الخطأ:{" "}
              <code className="font-mono px-1.5 py-0.5 rounded"
                style={{ background: "var(--color-beige)", color: "var(--color-dark)" }}>
                {errorCode}
              </code>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// useSearchParams() opts the page out of static prerendering only inside a Suspense boundary.
export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorPageInner />
    </Suspense>
  );
}
