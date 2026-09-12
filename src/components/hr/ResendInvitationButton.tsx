"use client";

import { useState, useTransition } from "react";
import { Send, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Props {
  candidateId: string;
  candidateEmail: string;
}

export function ResendInvitationButton({ candidateId, candidateEmail }: Props) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function handleResend() {
    if (!confirm(`سيتم إرسال رمز دعوة جديد إلى ${candidateEmail}. هل أنت متأكد؟`)) return;

    setStatus("idle");
    setMessage(null);
    setDevToken(null);

    start(async () => {
      const res = await fetch(`/api/candidates/${candidateId}/resend-invitation`, {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(json.error ?? "فشل الإرسال");
      } else {
        setStatus("success");
        setMessage(`تم إرسال رمز الدعوة إلى ${json.email}`);
        if (json.devToken) setDevToken(json.devToken);
      }
    });
  }

  return (
    <div className="space-y-2">
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
          : <><Send className="w-4 h-4" /> إعادة إرسال الدعوة</>}
      </button>

      {status === "success" && (
        <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
          <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <div>
            <p>{message}</p>
            {devToken && (
              <p className="mt-1 font-mono tracking-wider" style={{ color: "var(--color-primary-dark)" }}>
                [dev] {devToken}
              </p>
            )}
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
          style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>
          <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {message}
        </div>
      )}
    </div>
  );
}
