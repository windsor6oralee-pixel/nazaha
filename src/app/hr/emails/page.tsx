import Link from "next/link";
import { EmailLogView } from "@/components/hr/EmailLogView";

export default function HREmailsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/hr" className="hover:underline" style={{ color: "var(--color-primary)" }}>الموارد البشرية</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>سجل البريد الصادر</span>
      </div>

      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>تواصل</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>سجل البريد الصادر</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          كل رسالة أُرسلت من المنصة عبر موصلات البريد المرتبطة بجهتك — ابحث، صفِّ بالحالة، واطّلع على الحالة الفعلية.
        </p>
      </div>

      <EmailLogView />
    </div>
  );
}
