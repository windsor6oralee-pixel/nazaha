import Link from "next/link";
import { getTenantContext } from "@/infrastructure/tenant";
import {
  ensureDefaultTemplates,
  listEmailTemplates,
} from "@/infrastructure/email-templates/template.service";
import { EmailTemplatesManager } from "@/components/admin/EmailTemplatesManager";

export default async function EmailTemplatesPage() {
  const ctx = await getTenantContext();
  // First open seeds the four default templates so a new tenant sees useful starters.
  await ensureDefaultTemplates(ctx!.organizationId);
  const rows = await listEmailTemplates(ctx!.organizationId);
  const initial = rows.map((t) => ({ ...t, updatedAt: t.updatedAt.toISOString() }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/admin" className="hover:underline" style={{ color: "var(--color-primary)" }}>الإعدادات</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>قوالب البريد</span>
      </div>

      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>إعدادات الجهة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>قوالب البريد والتنبيهات</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          قوالب موحّدة لكل أنواع الإرسال: دعوة القبول الوظيفي، التنبيهات، تذكير الشهادة الصحية، والرسائل الحرّة.
          لكل نوع قالب افتراضي يُستخدم تلقائياً عند الإرسال، ويمكن إنشاء قوالب إضافية والاختيار بينها.
        </p>
      </div>

      <EmailTemplatesManager initial={initial} />
    </div>
  );
}
