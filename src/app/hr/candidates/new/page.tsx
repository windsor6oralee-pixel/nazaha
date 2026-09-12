import Link from "next/link";
import { getTenantContext } from "@/infrastructure/tenant";
import { listFieldDefinitions } from "@/infrastructure/custom-fields/field.service";
import { CreateCandidateForm } from "@/components/hr/CreateCandidateForm";

export default async function NewCandidatePage() {
  const ctx = await getTenantContext();
  const fields = ctx ? await listFieldDefinitions(ctx.organizationId) : [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/hr" className="hover:underline" style={{ color: "var(--color-primary)" }}>
          لوحة التحكم
        </Link>
        <span>/</span>
        <Link href="/hr/candidates" className="hover:underline" style={{ color: "var(--color-primary)" }}>
          المرشحون
        </Link>
        <span>/</span>
        <span style={{ color: "var(--color-dark)" }} className="font-medium">
          مرشح جديد
        </span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>
          إضافة مرشح
        </p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>
          إضافة مرشح جديد
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          أدخل بيانات المرشح المقبول وسيتم إرسال رمز الدعوة تلقائياً
        </p>
      </div>

      <CreateCandidateForm fields={fields} />
    </div>
  );
}
