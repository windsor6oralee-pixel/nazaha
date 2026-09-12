import Link from "next/link";
import { getTenantContext } from "@/infrastructure/tenant";
import { getSmtpConfig } from "@/infrastructure/notifications/smtp-config.service";
import { SmtpSettingsForm } from "@/components/admin/SmtpSettingsForm";

export default async function AdminSettingsPage() {
  const ctx = await getTenantContext();
  const existing = await getSmtpConfig(ctx!.organizationId);

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
        <h1 className="text-2xl font-bold text-heading" style={{ color: "var(--color-dark)" }}>
          إعداد خادم البريد الإلكتروني
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          أدخل بيانات SMTP الخاص بجهتك لتفعيل إرسال رموز الدعوة والإشعارات تلقائياً
        </p>
      </div>

      <SmtpSettingsForm existing={existing} />
    </div>
  );
}
