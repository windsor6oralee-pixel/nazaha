"use client";

import { useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert, Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import type { FieldDefinition } from "@/infrastructure/custom-fields/field.service";
import { CopyButton } from "@/components/hr/CopyButton";

interface Props {
  fields: FieldDefinition[];
}

interface FormState {
  hrWelcomeNote: string;
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
  hrWelcomeNote: "",
};

type Status = { type: "success"; token?: string; email: string; candidateId: string } | { type: "error"; message: string } | null;

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
          hrWelcomeNote: form.hrWelcomeNote.trim() || undefined,
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
      <div className="flex flex-col gap-6" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <div className="text-center flex flex-col items-center gap-2">
          <span
            aria-hidden
            className="inline-grid place-items-center"
            style={{ width: 64, height: 64, borderRadius: "var(--radius-20)", background: "var(--surface-100)", border: "1px solid var(--border-100)", color: "var(--success-500)" }}
          >
            <Icon name="approved" size={32} label={false} />
          </span>
          <h2 className="ds-subheading" style={{ margin: "var(--space-8) 0 0", fontFamily: "var(--font-kufi)", fontWeight: 700 }}>
            تم إنشاء المرشح بنجاح
          </h2>
          <p style={{ margin: 0, color: "var(--ink-muted)" }}>
            أُرسل رمز الدعوة إلى <strong dir="ltr" style={{ color: "var(--ink)" }}>{status.email}</strong>، ويمكنك أيضاً نسخه من هنا وإرساله بأي وسيلة.
          </p>
        </div>

        {status.token && (
          <Card
            animate={false}
            title={
              <span className="inline-flex items-center gap-2">
                <Icon name="privacy" size={24} label={false} style={{ color: "var(--green-700)" }} />
                رمز الدعوة
              </span>
            }
          >
            <div className="flex items-stretch gap-4 flex-wrap">
              <code
                dir="ltr"
                className="flex-1 min-w-[220px] break-all select-all"
                style={{
                  padding: "var(--space-16)",
                  borderRadius: "var(--radius-12)",
                  border: "1.5px solid var(--gold-500)",
                  background: "var(--surface-000)",
                  color: "var(--ink)",
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                }}
              >
                {status.token}
              </code>
              <CopyButton value={status.token} label="نسخ الرمز" className="self-center" />
            </div>
            <p className="ds-caption" style={{ margin: "var(--space-16) 0 0", color: "var(--ink-muted)" }}>
              يبقى الرمز ظاهراً بشكل دائم في ملف المرشح مع زر النسخ، حتى بعد مغادرة هذه الصفحة.
            </p>
          </Card>
        )}

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <ButtonLink
            href={`/hr/candidates/${status.candidateId}`}
            icon="profile"
          >
            الانتقال إلى ملف المرشح
          </ButtonLink>
          <Button
            variant="secondary"
            icon="candidates"
            onClick={() => { setStatus(null); setForm(INITIAL); }}
          >
            إضافة مرشح آخر
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {status?.type === "error" && (
        <Alert tone="error" icon="close">{status.message}</Alert>
      )}

      {/* Section: Personal Info */}
      <Card title="البيانات الشخصية" animate={false}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="الاسم الكامل بالعربي"
            icon="profile"
            value={form.nameAr}
            onChange={set("nameAr")}
            required
            placeholder="أحمد محمد العمري"
          />

          <Input
            label="رقم الهوية الوطنية"
            icon="privacy"
            value={form.nationalId}
            onChange={set("nationalId")}
            required
            placeholder="1xxxxxxxxx"
            maxLength={10}
            dir="ltr"
          />

          <Input
            label="البريد الإلكتروني"
            icon="messages"
            type="email"
            value={form.email}
            onChange={set("email")}
            required
            placeholder="candidate@example.com"
            dir="ltr"
          />

          <Input
            label="رقم الجوال"
            type="tel"
            value={form.phone}
            onChange={set("phone")}
            placeholder="05xxxxxxxx"
            dir="ltr"
          />
        </div>
      </Card>

      {/* Section: Job Info */}
      <Card title="البيانات الوظيفية" animate={false}>
        <div className="flex flex-col gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="المسمى الوظيفي"
              value={form.jobTitle}
              onChange={set("jobTitle")}
              required
              placeholder="محلل بيانات أول"
            />

            <Input
              label="القسم / الإدارة"
              icon="dashboard"
              value={form.department}
              onChange={set("department")}
              required
              placeholder="إدارة تقنية المعلومات"
            />

            <Input
              label="تاريخ القبول"
              icon="calendar"
              type="date"
              value={form.acceptanceDate}
              onChange={set("acceptanceDate")}
              required
              dir="ltr"
            />

            <Input
              label="تاريخ المباشرة المتوقع"
              icon="calendar"
              type="date"
              value={form.expectedStartDate}
              onChange={set("expectedStartDate")}
              dir="ltr"
            />
          </div>

          {/* HR Welcome Note */}
          <Textarea
            label={<>رسالة ترحيب للمرشح <span style={{ fontWeight: 400 }}>(اختياري)</span></>}
            value={form.hrWelcomeNote}
            onChange={(e) => setForm((p) => ({ ...p, hrWelcomeNote: e.target.value }))}
            placeholder="اكتب رسالة ترحيب شخصية تظهر للمرشح فور تسجيل دخوله — يمكن تضمين تعليمات خاصة، موقع العمل، اسم المشرف المباشر..."
            rows={3}
            hint="تظهر هذه الرسالة كبانر مميز في أعلى لوحة تحكم المرشح ويمكنه إغلاقها."
          />
        </div>
      </Card>

      {/* Section: Tenant custom fields */}
      {fields.length > 0 && (
        <Card title="بيانات إضافية" description="حقول خاصة بجهتك — تُستخدم في العقود والتقارير" animate={false}>
          <div className="grid sm:grid-cols-2 gap-4">
            {fields.map((f) => {
              const value = custom[f.key] ?? "";
              return (
                <div key={f.id}>
                  {f.type === "TEXT" && (
                    <Input label={f.labelAr} value={value} onChange={(e) => setCustomField(f.key, e.target.value)} required={f.isRequired} maxLength={500} />
                  )}
                  {f.type === "NUMBER" && (
                    <Input label={f.labelAr} type="number" step="any" value={value} onChange={(e) => setCustomField(f.key, e.target.value)} required={f.isRequired} dir="ltr" />
                  )}
                  {f.type === "DATE" && (
                    <Input label={f.labelAr} icon="calendar" type="date" value={value} onChange={(e) => setCustomField(f.key, e.target.value)} required={f.isRequired} dir="ltr" />
                  )}
                  {f.type === "SELECT" && (
                    <Select label={f.labelAr} value={value} onChange={(e) => setCustomField(f.key, e.target.value)} required={f.isRequired}>
                      <option value="">— اختر —</option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </Select>
                  )}
                  {f.type === "BOOLEAN" && (
                    <div className="nz-field" role="group" aria-label={f.labelAr}>
                      <span className="nz-field__label">
                        {f.labelAr}
                        {f.isRequired && <span className="nz-req" aria-hidden>*</span>}
                      </span>
                      <div className="flex gap-2">
                        {[{ v: "true", l: "نعم" }, { v: "false", l: "لا" }].map((opt) => {
                          const active = value === opt.v;
                          return (
                            <button key={opt.v} type="button" aria-pressed={active} onClick={() => setCustomField(f.key, opt.v)}
                              className="flex-1"
                              style={{
                                minHeight: "var(--tap-target-min)",
                                borderRadius: "var(--radius-12)",
                                border: "1.5px solid",
                                borderColor: active ? "var(--green-700)" : "var(--border-100)",
                                background: active ? "var(--surface-100)" : "var(--surface-000)",
                                color: active ? "var(--green-700)" : "var(--ink-muted)",
                                fontSize: 15,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard)",
                              }}>
                              {opt.l}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Info note */}
      <Alert tone="info" icon="messages">
        سيتم إنشاء حساب المرشح وإرسال رمز الدعوة تلقائياً إلى بريده الإلكتروني عند الحفظ
      </Alert>

      <Button type="submit" block icon="messages" loading={isPending}>
        {isPending ? "جارٍ الإنشاء وإرسال الدعوة..." : "إنشاء المرشح وإرسال الدعوة"}
      </Button>
    </form>
  );
}
