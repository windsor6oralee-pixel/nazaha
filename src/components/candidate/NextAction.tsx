import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { Candidate } from "@/types";

interface NextActionProps {
  candidate: Candidate;
  firstName: string;
}

export function NextAction({ candidate, firstName }: NextActionProps) {
  const rejectedDocs = candidate.documents.filter((d) => d.status === "rejected");
  const missingDocs = candidate.documents.filter(
    (d) => d.status === "not_uploaded" && d.required
  );
  const pendingReview = candidate.documents.filter((d) => d.status === "under_review");

  if (rejectedDocs.length > 0) {
    return (
      <div className="rounded-2xl border p-5" style={{ background: "var(--color-error-bg)", borderColor: "rgba(168,58,48,0.25)" }}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "var(--color-error)" }} />
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: "var(--color-error)" }}>{firstName}، يحتاج إلى إجراء</p>
            <p className="text-sm mt-1" style={{ color: "var(--color-error)" }}>
              {rejectedDocs.length === 1
                ? `مستند "${rejectedDocs[0].nameAr}" يحتاج إلى إعادة رفع.`
                : `${rejectedDocs.length} مستندات مرفوضة تحتاج إلى إعادة رفع.`}
            </p>
            <Link
              href="/candidate/documents"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium"
              style={{ color: "var(--color-error)" }}
            >
              إصلاح المستندات
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (missingDocs.length > 0) {
    return (
      <div className="rounded-2xl border p-5" style={{ background: "var(--color-warning-bg)", borderColor: "rgba(196,143,30,0.25)" }}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "var(--color-warning)" }} />
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: "var(--color-warning)" }}>{firstName}، الخطوة التالية</p>
            <p className="text-sm mt-1" style={{ color: "var(--color-warning)" }}>
              تبقى <strong>{missingDocs.length}</strong> {missingDocs.length === 1 ? "مستند" : "مستندات"} لرفعها لإكمال طلبك.
            </p>
            <Link
              href="/candidate/documents"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium"
              style={{ color: "var(--color-warning)" }}
            >
              رفع المستندات الآن
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (pendingReview.length > 0) {
    return (
      <div className="rounded-2xl border p-5" style={{ background: "#EBF2FB", borderColor: "rgba(29,95,168,0.25)" }}>
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 mt-0.5 flex-shrink-0 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#1D5FA8", borderTopColor: "transparent" }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: "#1D5FA8" }}>{firstName}، ملفك قيد المراجعة</p>
            <p className="text-sm mt-1" style={{ color: "#1D5FA8" }}>
              يراجع فريق الموارد البشرية مستنداتك حالياً. سنُشعرك فور اكتمال المراجعة.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5" style={{ background: "var(--color-success-bg)", borderColor: "rgba(34,122,78,0.25)" }}>
      <div className="flex items-start gap-3">
        <div className="w-5 h-5 mt-0.5 flex-shrink-0 font-bold" style={{ color: "var(--color-success)" }}>✓</div>
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--color-success)" }}>أحسنت يا {firstName}!</p>
          <p className="text-sm mt-1" style={{ color: "var(--color-success)" }}>
            جميع المستندات مكتملة. في انتظار الخطوة التالية من فريق الموارد البشرية.
          </p>
        </div>
      </div>
    </div>
  );
}
