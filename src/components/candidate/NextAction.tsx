import { ArrowLeft } from "lucide-react";
import type { Candidate } from "@/types";
import { Alert } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

interface NextActionProps {
  candidate: Candidate;
  firstName: string;
  /** حالة العقد الحالي إن وُجد. */
  contractStatus?: string | null;
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

export function NextAction({ candidate, firstName, contractStatus }: NextActionProps) {
  if (candidate.status === "pending") {
    return (
      <Alert tone="gold" title={`${firstName}، الخطوة الأولى`}>
        اقبل العرض الوظيفي لتبدأ رحلة انضمامك وتتمكن من رفع مستنداتك.
      </Alert>
    );
  }

  if (candidate.status === "rejected") {
    return (
      <Alert tone="error" title="طلبك مغلق">
        أُغلق هذا الطلب. للاستفسار تواصل مع الموارد البشرية في جهتك.
      </Alert>
    );
  }

  if (candidate.status === "approved") {
    if (contractStatus === "PENDING_SIGNATURE") {
      return (
        <Alert tone="gold" title={`${firstName}، عقدك جاهز`}>
          راجع عقد العمل ووقّعه إلكترونياً لإكمال رحلتك.
        </Alert>
      );
    }
    if (contractStatus === "FULLY_SIGNED") {
      return (
        <Alert tone="success" title={`أحسنت يا ${firstName}!`}>
          وقّعت العقد. استعد لموعد المباشرة، وستُكمل الموارد البشرية انضمامك عند حضورك.
        </Alert>
      );
    }
    return (
      <Alert tone="success" title={`${firstName}، اعتُمد ملفك`}>
        يُعدّ فريق الموارد البشرية عقد عملك الآن، وسيصلك إشعار حين يصبح جاهزاً للتوقيع.
      </Alert>
    );
  }

  if (candidate.status === "under_review") {
    return (
      <Alert tone="info" icon="pending" title={`${firstName}، ملفك بانتظار الاعتماد`}>
        اعتُمدت مستنداتك المطلوبة، وملفك الآن لدى مدير الموارد البشرية للاعتماد النهائي.
      </Alert>
    );
  }

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
