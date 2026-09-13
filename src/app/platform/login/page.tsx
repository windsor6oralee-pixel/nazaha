"use client";

import { useState, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, ServerCog, Loader2, ShieldAlert } from "lucide-react";
import { NazahaLogo } from "@/components/ui/NazahaLogo";

function PlatformLoginPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/platform";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await signIn("platform-credentials", { email, password, redirect: false });
      if (res?.error) { setError("بيانات الدخول غير صحيحة"); return; }
      router.replace(callbackUrl);
    });
  }

  const inputStyle: React.CSSProperties = {
    borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0B1F18" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <NazahaLogo variant="light" size="md" />
          <p className="flex items-center gap-1.5 text-sm mt-4" style={{ color: "var(--color-gold-light)", fontFamily: "'Noto Kufi Arabic', sans-serif" }}>
            <ServerCog className="w-4 h-4" /> وحدة إدارة المنصة
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 space-y-4" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
          <div className="flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg" style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}>
            <ShieldAlert className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            هذه الوحدة لمشغّلي المنصة فقط. موظفو الجهات يدخلون من بوابة الموارد البشرية.
          </div>

          {error && (
            <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-dark)" }}>البريد الإلكتروني</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" autoComplete="username"
              className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-dark)" }}>كلمة المرور</label>
            <div className="relative">
              <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" autoComplete="current-password"
                className="w-full px-4 py-2.5 pl-10 rounded-xl border text-sm outline-none" style={inputStyle} />
              <button type="button" onClick={() => setShow(!show)} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} aria-label="إظهار كلمة المرور">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-primary-dark)", color: "white", cursor: isPending ? "not-allowed" : "pointer", minHeight: 48 }}>
            {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الدخول...</> : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}

// useSearchParams() opts the page out of static prerendering only inside a Suspense boundary.
export default function PlatformLoginPage() {
  return (
    <Suspense fallback={null}>
      <PlatformLoginPageInner />
    </Suspense>
  );
}
