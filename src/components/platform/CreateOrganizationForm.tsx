"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, KeyRound, Loader2, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";

type Status = { type: "success"; message: string; details: string[] } | { type: "error"; message: string } | null;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all";
const inputStyle: React.CSSProperties = { borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)" };
function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = "var(--color-gold)"; e.target.style.boxShadow = "0 0 0 3px var(--color-gold-muted)";
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = "var(--color-border)"; e.target.style.boxShadow = "none";
}

export function CreateOrganizationForm() {
  const router = useRouter();
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [type, setType] = useState("GOVERNMENT");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [isPending, start] = useTransition();

  function reset() {
    setNameAr(""); setNameEn(""); setSlug(""); setSlugTouched(false); setType("GOVERNMENT");
    setAdminName(""); setAdminEmail(""); setAdminPassword("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    start(async () => {
      const res = await fetch("/api/platform/organizations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameAr, nameEn, slug, type, admin: { nameAr: adminName, email: adminEmail, password: adminPassword } }),
      });
      const json = await res.json();
      if (!res.ok) { setStatus({ type: "error", message: json.error ?? "فشل التسجيل" }); return; }
      setStatus({
        type: "success",
        message: `تم تسجيل "${nameAr}"`,
        details: [
          `${json.roles} أدوار نظام`,
          `مسار عمل بـ ${json.workflowSteps} خطوات`,
          `${json.templates} قوالب عقود`,
          `المشرف الأول: ${adminEmail}`,
        ],
      });
      reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border p-5 space-y-4 lg:sticky lg:top-24" style={{ borderColor: "var(--color-border)" }}>
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4" style={{ color: "var(--color-gold)" }} />
        <h2 className="font-bold text-sm" style={{ color: "var(--color-dark)" }}>تسجيل جهة جديدة</h2>
      </div>

      {status?.type === "error" && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>
          <XCircle className="w-3.5 h-3.5 flex-shrink-0" /> {status.message}
        </div>
      )}
      {status?.type === "success" && (
        <div className="text-xs px-3 py-2.5 rounded-lg space-y-1" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
          <p className="flex items-center gap-2 font-semibold"><CheckCircle className="w-3.5 h-3.5" /> {status.message}</p>
          <ul className="pr-5 list-disc">{status.details.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-dark)" }}>اسم الجهة *</label>
          <input value={nameAr} onChange={(e) => { setNameAr(e.target.value); }} required placeholder="هيئة الحكومة الرقمية"
            className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-dark)" }}>الاسم بالإنجليزية</label>
          <input value={nameEn} onChange={(e) => { setNameEn(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} dir="ltr" placeholder="Digital Government Authority"
            className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-dark)" }}>المعرّف *</label>
            <input value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} required dir="ltr" placeholder="dga" pattern="^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$"
              className={`${inputCls} font-mono`} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-dark)" }}>النوع *</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
              <option value="GOVERNMENT">حكومية</option>
              <option value="SEMI_GOVERNMENT">شبه حكومية</option>
              <option value="PRIVATE">قطاع خاص</option>
            </select>
          </div>
        </div>
      </div>

      <div className="h-px" style={{ background: "var(--color-border)" }} />
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4" style={{ color: "var(--color-gold)" }} />
        <h3 className="font-semibold text-xs" style={{ color: "var(--color-dark)" }}>المشرف الأول للجهة</h3>
      </div>
      <div className="space-y-3">
        <input value={adminName} onChange={(e) => setAdminName(e.target.value)} required placeholder="الاسم الكامل"
          className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
        <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required dir="ltr" placeholder="admin@entity.gov.sa" autoComplete="off"
          className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
        <div className="relative">
          <input type={showPw ? "text" : "password"} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={10} dir="ltr" placeholder="كلمة مرور مؤقتة (10+ أحرف)" autoComplete="new-password"
            className={`${inputCls} pl-10`} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} aria-label="إظهار">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button type="submit" disabled={isPending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
        style={{ background: isPending ? "#6B9E82" : "var(--color-primary)", color: "white", cursor: isPending ? "not-allowed" : "pointer", minHeight: 48 }}>
        {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التجهيز...</> : "تسجيل الجهة وتجهيزها"}
      </button>
      <p className="text-[11px] text-center" style={{ color: "var(--color-text-muted)" }}>
        عملية واحدة ذرّية: الجهة، الأدوار، مسار العمل، القوالب، والمشرف — إما تكتمل كلها أو لا يُحفظ شيء.
      </p>
    </form>
  );
}
