"use client";

import { useState, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { KeyRound, Loader2, ArrowRight } from "lucide-react";
import { NazahaLogo } from "@/components/ui/NazahaLogo";
import { safeCallbackUrl } from "@/lib/safe-redirect";

function CandidateLoginPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"), "/candidate");

  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (token.trim().length < 8) {
      setError("الرمز المُدخل غير صحيح. تأكد من نسخه كاملاً من رسالة الدعوة.");
      return;
    }

    startTransition(async () => {
      const res = await signIn("candidate-token", {
        token: token.trim(),
        redirect: false,
      });

      if (res?.error) {
        setError("الرمز غير صحيح أو منتهي الصلاحية. تواصل مع الموارد البشرية للحصول على رابط جديد.");
        return;
      }

      router.replace(callbackUrl);
    });
  }

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
                دخول المرشح
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                أدخل رمز الدعوة الذي أُرسل إليك
              </p>
            </div>
          </div>

          {/* Info box */}
          <div className="rounded-xl p-3 mb-5 text-sm"
            style={{ background: "var(--color-primary-muted)", color: "var(--color-primary)" }}>
            <p>
              ستجد رمز الدخول في البريد الإلكتروني المُرسَل إليك من قِبل إدارة الموارد البشرية
              عند قبولك في الوظيفة.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--color-dark)" }}>
                رمز الدخول
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="الصق الرمز هنا..."
                required
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all font-mono tracking-wider text-center"
                style={{
                  borderColor: error ? "var(--color-error)" : "var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  fontSize: "1rem", // ≥16px prevents iOS auto-zoom on focus
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
                  جارٍ التحقق...
                </>
              ) : (
                <>
                  <span>الدخول إلى ملفي</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t text-center"
            style={{ borderColor: "var(--color-border)" }}>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              هل أنت من الموارد البشرية؟{" "}
              <a href="/auth/login"
                className="font-medium hover:underline"
                style={{ color: "var(--color-primary)" }}>
                تسجيل دخول الموظفين
              </a>
            </p>
          </div>
        </div>

        {/* Dev hint — value comes from SEED_DEV_CANDIDATE_TOKEN in .env */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-4 p-3 rounded-xl text-xs border"
            style={{ background: "#FFF8E1", borderColor: "#F9C74F", color: "#7A5500" }}>
            <p className="font-bold mb-1">رمز التطوير (SEED_DEV_CANDIDATE_TOKEN):</p>
            <p style={{ color: "#999" }}>راجع .env للقيمة الفعلية</p>
          </div>
        )}
      </div>
    </div>
  );
}

// useSearchParams() opts the page out of static prerendering only inside a Suspense boundary.
export default function CandidateLoginPage() {
  return (
    <Suspense fallback={null}>
      <CandidateLoginPageInner />
    </Suspense>
  );
}
