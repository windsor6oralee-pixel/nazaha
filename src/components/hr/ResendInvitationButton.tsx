"use client";

import { useState, useTransition } from "react";
import { Send, CheckCircle, XCircle, Loader2 } from "lucide-react";

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
    if (!confirm(`سيُولَّد رمز دعوة جديد ويُرسل إلى ${candidateEmail}، ويتوقف الرمز الحالي عن العمل. هل أنت متأكد؟`)) return;

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
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleResend}
        disabled={isPending}
        className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border transition-all"
        style={{
          color: "var(--color-primary)",
          borderColor: "var(--color-primary)",
          background: "var(--color-primary-muted)",
          cursor: isPending ? "not-allowed" : "pointer",
          opacity: isPending ? 0.7 : 1,
          fontFamily: "'IBM Plex Sans Arabic', sans-serif",
          minHeight: 44,
        }}
      >
        {isPending
          ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الإرسال...</>
          : <><Send className="w-4 h-4" /> إعادة الإرسال عبر البريد</>}
      </button>

      {status === "success" && (
        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {message}
        </span>
      )}
      {status === "error" && (
        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
          style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>
          <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {message}
        </span>
      )}
    </div>
  );
}
