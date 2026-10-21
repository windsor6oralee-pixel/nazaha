import { getTenantContext } from "@/infrastructure/tenant";
import { listFieldDefinitions } from "@/infrastructure/custom-fields/field.service";
import { CreateCandidateForm } from "@/components/hr/CreateCandidateForm";
import { HRBreadcrumb } from "@/components/hr/HRBreadcrumb";

export default async function NewCandidatePage() {
  const ctx = await getTenantContext();
  const fields = ctx ? await listFieldDefinitions(ctx.organizationId) : [];

  return (
    <div className="nz-page nz-page--narrow">
      <div className="flex flex-col gap-4">
      <HRBreadcrumb
        items={[
          { label: "لوحة التحكم", href: "/hr" },
          { label: "المرشحون", href: "/hr/candidates" },
          { label: "مرشح جديد" },
        ]}
      />

      {/* Header */}
      <div className="nz-page__head">
        <div>
          <h1 className="nz-page__title">إضافة مرشح جديد</h1>
          <p className="nz-page__lead">
            أدخل بيانات المرشح المقبول وسيتم إرسال رمز التفعيل تلقائياً
          </p>
        </div>
      </div>
      </div>

      <CreateCandidateForm fields={fields} />
    </div>
  );
}
