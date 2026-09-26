import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { CandidateImportForm } from "@/components/hr/CandidateImportForm";

export default function CandidateImportPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/hr/candidates" className="hover:underline" style={{ color: "var(--color-primary)" }}>المرشحون</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>استيراد جماعي</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>أدوات الإدارة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>استيراد مرشحين دفعةً واحدة</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          ارفع ملف CSV يحتوي على أسماء وبريد المقبولين وسيتم إنشاء حساباتهم وإرسال دعوات التسجيل تلقائياً
        </p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { num: "1", title: "ارفع ملف CSV", desc: "اسم + بريد إلكتروني كحد أدنى" },
          { num: "2", title: "راجع البيانات", desc: "معاينة فورية قبل الإرسال" },
          { num: "3", title: "إرسال تلقائي", desc: "دعوة لكل مرشح فور الاستيراد" },
        ].map(s => (
          <div key={s.num} className="p-4 rounded-2xl border text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold"
              style={{ background: "var(--color-primary)", color: "white" }}>
              {s.num}
            </div>
            <p className="text-xs font-semibold" style={{ color: "var(--color-dark)" }}>{s.title}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="rounded-2xl border p-6" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--color-primary-muted)" }}>
            <Users className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--color-dark)" }}>استيراد من ملف CSV</p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>حتى 1000 مرشح في المرة الواحدة</p>
          </div>
        </div>
        <CandidateImportForm />
      </div>

      {/* Back link */}
      <div className="mt-6 flex justify-start">
        <Link
          href="/hr/candidates"
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--color-primary)" }}
        >
          <ArrowRight className="w-4 h-4" />
          العودة لقائمة المرشحين
        </Link>
      </div>
    </div>
  );
}
