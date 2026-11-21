import Link from "next/link";
import { ImportBatchesClient } from "@/components/hr/ImportBatchesClient";

export const metadata = { title: "دفعة الاستيراد" };

export default function ImportBatchesPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/hr" className="hover:underline" style={{ color: "var(--color-primary)" }}>الموارد البشرية</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>دفعة الاستيراد</span>
      </div>

      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>أدوات الإدارة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>دُفعات استيراد المقبولين</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          رفع الدفعة وتحققها ومعاينتها واعتمادها وتنفيذها — عند التنفيذ تُنشأ حسابات المقبولين مفعّلة
          بالبريد وكلمة المرور من الملف نفسه، جاهزة للدخول فوراً.
          الرفع وحده لا يُنشئ حساباً ولا يُرسل رسالة.
        </p>
      </div>

      <ImportBatchesClient />
    </div>
  );
}
