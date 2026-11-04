"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert, Card } from "@/components/ui/Card";

/* الخطوة الأولى في الرحلة: قبول العرض يفتح رفع المستندات. */
export function AcceptOfferCard({
  firstName,
  jobTitle,
  department,
  organization,
}: {
  firstName: string;
  jobTitle: string;
  department: string;
  organization: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/candidate/offer/accept", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "تعذّر قبول العرض");
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card title={`${firstName}، عرضك الوظيفي بانتظار قبولك`}>
      <div className="flex flex-col gap-4">
        <p style={{ margin: 0 }}>
          يسرّ <strong>{organization}</strong> أن تعرض عليك وظيفة <strong>{jobTitle}</strong> في {department}.
          بقبولك العرض تبدأ رحلة انضمامك وتستطيع رفع مستنداتك.
        </p>
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Button icon="approved" onClick={accept} loading={isPending}>
            {isPending ? "جارٍ التأكيد..." : "قبول العرض والبدء"}
          </Button>
        </div>
        <p className="ds-caption" style={{ margin: 0, color: "var(--ink-muted)" }}>
          لديك استفسار قبل القبول؟ تواصل مع الموارد البشرية في جهتك.
        </p>
      </div>
    </Card>
  );
}
