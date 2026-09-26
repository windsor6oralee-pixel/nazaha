"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";

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
      <Alert tone="success" title={`تم توقيع ${contractName} بنجاح`}>
        تهانينا! اكتملت خطوة التوقيع الإلكتروني.
      </Alert>
    );
  }

  return (
    <Card
      animate={false}
      title={contractName}
      description={
        <>
          {candidateName.split(" ")[0]}، صدر بتاريخ{" "}
          <span className="font-numeric">{new Date(generatedAt).toLocaleDateString("ar-SA-u-nu-latn")}</span> · بانتظار توقيعك
        </>
      }
      action={
        <span className="text-green-700" style={{ flex: "none" }}>
          <Icon name="justice" size={24} label={false} />
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Contract preview — static legal text, never animated */}
        <div
          className="rounded-12 border border-border-100 bg-surface-000 overflow-y-auto"
          style={{ padding: "var(--space-16)", maxHeight: 320 }}
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
        <label className="flex items-start gap-2 cursor-pointer text-ink" style={{ minHeight: 44, fontSize: 15 }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 3, flex: "none", accentColor: "var(--green-700)" }}
          />
          <span>قرأت العقد وأفهم محتواه وأوافق على جميع شروطه وأحكامه.</span>
        </label>

        {/* Typed name */}
        {agreed && (
          <Input
            label="اكتب اسمك الكامل للتوقيع"
            required
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={candidateName}
            hint="يُعدّ كتابة اسمك توقيعاً إلكترونياً ملزماً قانونياً."
          />
        )}

        {error && (
          <div className="flex items-center gap-2 text-danger-500" role="alert" style={{ fontSize: 14 }}>
            <Icon name="flag" size={16} label={false} />
            {error}
          </div>
        )}

        <Button
          block
          icon="justice"
          loading={isPending}
          disabled={!agreed || !fullName.trim()}
          onClick={handleSign}
        >
          {isPending ? "جارٍ التوقيع..." : "أوافق وأوقّع"}
        </Button>
      </div>
    </Card>
  );
}
