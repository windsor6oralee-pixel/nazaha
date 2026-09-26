"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Overlay";

interface Props {
  candidateId: string;
}

export function SendAlertButton({ candidateId }: Props) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH">("NORMAL");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setBody("");
    setPriority("NORMAL");
    setError(null);
    setSuccess(false);
  }

  function handleOpen() {
    reset();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const res = await fetch(`/api/hr/candidates/${candidateId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleAr: title.trim(), bodyAr: body.trim(), priority }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "حدث خطأ");
        return;
      }
      setSuccess(true);
      setTimeout(() => setOpen(false), 1500);
    });
  }

  return (
    <>
      <Button variant="secondary" icon="notifications" onClick={handleOpen}>
        إرسال تنبيه
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        title="إرسال رسالة / تنبيه"
        actions={success ? undefined : (
          <>
            <Button
              type="submit"
              form={formId}
              variant={priority === "HIGH" ? "danger" : "primary"}
              icon="messages"
              loading={isPending}
            >
              {isPending ? "جارٍ الإرسال..." : "إرسال التنبيه"}
            </Button>
            <Button variant="secondary" onClick={handleClose}>
              إلغاء
            </Button>
          </>
        )}
      >
        {success ? (
          <Alert tone="success" title="تم الإرسال بنجاح" />
        ) : (
          <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4" style={{ color: "var(--ink)" }}>
            {/* Priority toggle */}
            <div className="nz-field">
              <span className="nz-field__label" id={`${formId}-priority`}>نوع الرسالة</span>
              <div role="group" aria-labelledby={`${formId}-priority`} className="flex gap-2">
                {(["NORMAL", "HIGH"] as const).map((p) => {
                  const active = priority === p;
                  const high = p === "HIGH";
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPriority(p)}
                      className="flex-1 inline-flex items-center justify-center gap-2"
                      style={{
                        minHeight: "var(--tap-target-min)",
                        borderRadius: "var(--radius-12)",
                        border: "1.5px solid",
                        borderColor: active ? (high ? "var(--danger-500)" : "var(--green-700)") : "var(--border-100)",
                        background: active ? (high ? "var(--color-error-bg)" : "var(--surface-100)") : "var(--surface-000)",
                        color: active ? (high ? "var(--danger-500)" : "var(--green-700)") : "var(--ink-muted)",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard)",
                      }}
                    >
                      {high && <Icon name="flag" size={16} label={false} />}
                      {high ? "عاجل" : "عادي"}
                    </button>
                  );
                })}
              </div>
              {priority === "HIGH" && (
                <p className="nz-field__hint" style={{ color: "var(--danger-500)", margin: 0 }}>
                  الرسالة العاجلة ستظهر كنافذة إلزامية ولا يمكن للمرشح تجاهلها
                </p>
              )}
            </div>

            <Input
              label="العنوان"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder="مثال: طلب وثيقة ناقصة"
            />

            <Textarea
              label="نص الرسالة"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              maxLength={800}
              rows={4}
              placeholder="اكتب تفاصيل الرسالة هنا..."
            />

            {error && <Alert tone="error">{error}</Alert>}
          </form>
        )}
      </Modal>
    </>
  );
}
