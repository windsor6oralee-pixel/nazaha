import Link from "next/link";
import { getTenantContext } from "@/infrastructure/tenant";
import { listFieldDefinitions } from "@/infrastructure/custom-fields/field.service";
import { CandidateFieldsManager } from "@/components/admin/CandidateFieldsManager";

export default async function CandidateFieldsPage() {
  const ctx = await getTenantContext();
  const fields = await listFieldDefinitions(ctx!.organizationId);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/admin" className="hover:underline" style={{ color: "var(--color-primary)" }}>الإعدادات</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>الحقول المخصصة</span>
      </div>

      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>إعدادات الجهة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>حقول المرشح المخصصة</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          بيانات إضافية تحتاجها جهتك عن كل مرشح — تظهر في نموذج الإضافة وملف المرشح، وتُتاح كمتغيرات في قوالب العقود.
        </p>
      </div>

      <CandidateFieldsManager fields={fields} />
    </div>
  );
}
