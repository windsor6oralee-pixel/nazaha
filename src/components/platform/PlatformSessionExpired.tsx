"use client";

import { signOut } from "next-auth/react";
import { ShieldAlert } from "lucide-react";

/*
 * شاشة "انتهت الجلسة" لمشغّل المنصة.
 *
 * تظهر عندما يكون الرمز الموقّع ما زال موجوداً لكن الحساب لم يعد صالحاً —
 * مثل تغيير كلمة المرور أو تعطيل الحساب. الخيار الوحيد هنا هو إنهاء الجلسة
 * والدخول من جديد، فلا يبقى المشغّل داخل بوابة بلا صلاحية.
 */
export function PlatformSessionExpired() {
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-surface-alt)" }}>
      <div className="bg-white rounded-2xl border p-8 max-w-md w-full text-center space-y-4" style={{ borderColor: "var(--color-border)" }}>
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ background: "var(--color-error-bg)" }}>
          <ShieldAlert className="w-7 h-7" style={{ color: "var(--color-error)" }} />
        </div>
        <h1 className="text-lg font-bold" style={{ color: "var(--color-dark)" }}>انتهت الجلسة</h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          لم تعد صلاحية هذه الجلسة قائمة — ربما تغيّرت كلمة المرور أو أُوقف الحساب. سجّل الدخول من جديد للمتابعة.
        </p>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/platform/login" })}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: "var(--color-primary)", color: "white" }}
        >
          تسجيل الدخول من جديد
        </button>
      </div>
    </div>
  );
}
