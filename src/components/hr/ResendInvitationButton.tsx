"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

interface Props {
  candidateId: string;
  candidateEmail: string;
  /** Called after a successful resend (the invitation code has been rotated). */
  onSent?: () => void;
}

/**
 * Secondary action: e-mails a fresh invitation. The code itself is always visible in
 * InvitationCodeCard, so this is a convenience channel, not the only way to deliver it.
 */
export function ResendInvitationButton({ candidateId, candidateEmail, onSent }: Props) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function handleResend() {
    if (!confirm(`سيُولَّد رمز تفعيل جديد ويُرسل إلى ${candidateEmail}، ويتوقف الرمز الحالي عن العمل. هل أنت متأكد؟`)) return;

    setStatus("idle");
    setMessage(null);

    start(async () => {
      const res = await fetch(`/api/candidates/${candidateId}/resend-invitation`, { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(json.error ?? "فشل الإرسال");
        return;
      }
      setStatus("success");
      setMessage(`أُرسل رمز جديد إلى ${json.email}`);
      onSent?.();
    });
  }

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <Button variant="secondary" icon="messages" onClick={handleResend} loading={isPending}>
        {isPending ? "جارٍ الإرسال..." : "إعادة الإرسال عبر البريد"}
      </Button>

      {status === "success" && (
        <span role="status" className="nz-dot nz-dot--done">
          {message}
        </span>
      )}
      {status === "error" && (
        <span role="alert" className="inline-flex items-center gap-2 ds-caption" style={{ color: "var(--danger-500)", fontWeight: 500 }}>
          <Icon name="close" size={16} label={false} />
          {message}
        </span>
      )}
    </div>
  );
}
