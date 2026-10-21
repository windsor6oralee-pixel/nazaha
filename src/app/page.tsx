"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle, FileText, Zap } from "lucide-react";
import Image from "next/image";
import { BentoShowcase } from "@/components/landing/BentoShowcase";

const features = [
  { icon: FileText, text: "تتبع مستنداتك لحظة بلحظة" },
  { icon: CheckCircle, text: "اعتماد فوري لكل خطوة تُكملها" },
  { icon: Zap, text: "رحلة واضحة من القبول إلى الانطلاقة" },
];

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/auth/candidate/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "تعذّر تسجيل الدخول — حاول مرة أخرى.");
        return;
      }

      router.replace("/candidate");
    });
  }

  return (
    <div dir="rtl">
    <div className="min-h-screen flex">

      {/* ── Right panel — brand + tagline ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "var(--color-primary-dark)" }}
      >
        {/* Gold top accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--color-gold)" }} />

        {/* Decorative radial glow */}
        <div style={{
          position: "absolute", bottom: -120, left: -80, width: 420, height: 420,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(201,169,74,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Logo */}
        <div className="flex items-center gap-4 z-10">
          <div className="logo-plate">
            <Image
              src="/nazaha-logo.png"
              alt="شعار نزاهة التوظيف"
              width={120}
              height={120}
              priority
              style={{ objectFit: "contain", display: "block" }}
            />
          </div>
          <div>
            <p className="font-bold text-2xl leading-tight text-white text-heading">نزاهة التوظيف</p>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Inter', sans-serif" }}>Nazaha Employment</p>
          </div>
        </div>

        {/* Main copy */}
        <div className="z-10">
          <div className="mb-6" style={{ width: 48, height: 3, background: "var(--color-gold)", borderRadius: 9999 }} />
          <h1
            className="text-4xl font-bold leading-snug mb-5 text-heading"
            style={{ color: "var(--color-gold-light)" }}
          >
            بداية موثوقة
            <br />
            لمسيرة تستحقها
          </h1>
          <p className="text-base leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
            منصة ما بعد القبول الوظيفي للجهات الحكومية —
            <br />
            رحلة رقمية واضحة من لحظة القبول حتى الانطلاقة.
          </p>

          {/* Feature list */}
          <ul className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(201,169,74,0.15)" }}
                >
                  <Icon className="w-4 h-4" style={{ color: "var(--color-gold)" }} />
                </div>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.75)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer values */}
        <div className="flex gap-6 text-xs z-10" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          {["النزاهة", "الثقة", "الكفاءة", "التمكين"].map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
      </div>

      {/* ── Left panel — login form ── */}
      <div
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: "var(--color-beige)" }}
      >
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <div className="flex items-center gap-3">
              <Image src="/nazaha-logo.png" alt="شعار نزاهة التوظيف" width={72} height={72} priority style={{ objectFit: "contain" }} />
              <span className="font-bold text-xl text-heading" style={{ color: "var(--color-primary-dark)" }}>نزاهة التوظيف</span>
            </div>
          </div>

          <div
            className="bg-white rounded-2xl border p-8"
            style={{ borderColor: "var(--color-border)", boxShadow: "0 2px 16px rgba(0,0,0,0.07)" }}
          >
            {/* Greeting */}
            <div className="mb-7">
              <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>
                مرحباً بك في نزاهة التوظيف
              </p>
              <h2 className="text-2xl font-bold text-heading" style={{ color: "var(--color-dark)" }}>
                ابدأ رحلتك المهنية
              </h2>
              <p className="text-sm mt-1.5" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
                سجّل الدخول ببريدك الإلكتروني وكلمة المرور
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="home-email"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--color-dark)" }}
                >
                  البريد الإلكتروني
                </label>
                <input
                  id="home-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  dir="ltr"
                  autoComplete="username"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{
                    borderColor: error ? "var(--color-error)" : "var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--color-text)",
                    transition: "border-color var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard)",
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
                <label
                  htmlFor="home-password"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--color-dark)" }}
                >
                  كلمة المرور
                </label>
                <input
                  id="home-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  dir="ltr"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{
                    borderColor: error ? "var(--color-error)" : "var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--color-text)",
                    transition: "border-color var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard)",
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
                <div
                  className="flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg"
                  style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}
                >
                  <span className="flex-shrink-0">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: isPending ? "#6B9E82" : "var(--color-primary)",
                  color: "white",
                  cursor: isPending ? "not-allowed" : "pointer",
                  transition: "background var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)",
                  fontFamily: "'IBM Plex Sans Arabic', sans-serif",
                }}
                onMouseEnter={(e) => { if (!isPending) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-primary-hover)"; }}
                onMouseLeave={(e) => { if (!isPending) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-primary)"; }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جارٍ التحقق...
                  </>
                ) : (
                  <>
                    الدخول إلى ملفي
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Help text */}
            <div
              className="mt-6 pt-5 border-t text-center"
              style={{ borderColor: "var(--color-border)" }}
            >
              <p className="text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
                لم تُفعّل حسابك بعد؟{" "}
                <a href="/auth/candidate/setup" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                  فعّله برمز التفعيل
                </a>
              </p>
            </div>
          </div>

          <a href="#platform" className="scroll-hint mt-6 mx-auto flex flex-col items-center gap-1 text-xs"
            style={{ color: "var(--color-text-muted)", minHeight: 0, minWidth: 0 }}>
            تعرّف على المنصة
            <span className="scroll-hint-arrow" aria-hidden>↓</span>
          </a>

        </div>
      </div>
    </div>

    <BentoShowcase />
    </div>
  );
}
