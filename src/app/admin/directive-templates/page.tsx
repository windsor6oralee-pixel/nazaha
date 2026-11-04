import Link from "next/link";
import { getTenantContext } from "@/infrastructure/tenant";
import { listDirectiveTemplates } from "@/infrastructure/directives/directive.service";
import { DirectiveTemplatesManager } from "@/components/admin/DirectiveTemplatesManager";

export default async function DirectiveTemplatesPage() {
  const ctx = await getTenantContext();
  const templates = await listDirectiveTemplates(ctx!.organizationId);
  const initial = templates.map((t) => ({ ...t, updatedAt: t.updatedAt.toISOString() }));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/admin" className="hover:underline" style={{ color: "var(--color-primary)" }}>الإعدادات</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>قوالب التوجيهات</span>
      </div>

      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>إعدادات الجهة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>قوالب التوجيهات الجاهزة</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          رسائل سريعة تضعها لتختارها HR من ملف المرشح وتُركّبها على بطاقة التوجيه عنده بضغطة.
        </p>
      </div>

      <DirectiveTemplatesManager initialTemplates={initial} />
    </div>
  );
}
