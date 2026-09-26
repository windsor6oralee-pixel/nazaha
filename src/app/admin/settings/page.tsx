import Link from "next/link";
import { getTenantContext } from "@/infrastructure/tenant";
import { getSmtpConfig } from "@/infrastructure/notifications/smtp-config.service";
import { getInboxKitConfig } from "@/infrastructure/notifications/inboxkit-config.service";
import { SmtpSettingsForm } from "@/components/admin/SmtpSettingsForm";
import { InboxKitSettingsForm } from "@/components/admin/InboxKitSettingsForm";
import { EmailProviderTabs } from "@/components/admin/EmailProviderTabs";

export default async function AdminSettingsPage() {
  const ctx = await getTenantContext();
  const orgId = ctx!.organizationId;

  const [existingSmtp, existingInboxKit] = await Promise.all([
    getSmtpConfig(orgId),
    getInboxKitConfig(orgId),
  ]);

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
    </div>
  );
}
