import Link from "next/link";
import { getTenantContext } from "@/infrastructure/tenant";
import { listTemplates, getPlaceholdersForOrg } from "@/infrastructure/contracts/contract-template.service";
import { ContractTemplateEditor } from "@/components/admin/ContractTemplateEditor";

export default async function ContractTemplatesPage() {
  const ctx = await getTenantContext();
  const [rows, placeholders] = await Promise.all([
    listTemplates(ctx!.organizationId),
    getPlaceholdersForOrg(ctx!.organizationId),
  ]);
  const templates = rows.map((t) => ({ ...t, updatedAt: t.updatedAt.toISOString() }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/admin" className="hover:underline" style={{ color: "var(--color-primary)" }}>الإعدادات</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>قوالب العقود</span>
      </div>

      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>إعدادات الجهة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>قوالب العقود</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          صياغة العقود الرسمية لجهتك. عند توليد عقد لمرشح تُحقن بياناته وبيانات الجهة في القالب، وتُجمَّد النسخة الناتجة ببصمة رقمية لا تتغير بعد التوقيع.
        </p>
      </div>

      <ContractTemplateEditor templates={templates} placeholders={placeholders} />
    </div>
  );
}
