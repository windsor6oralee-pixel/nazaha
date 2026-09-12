"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Landmark, FileSignature, MapPin, Mail, Phone, Palette,
  ImagePlus, Trash2, CheckCircle, XCircle, Loader2,
} from "lucide-react";
import type { OrganizationProfile } from "@/infrastructure/services/organization.service";

interface Props {
  profile: OrganizationProfile;
}

type Status = { type: "success" | "error"; message: string } | null;

const ORG_TYPES: { value: OrganizationProfile["type"]; label: string }[] = [
  { value: "GOVERNMENT",      label: "جهة حكومية" },
  { value: "SEMI_GOVERNMENT", label: "جهة شبه حكومية" },
  { value: "PRIVATE",         label: "قطاع خاص" },
];

const inputCls = "w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all";
const inputStyle: React.CSSProperties = {
  borderColor: "var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontFamily: "'IBM Plex Sans Arabic', sans-serif",
};
function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "var(--color-gold)";
  e.target.style.boxShadow = "0 0 0 3px var(--color-gold-muted)";
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "var(--color-border)";
  e.target.style.boxShadow = "none";
}

function Field({ label, icon: Icon, required, hint, children }: {
  label: string; icon: React.ElementType; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5" style={{ color: "var(--color-dark)" }}>
        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-primary)" }} />
        {label}
        {required && <span style={{ color: "var(--color-error)" }}>*</span>}
      </label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{hint}</p>}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border p-6 space-y-5" style={{ borderColor: "var(--color-border)" }}>
      <div>
        <h2 className="font-bold text-base" style={{ color: "var(--color-dark)" }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function StatusBanner({ status }: { status: Status }) {
  if (!status) return null;
  const ok = status.type === "success";
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{
      background: ok ? "var(--color-success-bg)" : "var(--color-error-bg)",
      color: ok ? "var(--color-success)" : "var(--color-error)",
      border: `1px solid ${ok ? "rgba(34,122,78,0.25)" : "rgba(168,58,48,0.25)"}`,
    }}>
      {ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
      {status.message}
    </div>
  );
}

export function OrganizationProfileForm({ profile }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    nameAr:                profile.nameAr,
    nameEn:                profile.nameEn ?? "",
    type:                  profile.type,
    officialNameAr:        profile.officialNameAr ?? "",
    authorizedSignerName:  profile.authorizedSignerName ?? "",
    authorizedSignerTitle: profile.authorizedSignerTitle ?? "",
    commercialRegNo:       profile.commercialRegNo ?? "",
    address:               profile.address ?? "",
    contactEmail:          profile.contactEmail ?? "",
    contactPhone:          profile.contactPhone ?? "",
    primaryColor:          profile.primaryColor ?? "",
  });
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl);
  const [status, setStatus] = useState<Status>(null);
  const [logoStatus, setLogoStatus] = useState<Status>(null);
  const [isSaving, startSave] = useTransition();
  const [isLogoBusy, startLogo] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    startSave(async () => {
      const res = await fetch("/api/admin/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setStatus({ type: "error", message: json.error ?? "فشل الحفظ" }); return; }
      setStatus({ type: "success", message: "تم حفظ هوية الجهة بنجاح" });
      router.refresh();
    });
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoStatus(null);
    startLogo(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/organization/logo", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setLogoStatus({ type: "error", message: json.error ?? "فشل رفع الشعار" }); return; }
      setLogoUrl(json.logoUrl);
      setLogoStatus({ type: "success", message: "تم تحديث الشعار" });
      router.refresh();
    });
  }

  function handleLogoRemove() {
    if (!confirm("هل تريد إزالة شعار الجهة؟")) return;
    setLogoStatus(null);
    startLogo(async () => {
      await fetch("/api/admin/organization/logo", { method: "DELETE" });
      setLogoUrl(null);
      router.refresh();
    });
  }

  const isPrivate = form.type === "PRIVATE";

  return (
    <div className="space-y-6">
      {/* Logo */}
      <Section title="شعار الجهة" subtitle="يظهر بجانب شعار نزاهة في ترويسة المنصة لموظفي الجهة والمرشحين">
        <StatusBanner status={logoStatus} />
        <div className="flex items-center gap-5 flex-wrap">
          <div
            className="w-24 h-24 rounded-2xl border flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}
          >
            {logoUrl
              ? <img src={logoUrl} alt="شعار الجهة" className="w-full h-full object-contain p-2" />
              : <Building2 className="w-9 h-9" style={{ color: "var(--color-text-muted)" }} />}
          </div>
          <div className="flex gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoChange} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={isLogoBusy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border"
              style={{ color: "var(--color-primary)", borderColor: "var(--color-primary)", background: "var(--color-primary-muted)", cursor: "pointer", minHeight: 44 }}>
              {isLogoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              {logoUrl ? "استبدال الشعار" : "رفع الشعار"}
            </button>
            {logoUrl && (
              <button type="button" onClick={handleLogoRemove} disabled={isLogoBusy}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border"
                style={{ color: "var(--color-error)", borderColor: "rgba(168,58,48,0.3)", background: "var(--color-error-bg)", cursor: "pointer", minHeight: 44 }}>
                <Trash2 className="w-4 h-4" /> إزالة
              </button>
            )}
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>PNG أو JPEG — بحد أقصى 2 ميغابايت. يُفضَّل خلفية شفافة ونسبة 1:1.</p>
      </Section>

      <form onSubmit={handleSave} className="space-y-6">
        <StatusBanner status={status} />

        <Section title="الهوية الأساسية">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="اسم الجهة (المختصر)" icon={Building2} required hint="يظهر في الترويسة والإشعارات">
              <input value={form.nameAr} onChange={set("nameAr")} required className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </Field>
            <Field label="الاسم بالإنجليزية" icon={Building2}>
              <input value={form.nameEn} onChange={set("nameEn")} dir="ltr" className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </Field>
            <Field label="نوع الجهة" icon={Landmark} required>
              <select value={form.type} onChange={set("type")} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
                {ORG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            {isPrivate && (
              <Field label="رقم السجل التجاري" icon={FileSignature}>
                <input value={form.commercialRegNo} onChange={set("commercialRegNo")} dir="ltr" className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </Field>
            )}
          </div>
        </Section>

        <Section title="بيانات التعاقد" subtitle="تُستخدم في صياغة العقود الرسمية وتوقيعها">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="الاسم الرسمي الكامل" icon={FileSignature} hint="كما يظهر في مقدمة العقد — مثال: وزارة المالية — المملكة العربية السعودية">
                <input value={form.officialNameAr} onChange={set("officialNameAr")} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </Field>
            </div>
            <Field label="اسم المعتمد الرسمي" icon={FileSignature} hint="الشخص الذي يوقّع العقود نيابةً عن الجهة">
              <input value={form.authorizedSignerName} onChange={set("authorizedSignerName")} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </Field>
            <Field label="منصب المعتمد الرسمي" icon={FileSignature}>
              <input value={form.authorizedSignerTitle} onChange={set("authorizedSignerTitle")} placeholder="وكيل الوزارة للموارد البشرية" className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="العنوان" icon={MapPin}>
                <input value={form.address} onChange={set("address")} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="التواصل والمظهر">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="بريد التواصل للمرشحين" icon={Mail} hint="يظهر للمرشح عند الحاجة للمساعدة">
              <input type="email" value={form.contactEmail} onChange={set("contactEmail")} dir="ltr" className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </Field>
            <Field label="هاتف التواصل" icon={Phone}>
              <input type="tel" value={form.contactPhone} onChange={set("contactPhone")} dir="ltr" className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </Field>
            <Field label="لون الترويسة (اختياري)" icon={Palette} hint="يُلوّن ترويسة لوحة الموارد البشرية فقط — لا يغيّر هوية نزاهة">
              <div className="flex items-center gap-2">
                <input type="color" value={form.primaryColor || "#013A2B"} onChange={set("primaryColor")}
                  className="w-11 h-11 rounded-xl border cursor-pointer p-1" style={{ borderColor: "var(--color-border)", background: "white" }} aria-label="اختيار اللون" />
                <input value={form.primaryColor} onChange={set("primaryColor")} placeholder="#013A2B" dir="ltr" maxLength={7}
                  className={inputCls} style={{ ...inputStyle, fontFamily: "monospace" }} onFocus={onFocus} onBlur={onBlur} />
                {form.primaryColor && (
                  <button type="button" onClick={() => setForm((f) => ({ ...f, primaryColor: "" }))}
                    className="text-xs whitespace-nowrap px-3 py-2 rounded-lg" style={{ color: "var(--color-text-muted)", cursor: "pointer" }}>
                    الافتراضي
                  </button>
                )}
              </div>
            </Field>
          </div>
        </Section>

        <button type="submit" disabled={isSaving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
          style={{ background: isSaving ? "#6B9E82" : "var(--color-primary)", color: "white", cursor: isSaving ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Sans Arabic', sans-serif", minHeight: 48 }}>
          {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الحفظ...</> : "حفظ هوية الجهة"}
        </button>
      </form>
    </div>
  );
}
