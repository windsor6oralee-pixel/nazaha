import Link from "next/link";
import { getTenantContext } from "@/infrastructure/tenant";
import {
  listDocumentRules,
  DOCUMENT_CATALOG,
} from "@/infrastructure/workflow/document-rules.service";
import { DocumentRulesManager } from "@/components/admin/DocumentRulesManager";

export default async function AdminDocumentsPage() {
  const ctx = await getTenantContext();
  const rules = await listDocumentRules(ctx!.organizationId);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/admin" className="hover:underline" style={{ color: "var(--color-primary)" }}>الإعدادات</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>المستندات المطلوبة</span>
      </div>

      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>إعدادات الجهة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>المستندات المطلوبة من المرشح</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          القائمة الافتراضية: صورة الهوية + شهادة IBAN فقط. فعِّل مستندات إضافية حسب حاجة جهتك.
        </p>
      </div>

      <DocumentRulesManager initialRules={rules} catalog={DOCUMENT_CATALOG} />
    </div>
  );
}
