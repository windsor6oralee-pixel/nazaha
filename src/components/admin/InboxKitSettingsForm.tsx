"use client";

import { useState, useTransition } from "react";
import { CheckCircle, XCircle, Loader2, Search, Mail, Trash2, ExternalLink, Zap } from "lucide-react";

interface Mailbox {
  uid: string;
  username: string;
  domain_name: string;
  first_name: string;
  last_name: string;
  status: string;
  platform: string;
}

interface ExistingConfig {
  workspaceId: string;
  mailboxEmail: string;
  mailboxUid: string;
}

interface Props {
  existing: ExistingConfig | null;
}

type Status = { type: "success" | "error"; message: string } | null;
type Step = "credentials" | "pick" | "done";

export function InboxKitSettingsForm({ existing }: Props) {
  const [step, setStep] = useState<Step>(existing?.mailboxUid ? "done" : "credentials");
  const [apiKey,      setApiKey]      = useState("");
  const [workspaceId, setWorkspaceId] = useState(existing?.workspaceId ?? "");
  const [fromName,    setFromName]    = useState("نزاهة التوظيف");
  const [mailboxes,   setMailboxes]   = useState<Mailbox[]>([]);
  const [selected,    setSelected]    = useState<Mailbox | null>(null);
  const [status,      setStatus]      = useState<Status>(null);
  const [connected,   setConnected]   = useState(existing);
  const [isFetching,  startFetch]     = useTransition();
  const [isConnecting, startConnect]  = useTransition();
  const [isDeleting,   startDelete]   = useTransition();

  const inputStyle = {
    borderColor: "var(--color-border)",
    background: "var(--color-surface)",
    color: "var(--color-text)",
  } as React.CSSProperties;

  function inputCls(extra = "") {
    return `w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all ${extra}`;
  }
  function onFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = "var(--color-primary)";
    e.target.style.boxShadow = "0 0 0 3px var(--color-primary-muted)";
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = "var(--color-border)";
    e.target.style.boxShadow = "none";
  }

  function handleFetch(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    startFetch(async () => {
      const res = await fetch("/api/admin/inboxkit/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, workspaceId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus({ type: "error", message: json.error ?? "فشل جلب صناديق البريد" });
        return;
      }
      if (!json.mailboxes?.length) {
        setStatus({ type: "error", message: "لا توجد صناديق بريد نشطة في هذا الـ Workspace" });
        return;
      }
      setMailboxes(json.mailboxes);
      setStep("pick");
    });
  }

  function handleConnect() {
    if (!selected) return;
    setStatus(null);
    const mailboxEmail = `${selected.username}@${selected.domain_name}`;
    startConnect(async () => {
      const res = await fetch("/api/admin/inboxkit/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, workspaceId, mailboxUid: selected.uid, mailboxEmail, fromName }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus({ type: "error", message: json.error ?? "فشل الربط" });
        return;
      }
      setConnected({ workspaceId, mailboxEmail, mailboxUid: selected.uid });
      setStep("done");
      setStatus({ type: "success", message: `تم ربط ${mailboxEmail} بنجاح. SMTP جاهز للإرسال ✓` });
    });
  }

  function handleDelete() {
    if (!confirm("هل أنت متأكد من إلغاء ربط InboxKit؟ سيتوقف إرسال البريد الإلكتروني.")) return;
    startDelete(async () => {
      await fetch("/api/admin/inboxkit", { method: "DELETE" });
      await fetch("/api/admin/smtp", { method: "DELETE" });
      setConnected(null);
      setStep("credentials");
      setApiKey("");
      setMailboxes([]);
      setSelected(null);
      setStatus(null);
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

      {/* Connected badge */}
      {connected && (
        <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--color-success-bg)" }}>
              <Zap className="w-4 h-4" style={{ color: "var(--color-success)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>InboxKit مُتصل</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {connected.mailboxEmail} · Google Workspace
              </p>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{ color: "var(--color-error)", borderColor: "rgba(168,58,48,0.3)", background: "var(--color-error-bg)", cursor: "pointer" }}
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            إلغاء الربط
          </button>
        </div>
      )}

      {/* Step 1 — API credentials */}
      {step === "credentials" && (
        <form onSubmit={handleFetch} className="rounded-2xl border p-6 space-y-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: "var(--color-dark)" }}>ربط حساب InboxKit</h2>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              أدخل بيانات API من{" "}
              <a href="https://app.inboxkit.com" target="_blank" rel="noopener noreferrer"
                className="underline inline-flex items-center gap-0.5" style={{ color: "var(--color-primary)" }}>
                لوحة تحكم InboxKit <ExternalLink className="w-3 h-3" />
              </a>
              {" "}← Settings → API &amp; Integrations
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-dark)" }}>
                مفتاح API (API Key) *
              </label>
              <input
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                required
                dir="ltr"
                placeholder="ik_live_••••••••••••••••"
                className={inputCls()}
                style={inputStyle}
                onFocus={onFocus}
                onBlur={onBlur}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-dark)" }}>
                Workspace ID *
              </label>
              <input
                value={workspaceId}
                onChange={e => setWorkspaceId(e.target.value)}
                required
                dir="ltr"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className={inputCls()}
                style={inputStyle}
                onFocus={onFocus}
                onBlur={onBlur}
              />
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                يمكنك إيجاده في رابط صفحة الـ Workspace في InboxKit
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isFetching || !apiKey || !workspaceId}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: (isFetching || !apiKey || !workspaceId) ? "#6B9E82" : "var(--color-primary)",
              color: "white",
              cursor: (isFetching || !apiKey || !workspaceId) ? "not-allowed" : "pointer",
              fontFamily: "'IBM Plex Sans Arabic', sans-serif",
            }}
          >
            {isFetching ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ جلب صناديق البريد...</> : <><Search className="w-4 h-4" /> جلب صناديق البريد</>}
          </button>
        </form>
      )}

      {/* Step 2 — Pick mailbox */}
      {step === "pick" && mailboxes.length > 0 && (
        <div className="rounded-2xl border p-6 space-y-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: "var(--color-dark)" }}>اختر صندوق البريد</h2>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              اختر الصندوق الذي سيُرسَل منه البريد الإلكتروني للمرشحين
            </p>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {mailboxes.map(mb => {
              const email = `${mb.username}@${mb.domain_name}`;
              const isSelected = selected?.uid === mb.uid;
              return (
                <button
                  key={mb.uid}
                  type="button"
                  onClick={() => setSelected(mb)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all"
                  style={{
                    borderColor: isSelected ? "var(--color-primary)" : "var(--color-border)",
                    background:  isSelected ? "var(--color-primary-muted)" : "var(--color-surface-alt)",
                    cursor: "pointer",
                  }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: isSelected ? "var(--color-primary)" : "var(--color-border)" }}>
                    <Mail className="w-4 h-4" style={{ color: isSelected ? "white" : "var(--color-text-muted)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" dir="ltr" style={{ color: "var(--color-dark)" }}>{email}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {mb.first_name} {mb.last_name} · {mb.platform === "GOOGLE" ? "Google Workspace" : "Microsoft 365"}
                    </p>
                  </div>
                  {isSelected && <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-primary)" }} />}
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-dark)" }}>اسم المُرسِل</label>
                <input
                  value={fromName}
                  onChange={e => setFromName(e.target.value)}
                  placeholder="نزاهة التوظيف"
                  className={inputCls()}
                  style={inputStyle}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>

              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: isConnecting ? "#6B9E82" : "var(--color-primary)",
                  color: "white",
                  cursor: isConnecting ? "not-allowed" : "pointer",
                  fontFamily: "'IBM Plex Sans Arabic', sans-serif",
                }}
              >
                {isConnecting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الربط...</>
                  : <><Zap className="w-4 h-4" /> ربط الصندوق وتفعيل الإرسال</>
                }
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => { setStep("credentials"); setMailboxes([]); setSelected(null); }}
            className="text-xs underline"
            style={{ color: "var(--color-text-muted)", cursor: "pointer", background: "none", border: "none" }}
          >
            ← رجوع وتغيير بيانات API
          </button>
        </div>
      )}

      {/* Step done — reconnect option */}
      {step === "done" && (
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            البريد الإلكتروني يُرسَل تلقائياً عبر Google Workspace من خلال InboxKit.
            لتغيير الصندوق، قم بإلغاء الربط أعلاه ثم أعد الاتصال.
          </p>
        </div>
      )}
    </div>
  );
}
