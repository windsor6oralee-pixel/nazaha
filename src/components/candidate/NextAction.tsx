import { ArrowLeft } from "lucide-react";
import type { Candidate } from "@/types";
import { Alert } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

interface NextActionProps {
  candidate: Candidate;
  firstName: string;
}

function DocumentsLink({ children }: { children: string }) {
  return (
    <div style={{ marginTop: "var(--space-16)" }}>
      <ButtonLink href="/candidate/documents" variant="secondary">
        {children}
        <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
      </ButtonLink>
    </div>
  );
}

export function NextAction({ candidate, firstName }: NextActionProps) {
  const rejectedDocs = candidate.documents.filter((d) => d.status === "rejected");
  const missingDocs = candidate.documents.filter(
    (d) => d.status === "not_uploaded" && d.required
  );
  const pendingReview = candidate.documents.filter((d) => d.status === "under_review");

  if (rejectedDocs.length > 0) {
    return (
      <Alert tone="error" title={`${firstName}، يحتاج إلى إجراء`}>
        <p style={{ margin: 0 }}>
          {rejectedDocs.length === 1
            ? `مستند "${rejectedDocs[0].nameAr}" يحتاج إلى إعادة رفع.`
            : `${rejectedDocs.length} مستندات مرفوضة تحتاج إلى إعادة رفع.`}
        </p>
        <DocumentsLink>إصلاح المستندات</DocumentsLink>
      </Alert>
    );
  }

  if (missingDocs.length > 0) {
    return (
      <Alert tone="gold" title={`${firstName}، الخطوة التالية`}>
        <p style={{ margin: 0 }}>
          تبقى <strong className="text-ink font-numeric">{missingDocs.length}</strong>{" "}
          {missingDocs.length === 1 ? "مستند" : "مستندات"} لرفعها لإكمال طلبك.
        </p>
        <DocumentsLink>رفع المستندات الآن</DocumentsLink>
      </Alert>
    );
  }

  if (pendingReview.length > 0) {
    return (
      <Alert tone="info" icon="pending" title={`${firstName}، ملفك قيد المراجعة`}>
        يراجع فريق الموارد البشرية مستنداتك حالياً. سنُشعرك فور اكتمال المراجعة.
      </Alert>
    );
  }

  return (
    <Alert tone="success" title={`أحسنت يا ${firstName}!`}>
      جميع المستندات مكتملة. في انتظار الخطوة التالية من فريق الموارد البشرية.
    </Alert>
  );
}
