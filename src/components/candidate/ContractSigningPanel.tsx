"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Progress } from "@/components/ui/Progress";

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
    ? new Date(contract.generatedAt).toLocaleDateString("ar-SA-u-nu-latn", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // ── Signed state ──────────────────────────────────────────────────────────
  if (signed) {
    return (
      <Card>
        <div className="flex flex-col items-center text-center" style={{ gap: "var(--space-8)" }}>
          <span className="text-success-500">
            <Icon name="approved" size={48} label={false} />
          </span>
          <h3 className="ds-subheading text-ink" style={{ margin: "var(--space-8) 0 0" }}>
            تم توقيع العقد بنجاح
          </h3>
          <p className="text-ink-muted" style={{ margin: 0 }}>{contract.nameAr}</p>
          {signedAt && (
            <p className="text-ink-muted" style={{ margin: 0, fontSize: 13 }}>
              وُقِّع بتاريخ{" "}
              <span className="font-numeric">
                {new Date(signedAt).toLocaleDateString("ar-SA-u-nu-latn", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </p>
          )}
        </div>
      </Card>
    );
  }

  // ── Signing UI ────────────────────────────────────────────────────────────
  // Legal text and the signing form never animate (animate={false}).
  return (
    <div className="flex flex-col gap-6">
      {/* Contract details card */}
      <Card
        animate={false}
        title={contract.nameAr}
        description={genDate ? <>صدر بتاريخ <span className="font-numeric">{genDate}</span></> : undefined}
        action={<Badge tone="review">بانتظار توقيعك</Badge>}
      />

      {/* Full contract text (frozen at generation) */}
      <Card animate={false} plain className="overflow-y-auto" style={{ maxHeight: "32rem" }}>
        {contract.renderedHtml ? (
          <div className="contract-body" dangerouslySetInnerHTML={{ __html: contract.renderedHtml }} />
        ) : (
          <p className="text-ink-muted" style={{ margin: 0 }}>
            نص العقد غير متوفر — يرجى التواصل مع الموارد البشرية.
          </p>
        )}
      </Card>

      {/* Signing form */}
      <Card animate={false} title="التوقيع الإلكتروني">
        <form onSubmit={handleSign} className="flex flex-col gap-6">
          {/* Name field */}
          <Input
            label="الاسم الكامل للتوقيع"
            required
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="أدخل اسمك الكامل كما في الهوية"
            hint="سيُسجَّل هذا الاسم كتوقيعك الرسمي على العقد"
          />

          {/* Signature preview */}
          {fullName.trim() && (
            <div
              className="rounded-12 border bg-surface-000 text-center"
              style={{ borderColor: "var(--gold-500)", padding: "var(--space-16)" }}
            >
              <p
                className="text-ink"
                style={{ margin: 0, fontFamily: "var(--font-kufi)", fontSize: 20, fontWeight: 700, letterSpacing: "0.06em" }}
              >
                {fullName}
              </p>
              <p className="text-ink-muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
                معاينة التوقيع
              </p>
            </div>
          )}

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-4 cursor-pointer" style={{ minHeight: 44 }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{ width: 20, height: 20, marginTop: 4, flex: "none", accentColor: "var(--green-700)" }}
            />
            <span className="text-ink-muted" style={{ fontSize: 15, lineHeight: 1.7 }}>
              أقر بأنني قرأت جميع بنود العقد وأفهمها وأوافق عليها، وأن توقيعي الإلكتروني يُعدّ ملزماً
              قانونياً ويعادل التوقيع الخطي وفق نظام التعاملات الإلكترونية في المملكة العربية السعودية.
            </span>
          </label>

          {/* Error */}
          {error && (
            <Alert tone="error" icon="close">
              {error}
            </Alert>
          )}

          {/* Submit */}
          <Button
            type="submit"
            block
            icon="justice"
            loading={isPending}
            disabled={!confirmed || !fullName.trim()}
          >
            {isPending ? "جارٍ تسجيل التوقيع..." : "توقيع العقد إلكترونياً"}
          </Button>
        </form>
      </Card>

      {/* Legal note */}
      <Alert tone="info" icon="integrity">
        التوقيع الإلكتروني معتمد وفق نظام التعاملات الإلكترونية في المملكة العربية السعودية
        ويُعادل التوقيع الورقي من الناحية القانونية. يُحفظ سجل التوقيع مع بيانات الجهاز والتوقيت.
      </Alert>
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
    <Card>
      <Alert tone="gold" icon="pending" title="في انتظار اكتمال المستندات">
        ستُفتح هذه المرحلة بعد اعتماد جميع مستنداتك المطلوبة
      </Alert>

      {/* Progress */}
      <div style={{ margin: "var(--space-24) 0" }}>
        <div className="nz-progress__row">
          <span>المستندات المعتمدة</span>
          <span className="nz-progress__val">
            {approvedCount} / {totalRequired}
          </span>
        </div>
        <Progress
          value={totalRequired > 0 ? (approvedCount / totalRequired) * 100 : 0}
          showValue={false}
        />
      </div>

      {/* Placeholder contracts */}
      <div className="flex flex-col gap-2 select-none" style={{ opacity: 0.5 }}>
        {["عقد العمل", "إقرار السرية"].map((name) => (
          <div
            key={name}
            className="flex items-center gap-4 rounded-12 border border-border-100 bg-surface-000"
            style={{ padding: "var(--space-16)" }}
          >
            <div
              className="flex items-center justify-center rounded-8 bg-surface-100 text-ink-muted"
              style={{ width: 40, height: 40, flex: "none" }}
            >
              <Icon name="documents" size={24} label={false} />
            </div>
            <p className="flex-1 text-ink" style={{ margin: 0, fontWeight: 500 }}>{name}</p>
            <Badge tone="neutral" icon="privacy">مقفل</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Waiting state (docs approved, no contract yet) ────────────────────────────
export function ContractWaitingPanel() {
  return (
    <Card>
      <EmptyState icon="documents" title="جارٍ إعداد العقد">
        تمت الموافقة على مستنداتك. يقوم فريق الموارد البشرية بإعداد العقد وسيتم إشعارك فور جاهزيته.
      </EmptyState>
    </Card>
  );
}
