"use client";

import { useState, useTransition } from "react";
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
  KeyRound,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import type { FieldDefinition } from "@/infrastructure/custom-fields/field.service";
import { CopyButton } from "@/components/hr/CopyButton";

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

type Status = { type: "success"; token?: string; email: string; candidateId: string } | { type: "error"; message: string } | null;

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

      // Stay here: the invitation code must remain visible until HR chooses to leave.
      setStatus({
        type: "success",
        email: json.email,
        token: json.rawToken,
        candidateId: json.candidateId,
      });
    });
  }

  if (status?.type === "success") {
    return (
      <div className="max-w-lg mx-auto py-12" dir="rtl">
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--color-success-bg)" }}
          >
            <CheckCircle className="w-8 h-8" style={{ color: "var(--color-success)" }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-dark)" }}>
            تم إنشاء المرشح بنجاح
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            أُرسل رمز الدعوة إلى <strong dir="ltr">{status.email}</strong>، ويمكنك أيضاً نسخه من هنا وإرساله بأي وسيلة.
          </p>
        </div>

        {status.token && (
          <div className="mt-6 rounded-2xl border p-5" style={{ borderColor: "var(--color-gold)", background: "var(--color-gold-muted)" }}>
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold" style={{ color: "var(--color-primary-dark)" }}>
              <KeyRound className="w-4 h-4" style={{ color: "var(--color-gold-dark)" }} />
              رمز الدعوة
            </div>
            <div className="flex items-stretch gap-3 flex-wrap">
              <code
                dir="ltr"
                className="flex-1 min-w-[220px] px-4 py-3 rounded-xl border bg-white text-sm font-mono tracking-wider break-all select-all"
                style={{ borderColor: "var(--color-border)", color: "var(--color-primary-dark)" }}
              >
                {status.token}
              </code>
              <CopyButton value={status.token} label="نسخ الرمز" className="self-center" />
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--color-text-muted)" }}>
              يبقى الرمز ظاهراً بشكل دائم في ملف المرشح مع زر النسخ، حتى بعد مغادرة هذه الصفحة.
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href={`/hr/candidates/${status.candidateId}`}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-primary)", color: "#fff", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
          >
            الانتقال إلى ملف المرشح
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={() => { setStatus(null); setForm(INITIAL); }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium border"
            style={{ borderColor: "var(--color-border)", color: "var(--color-primary)", background: "#fff", cursor: "pointer", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
          >
            إضافة مرشح آخر
          </button>
        </div>
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
