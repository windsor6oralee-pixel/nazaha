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

/** حالة حساب دخول المرشح —exists بمجرد تفعيله برمز الدعوة. */
export interface CandidateAccountView {
  loginEmail: string | null;
  activatedAt: string | null;
  lastLoginAt: string | null;
}

interface Props {
  candidateId: string;
  candidateEmail: string;
  account: CandidateAccountView | null;
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
 *
 * The code is no longer a login credential — it is a one-time activation code the
 * candidate exchanges for a permanent account (e-mail + password). Once the account
 * exists, this card reports that instead of the code's state.
 */
export function InvitationCodeCard({ candidateId, candidateEmail, account, invitation }: Props) {
  const router = useRouter();
  const st = invitation ? STATUS[invitation.status] : null;
  const activated = !!account?.activatedAt;
  const showCode = invitation?.code && invitation.status === "active" && !activated;

  return (
    <Card
      aria-labelledby="invitation-code-title"
      title={
        <span id="invitation-code-title" className="inline-flex items-center gap-2">
          <Icon name="privacy" size={24} label={false} style={{ color: "var(--green-700)" }} />
          حساب دخول المرشح
        </span>
      }
      description={
        activated
          ? "الحساب مفعّل — يدخل المرشح إلى بوابته ببريده الإلكتروني وكلمة المرور. الرمز أدناه انتهى دوره."
          : "رمز التفعيل يُستعمل مرة واحدة: ينشئ به المرشح حسابه (بريد + كلمة مرور) ثم يدخل بحسابه دائماً."
      }
      action={
        activated
          ? <Badge tone="done" icon="approved">مفعّل</Badge>
          : st && <Badge tone={st.tone} icon={st.icon}>{st.label}</Badge>
      }
    >
      {activated ? (
        <div
          className="rounded-xl p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
          style={{ background: "var(--surface-000)", border: "1px solid var(--border-100)" }}
        >
          <div>
            <p className="text-[11px]" style={{ color: "var(--ink-muted)" }}>بريد الدخول</p>
            <p className="font-medium" dir="ltr" style={{ color: "var(--ink)" }}>
              {account?.loginEmail ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: "var(--ink-muted)" }}>تاريخ التفعيل</p>
            <p className="font-medium" style={{ color: "var(--ink)" }}>
              {account?.activatedAt ? fmt(account.activatedAt) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: "var(--ink-muted)" }}>آخر دخول</p>
            <p className="font-medium" style={{ color: "var(--ink)" }}>
              {account?.lastLoginAt ? fmt(account.lastLoginAt) : "لم يدخل بعد"}
            </p>
          </div>
        </div>
      ) : (
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
                ? "استُخدم هذا الرمز لتفعيل الحساب. أعد الإرسال لتوليد رمز جديد."
                : invitation?.status === "expired"
                  ? "انتهت صلاحية الرمز. أعد الإرسال لتوليد رمز جديد."
                  : invitation
                    ? "أُنشئ هذا الرمز قبل تفعيل الحفظ المشفّر ولا يمكن عرضه. أعد الإرسال لتوليد رمز جديد."
                    : "لم يُنشأ رمز دعوة بعد."}
          </div>
          {showCode && <CopyButton value={invitation!.code!} label="نسخ الرمز" className="self-center" />}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between flex-wrap gap-4">
        <div className="ds-caption flex items-center gap-4" style={{ color: "var(--ink-muted)" }}>
          {invitation && !activated && (
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
