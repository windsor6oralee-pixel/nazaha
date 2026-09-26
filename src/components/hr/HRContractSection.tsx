"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert, Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

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

const CONTRACT_TONE: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  PENDING_SIGNATURE: "review",
  FULLY_SIGNED: "done",
  EXPIRED: "rejected",
  CANCELLED: "rejected",
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

  const signed = existingContract?.status === "FULLY_SIGNED";

  return (
    <Card title="العقد الوظيفي" className="mt-6">
      {existingContract ? (
        <div
          className="flex items-start gap-4"
          style={{
            padding: "var(--space-16)",
            borderRadius: "var(--radius-12)",
            border: "1px solid var(--border-100)",
            background: "var(--surface-000)",
          }}
        >
          <Icon name="justice" size={24} label={false} style={{ color: "var(--green-700)" }} />
          <div className="min-w-0 flex-1">
            <p style={{ margin: 0, fontWeight: 600, color: "var(--ink)" }}>
              {existingContract.nameAr}
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <Badge tone={CONTRACT_TONE[existingContract.status] ?? "neutral"} icon={signed ? "approved" : undefined}>
                {STATUS_LABELS[existingContract.status] ?? existingContract.status}
              </Badge>
              <span className="ds-caption font-numeric" style={{ color: "var(--ink-muted)" }}>
                {new Date(existingContract.generatedAt).toLocaleDateString("ar-SA-u-nu-latn")}
              </span>
            </div>
            <a
              href={`/hr/contracts/${existingContract.id}`}
              className="nz-btn nz-btn--ghost nz-btn--sm mt-2"
              style={{ minHeight: "var(--tap-target-min)", paddingInline: "var(--space-8)", marginInlineStart: "calc(var(--space-8) * -1)" }}
            >
              <Icon name="review" size={20} label={false} />
              عرض نص العقد وبيانات التوقيع
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="ds-caption" style={{ margin: 0, color: "var(--ink-muted)" }}>
            لم يُنشأ عقد بعد. أنشئ العقد ليتمكن المرشح من مراجعته والتوقيع عليه.
          </p>
          {error && <Alert tone="error">{error}</Alert>}
          <Button
            variant="secondary"
            block
            icon="documents"
            onClick={generateContract}
            loading={isPending}
          >
            {isPending ? "جارٍ الإنشاء..." : "إنشاء عقد العمل"}
          </Button>
        </div>
      )}
    </Card>
  );
}
