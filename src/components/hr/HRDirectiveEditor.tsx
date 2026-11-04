"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle, Save, Trash2, Loader2, XCircle, MessageSquarePlus, Info, AlertTriangle, CalendarClock, History } from "lucide-react";
import type { DirectiveContext } from "@/infrastructure/directives/variables";

type DirectiveType = "INFO" | "URGENT" | "APPOINTMENT";

interface Directive {
  id: string;
  type: DirectiveType;
  title: string;
  body: string;
  allowReply: boolean;
  notifyByEmail: boolean;
  candidateReply: string | null;
  candidateReadAt: string | null;
  candidateRepliedAt: string | null;
  createdByName: string;
  updatedAt: string;
}

interface Template { id: string; title: string; body: string; type: DirectiveType }

interface Props { applicationId: string }

const TYPES: { code: DirectiveType; label: string; color: string; Icon: typeof Info }[] = [
  { code: "INFO",        label: "معلومة",        color: "#013A2B", Icon: Info },
  { code: "URGENT",      label: "عاجل",          color: "#A83A30", Icon: AlertTriangle },
  { code: "APPOINTMENT", label: "موعد / تذكير",   color: "#C9A94A", Icon: CalendarClock },
];

interface HistoryEntry {
  id: string; type: DirectiveType; title: string; body: string;
  candidateReply: string | null; candidateReadAt: string | null; candidateRepliedAt: string | null;
  createdAt: string; archivedAt: string; createdByName: string;
}

function renderVariables(text: string, ctx: DirectiveContext | null): string {
  if (!ctx || !text) return text;
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, path: string) => {
    const parts = path.split(".");
    let cur: unknown = ctx;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else return match;
    }
    return typeof cur === "string" || typeof cur === "number" ? String(cur) : match;
  });
}

export function HRDirectiveEditor({ applicationId }: Props) {
  const [directive, setDirective] = useState<Directive | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [varContext, setVarContext] = useState<DirectiveContext | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [type, setType] = useState<DirectiveType>("INFO");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [allowReply, setAllowReply] = useState(false);
  const [notifyByEmail, setNotifyByEmail] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    (async () => {
      const [d, t, c, h] = await Promise.all([
        fetch(`/api/hr/applications/${applicationId}/directive`).then((r) => r.json()).catch(() => ({ directive: null })),
        fetch(`/api/admin/directive-templates`).then((r) => r.ok ? r.json() : { templates: [] }).catch(() => ({ templates: [] })),
        fetch(`/api/hr/applications/${applicationId}/directive-context`).then((r) => r.ok ? r.json() : { context: null }).catch(() => ({ context: null })),
        fetch(`/api/hr/applications/${applicationId}/directive/history`).then((r) => r.ok ? r.json() : { history: [] }).catch(() => ({ history: [] })),
      ]);
      setDirective(d.directive);
      setType(d.directive?.type ?? "INFO");
      setTitle(d.directive?.title ?? "");
      setBody(d.directive?.body ?? "");
      setAllowReply(!!d.directive?.allowReply);
      setNotifyByEmail(!!d.directive?.notifyByEmail);
      setTemplates(t.templates ?? []);
      setVarContext(c.context ?? null);
      setHistory(h.history ?? []);
    })();
  }, [applicationId]);

  function applyTemplate(tpl: Template) {
    // Resolve `{{candidate.firstName}}` and friends against this candidate.
    setTitle(renderVariables(tpl.title, varContext));
    setBody(renderVariables(tpl.body, varContext));
    setType(tpl.type);
    setStatus(null);
  }

  async function reloadHistory() {
    const h = await fetch(`/api/hr/applications/${applicationId}/directive/history`).then((r) => r.json()).catch(() => ({ history: [] }));
    setHistory(h.history ?? []);
  }

  function save() {
    setStatus(null);
    start(async () => {
      const res = await fetch(`/api/hr/applications/${applicationId}/directive`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, body, allowReply, notifyByEmail }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus({ ok: false, text: json?.error ?? "فشل الحفظ" }); return; }
      setDirective(json.directive);
      setStatus({ ok: true, text: notifyByEmail ? "حُفظ وأُرسل بريد للمرشح" : "حُفظ — سيراه المرشح فوراً" });
      void reloadHistory();
    });
  }

  function clear() {
    if (!confirm("حذف التوجيه الحالي؟")) return;
    setStatus(null);
    start(async () => {
      const res = await fetch(`/api/hr/applications/${applicationId}/directive`, { method: "DELETE" });
      if (!res.ok) { setStatus({ ok: false, text: "فشل الحذف" }); return; }
      setDirective(null);
      setTitle(""); setBody(""); setType("INFO"); setAllowReply(false); setNotifyByEmail(false);
      setStatus({ ok: true, text: "تم حذف التوجيه" });
      void reloadHistory();
    });
  }

  const typeToneLabel: Record<DirectiveType, { ar: string; color: string }> = {
    INFO:        { ar: "معلومة", color: "#013A2B" },
    URGENT:      { ar: "عاجل",   color: "#A83A30" },
    APPOINTMENT: { ar: "موعد",   color: "#C9A94A" },
  };

  const activeTone = TYPES.find((t) => t.code === type)!;

  return (
    <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--color-dark)" }}>
            <MessageSquarePlus className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
            بطاقة التوجيه
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            رسالة ثابتة أعلى شاشة المرشح — تبقى حتى تُغيّرها.
          </p>
        </div>
        {directive && (
          <div className="text-[11px] text-left" style={{ color: "var(--color-text-muted)" }}>
            {directive.candidateReadAt
              ? <>قرأها المرشح {new Date(directive.candidateReadAt).toLocaleDateString("ar-SA-u-nu-latn")}</>
              : <>لم تُقرأ بعد</>}
          </div>
        )}
      </div>

      {status && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{
            background: status.ok ? "var(--color-success-bg)" : "var(--color-error-bg)",
            color:      status.ok ? "var(--color-success)"    : "var(--color-error)",
            border: `1px solid ${status.ok ? "rgba(34,122,78,0.25)" : "rgba(168,58,48,0.25)"}`,
          }}>
          {status.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {status.text}
        </div>
      )}

      <div>
        <p className="text-xs font-medium mb-2" style={{ color: "var(--color-dark)" }}>نوع التوجيه</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map(({ code, label, color, Icon }) => {
            const active = type === code;
            return (
              <button key={code} type="button" onClick={() => setType(code)}
                className="inline-flex items-center gap-2 p-2.5 rounded-xl border transition-all"
                style={{
                  borderColor: active ? color : "var(--color-border)",
                  background:  active ? `${color}1A` : "var(--color-surface-alt)",
                  cursor: "pointer",
                }}>
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-sm" style={{ color: active ? color : "var(--color-dark)", fontWeight: active ? 700 : 500 }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {templates.length > 0 && (
        <div>
          <p className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>اختر من القوالب الجاهزة:</p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((tpl) => {
              const tone = TYPES.find((x) => x.code === tpl.type)!;
              return (
                <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}
                  className="text-[11px] px-2 py-1 rounded-md border inline-flex items-center gap-1"
                  style={{ borderColor: "var(--color-border)", cursor: "pointer", color: tone.color }}>
                  <tone.Icon className="w-3 h-3" />
                  {tpl.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="block">
        <span className="text-xs font-medium" style={{ color: "var(--color-dark)" }}>العنوان</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
          className="w-full px-3 py-2 mt-1 rounded-xl border text-sm"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }} />
      </label>

      <label className="block">
        <span className="text-xs font-medium" style={{ color: "var(--color-dark)" }}>النص</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={4000}
          className="w-full px-3 py-2 mt-1 rounded-xl border text-sm"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }} />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={allowReply} onChange={(e) => setAllowReply(e.target.checked)} />
          <span className="text-xs" style={{ color: "var(--color-dark)" }}>السماح للمرشح بالرد</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={notifyByEmail} onChange={(e) => setNotifyByEmail(e.target.checked)} />
          <span className="text-xs" style={{ color: "var(--color-dark)" }}>إرسال بريد تنبيه للمرشح الآن</span>
        </label>
      </div>

      {directive?.candidateReply && (
        <div className="rounded-xl p-3" style={{ background: "var(--color-primary-muted)", border: "1px solid rgba(25,92,48,0.25)" }}>
          <p className="text-[11px] mb-1" style={{ color: "var(--color-primary-dark)" }}>
            رد المرشح {directive.candidateRepliedAt && <>· {new Date(directive.candidateRepliedAt).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" })}</>}
          </p>
          <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-dark)" }}>{directive.candidateReply}</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
          <button type="button" onClick={() => setShowHistory((v) => !v)}
            className="w-full text-right px-4 py-2 text-xs font-semibold flex items-center justify-between"
            style={{ color: "var(--color-primary-dark)", cursor: "pointer" }}>
            <span className="inline-flex items-center gap-2">
              <History className="w-3.5 h-3.5" /> أرشيف التوجيهات ({history.length})
            </span>
            <span style={{ color: "var(--color-text-muted)" }}>{showHistory ? "إخفاء" : "عرض"}</span>
          </button>
          {showHistory && (
            <div className="px-4 pb-3 space-y-2 max-h-80 overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="rounded-lg border p-2.5"
                  style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                        style={{ background: `${typeToneLabel[h.type].color}1A`, color: typeToneLabel[h.type].color }}>
                        {typeToneLabel[h.type].ar}
                      </span>
                      <p className="text-xs font-semibold" style={{ color: "var(--color-dark)" }}>{h.title}</p>
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                      {new Date(h.archivedAt).toLocaleDateString("ar-SA-u-nu-latn")}
                    </span>
                  </div>
                  <p className="text-xs mt-1.5 whitespace-pre-wrap" style={{ color: "var(--color-text-muted)" }}>{h.body}</p>
                  {h.candidateReply && (
                    <div className="mt-2 rounded-md p-2 text-[11px]"
                      style={{ background: "var(--color-primary-muted)", color: "var(--color-dark)" }}>
                      <b>رد المرشح:</b> {h.candidateReply}
                    </div>
                  )}
                  <p className="text-[10px] mt-1" style={{ color: "var(--color-text-muted)" }}>
                    بواسطة {h.createdByName}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
        {directive && (
          <button type="button" onClick={clear} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border"
            style={{ color: "var(--color-error)", borderColor: "rgba(168,58,48,0.3)", cursor: busy ? "not-allowed" : "pointer" }}>
            <Trash2 className="w-3.5 h-3.5" /> حذف التوجيه
          </button>
        )}
        <button type="button" onClick={save} disabled={busy || !title.trim() || !body.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: busy ? "#6B9E82" : activeTone.color, color: "white", cursor: busy ? "not-allowed" : "pointer" }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ وتفعيل
        </button>
      </div>
    </div>
  );
}
