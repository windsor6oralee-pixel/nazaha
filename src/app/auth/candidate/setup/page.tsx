"use client";

import { useState, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, ArrowRight } from "lucide-react";
import { NazahaLogo } from "@/components/ui/NazahaLogo";

/**
 * تفعيل حساب المرشح لأول مرة.
 *
 * رمز الدعوة يُستعمل هنا مرة واحدة فقط: يتحوّل إلى بريد دخول وكلمة مرور،
 * ثم يُوسم «مُستخدم» فلا يعود صالحاً. بعد التفعيل يدخل المرشح بحسابه
 * من /auth/candidate.
 */
function CandidateSetupPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/auth/candidate/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), email: email.trim(), password }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "تعذّر تفعيل الحساب — حاول مرة أخرى.");
        return;
      }

      router.replace("/auth/candidate");
    });
  }

  const fieldStyle = (invalid?: boolean) => ({
    borderColor: invalid ? "var(--color-error)" : "var(--color-border)",
    background: "var(--color-surface)",
    color: "var(--color-text)",
    fontSize: "1rem", // ≥16px prevents iOS auto-zoom on focus
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ background: "var(--color-beige)" }} dir="rtl">

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6 sm:mb-8">
          <NazahaLogo variant="dark" size="md" />
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-6 sm:p-8"
          style={{ borderColor: "var(--color-border)" }}>

          {/* Header */}
          <div className="flex items-start gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--color-primary-muted)" }}>
              <KeyRound className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--color-dark)" }}>
                تفعيل حساب المرشح
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                أنشئ حساب دخولك بكلمة مرور من اختيارك
              </p>
            </div>
          </div>

          {/* Info box */}
          <div className="rounded-xl p-3 mb-5 text-sm"
            style={{ background: "var(--color-primary-muted)", color: "var(--color-primary)" }}>
            <p>
              استخدم رمز الدعوة المُرسل إليك من إدارة الموارد البشرية، ثم اختر بريداً وكلمة مرور.
              بعدها تدخل إلى بوابتك بالحساب الجديد دائماً.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="setup-code" className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--color-dark)" }}>
                رمز الدعوة
              </label>
              <input
                id="setup-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="الصق الرمز هنا..."
                required
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all font-mono tracking-wider text-center"
                style={fieldStyle(!!error)}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--color-primary)";
                  e.target.style.boxShadow = "0 0 0 3px var(--color-primary-muted)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--color-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <div>
              <label htmlFor="setup-email" className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--color-dark)" }}>
                البريد الإلكتروني للدخول
              </label>
              <input
                id="setup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                autoComplete="username"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                style={fieldStyle(!!error)}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--color-primary)";
                  e.target.style.boxShadow = "0 0 0 3px var(--color-primary-muted)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--color-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <div>
              <label htmlFor="setup-password" className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--color-dark)" }}>
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="setup-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="10 أحرف على الأقل، وتحتوي رقماً"
                  required
                  autoComplete="new-password"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                  style={{ ...fieldStyle(!!error), paddingLeft: 44 }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--color-primary)";
                    e.target.style.boxShadow = "0 0 0 3px var(--color-primary-muted)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--color-border)";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute top-1/2 -translate-y-1/2 p-2 rounded-lg"
                  style={{ left: 6, color: "var(--color-text-muted)" }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="setup-confirm" className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--color-dark)" }}>
                تأكيد كلمة المرور
              </label>
              <input
                id="setup-confirm"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد كتابة كلمة المرور"
                required
                autoComplete="new-password"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                style={fieldStyle(!!error)}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--color-primary)";
                  e.target.style.boxShadow = "0 0 0 3px var(--color-primary-muted)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--color-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg"
                style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>
                <span className="flex-shrink-0 mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                minHeight: 52,
                background: isPending ? "#6B9E82" : "var(--color-primary)",
                color: "white",
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جارٍ التفعيل...
                </>
              ) : (
                <>
                  <span>تفعيل الحساب</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t text-center"
            style={{ borderColor: "var(--color-border)" }}>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              لديك حساب مفعّل بالفعل؟{" "}
              <a href="/auth/candidate"
                className="font-medium hover:underline"
                style={{ color: "var(--color-primary)" }}>
                تسجيل الدخول
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// useSearchParams() opts the page out of static prerendering only inside a Suspense boundary.
export default function CandidateSetupPage() {
  return (
    <Suspense fallback={null}>
      <CandidateSetupPageInner />
    </Suspense>
  );
}
