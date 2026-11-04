"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Star, Save, X as XIcon, Variable } from "lucide-react";
import { AVAILABLE_VARIABLES } from "@/infrastructure/directives/variables";

type Kind = "INVITATION" | "ALERT" | "HEALTH_CERT" | "GENERIC";

interface Row {
  id: string;
  kind: Kind;
  nameAr: string;
  subjectAr: string;
  bodyAr: string;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: string;
}

const KIND_META: Record<Kind, { ar: string; color: string }> = {
  INVITATION:  { ar: "دعوة قبول وظيفي",      color: "#013A2B" },
  ALERT:       { ar: "تنبيه",                 color: "#A83A30" },
  HEALTH_CERT: { ar: "شهادة صحية",            color: "#2E7D5B" },
  GENERIC:     { ar: "رسالة حرّة",            color: "#6B6B6B" },
};

const KINDS: Kind[] = ["INVITATION", "ALERT", "HEALTH_CERT", "GENERIC"];

function emptyRow(kind: Kind): Row {
  return { id: "", kind, nameAr: "", subjectAr: "", bodyAr: "", isDefault: false, isActive: true, updatedAt: "" };
}

export function EmailTemplatesManager({ initial }: { initial: Row[] }) {
  const [rows, setRows]     = useState<Row[]>(initial);
  const [activeKind, setActiveKind] = useState<Kind>("INVITATION");
  const [draft, setDraft]   = useState<Row | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start]       = useTransition();

  const filtered = useMemo(() => rows.filter((r) => r.kind === activeKind && r.isActive), [rows, activeKind]);

  function startNew() {
    setDraft(emptyRow(activeKind));
    setStatus(null);
  }
  function startEdit(r: Row) {
    setDraft({ ...r });
    setStatus(null);
  }
  function cancel() { setDraft(null); setStatus(null); }

  function save() {
    if (!draft) return;
    if (!draft.nameAr.trim() || !draft.subjectAr.trim() || !draft.bodyAr.trim()) {
      setStatus({ ok: false, text: "الاسم والعنوان والنص مطلوبة" });
      return;
    }
    start(async () => {
      const url    = draft.id ? `/api/admin/email-templates/${draft.id}` : "/api/admin/email-templates";
      const method = draft.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: draft.kind, nameAr: draft.nameAr, subjectAr: draft.subjectAr,
          bodyAr: draft.bodyAr, isDefault: draft.isDefault, isActive: draft.isActive,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus({ ok: false, text: json?.error ?? "فشل الحفظ" }); return; }

      const saved: Row = json.template;
      setRows((prev) => {
        // When isDefault flips on, everyone else in the same kind must flip off locally too.
        const next = saved.isDefault
          ? prev.map((r) => r.kind === saved.kind ? { ...r, isDefault: false } : r)
          : prev.slice();
        const idx  = next.findIndex((r) => r.id === saved.id);
        if (idx >= 0) next[idx] = saved; else next.push(saved);
        return next;
      });
      setStatus({ ok: true, text: "تم الحفظ" });
      setDraft(null);
    });
  }

  function removeRow(r: Row) {
    if (!confirm(`حذف القالب "${r.nameAr}"؟`)) return;
    start(async () => {
      const res = await fetch(`/api/admin/email-templates/${r.id}`, { method: "DELETE" });
      if (!res.ok) { setStatus({ ok: false, text: "فشل الحذف" }); return; }
      setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, isActive: false, isDefault: false } : x));
      setStatus({ ok: true, text: "تم الحذف" });
    });
  }

  function makeDefault(r: Row) {
    start(async () => {
      const res = await fetch(`/api/admin/email-templates/${r.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) { setStatus({ ok: false, text: "فشل تعيين الافتراضي" }); return; }
      setRows((prev) => prev.map((x) => x.kind === r.kind ? { ...x, isDefault: x.id === r.id } : x));
      setStatus({ ok: true, text: "تم تعيين الافتراضي" });
    });
  }

  return (
    <div className="space-y-5">
      {/* Kind tabs */}
      <div role="tablist" aria-label="نوع القالب" className="flex flex-wrap gap-2">
        {KINDS.map((k) => {
          const active = activeKind === k;
          const count  = rows.filter((r) => r.kind === k && r.isActive).length;
          return (
            <button key={k} type="button" role="tab" aria-selected={active}
              onClick={() => { setActiveKind(k); setDraft(null); setStatus(null); }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold"
              style={{
                borderColor: active ? KIND_META[k].color : "var(--color-border)",
                background:  active ? `${KIND_META[k].color}1A` : "var(--color-surface)",
                color:       active ? KIND_META[k].color : "var(--color-text)",
                cursor: "pointer",
              }}>
              {KIND_META[k].ar}
              <span className="text-[10px] font-semibold opacity-75">{count}</span>
            </button>
          );
        })}
      </div>

      {status && (
        <div className="px-3 py-2 rounded-xl text-sm"
          style={{
            background: status.ok ? "var(--color-success-bg)" : "var(--color-error-bg)",
            color:      status.ok ? "var(--color-success)"    : "var(--color-error)",
            border: `1px solid ${status.ok ? "rgba(34,122,78,0.25)" : "rgba(168,58,48,0.25)"}`,
          }}>
          {status.text}
        </div>
      )}

      {/* List */}
      {!draft && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>
              {filtered.length} قالب في «{KIND_META[activeKind].ar}»
            </p>
            <button type="button" onClick={startNew}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--color-primary)", color: "white", cursor: "pointer" }}>
              <Plus className="w-4 h-4" /> قالب جديد
            </button>
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-xl border p-6 text-center text-sm"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>
              لا قوالب بعد — أنشئ أولها.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
              {filtered.map((r) => (
                <li key={r.id} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>{r.nameAr}</p>
                      {r.isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
                          style={{ background: "var(--color-primary-muted)", color: "var(--color-primary-dark)" }}>
                          <Star className="w-3 h-3" /> افتراضي
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                      عنوان البريد: <span style={{ color: "var(--color-dark)" }}>{r.subjectAr}</span>
                    </p>
                    <p className="text-xs mt-1 line-clamp-2 whitespace-pre-wrap" style={{ color: "var(--color-text-muted)" }}>
                      {r.bodyAr.slice(0, 160)}{r.bodyAr.length > 160 ? "…" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!r.isDefault && (
                      <button type="button" onClick={() => makeDefault(r)} title="تعيين كافتراضي" disabled={busy}
                        className="p-2 rounded-md border" style={{ borderColor: "var(--color-border)", cursor: busy ? "wait" : "pointer" }}>
                        <Star className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
                      </button>
                    )}
                    <button type="button" onClick={() => startEdit(r)}
                      className="px-3 py-1.5 text-xs rounded-md border font-semibold"
                      style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)", cursor: "pointer" }}>
                      تعديل
                    </button>
                    <button type="button" onClick={() => removeRow(r)} disabled={busy} title="حذف"
                      className="p-2 rounded-md border" style={{ borderColor: "rgba(168,58,48,0.3)", cursor: busy ? "wait" : "pointer" }}>
                      <Trash2 className="w-4 h-4" style={{ color: "var(--color-error)" }} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Editor */}
      {draft && (
        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>
              {draft.id ? "تعديل قالب" : "قالب جديد"} — {KIND_META[draft.kind].ar}
            </p>
            <button type="button" onClick={cancel} aria-label="إلغاء"
              className="p-2 rounded-md hover:bg-[var(--color-surface-alt)]" style={{ cursor: "pointer" }}>
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>اسم القالب (يظهر لك في قائمة الاختيار)</span>
            <input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}
              className="px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "var(--color-border)" }}
              placeholder="مثل: دعوة قبول — نسخة رسمية" maxLength={200} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>عنوان البريد (Subject)</span>
            <input value={draft.subjectAr} onChange={(e) => setDraft({ ...draft, subjectAr: e.target.value })}
              className="px-3 py-2 rounded-xl border text-sm" style={{ borderColor: "var(--color-border)" }}
              placeholder="مرحباً {{candidate.firstName}} — بيانات دخولك" maxLength={300} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>نص الرسالة (يُدعم المتغيّرات)</span>
            <textarea value={draft.bodyAr} onChange={(e) => setDraft({ ...draft, bodyAr: e.target.value })}
              rows={10} maxLength={8000}
              className="px-3 py-2 rounded-xl border text-sm font-mono" style={{ borderColor: "var(--color-border)" }}
              placeholder="عزيزي/عزيزتي {{candidate.firstName}}..." />
          </label>

          <details className="rounded-md border p-2 text-[11px]" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
            <summary className="cursor-pointer inline-flex items-center gap-1" style={{ color: "var(--color-primary-dark)" }}>
              <Variable className="w-3 h-3" /> المتغيّرات المتاحة
            </summary>
            <div className="flex flex-wrap gap-1 mt-2">
              {AVAILABLE_VARIABLES.map((v) => (
                <code key={v.key} dir="ltr" title={v.labelAr}
                  className="font-mono px-1.5 py-0.5 rounded border cursor-pointer"
                  onClick={() => setDraft({ ...draft, bodyAr: draft.bodyAr + `{{${v.key}}}` })}
                  style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
                  {`{{${v.key}}}`}
                </code>
              ))}
            </div>
            <p className="mt-2" style={{ color: "var(--color-text-muted)" }}>اضغط أي متغيّر لإلحاقه بنهاية النص.</p>
          </details>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--color-dark)" }}>
              <input type="checkbox" checked={draft.isDefault}
                onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })} />
              تعيين كافتراضي لهذا النوع (يستخدم تلقائياً عند الإرسال)
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button type="button" onClick={save} disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: busy ? "#6B9E82" : "var(--color-primary)", color: "white", cursor: busy ? "wait" : "pointer" }}>
              <Save className="w-4 h-4" /> {busy ? "جارٍ الحفظ…" : "حفظ"}
            </button>
            <button type="button" onClick={cancel}
              className="px-4 py-2 rounded-xl text-sm font-semibold border"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text)", cursor: "pointer" }}>
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
