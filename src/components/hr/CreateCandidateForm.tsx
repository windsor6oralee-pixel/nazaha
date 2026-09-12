"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Calendar,
  IdCard,
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  ListChecks,
} from "lucide-react";
import type { FieldDefinition } from "@/infrastructure/custom-fields/field.service";

interface Props {
  fields: FieldDefinition[];
}

interface FormState {
  nameAr: string;
  nationalId: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  acceptanceDate: string;
  expectedStartDate: string;
}

const INITIAL: FormState = {
  nameAr: "",
  nationalId: "",
  email: "",
  phone: "",
  jobTitle: "",
  department: "",
  acceptanceDate: new Date().toISOString().split("T")[0],
  expectedStartDate: "",
};

type Status = { type: "success"; token?: string; email: string } | { type: "error"; message: string } | null;

const inputBase =
  "w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all";

const inputStyle: React.CSSProperties = {
  borderColor: "var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontFamily: "'IBM Plex Sans Arabic', sans-serif",
};

function onFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "var(--color-gold)";
  e.target.style.boxShadow = "0 0 0 3px var(--color-gold-muted)";
}
function onBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "var(--color-border)";
  e.target.style.boxShadow = "none";
}

interface FieldProps {
  label: string;
  icon: React.ElementType;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, icon: Icon, required, children }: FieldProps) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5" style={{ color: "var(--color-dark)" }}>
        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-primary)" }} />
        {label}
        {required && <span style={{ color: "var(--color-error)" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export function CreateCandidateForm({ fields }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.type === "BOOLEAN" ? "false" : ""]))
  );
  const [status, setStatus] = useState<Status>(null);
  const [isPending, start] = useTransition();
  const router = useRouter();

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }
  function setCustomField(key: string, value: string) {
    setCustom((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    start(async () => {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameAr: form.nameAr.trim(),
          nationalId: form.nationalId.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          jobTitle: form.jobTitle.trim(),
          department: form.department.trim(),
          acceptanceDate: form.acceptanceDate,
          expectedStartDate: form.expectedStartDate || undefined,
          customFields: custom,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setStatus({ type: "error", message: json.error ?? "حدث خطأ" });
        return;
      }

      setStatus({
        type: "success",
        email: json.email,
        token: json.rawToken,
      });

      // Redirect after short delay
      setTimeout(() => router.push(`/hr/candidates/${json.candidateId}`), 2000);
    });
  }

  if (status?.type === "success") {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "var(--color-success-bg)" }}
        >
          <CheckCircle className="w-8 h-8" style={{ color: "var(--color-success)" }} />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-dark)" }}>
          تم إنشاء المرشح بنجاح
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
          تم إرسال رمز الدعوة إلى <strong>{status.email}</strong>
        </p>
        {status.token && (
          <div
            className="inline-block px-4 py-2 rounded-xl text-sm font-mono tracking-wider mb-4"
            style={{ background: "var(--color-primary)", color: "var(--color-gold)" }}
          >
            [dev] {status.token}
          </div>
        )}
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          جارٍ الانتقال لملف المرشح...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
      {status?.type === "error" && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{
            background: "var(--color-error-bg)",
            color: "var(--color-error)",
            border: "1px solid rgba(168,58,48,0.25)",
          }}
        >
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {status.message}
        </div>
      )}

      {/* Section: Personal Info */}
      <div className="bg-white rounded-2xl border p-6 space-y-5" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="font-bold text-base" style={{ color: "var(--color-dark)" }}>
          البيانات الشخصية
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الاسم الكامل بالعربي" icon={User} required>
            <input
              value={form.nameAr}
              onChange={set("nameAr")}
              required
              placeholder="أحمد محمد العمري"
              className={inputBase}
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </Field>

          <Field label="رقم الهوية الوطنية" icon={IdCard} required>
            <input
              value={form.nationalId}
              onChange={set("nationalId")}
              required
              placeholder="1xxxxxxxxx"
              maxLength={10}
              dir="ltr"
              className={inputBase}
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </Field>

          <Field label="البريد الإلكتروني" icon={Mail} required>
            <input
              type="email"
              value={form.email}
              onChange={set("email")}
              required
              placeholder="candidate@example.com"
              dir="ltr"
              className={inputBase}
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </Field>

          <Field label="رقم الجوال" icon={Phone}>
            <input
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              placeholder="05xxxxxxxx"
              dir="ltr"
              className={inputBase}
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </Field>
        </div>
      </div>

      {/* Section: Job Info */}
      <div className="bg-white rounded-2xl border p-6 space-y-5" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="font-bold text-base" style={{ color: "var(--color-dark)" }}>
          البيانات الوظيفية
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="المسمى الوظيفي" icon={Briefcase} required>
            <input
              value={form.jobTitle}
              onChange={set("jobTitle")}
              required
              placeholder="محلل بيانات أول"
              className={inputBase}
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </Field>

          <Field label="القسم / الإدارة" icon={Building2} required>
            <input
              value={form.department}
              onChange={set("department")}
              required
              placeholder="إدارة تقنية المعلومات"
              className={inputBase}
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </Field>

          <Field label="تاريخ القبول" icon={Calendar} required>
            <input
              type="date"
              value={form.acceptanceDate}
              onChange={set("acceptanceDate")}
              required
              dir="ltr"
              className={inputBase}
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </Field>

          <Field label="تاريخ المباشرة المتوقع" icon={Calendar}>
            <input
              type="date"
              value={form.expectedStartDate}
              onChange={set("expectedStartDate")}
              dir="ltr"
              className={inputBase}
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </Field>
        </div>
      </div>

      {/* Section: Tenant custom fields */}
      {fields.length > 0 && (
        <div className="bg-white rounded-2xl border p-6 space-y-5" style={{ borderColor: "var(--color-border)" }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: "var(--color-dark)" }}>بيانات إضافية</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>حقول خاصة بجهتك — تُستخدم في العقود والتقارير</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {fields.map((f) => {
              const value = custom[f.key] ?? "";
              const common = { className: inputBase, style: inputStyle, onFocus, onBlur };
              return (
                <Field key={f.id} label={f.labelAr} icon={ListChecks} required={f.isRequired}>
                  {f.type === "TEXT" && (
                    <input value={value} onChange={(e) => setCustomField(f.key, e.target.value)} required={f.isRequired} maxLength={500} {...common} />
                  )}
                  {f.type === "NUMBER" && (
                    <input type="number" step="any" value={value} onChange={(e) => setCustomField(f.key, e.target.value)} required={f.isRequired} dir="ltr" {...common} />
                  )}
                  {f.type === "DATE" && (
                    <input type="date" value={value} onChange={(e) => setCustomField(f.key, e.target.value)} required={f.isRequired} dir="ltr" {...common} />
                  )}
                  {f.type === "SELECT" && (
                    <select value={value} onChange={(e) => setCustomField(f.key, e.target.value)} required={f.isRequired}
                      className={inputBase} style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = "var(--color-gold)"; e.target.style.boxShadow = "0 0 0 3px var(--color-gold-muted)"; }}
                      onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; e.target.style.boxShadow = "none"; }}>
                      <option value="">— اختر —</option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                  {f.type === "BOOLEAN" && (
                    <div className="flex gap-2">
                      {[{ v: "true", l: "نعم" }, { v: "false", l: "لا" }].map((opt) => {
                        const active = value === opt.v;
                        return (
                          <button key={opt.v} type="button" onClick={() => setCustomField(f.key, opt.v)}
                            className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all"
                            style={{
                              borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                              background: active ? "var(--color-primary-muted)" : "var(--color-surface)",
                              color: active ? "var(--color-primary-dark)" : "var(--color-text-muted)",
                              cursor: "pointer", minHeight: 44,
                            }}>
                            {opt.l}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Field>
              );
            })}
          </div>
        </div>
      )}

      {/* Info note */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
        style={{ background: "var(--color-primary-muted)", borderColor: "var(--color-primary)" }}
      >
        <Send className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--color-primary)" }} />
        <p style={{ color: "var(--color-primary-dark)" }}>
          سيتم إنشاء حساب المرشح وإرسال رمز الدعوة تلقائياً إلى بريده الإلكتروني عند الحفظ
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
        style={{
          background: isPending ? "#6B9E82" : "var(--color-primary)",
          color: "white",
          cursor: isPending ? "not-allowed" : "pointer",
          fontFamily: "'IBM Plex Sans Arabic', sans-serif",
          minHeight: 48,
        }}
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            جارٍ الإنشاء وإرسال الدعوة...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            إنشاء المرشح وإرسال الدعوة
          </>
        )}
      </button>
    </form>
  );
}
