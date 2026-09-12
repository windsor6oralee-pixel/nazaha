"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, CheckCircle, Loader2, AlertCircle } from "lucide-react";

interface ContractCardProps {
  contractId: string;
  contractName: string;
  candidateName: string;
  jobTitle: string;
  organization: string;
  generatedAt: string;
  renderedHtml: string | null;
}

export function ContractCard({
  contractId,
  contractName,
  candidateName,
  jobTitle,
  organization,
  generatedAt,
  renderedHtml,
}: ContractCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  function handleSign() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/contracts/${contractId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "حدث خطأ");
        return;
      }
      setSigned(true);
      router.refresh();
    });
  }

  if (signed) {
    return (
      <div
        className="rounded-2xl border p-6"
        style={{ borderColor: "#6EE7B7", background: "#ECFDF5" }}
      >
        <div className="flex items-center gap-3">
          <CheckCircle className="w-8 h-8 flex-shrink-0" style={{ color: "#065F46" }} />
          <div>
            <p className="font-bold text-base" style={{ color: "#065F46" }}>
              تم توقيع {contractName} بنجاح
            </p>
            <p className="text-sm mt-0.5" style={{ color: "#047857" }}>
              تهانينا! اكتملت خطوة التوقيع الإلكتروني.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-6 space-y-4"
      style={{ borderColor: "var(--color-border)", background: "white" }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--color-primary-muted)" }}
        >
          <FileSignature className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
        </div>
        <div>
          <h3 className="font-bold text-base" style={{ color: "var(--color-dark)" }}>
            {contractName}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {candidateName.split(" ")[0]}، صدر بتاريخ {new Date(generatedAt).toLocaleDateString("ar-SA")} · بانتظار توقيعك
          </p>
        </div>
      </div>

      {/* Contract preview */}
      <div
        className="rounded-xl p-4 max-h-80 overflow-y-auto"
        style={{
          background: "var(--color-beige)",
          border: "1px solid var(--color-border)",
        }}
      >
        {renderedHtml ? (
          <div className="contract-body" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        ) : (
          <div className="contract-body">
            <h1>{contractName}</h1>
            <p>
              يُبرم هذا العقد بين <strong>{organization}</strong> (جهة العمل) و<strong>{candidateName}</strong> (الموظف)
              لوظيفة <strong>{jobTitle}</strong> وفق الأنظمة واللوائح المعمول بها في المملكة العربية السعودية.
            </p>
          </div>
        )}
      </div>

      {/* Consent checkbox */}
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-emerald-700 flex-shrink-0"
        />
        <span className="text-sm" style={{ color: "var(--color-dark)" }}>
          قرأت العقد وأفهم محتواه وأوافق على جميع شروطه وأحكامه.
        </span>
      </label>

      {/* Typed name */}
      {agreed && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: "var(--color-dark)" }}>
            اكتب اسمك الكامل للتوقيع{" "}
            <span style={{ color: "var(--color-error)" }}>*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={candidateName}
            className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-dark)",
              fontFamily: "cursive",
              fontSize: "16px",
            }}
          />
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            يُعدّ كتابة اسمك توقيعاً إلكترونياً ملزماً قانونياً.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--color-error)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleSign}
        disabled={!agreed || !fullName.trim() || isPending}
        className="w-full py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
        style={{
          background:
            agreed && fullName.trim() && !isPending
              ? "var(--color-primary)"
              : "var(--color-border)",
          color: agreed && fullName.trim() && !isPending ? "white" : "var(--color-text-muted)",
          cursor: agreed && fullName.trim() && !isPending ? "pointer" : "not-allowed",
        }}
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileSignature className="w-4 h-4" />
        )}
        {isPending ? "جارٍ التوقيع..." : "أوافق وأوقّع"}
      </button>
    </div>
  );
}
