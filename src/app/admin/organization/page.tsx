import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantContext } from "@/infrastructure/tenant";
import { getOrganizationProfile } from "@/infrastructure/services/organization.service";
import { OrganizationProfileForm } from "@/components/admin/OrganizationProfileForm";

export default async function OrganizationSettingsPage() {
  const ctx = await getTenantContext();
  const profile = ctx ? await getOrganizationProfile(ctx.organizationId) : null;
  if (!profile) return notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/admin" className="hover:underline" style={{ color: "var(--color-primary)" }}>الإعدادات</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>هوية الجهة</span>
      </div>

      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>إعدادات الجهة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>هوية الجهة وبيانات التعاقد</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          الاسم والشعار والمعتمد الرسمي — تظهر في المنصة والعقود والمراسلات الخاصة بـ {profile.nameAr}
        </p>
      </div>

      <OrganizationProfileForm profile={profile} />
    </div>
  );
}
