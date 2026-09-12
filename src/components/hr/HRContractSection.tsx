"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus, CheckCircle, Loader2, AlertCircle, FileSignature } from "lucide-react";

interface HRContractSectionProps {
  applicationId: string;
  existingContract: { id: string; nameAr: string; status: string; generatedAt: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  PENDING_SIGNATURE: "بانتظار التوقيع",
  FULLY_SIGNED: "موقَّع",
  EXPIRED: "منتهي الصلاحية",
  CANCELLED: "ملغى",
};

export function HRContractSection({ applicationId, existingContract }: HRContractSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generateContract() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, type: "EMPLOYMENT_CONTRACT" }),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 409) {
        setError(json.error ?? "حدث خطأ");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      className="mt-4 bg-white rounded-2xl border p-5 shadow-sm"
      style={{ borderColor: "var(--color-border)" }}
    >
      <h3 className="font-bold text-sm mb-3" style={{ color: "var(--color-dark)" }}>
        العقد الوظيفي
      </h3>

      {existingContract ? (
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{
            background:
              existingContract.status === "FULLY_SIGNED"
                ? "var(--color-success-bg)"
                : "var(--color-beige)",
            borderLeft: `4px solid ${existingContract.status === "FULLY_SIGNED" ? "#6EE7B7" : "var(--color-gold)"}`,
          }}
        >
          <FileSignature
            className="w-5 h-5 flex-shrink-0 mt-0.5"
            style={{
              color:
                existingContract.status === "FULLY_SIGNED"
                  ? "var(--color-success)"
                  : "var(--color-gold)",
            }}
          />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--color-dark)" }}>
              {existingContract.nameAr}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {STATUS_LABELS[existingContract.status] ?? existingContract.status} ·{" "}
              {new Date(existingContract.generatedAt).toLocaleDateString("ar-SA")}
            </p>
            <a
              href={`/hr/contracts/${existingContract.id}`}
              className="inline-block text-xs mt-2 hover:underline"
              style={{ color: "var(--color-primary)" }}
            >
              عرض نص العقد وبيانات التوقيع ←
            </a>
          </div>
          {existingContract.status === "FULLY_SIGNED" && (
            <CheckCircle className="w-4 h-4 mr-auto mt-0.5" style={{ color: "var(--color-success)" }} />
          )}
        </div>
      ) : (
        <>
          <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
            لم يُنشأ عقد بعد. أنشئ العقد ليتمكن المرشح من مراجعته والتوقيع عليه.
          </p>
          {error && (
            <div
              className="flex items-center gap-1.5 text-xs mb-2"
              style={{ color: "var(--color-error)" }}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}
          <button
            onClick={generateContract}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium border px-4 py-2.5 rounded-xl transition-colors"
            style={{
              color: "var(--color-primary)",
              borderColor: "var(--color-primary)",
              background: "var(--color-primary-muted)",
              opacity: isPending ? 0.6 : 1,
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FilePlus className="w-4 h-4" />
            )}
            {isPending ? "جارٍ الإنشاء..." : "إنشاء عقد العمل"}
          </button>
        </>
      )}
    </div>
  );
}
