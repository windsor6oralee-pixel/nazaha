"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  CheckCircle,
  Copy,
  Dices,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  XCircle,
} from "lucide-react";
import { MIN_PASSWORD_LENGTH, generatePassword, validatePassword } from "@/lib/password";

/*
 * ضبط كلمة مرور أي حساب من بوابة المنصة.
 *
 * المشغّل إمّا يكتب كلمة مرور بنفسه أو يولّد واحدة عشوائية يسلّمها لصاحب
 * الحساب. كلمة المرور لا تغادر المتصفح ولا تُعاد في استجابة الخادم.
 */

type Kind = "user" | "admin" | "candidate";

interface Props {
  /** نوع الحساب: موظف جهة أو مشغّل منصة أو مرشح. */
  kind: Kind;
  id: string;
  email: string;
  /** هل هذا حساب المشغّل الحالي؟ تغييره يُنهي جلسته الحالية. */
  isSelf?: boolean;
  label?: string;
}

const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all";
const inputStyle: React.CSSProperties = {
  borderColor: "var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};
function onFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "var(--color-gold)";
  e.target.style.boxShadow = "0 0 0 3px var(--color-gold-muted)";
}
function onBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = "var(--color-border)";
  e.target.style.boxShadow = "none";
}

export function ResetPasswordControl({ kind, id, email, isSelf = false, label }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const endpoint =
    kind === "admin"
      ? `/api/platform/admins/${id}/password`
      : kind === "candidate"
        ? `/api/platform/candidates/${id}/password`
        : `/api/platform/users/${id}/password`;

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isPending]);

  function close() {
    setOpen(false);
    setPassword("");
    setError(null);
    setCopied(false);
  }

  function generate() {
    setPassword(generatePassword());
    setShow(true);
    setError(null);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("تعذّر النسخ — انسخ كلمة المرور يدوياً");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const invalid = validatePassword(password);
    if (invalid) {
      setError(invalid);
      return;
    }

    start(async () => {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "تعذّر تغيير كلمة المرور");
        return;
      }

      setPassword("");
      setShow(false);

      if (isSelf) {
        setSuccess("تم تغيير كلمة المرور. سننهي جلستك الحالية — سجّل الدخول من جديد.");
        // الجلسة القديمة أُبطلت بتغيير كلمة المرور، فلا معنى إبقائها.
        setTimeout(() => signOut({ callbackUrl: "/platform/login" }), 1500);
        return;
      }

      setSuccess(`تم ضبط كلمة المرور لـ ${json.email ?? email}.`);
      setTimeout(() => {
        close();
        router.refresh();
      }, 1200);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
        style={{
          borderColor: "var(--color-border)",
          color: "var(--color-dark)",
          background: "var(--color-surface)",
          whiteSpace: "nowrap",
        }}
      >
        <KeyRound className="w-3.5 h-3.5" style={{ color: "var(--color-gold)" }} />
        {label ?? (isSelf ? "تغيير كلمة مروري" : "ضبط كلمة المرور")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: "rgba(15, 23, 42, 0.45)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="ضبط كلمة المرور"
            className="w-full max-w-md bg-white rounded-2xl border p-5 space-y-4"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-sm" style={{ color: "var(--color-dark)" }}>
                  {isSelf ? "تغيير كلمة المرور الخاصة بك" : "ضبط كلمة مرور الحساب"}
                </h2>
                <p dir="ltr" className="text-[11px] font-mono text-right mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {email}
                </p>
              </div>
              <button type="button" onClick={close} disabled={isPending} aria-label="إغلاق"
                className="p-1 rounded-lg" style={{ color: "var(--color-text-muted)" }}>
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {success ? (
              <div className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                {error && (
                  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium" style={{ color: "var(--color-dark)" }}>
                      كلمة المرور الجديدة
                    </label>
                    <button type="button" onClick={generate}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md"
                      style={{ color: "var(--color-gold)", background: "var(--color-gold-muted)" }}>
                      <Dices className="w-3 h-3" /> توليد
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      dir="ltr"
                      autoComplete="new-password"
                      placeholder={`${MIN_PASSWORD_LENGTH} أحرف على الأقل، مع حرف ورقم`}
                      className={`${inputCls} pl-10`}
                      style={inputStyle}
                      onFocus={onFocus}
                      onBlur={onBlur}
                    />
                    <button type="button" onClick={() => setShow(!show)}
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--color-text-muted)" }}
                      aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                        سلّمها لصاحب الحساب — لن تُعرض مرة أخرى.
                      </span>
                      <button type="button" onClick={copy}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border"
                        style={{ borderColor: "var(--color-border)", color: "var(--color-dark)" }}>
                        <Copy className="w-3 h-3" /> {copied ? "تم النسخ" : "نسخ"}
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                  {!isSelf
                    ? "تُبطَل فوراً كل جلسات الحساب المفتوحة، وتُرفع أي محاولات دخول فاشلة، وتُسجَّل العملية في سجل التدقيق."
                    : "تُبطَل فوراً كل جلساتك المفتوحة — بما فيها هذه الجلسة — وستحتاج لتسجيل الدخول من جديد."}
                </p>

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: isPending ? "#6B9E82" : "var(--color-primary)", color: "white", cursor: isPending ? "not-allowed" : "pointer" }}>
                    {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الحفظ...</> : "حفظ كلمة المرور"}
                  </button>
                  <button type="button" onClick={close} disabled={isPending}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-dark)" }}>
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
