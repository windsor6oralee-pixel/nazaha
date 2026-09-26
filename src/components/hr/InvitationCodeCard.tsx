"use client";

import { useRouter } from "next/navigation";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
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

const STATUS: Record<InvitationView["status"], { label: string; tone: BadgeTone; icon: IconName }> = {
  active:  { label: "نشط",            tone: "done",     icon: "approved" },
  used:    { label: "مُستخدم",         tone: "neutral",  icon: "approved" },
  expired: { label: "منتهي الصلاحية",  tone: "rejected", icon: "flag" },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
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
    <Card
      aria-labelledby="invitation-code-title"
      title={
        <span id="invitation-code-title" className="inline-flex items-center gap-2">
          <Icon name="privacy" size={24} label={false} style={{ color: "var(--green-700)" }} />
          رمز الدعوة
        </span>
      }
      description="يدخل به المرشح إلى بوابته من صفحة «دخول المرشح». يبقى هنا دائماً ويمكن نسخه وإرساله بأي وسيلة."
      action={st && <Badge tone={st.tone} icon={st.icon}>{st.label}</Badge>}
    >
      <div className="flex items-stretch gap-4 flex-wrap">
        <div
          dir={showCode ? "ltr" : "rtl"}
          className={`flex-1 min-w-[240px] break-all ${showCode ? "select-all" : ""}`}
          style={{
            padding: "var(--space-16)",
            borderRadius: "var(--radius-12)",
            border: `1.5px ${showCode ? "solid" : "dashed"} ${showCode ? "var(--gold-500)" : "var(--border-100)"}`,
            background: "var(--surface-000)",
            color: showCode ? "var(--ink)" : "var(--ink-muted)",
            fontFamily: showCode ? "var(--font-latin)" : undefined,
            fontSize: showCode ? 18 : 14,
            fontWeight: showCode ? 600 : 400,
            letterSpacing: showCode ? "0.08em" : undefined,
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

      <div className="mt-4 flex items-center justify-between flex-wrap gap-4">
        <div className="ds-caption flex items-center gap-4" style={{ color: "var(--ink-muted)" }}>
          {invitation && (
            <span className="inline-flex items-center gap-2">
              <Icon name="calendar" size={16} label={false} />
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
    </Card>
  );
}
