"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert, Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Overlay";

export interface LifecycleActionView {
  action: string;
  labelAr: string;
  descriptionAr: string;
  tone: "primary" | "danger" | "secondary";
  requiresReason: boolean;
  blockedReason: string | null;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "neutral",
  IN_PROGRESS: "brand",
  UNDER_REVIEW: "review",
  APPROVED: "done",
  COMPLETED: "done",
  REJECTED: "rejected",
  WITHDRAWN: "rejected",
};

/* الخطوة التالية كما يراها مسؤول الموارد البشرية لكل حالة. */
const NEXT_HINT: Record<string, string> = {
  PENDING: "بانتظار أن يفعّل المرشح حسابه ويقبل العرض.",
  IN_PROGRESS: "المرشح يستكمل مستنداته — راجع ما يُرفع منها.",
  UNDER_REVIEW: "اكتملت المستندات المطلوبة واعتُمدت — القرار الآن لمدير الموارد البشرية.",
  APPROVED: "الملف معتمد — أصدر العقد، ثم أكمل الانضمام بعد التوقيع والمباشرة.",
  COMPLETED: "اكتملت رحلة الانضمام.",
  REJECTED: "الطلب مغلق بالرفض.",
  WITHDRAWN: "الطلب مغلق بانسحاب المرشح.",
};

export function ApplicationLifecyclePanel({
  applicationId,
  status,
  statusLabel,
  statusReason,
  statusChangedAt,
  actions,
}: {
  applicationId: string;
  status: string;
  statusLabel: string;
  statusReason: string | null;
  statusChangedAt: string | null;
  actions: LifecycleActionView[];
}) {
  const router = useRouter();
  const formId = useId();
  const [selected, setSelected] = useState<LifecycleActionView | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function choose(a: LifecycleActionView) {
    setSelected(a);
    setReason("");
    setError(null);
  }

  function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (selected.requiresReason && !reason.trim()) {
      setError("اكتب السبب — سيظهر للمرشح وفي سجل التدقيق");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/hr/applications/${applicationId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: selected.action, reason: reason.trim() || null }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "تعذّر تنفيذ الإجراء");
        return;
      }
      setSelected(null);
      router.refresh();
    });
  }

  return (
    <Card title="حالة الطلب" className="mb-6" action={<Badge tone={STATUS_TONE[status] ?? "neutral"}>{statusLabel}</Badge>}>
      <div className="flex flex-col gap-4">
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>{NEXT_HINT[status]}</p>

        {statusReason && (
          <Alert tone={status === "REJECTED" || status === "WITHDRAWN" ? "error" : "info"} title="آخر ملاحظة على القرار">
            {statusReason}
          </Alert>
        )}
        {statusChangedAt && (
          <p className="ds-caption font-numeric" style={{ margin: 0, color: "var(--ink-muted)" }}>
            آخر تغيير للحالة: {new Date(statusChangedAt).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}

        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <div key={a.action} className="flex flex-col gap-1">
                <Button
                  variant={a.tone === "danger" ? "danger" : a.tone === "primary" ? "primary" : "secondary"}
                  size="sm"
                  disabled={!!a.blockedReason}
                  title={a.blockedReason ?? undefined}
                  onClick={() => choose(a)}
                >
                  {a.labelAr}
                </Button>
                {a.blockedReason && (
                  <span className="ds-caption" style={{ color: "var(--ink-muted)" }}>{a.blockedReason}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="ds-caption" style={{ margin: 0, color: "var(--ink-muted)" }}>
            لا توجد قرارات متاحة لدورك في هذه المرحلة.
          </p>
        )}
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.labelAr ?? ""}
        actions={
          <>
            <Button type="submit" form={formId} variant={selected?.tone === "danger" ? "danger" : "primary"} loading={isPending}>
              تأكيد
            </Button>
            <Button variant="secondary" onClick={() => setSelected(null)}>إلغاء</Button>
          </>
        }
      >
        <form id={formId} onSubmit={confirm} className="flex flex-col gap-4">
          <p style={{ margin: 0 }}>{selected?.descriptionAr}</p>
          <Textarea
            label={selected?.requiresReason ? "السبب (إلزامي)" : "ملاحظة (اختيارية)"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required={selected?.requiresReason}
            maxLength={1000}
            rows={3}
            hint="تصل الملاحظة إلى المرشح في البريد وتُحفظ في سجل التدقيق"
          />
          {error && <Alert tone="error">{error}</Alert>}
        </form>
      </Modal>
    </Card>
  );
}
