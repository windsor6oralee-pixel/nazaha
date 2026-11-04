"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, Plus, Trash2, Pencil, Save, X, Variable } from "lucide-react";
import { AVAILABLE_VARIABLES } from "@/infrastructure/directives/variables";

type DirectiveType = "INFO" | "URGENT" | "APPOINTMENT";

interface Template { id: string; title: string; body: string; type: DirectiveType; updatedAt: string }

interface Props { initialTemplates: Template[] }

const TYPE_LABEL: Record<DirectiveType, { ar: string; color: string }> = {
  INFO:        { ar: "معلومة", color: "#013A2B" },
  URGENT:      { ar: "عاجل",   color: "#A83A30" },
  APPOINTMENT: { ar: "موعد",   color: "#C9A94A" },
};

export function DirectiveTemplatesManager({ initialTemplates }: Props) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  const [newTitle, setNewTitle] = useState("");
  const [newBody,  setNewBody]  = useState("");
  const [newType,  setNewType]  = useState<DirectiveType>("INFO");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody,  setEditBody]  = useState("");
  const [editType,  setEditType]  = useState<DirectiveType>("INFO");

  function create() {
    setStatus(null);
    start(async () => {
      const res = await fetch("/api/admin/directive-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, body: newBody, type: newType }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus({ ok: false, text: json?.error ?? "فشل الإنشاء" }); return; }
      setTemplates((prev) => [...prev, json.template].sort((a, b) => a.title.localeCompare(b.title)));
      setNewTitle(""); setNewBody(""); setNewType("INFO");
      setStatus({ ok: true, text: "أُضيف القالب" });
      router.refresh();
    });
  }

  function save(id: string) {
    setStatus(null);
    start(async () => {
      const res = await fetch(`/api/admin/directive-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody, type: editType }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus({ ok: false, text: json?.error ?? "فشل التعديل" }); return; }
      setTemplates((prev) => prev.map((t) => t.id === id ? json.template : t));
      setEditingId(null);
      setStatus({ ok: true, text: "حُفظ التعديل" });
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("حذف القالب؟")) return;
    start(async () => {
      const res = await fetch(`/api/admin/directive-templates/${id}`, { method: "DELETE" });
      if (!res.ok) { setStatus({ ok: false, text: "فشل الحذف" }); return; }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {status && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{
            background: status.ok ? "var(--color-success-bg)" : "var(--color-error-bg)",
            color:      status.ok ? "var(--color-success)"    : "var(--color-error)",
            border: `1px solid ${status.ok ? "rgba(34,122,78,0.25)" : "rgba(168,58,48,0.25)"}`,
          }}>
          {status.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {status.text}
        </div>
      )}

      <div className="space-y-2">
        {templates.length === 0 && (
          <div className="rounded-2xl border p-6 text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>لا توجد قوالب بعد.</p>
          </div>
        )}
        {templates.map((t) => (
          <div key={t.id} className="rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            {editingId === t.id ? (
              <div className="space-y-2">
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-sm font-semibold"
                  style={{ borderColor: "var(--color-border)" }} />
                <div className="flex items-center gap-1">
                  {(["INFO", "URGENT", "APPOINTMENT"] as DirectiveType[]).map((code) => (
                    <button key={code} type="button" onClick={() => setEditType(code)}
                      className="text-[11px] px-2 py-1 rounded-md border"
                      style={{
                        borderColor: editType === code ? TYPE_LABEL[code].color : "var(--color-border)",
                        background:  editType === code ? `${TYPE_LABEL[code].color}1A` : "var(--color-surface-alt)",
                        color: TYPE_LABEL[code].color, cursor: "pointer",
                      }}>{TYPE_LABEL[code].ar}</button>
                  ))}
                </div>
                <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={4}
                  className="w-full px-3 py-2 rounded-xl border text-sm"
                  style={{ borderColor: "var(--color-border)" }} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingId(null)}
                    className="text-xs px-3 py-1.5 rounded-md border inline-flex items-center gap-1"
                    style={{ borderColor: "var(--color-border)", cursor: "pointer" }}>
                    <X className="w-3 h-3" /> إلغاء
                  </button>
                  <button type="button" onClick={() => save(t.id)} disabled={busy}
                    className="text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1"
                    style={{ background: "var(--color-primary)", color: "white", cursor: busy ? "not-allowed" : "pointer" }}>
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} حفظ
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>{t.title}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                      style={{ background: `${TYPE_LABEL[t.type].color}1A`, color: TYPE_LABEL[t.type].color }}>
                      {TYPE_LABEL[t.type].ar}
                    </span>
                  </div>
                  <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "var(--color-text-muted)" }}>{t.body}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button type="button" onClick={() => { setEditingId(t.id); setEditTitle(t.title); setEditBody(t.body); setEditType(t.type); }}
                    className="text-[11px] px-2 py-1 rounded-md border inline-flex items-center gap-1"
                    style={{ borderColor: "var(--color-border)", cursor: "pointer", color: "var(--color-text)" }}>
                    <Pencil className="w-3 h-3" /> تعديل
                  </button>
                  <button type="button" onClick={() => remove(t.id)} disabled={busy}
                    className="text-[11px] px-2 py-1 rounded-md border inline-flex items-center gap-1"
                    style={{ color: "var(--color-error)", borderColor: "rgba(168,58,48,0.3)", cursor: "pointer" }}>
                    <Trash2 className="w-3 h-3" /> حذف
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
        <p className="text-xs font-semibold flex items-center gap-1 mb-2" style={{ color: "var(--color-primary-dark)" }}>
          <Variable className="w-3.5 h-3.5" /> متغيّرات متاحة (انسخها والصقها داخل النص)
        </p>
        <div className="flex flex-wrap gap-1">
          {AVAILABLE_VARIABLES.map((v) => (
            <code key={v.key} dir="ltr" title={v.labelAr}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded border cursor-text"
              onClick={(e) => { try { navigator.clipboard.writeText(`{{${v.key}}}`); } catch { void e; } }}
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)" }}>
              {`{{${v.key}}}`}
            </code>
          ))}
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: "var(--color-text-muted)" }}>
          تُستبدَل تلقائياً باسم المرشح وبيانات الجهة عند تطبيق القالب على ملف مرشح.
        </p>
      </div>

      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-dark)" }}>قالب جديد</p>
        <div className="space-y-2">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="العنوان (مثل: مرحباً {{candidate.firstName}} — تذكير)"
            className="w-full px-3 py-2 rounded-xl border text-sm"
            style={{ borderColor: "var(--color-border)" }} />
          <div className="flex items-center gap-1">
            {(["INFO", "URGENT", "APPOINTMENT"] as DirectiveType[]).map((code) => (
              <button key={code} type="button" onClick={() => setNewType(code)}
                className="text-[11px] px-2 py-1 rounded-md border"
                style={{
                  borderColor: newType === code ? TYPE_LABEL[code].color : "var(--color-border)",
                  background:  newType === code ? `${TYPE_LABEL[code].color}1A` : "var(--color-surface-alt)",
                  color: TYPE_LABEL[code].color, cursor: "pointer",
                }}>{TYPE_LABEL[code].ar}</button>
            ))}
          </div>
          <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="نص الرسالة" rows={3}
            className="w-full px-3 py-2 rounded-xl border text-sm"
            style={{ borderColor: "var(--color-border)" }} />
          <div className="flex justify-end">
            <button type="button" onClick={create} disabled={busy || !newTitle.trim() || !newBody.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: busy ? "#6B9E82" : "var(--color-primary)", color: "white", cursor: busy ? "not-allowed" : "pointer" }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} إضافة قالب
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
