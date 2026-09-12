import { Building2, Users, UserCheck } from "lucide-react";
import { listOrganizations } from "@/infrastructure/platform/provisioning.service";
import { CreateOrganizationForm } from "@/components/platform/CreateOrganizationForm";
import { OrganizationActiveToggle } from "@/components/platform/OrganizationActiveToggle";

const TYPE_LABEL: Record<string, string> = {
  GOVERNMENT: "حكومية", SEMI_GOVERNMENT: "شبه حكومية", PRIVATE: "قطاع خاص",
};

export default async function PlatformHomePage() {
  const orgs = await listOrganizations();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-gold)" }}>إدارة المنصة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>الجهات المشتركة</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          كل جهة معزولة تماماً في بياناتها وأدوارها وقوالبها. تسجيل جهة جديدة يُنشئ كل ما تحتاجه للانطلاق في عملية واحدة.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>{orgs.length} جهة</span>
          </div>
          {orgs.length === 0 ? (
            <p className="p-10 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>لا توجد جهات بعد</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {orgs.map((o) => (
                <li key={o.id} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: o.isActive ? "var(--color-primary-muted)" : "var(--color-surface-alt)" }}>
                    <Building2 className="w-5 h-5" style={{ color: o.isActive ? "var(--color-primary)" : "var(--color-text-muted)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--color-dark)" }}>{o.nameAr}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>{TYPE_LABEL[o.type]}</span>
                      {!o.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>موقوفة</span>}
                    </div>
                    <p dir="ltr" className="text-[11px] font-mono mt-0.5 text-right" style={{ color: "var(--color-text-muted)" }}>{o.slug}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {o._count.users}</span>
                    <span className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> {o._count.candidates}</span>
                  </div>
                  <OrganizationActiveToggle id={o.id} isActive={o.isActive} nameAr={o.nameAr} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <CreateOrganizationForm />
      </div>
    </div>
  );
}
