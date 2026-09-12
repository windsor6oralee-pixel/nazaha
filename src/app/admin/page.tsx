import Link from "next/link";
import { Building2, Mail, FileSignature, ListChecks, ChevronLeft } from "lucide-react";
import { getTenantContext } from "@/infrastructure/tenant";
import { getOrganizationProfile } from "@/infrastructure/services/organization.service";
import { getSmtpConfig } from "@/infrastructure/notifications/smtp-config.service";
import { listTemplates } from "@/infrastructure/contracts/contract-template.service";
import { listFieldDefinitions } from "@/infrastructure/custom-fields/field.service";

export default async function AdminHubPage() {
  const ctx = await getTenantContext();
  const orgId = ctx!.organizationId;
  const [profile, smtp, templates, fields] = await Promise.all([
    getOrganizationProfile(orgId),
    getSmtpConfig(orgId),
    listTemplates(orgId),
    listFieldDefinitions(orgId),
  ]);
  const activeTemplates = templates.filter((t) => t.isActive).length;

  const cards = [
    {
      href: "/admin/candidate-fields",
      icon: ListChecks,
      title: "الحقول المخصصة",
      desc: "بيانات إضافية عن المرشح خاصة بجهتك",
      status: fields.length ? `${fields.length} حقل` : "اختياري — لا حقول",
      ok: true,
    },
    {
      href: "/admin/contracts",
      icon: FileSignature,
      title: "قوالب العقود",
      desc: "صياغة عقد العمل والإقرارات وإصداراتها",
      status: activeTemplates ? `${activeTemplates} قالب نشط` : "لا توجد قوالب",
      ok: activeTemplates > 0,
    },
    {
      href: "/admin/organization",
      icon: Building2,
      title: "هوية الجهة",
      desc: "الاسم، الشعار، المعتمد الرسمي وبيانات التعاقد",
      status: profile?.authorizedSignerName ? "مكتملة" : "تحتاج استكمالاً",
      ok: !!profile?.authorizedSignerName,
    },
    {
      href: "/admin/settings",
      icon: Mail,
      title: "خادم البريد الإلكتروني",
      desc: "إعدادات SMTP لإرسال الدعوات والإشعارات",
      status: smtp ? `مُعدّ · ${smtp.host}` : "غير مُعدّ",
      ok: !!smtp,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>الإدارة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>إعدادات {profile?.nameAr}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          الإعدادات الخاصة بجهتك — لا تؤثر على الجهات الأخرى في المنصة
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map(({ href, icon: Icon, title, desc, status, ok }) => (
          <Link
            key={href}
            href={href}
            className="stat-card bg-white rounded-2xl border p-5 flex flex-col gap-4"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="flex items-start justify-between">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "var(--color-primary-muted)" }}>
                <Icon className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
              </div>
              <ChevronLeft className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
            </div>
            <div>
              <h2 className="font-bold text-base" style={{ color: "var(--color-dark)" }}>{title}</h2>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{desc}</p>
            </div>
            <span
              className="self-start text-xs font-medium px-2.5 py-1 rounded-full"
              style={{
                background: ok ? "var(--color-success-bg)" : "var(--color-warning-bg)",
                color: ok ? "var(--color-success)" : "var(--color-warning)",
              }}
            >
              {status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
