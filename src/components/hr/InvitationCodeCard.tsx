"use client";

import { useRouter } from "next/navigation";
import { KeyRound, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { CopyButton } from "@/components/hr/CopyButton";
import { ResendInvitationButton } from "@/components/hr/ResendInvitationButton";

export interface InvitationView {
  code: string | null;
  status: "active" | "used" | "expired";
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

interface Props {
  candidateId: string;
  candidateEmail: string;
  invitation: InvitationView | null;
}

const STATUS = {
  active:  { label: "نشط",            cls: "badge-success", Icon: CheckCircle2 },
  used:    { label: "مُستخدم",         cls: "badge-muted",   Icon: CheckCircle2 },
  expired: { label: "منتهي الصلاحية",  cls: "badge-error",   Icon: AlertTriangle },
} as const;

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Always-visible invitation code for the HR candidate profile: the code, its state,
 * a one-click copy, and e-mail resend as a secondary action (which also rotates the code).
 */
export function InvitationCodeCard({ candidateId, candidateEmail, invitation }: Props) {
  const router = useRouter();
  const st = invitation ? STATUS[invitation.status] : null;
  const showCode = invitation?.code && invitation.status === "active";

  return (
    <section
      className="bg-white rounded-2xl border p-6 mb-6 shadow-sm"
      style={{ borderColor: "var(--color-border)" }}
      aria-labelledby="invitation-code-title"
    >
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--color-gold-muted)" }}>
            <KeyRound className="w-5 h-5" style={{ color: "var(--color-gold-dark)" }} />
          </div>
          <div>
            <h2 id="invitation-code-title" className="font-bold text-base" style={{ color: "var(--color-dark)" }}>
              رمز الدعوة
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              يدخل به المرشح إلى بوابته من صفحة «دخول المرشح». يبقى هنا دائماً ويمكن نسخه وإرساله بأي وسيلة.
            </p>
          </div>
        </div>
        {st && (
          <span className={`badge ${st.cls} inline-flex items-center gap-1`}>
            <st.Icon className="w-3.5 h-3.5" />
            {st.label}
          </span>
        )}
      </div>

      <div className="mt-5 flex items-stretch gap-3 flex-wrap">
        <div
          dir="ltr"
          className="flex-1 min-w-[240px] px-4 py-3 rounded-xl border font-mono text-sm tracking-wider break-all select-all"
          style={{
            background: showCode ? "var(--color-surface-alt)" : "var(--color-beige)",
            borderColor: showCode ? "var(--color-gold)" : "var(--color-border)",
            color: showCode ? "var(--color-primary-dark)" : "var(--color-text-muted)",
            borderStyle: showCode ? "solid" : "dashed",
          }}
        >
          {showCode
            ? invitation!.code
            : invitation?.status === "used"
              ? "استُخدم هذا الرمز لتسجيل الدخول. أعد الإرسال لتوليد رمز جديد."
              : invitation?.status === "expired"
                ? "انتهت صلاحية الرمز. أعد الإرسال لتوليد رمز جديد."
                : invitation
                  ? "أُنشئ هذا الرمز قبل تفعيل الحفظ المشفّر ولا يمكن عرضه. أعد الإرسال لتوليد رمز جديد."
                  : "لم يُنشأ رمز دعوة بعد."}
        </div>
        {showCode && <CopyButton value={invitation!.code!} label="نسخ الرمز" className="self-center" />}
      </div>

      <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
          {invitation && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {invitation.status === "used" && invitation.usedAt
                ? `استُخدم في ${fmt(invitation.usedAt)}`
                : `صالح حتى ${fmt(invitation.expiresAt)}`}
            </span>
          )}
        </div>
        <ResendInvitationButton
          candidateId={candidateId}
          candidateEmail={candidateEmail}
          onSent={() => router.refresh()}
        />
      </div>
    </section>
  );
}
