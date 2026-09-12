"use client";

import { useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Shield, Loader2 } from "lucide-react";
import { NazahaLogo } from "@/components/ui/NazahaLogo";

export default function HRLoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/hr";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await signIn("hr-credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
        return;
      }

      router.replace(callbackUrl);
    });
  }

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Left panel — decorative brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: "var(--color-primary-dark)" }}>
        {/* Gold top accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: "50%", height: 3, background: "var(--color-gold)" }} />
        <NazahaLogo variant="light" size="lg" />

        <div>
          <div className="gold-divider mb-6" style={{ width: 64 }} />
          <p className="text-heading text-3xl font-bold leading-snug mb-4"
            style={{ color: "var(--color-gold-light)" }}>
            الثقة التي تسبق الانطلاقة
          </p>
          <p className="text-lg leading-relaxed text-body" style={{ color: "rgba(255,255,255,0.65)" }}>
            منصة إدارة رحلة ما بعد القبول الوظيفي
            <br />
            للجهات الحكومية وشبه الحكومية.
          </p>
        </div>

        <div className="flex gap-8 text-sm text-body" style={{ color: "rgba(255,255,255,0.4)" }}>
          {["النزاهة", "الثقة", "الكفاءة", "التمكين"].map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6"
        style={{ background: "var(--color-beige)" }}>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <NazahaLogo variant="dark" size="md" />
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-8"
            style={{ borderColor: "var(--color-border)" }}>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
                <span className="text-xs font-medium" style={{ color: "var(--color-primary)" }}>
                  بوابة الموارد البشرية
                </span>
              </div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>
                تسجيل الدخول
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                أدخل بيانات حساب الموارد البشرية للمتابعة
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--color-dark)" }}>
                  البريد الإلكتروني المؤسسي
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.gov.sa"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                  style={{
                    borderColor: error ? "var(--color-error)" : "var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--color-text)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--color-primary)";
                    e.target.style.boxShadow = "0 0 0 3px var(--color-primary-muted)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = error ? "var(--color-error)" : "var(--color-border)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--color-dark)" }}>
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all pl-10"
                    style={{
                      borderColor: error ? "var(--color-error)" : "var(--color-border)",
                      background: "var(--color-surface)",
                      color: "var(--color-text)",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--color-primary)";
                      e.target.style.boxShadow = "0 0 0 3px var(--color-primary-muted)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = error ? "var(--color-error)" : "var(--color-border)";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg"
                  style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>
                  <span>⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all mt-2"
                style={{
                  background: isPending ? "#6B9E82" : "var(--color-primary)",
                  color: "white",
                  cursor: isPending ? "not-allowed" : "pointer",
                }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جارٍ التحقق...
                  </>
                ) : (
                  "دخول"
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t text-center"
              style={{ borderColor: "var(--color-border)" }}>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                هل أنت مرشح؟{" "}
                <a href="/auth/candidate"
                  className="font-medium hover:underline"
                  style={{ color: "var(--color-primary)" }}>
                  ادخل عبر رابط الدعوة
                </a>
              </p>
            </div>
          </div>

          {/* Dev hint — shown only in development; values from SEED_DEV_* env vars */}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-4 p-3 rounded-xl text-xs border"
              style={{ background: "#FFF8E1", borderColor: "#F9C74F", color: "#7A5500" }}>
              <p className="font-bold mb-1">بيانات التطوير (SEED_DEV_*):</p>
              <p>البريد: salma.rashidi@mof.gov.sa</p>
              <p>كلمة المرور: راجع SEED_DEV_HR_PASSWORD في .env</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
