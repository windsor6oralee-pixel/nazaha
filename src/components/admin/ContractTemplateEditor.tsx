"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Eye, Code2, CheckCircle, XCircle, Loader2, History } from "lucide-react";

export interface TemplateRow {
  id: string;
  type: string;
  nameAr: string;
  version: number;
  isActive: boolean;
  updatedAt: string;
  bodyHtml: string;
}

interface Props {
  templates: TemplateRow[];
  placeholders: readonly { key: string; labelAr: string; group: "candidate" | "org" | "contract" | "custom" }[];
}

const GROUP_LABELS: Record<Props["placeholders"][number]["group"], string> = {
  candidate: "المرشح", org: "الجهة", contract: "العقد", custom: "حقول الجهة المخصصة",
};

const TYPE_LABELS: Record<string, string> = {
  EMPLOYMENT_CONTRACT:       "عقد العمل",
  CONFIDENTIALITY_AGREEMENT: "اتفاقية السرية",
  IT_POLICY_ACKNOWLEDGEMENT: "إقرار سياسة تقنية المعلومات",
  CONFLICT_OF_INTEREST:      "إقرار تضارب المصالح",
  CUSTOM:                    "عقد مخصص",
};
const ALL_TYPES = Object.keys(TYPE_LABELS);

type Status = { type: "success" | "error"; message: string } | null;

export function ContractTemplateEditor({ templates, placeholders }: Props) {
  const router = useRouter();
  const activeByType = useMemo(() => {
    const map = new Map<string, TemplateRow>();
    for (const t of templates) if (t.isActive && !map.has(t.type)) map.set(t.type, t);
    return map;
  }, [templates]);

  const [type, setType] = useState<string>(activeByType.has("EMPLOYMENT_CONTRACT") ? "EMPLOYMENT_CONTRACT" : ALL_TYPES[0]);
  const current = activeByType.get(type) ?? null;
  const [nameAr, setNameAr] = useState(current?.nameAr ?? TYPE_LABELS[type]);
  const [bodyHtml, setBodyHtml] = useState(current?.bodyHtml ?? "");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [isSaving, startSave] = useTransition();
  const [isPreviewing, startPreview] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = current ? current.nameAr !== nameAr || current.bodyHtml !== bodyHtml : bodyHtml.trim().length > 0;
  const versions = templates.filter((t) => t.type === type);

  function switchType(next: string) {
    if (dirty && !confirm("لديك تغييرات غير محفوظة. هل تريد التبديل دون حفظ؟")) return;
    const t = activeByType.get(next) ?? null;
    setType(next);
    setNameAr(t?.nameAr ?? TYPE_LABELS[next]);
    setBodyHtml(t?.bodyHtml ?? "");
    setPreviewHtml(null);
    setMode("edit");
    setStatus(null);
  }

  function insertPlaceholder(key: string) {
    const el = textareaRef.current;
    const token = `{{${key}}}`;
    if (!el) { setBodyHtml((b) => b + token); return; }
    const start = el.selectionStart ?? bodyHtml.length;
    const end = el.selectionEnd ?? start;
    const next = bodyHtml.slice(0, start) + token + bodyHtml.slice(end);
    setBodyHtml(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
  }

  function handlePreview() {
    setStatus(null);
    startPreview(async () => {
      const res = await fetch("/api/admin/contract-templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, nameAr, bodyHtml }),
      });
      const json = await res.json();
      if (!res.ok) { setStatus({ type: "error", message: json.error ?? "فشلت المعاينة" }); return; }
      setPreviewHtml(json.html);
      setMode("preview");
    });
  }

  function handleSave() {
    setStatus(null);
    startSave(async () => {
      const res = await fetch("/api/admin/contract-templates", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, nameAr, bodyHtml }),
      });
      const json = await res.json();
      if (!res.ok) { setStatus({ type: "error", message: json.error ?? "فشل الحفظ" }); return; }
      setStatus({ type: "success", message: `تم حفظ الإصدار ${json.template.version} وتفعيله — العقود السابقة تحتفظ بنسختها` });
      router.refresh();
    });
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    background: active ? "var(--color-primary)" : "transparent",
    color: active ? "white" : "var(--color-text-muted)",
    cursor: "pointer",
    fontFamily: "'IBM Plex Sans Arabic', sans-serif",
  });

  return (
    <div className="space-y-5" dir="rtl">
      {/* Type selector */}
      <div className="flex gap-2 flex-wrap">
        {ALL_TYPES.map((t) => {
          const has = activeByType.has(t);
          const active = t === type;
          return (
            <button key={t} type="button" onClick={() => switchType(t)}
              className="px-3.5 py-2 rounded-xl text-sm font-medium border transition-all"
              style={{
                borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                background: active ? "var(--color-primary-muted)" : "white",
                color: active ? "var(--color-primary-dark)" : "var(--color-text-muted)",
                cursor: "pointer", minHeight: 40,
              }}>
              {TYPE_LABELS[t]}
              {has && <span className="mr-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>v{activeByType.get(t)!.version}</span>}
            </button>
          );
        })}
      </div>

      {status && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{
          background: status.type === "success" ? "var(--color-success-bg)" : "var(--color-error-bg)",
          color: status.type === "success" ? "var(--color-success)" : "var(--color-error)",
          border: `1px solid ${status.type === "success" ? "rgba(34,122,78,0.25)" : "rgba(168,58,48,0.25)"}`,
        }}>
          {status.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
          {status.message}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_260px] gap-5">
        {/* Editor */}
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b flex-wrap" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
            <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="اسم العقد"
              className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border text-sm font-semibold outline-none"
              style={{ borderColor: "var(--color-border)", background: "white", color: "var(--color-dark)" }} />
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
              <button type="button" onClick={() => setMode("edit")} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium" style={tabBtn(mode === "edit")}>
                <Code2 className="w-3.5 h-3.5" /> تحرير
              </button>
              <button type="button" onClick={handlePreview} disabled={isPreviewing} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium" style={tabBtn(mode === "preview")}>
                {isPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} معاينة
              </button>
            </div>
          </div>

          {mode === "edit" ? (
            <textarea ref={textareaRef} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} spellCheck={false} dir="rtl"
              className="w-full p-4 outline-none resize-y font-mono text-[13px] leading-relaxed"
              style={{ minHeight: 520, color: "var(--color-dark)", background: "white" }}
              placeholder="اكتب نص العقد بصيغة HTML مبسّطة، وأدرج المتغيرات من القائمة الجانبية…" />
          ) : (
            <div className="p-6 overflow-auto" style={{ minHeight: 520, background: "var(--color-beige)" }}>
              <div className="bg-white rounded-xl border p-6 max-w-2xl mx-auto" style={{ borderColor: "var(--color-border)" }}>
                <div className="contract-body" dangerouslySetInnerHTML={{ __html: previewHtml ?? "" }} />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border p-4" style={{ borderColor: "var(--color-border)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-dark)" }}>المتغيرات المتاحة</p>
            <p className="text-[11px] mb-3" style={{ color: "var(--color-text-muted)" }}>اضغط لإدراج المتغير عند المؤشر. تُستبدل تلقائياً ببيانات المرشح والجهة عند توليد العقد.</p>
            <div className="space-y-3">
              {(["candidate", "org", "contract", "custom"] as const).map((g) => {
                const items = placeholders.filter((p) => p.group === g);
                if (!items.length && g !== "custom") return null;
                return (
                  <div key={g}>
                    <p className="text-[10px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: g === "custom" ? "var(--color-gold)" : "var(--color-text-muted)" }}>
                      {GROUP_LABELS[g]}
                    </p>
                    {items.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((p) => (
                          <button key={p.key} type="button" onClick={() => insertPlaceholder(p.key)} title={`{{${p.key}}}`}
                            className="text-[11px] px-2 py-1 rounded-md border transition-colors"
                            style={{
                              borderColor: g === "custom" ? "rgba(201,169,74,0.4)" : "var(--color-border)",
                              background: g === "custom" ? "var(--color-gold-muted)" : "var(--color-surface-alt)",
                              color: "var(--color-primary-dark)", cursor: "pointer",
                            }}>
                            {p.labelAr}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                        لا توجد حقول مخصصة — أضفها من <a href="/admin/candidate-fields" className="underline">إعدادات الحقول</a>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {versions.length > 0 && (
            <div className="bg-white rounded-2xl border p-4" style={{ borderColor: "var(--color-border)" }}>
              <p className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: "var(--color-dark)" }}>
                <History className="w-3.5 h-3.5" /> الإصدارات
              </p>
              <ul className="space-y-1.5">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                    <span>v{v.version} · {new Date(v.updatedAt).toLocaleDateString("ar-SA")}</span>
                    {v.isActive && <span className="px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>نشط</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button type="button" onClick={handleSave} disabled={isSaving || !dirty || !nameAr.trim() || !bodyHtml.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: isSaving || !dirty ? "var(--color-border)" : "var(--color-primary)",
              color: isSaving || !dirty ? "var(--color-text-muted)" : "white",
              cursor: isSaving || !dirty ? "not-allowed" : "pointer",
              fontFamily: "'IBM Plex Sans Arabic', sans-serif", minHeight: 48,
            }}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {current ? `حفظ كإصدار ${current.version + 1}` : "حفظ القالب"}
          </button>
          <p className="text-[11px] text-center" style={{ color: "var(--color-text-muted)" }}>
            الحفظ ينشئ إصداراً جديداً ولا يعدّل العقود المُولَّدة سابقاً.
          </p>
        </div>
      </div>
    </div>
  );
}
