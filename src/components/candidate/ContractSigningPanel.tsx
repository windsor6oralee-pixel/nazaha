"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  PenLine,
  CheckCircle,
  XCircle,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

interface Contract {
  id: string;
  nameAr: string;
  status: string;
  generatedAt: string | null;
  signedAt: string | null;
  renderedHtml: string | null;
}

interface Props {
  contract: Contract;
  candidateNameAr: string;
}

export function ContractSigningPanel({ contract, candidateNameAr }: Props) {
  const [fullName, setFullName] = useState(candidateNameAr);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(contract.status === "FULLY_SIGNED");
  const [signedAt, setSignedAt] = useState<string | null>(contract.signedAt);
  const [isPending, start] = useTransition();
  const router = useRouter();

  function handleSign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    start(async () => {
      const res = await fetch(`/api/contracts/${contract.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "فشل التوقيع");
        return;
      }

      setSignedAt(new Date().toISOString());
      setSigned(true);
      router.refresh();
    });
  }

  const genDate = contract.generatedAt
    ? new Date(contract.generatedAt).toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // ── Signed state ──────────────────────────────────────────────────────────
  if (signed) {
    return (
      <div
        className="rounded-2xl border p-6 text-center"
        style={{ borderColor: "#6EE7B7", background: "var(--color-success-bg)" }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(34,122,78,0.12)" }}
        >
          <CheckCircle className="w-8 h-8" style={{ color: "var(--color-success)" }} />
        </div>
        <h3 className="font-bold text-lg mb-1" style={{ color: "var(--color-dark)" }}>
          تم توقيع العقد بنجاح
        </h3>
        <p className="text-sm mb-3" style={{ color: "var(--color-text-muted)" }}>
          {contract.nameAr}
        </p>
        {signedAt && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            وُقِّع بتاريخ{" "}
            {new Date(signedAt).toLocaleDateString("ar-SA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </div>
    );
  }

  // ── Signing UI ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Contract details card */}
      <div
        className="rounded-2xl border p-5 flex items-start gap-4"
        style={{ borderColor: "var(--color-border)", background: "white" }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--color-primary-muted)" }}
        >
          <FileText className="w-6 h-6" style={{ color: "var(--color-primary)" }} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-base" style={{ color: "var(--color-dark)" }}>
            {contract.nameAr}
          </h3>
          {genDate && (
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              صدر بتاريخ {genDate}
            </p>
          )}
          <span
            className="inline-block text-xs font-medium mt-2 px-2.5 py-1 rounded-full"
            style={{
              background: "var(--color-warning-bg)",
              color: "var(--color-warning)",
            }}
          >
            بانتظار توقيعك
          </span>
        </div>
      </div>

      {/* Full contract text (frozen at generation) */}
      <div
        className="rounded-xl border p-5 max-h-[32rem] overflow-y-auto"
        style={{ borderColor: "var(--color-border)", background: "white" }}
      >
        {contract.renderedHtml ? (
          <div className="contract-body" dangerouslySetInnerHTML={{ __html: contract.renderedHtml }} />
        ) : (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            نص العقد غير متوفر — يرجى التواصل مع الموارد البشرية.
          </p>
        )}
      </div>

      {/* Signing form */}
      <form
        onSubmit={handleSign}
        className="rounded-2xl border p-6 space-y-5"
        style={{ borderColor: "var(--color-border)", background: "white" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <PenLine className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
          <h3 className="font-semibold text-sm" style={{ color: "var(--color-dark)" }}>
            التوقيع الإلكتروني
          </h3>
        </div>

        {/* Name field */}
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--color-dark)" }}
          >
            الاسم الكامل للتوقيع <span style={{ color: "var(--color-error)" }}>*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="أدخل اسمك الكامل كما في الهوية"
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontFamily: "'Noto Kufi Arabic', sans-serif",
              fontSize: "1rem",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--color-gold)";
              e.target.style.boxShadow = "0 0 0 3px var(--color-gold-muted)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--color-border)";
              e.target.style.boxShadow = "none";
            }}
          />
          <p className="text-xs mt-1.5" style={{ color: "var(--color-text-muted)" }}>
            سيُسجَّل هذا الاسم كتوقيعك الرسمي على العقد
          </p>
        </div>

        {/* Signature preview */}
        {fullName.trim() && (
          <div
            className="px-4 py-3 rounded-xl border text-center"
            style={{
              borderColor: "var(--color-primary)",
              background: "var(--color-primary-muted)",
            }}
          >
            <p
              className="text-lg"
              style={{
                color: "var(--color-primary-dark)",
                fontFamily: "'Noto Kufi Arabic', sans-serif",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              {fullName}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              معاينة التوقيع
            </p>
          </div>
        )}

        {/* Confirmation checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5 flex-shrink-0">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="sr-only"
            />
            <div
              className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
              style={{
                borderColor: confirmed ? "var(--color-primary)" : "var(--color-border)",
                background: confirmed ? "var(--color-primary)" : "white",
              }}
            >
              {confirmed && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            أقر بأنني قرأت جميع بنود العقد وأفهمها وأوافق عليها، وأن توقيعي الإلكتروني يُعدّ ملزماً
            قانونياً ويعادل التوقيع الخطي وفق نظام التعاملات الإلكترونية في المملكة العربية السعودية.
          </span>
        </label>

        {/* Error */}
        {error && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{
              background: "var(--color-error-bg)",
              color: "var(--color-error)",
              border: "1px solid rgba(168,58,48,0.25)",
            }}
          >
            <XCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending || !confirmed || !fullName.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background:
              isPending || !confirmed || !fullName.trim()
                ? "var(--color-border)"
                : "var(--color-primary)",
            color: isPending || !confirmed || !fullName.trim() ? "var(--color-text-muted)" : "white",
            cursor: isPending || !confirmed || !fullName.trim() ? "not-allowed" : "pointer",
            fontFamily: "'IBM Plex Sans Arabic', sans-serif",
            minHeight: 48,
          }}
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جارٍ تسجيل التوقيع...
            </>
          ) : (
            <>
              <PenLine className="w-4 h-4" />
              توقيع العقد إلكترونياً
            </>
          )}
        </button>
      </form>

      {/* Legal note */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl text-xs"
        style={{
          background: "var(--color-surface-alt)",
          borderColor: "var(--color-border)",
          color: "var(--color-text-muted)",
        }}
      >
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--color-primary)" }} />
        <p>
          التوقيع الإلكتروني معتمد وفق نظام التعاملات الإلكترونية في المملكة العربية السعودية
          ويُعادل التوقيع الورقي من الناحية القانونية. يُحفظ سجل التوقيع مع بيانات الجهاز والتوقيت.
        </p>
      </div>
    </div>
  );
}

// ── Locked state (docs not all approved) ─────────────────────────────────────
export function ContractLockedPanel({
  approvedCount,
  totalRequired,
}: {
  approvedCount: number;
  totalRequired: number;
}) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ borderColor: "var(--color-border)", background: "white" }}
    >
      <div
        className="flex items-center gap-3 p-4 rounded-xl mb-5"
        style={{ background: "var(--color-warning-bg)" }}
      >
        <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "var(--color-warning)" }} />
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--color-dark)" }}>
            في انتظار اكتمال المستندات
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            ستُفتح هذه المرحلة بعد اعتماد جميع مستنداتك المطلوبة
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
          <span>المستندات المعتمدة</span>
          <span className="font-semibold" style={{ color: "var(--color-dark)" }}>
            {approvedCount} / {totalRequired}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${totalRequired > 0 ? (approvedCount / totalRequired) * 100 : 0}%`,
              background: "linear-gradient(90deg, var(--color-primary) 0%, var(--color-gold) 100%)",
            }}
          />
        </div>
      </div>

      {/* Placeholder contracts */}
      <div className="space-y-3 opacity-50 select-none">
        {["عقد العمل", "إقرار السرية"].map((name) => (
          <div
            key={name}
            className="flex items-center gap-3 p-4 rounded-xl border"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--color-surface-alt)" }}
            >
              <FileText className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--color-dark)" }}>{name}</p>
            </div>
            <span
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}
            >
              مقفل
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Waiting state (docs approved, no contract yet) ────────────────────────────
export function ContractWaitingPanel() {
  return (
    <div
      className="rounded-2xl border p-8 text-center"
      style={{ borderColor: "var(--color-border)", background: "white" }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ background: "var(--color-primary-muted)" }}
      >
        <FileText className="w-7 h-7" style={{ color: "var(--color-primary)" }} />
      </div>
      <h3 className="font-bold mb-2" style={{ color: "var(--color-dark)" }}>
        جارٍ إعداد العقد
      </h3>
      <p className="text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
        تمت الموافقة على مستنداتك. يقوم فريق الموارد البشرية بإعداد العقد وسيتم إشعارك فور جاهزيته.
      </p>
    </div>
  );
}
