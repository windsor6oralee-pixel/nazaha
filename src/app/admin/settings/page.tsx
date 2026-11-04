import Link from "next/link";
import { getTenantContext } from "@/infrastructure/tenant";
import { getSmtpConfig } from "@/infrastructure/notifications/smtp-config.service";
import { getInboxKitConfig } from "@/infrastructure/notifications/inboxkit-config.service";
import { getMailboxPool } from "@/infrastructure/notifications/mailbox-pool-config.service";
import {
  getSendingPolicy,
  filterPoolByPolicy,
  domainsIn,
} from "@/infrastructure/notifications/sending-policy.service";
import { SmtpSettingsForm } from "@/components/admin/SmtpSettingsForm";
import { InboxKitSettingsForm } from "@/components/admin/InboxKitSettingsForm";
import { EmailProviderTabs } from "@/components/admin/EmailProviderTabs";

export default async function AdminSettingsPage() {
  const ctx = await getTenantContext();
  const orgId = ctx!.organizationId;

  const [existingSmtp, existingInboxKit, pool, policy] = await Promise.all([
    getSmtpConfig(orgId),
    getInboxKitConfig(orgId),
    getMailboxPool(orgId),
    getSendingPolicy(orgId),
  ]);
  const poolDomains = pool ? domainsIn(pool) : [];
  const activeMailboxes = pool ? filterPoolByPolicy(pool, policy) : [];
  const modeLabel = policy.mode === "exclusive" ? "حصري" : policy.mode === "overflow" ? "فيض" : "مشترك";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/admin" className="hover:underline" style={{ color: "var(--color-primary)" }}>الإعدادات</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>خادم البريد</span>
      </div>

      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>
          إعدادات النظام
        </p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>
          إعداد البريد الإلكتروني
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          اختر طريقة إرسال رموز الدعوة والإشعارات للمرشحين
        </p>
      </div>

      <EmailProviderTabs
        defaultTab={existingInboxKit ? "inboxkit" : "smtp"}
        smtpForm={<SmtpSettingsForm existing={existingSmtp} />}
        inboxKitForm={
          <InboxKitSettingsForm
            existing={existingInboxKit ? {
              workspaceId:  existingInboxKit.workspaceId,
              mailboxEmail: existingInboxKit.mailboxEmail,
              mailboxUid:   existingInboxKit.mailboxUid,
            } : null}
          />
        }
      />

      {pool && pool.length > 0 && (
        <div className="mt-8 rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>خطة إرسال البريد لجهتك</p>
            <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: "var(--color-primary-muted)", color: "var(--color-primary-dark)" }}>{modeLabel}</span>
          </div>
          <div className="grid gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <div><b>الدومينات الأساسية:</b> <span dir="ltr">{policy.primary.join(", ") || "—"}</span></div>
            {policy.overflow.length > 0 && (
              <div><b>الدومينات الاحتياطية:</b> <span dir="ltr">{policy.overflow.join(", ")}</span></div>
            )}
            {policy.excluded.length > 0 && (
              <div><b>مستبعدة:</b> <span dir="ltr">{policy.excluded.join(", ")}</span></div>
            )}
            <div><b>الدومينات المتاحة في حسابك:</b> {poolDomains.length} · <b>الصناديق النشطة:</b> {activeMailboxes.length} من {pool.length}</div>
          </div>
          <p className="text-[11px] mt-3" style={{ color: "var(--color-text-muted)" }}>
            لتعديل هذه الخطة تواصل مع مشغّل المنصة — هذه السياسة تُضبط من `/platform` ولا تُعدَّل من هنا.
          </p>
        </div>
      )}
    </div>
  );
}
