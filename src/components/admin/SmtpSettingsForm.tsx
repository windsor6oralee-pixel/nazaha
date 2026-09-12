"use client";

import { useState, useTransition } from "react";
import { Server, Eye, EyeOff, CheckCircle, XCircle, Loader2, Send, Trash2 } from "lucide-react";
import type { SmtpSettings } from "@/infrastructure/notifications/smtp-config.service";

interface Props {
  existing: SmtpSettings | null;
}

type Status = { type: "success" | "error"; message: string } | null;

export function SmtpSettingsForm({ existing }: Props) {
  const [host,      setHost]      = useState(existing?.host      ?? "");
  const [port,      setPort]      = useState(String(existing?.port ?? 587));
  const [secure,    setSecure]    = useState(existing?.secure    ?? false);
  const [user,      setUser]      = useState(existing?.user      ?? "");
  const [pass,      setPass]      = useState("");
  const [fromEmail, setFromEmail] = useState(existing?.fromEmail ?? "");
  const [fromName,  setFromName]  = useState(existing?.fromName  ?? "نزاهة التوظيف");
  const [testEmail, setTestEmail] = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [status,    setStatus]    = useState<Status>(null);
  const [testStatus, setTestStatus] = useState<Status>(null);
  const [isPending, start]        = useTransition();
  const [isTesting, startTest]    = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const configured = !!existing;

  function field(label: string, input: React.ReactNode, hint?: string) {
    return (
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-dark)" }}>{label}</label>
        {input}
        {hint && <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{hint}</p>}
      </div>
    );
  }

  const inputStyle = {
    borderColor: "var(--color-border)",
    background: "var(--color-surface)",
    color: "var(--color-text)",
  } as React.CSSProperties;

  function inputCls(extra = "") {
    return `w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all ${extra}`;
  }

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = "var(--color-primary)";
    e.target.style.boxShadow = "0 0 0 3px var(--color-primary-muted)";
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = "var(--color-border)";
    e.target.style.boxShadow = "none";
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    start(async () => {
      const res = await fetch("/api/admin/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port: Number(port), secure, user, pass: pass || undefined, fromEmail, fromName }),
      });
      const json = await res.json();
      if (!res.ok) setStatus({ type: "error", message: json.error ?? "فشل الحفظ" });
      else setStatus({ type: "success", message: "تم حفظ إعدادات SMTP بنجاح ✓" });
    });
  }

  function handleTest() {
    setTestStatus(null);
    startTest(async () => {
      const body: Record<string, unknown> = { testEmail };
      // If unsaved values present, send them inline for pre-save testing
      if (pass) Object.assign(body, { host, port: Number(port), secure, user, pass, fromEmail, fromName });

      const res = await fetch("/api/admin/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) setTestStatus({ type: "error", message: json.error ?? "فشل الاختبار" });
      else setTestStatus({ type: "success", message: `تم إرسال بريد اختبار إلى ${json.sentTo} ✓` });
    });
  }

  function handleDelete() {
    if (!confirm("هل أنت متأكد من حذف إعدادات SMTP؟ سيتوقف إرسال البريد الإلكتروني.")) return;
    startDelete(async () => {
      await fetch("/api/admin/smtp", { method: "DELETE" });
      window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {status && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{
            background: status.type === "success" ? "var(--color-success-bg)" : "var(--color-error-bg)",
            color:      status.type === "success" ? "var(--color-success)" : "var(--color-error)",
            border: `1px solid ${status.type === "success" ? "rgba(34,122,78,0.25)" : "rgba(168,58,48,0.25)"}`,
          }}
        >
          {status.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
          {status.message}
        </div>
      )}

      {/* Current status badge */}
      <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: configured ? "var(--color-success-bg)" : "var(--color-warning-bg)" }}>
            <Server className="w-4 h-4" style={{ color: configured ? "var(--color-success)" : "var(--color-warning)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>
              {configured ? "خادم البريد مُعدّ" : "لم يتم إعداد خادم البريد بعد"}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {configured ? `${existing.host}:${existing.port} · ${existing.fromEmail}` : "أدخل بيانات SMTP لتفعيل الإرسال"}
            </p>
          </div>
        </div>
        {configured && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{ color: "var(--color-error)", borderColor: "rgba(168,58,48,0.3)", background: "var(--color-error-bg)", cursor: "pointer" }}
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            حذف الإعدادات
          </button>
        )}
      </div>

      {/* Main form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border p-6 space-y-5" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="font-bold text-base text-heading" style={{ color: "var(--color-dark)" }}>بيانات الخادم</h2>

        <div className="grid sm:grid-cols-3 gap-4">
          {field("عنوان الخادم (Host) *",
            <input value={host} onChange={e => setHost(e.target.value)} required placeholder="smtp.gmail.com"
              className={inputCls()} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          )}
          {field("المنفذ (Port)",
            <input type="number" value={port} onChange={e => setPort(e.target.value)} placeholder="587"
              className={inputCls()} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          )}
          {field("التشفير",
            <select value={secure ? "true" : "false"} onChange={e => setSecure(e.target.value === "true")}
              className={inputCls()} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
              <option value="false">STARTTLS (587 / 25)</option>
              <option value="true">SSL/TLS (465)</option>
            </select>
          )}
        </div>

        <div className="h-px" style={{ background: "var(--color-border)" }} />
        <h2 className="font-bold text-base text-heading" style={{ color: "var(--color-dark)" }}>بيانات المصادقة</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          {field("اسم المستخدم (User) *",
            <input value={user} onChange={e => setUser(e.target.value)} required placeholder="no-reply@domain.gov.sa"
              dir="ltr" className={inputCls()} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          )}
          {field(configured ? "كلمة المرور (اتركها فارغة للإبقاء على الحالية)" : "كلمة المرور *",
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={pass}
                onChange={e => setPass(e.target.value)}
                required={!configured}
                placeholder={configured ? "••••••••" : "أدخل كلمة المرور"}
                dir="ltr"
                className={inputCls("pl-10")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>

        <div className="h-px" style={{ background: "var(--color-border)" }} />
        <h2 className="font-bold text-base text-heading" style={{ color: "var(--color-dark)" }}>معلومات المُرسِل</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          {field("اسم المُرسِل",
            <input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="نزاهة التوظيف"
              className={inputCls()} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          )}
          {field("بريد المُرسِل",
            <input value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="no-reply@domain.gov.sa"
              dir="ltr" className={inputCls()} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          )}
        </div>

        <button type="submit" disabled={isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
          style={{
            background: isPending ? "#6B9E82" : "var(--color-primary)",
            color: "white", cursor: isPending ? "not-allowed" : "pointer",
            fontFamily: "'IBM Plex Sans Arabic', sans-serif",
          }}>
          {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الحفظ...</> : "حفظ إعدادات SMTP"}
        </button>
      </form>

      {/* Test section */}
      <div className="bg-white rounded-2xl border p-6 space-y-4" style={{ borderColor: "var(--color-border)" }}>
        <div>
          <h2 className="font-bold text-base text-heading" style={{ color: "var(--color-dark)" }}>اختبار الاتصال</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            أرسل بريداً تجريبياً للتحقق من صحة الإعدادات قبل تفعيل الإرسال للمرشحين
          </p>
        </div>

        {testStatus && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
            style={{
              background: testStatus.type === "success" ? "var(--color-success-bg)" : "var(--color-error-bg)",
              color:      testStatus.type === "success" ? "var(--color-success)" : "var(--color-error)",
              border: `1px solid ${testStatus.type === "success" ? "rgba(34,122,78,0.25)" : "rgba(168,58,48,0.25)"}`,
            }}
          >
            {testStatus.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
            {testStatus.message}
          </div>
        )}

        <div className="flex gap-3">
          <input
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            placeholder="email@domain.com"
            dir="ltr"
            className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
            style={inputStyle}
            onFocus={onFocus}
            onBlur={onBlur}
          />
          <button
            onClick={handleTest}
            disabled={isTesting || !testEmail || (!configured && !pass)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0"
            style={{
              background: (isTesting || !testEmail || (!configured && !pass)) ? "var(--color-border)" : "var(--color-primary-dark)",
              color: "white",
              cursor: "pointer",
              fontFamily: "'IBM Plex Sans Arabic', sans-serif",
            }}
          >
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isTesting ? "جارٍ الإرسال..." : "إرسال تجريبي"}
          </button>
        </div>
        {!configured && !pass && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            أدخل كلمة المرور أعلاه لاختبار الإعدادات قبل الحفظ
          </p>
        )}
      </div>
    </div>
  );
}
