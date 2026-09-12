"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, Check, X, Loader2, Eye, EyeOff, Asterisk, ArrowUp, ArrowDown, ListChecks } from "lucide-react";
import type { FieldDefinition } from "@/infrastructure/custom-fields/field.service";

interface Props {
  fields: FieldDefinition[];
}

type FieldType = FieldDefinition["type"];
const TYPES: { value: FieldType; label: string; hint: string }[] = [
  { value: "TEXT",    label: "نص",           hint: "حتى 500 حرف" },
  { value: "NUMBER",  label: "رقم",          hint: "قيمة عددية" },
  { value: "DATE",    label: "تاريخ",        hint: "يوم / شهر / سنة" },
  { value: "SELECT",  label: "قائمة اختيار", hint: "خيار واحد من قائمة" },
  { value: "BOOLEAN", label: "نعم / لا",     hint: "قيمة ثنائية" },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label])) as Record<FieldType, string>;

type Status = { type: "success" | "error"; message: string } | null;

const inputCls = "w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all";
const inputStyle: React.CSSProperties = { borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)" };
function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = "var(--color-gold)"; e.target.style.boxShadow = "0 0 0 3px var(--color-gold-muted)";
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = "var(--color-border)"; e.target.style.boxShadow = "none";
}

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[0-9]/, "f$&").slice(0, 40);
}

function Toggle({ on, onClick, label, iconOn: IconOn, iconOff: IconOff }: {
  on: boolean; onClick: () => void; label: string; iconOn: React.ElementType; iconOff: React.ElementType;
}) {
  const Icon = on ? IconOn : IconOff;
  return (
    <button type="button" onClick={onClick} title={label}
      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors"
      style={{
        borderColor: on ? "var(--color-primary)" : "var(--color-border)",
        background: on ? "var(--color-primary-muted)" : "white",
        color: on ? "var(--color-primary-dark)" : "var(--color-text-muted)", cursor: "pointer",
      }}>
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}

export function CandidateFieldsManager({ fields }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(null);
  const [isBusy, start] = useTransition();

  // New-field draft
  const [adding, setAdding] = useState(false);
  const [labelAr, setLabelAr] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [type, setType] = useState<FieldType>("TEXT");
  const [optionsText, setOptionsText] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [showToCandidate, setShowToCandidate] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editOptions, setEditOptions] = useState("");

  function resetDraft() {
    setAdding(false); setLabelAr(""); setKey(""); setKeyTouched(false); setType("TEXT");
    setOptionsText(""); setIsRequired(false); setShowToCandidate(false);
  }

  async function call(url: string, init: RequestInit, okMsg: string) {
    setStatus(null);
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setStatus({ type: "error", message: json.error ?? "حدث خطأ" }); return false; }
    setStatus({ type: "success", message: okMsg });
    router.refresh();
    return true;
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const ok = await call("/api/admin/candidate-fields", {
        method: "POST",
        body: JSON.stringify({
          labelAr, key, type, isRequired, showToCandidate,
          options: type === "SELECT" ? optionsText.split("\n").map((s) => s.trim()).filter(Boolean) : [],
        }),
      }, `أُضيف الحقل "${labelAr}" — متاح الآن في نموذج المرشح والقوالب كـ {{custom.${key}}}`);
      if (ok) resetDraft();
    });
  }

  function patch(id: string, data: Record<string, unknown>, msg: string) {
    start(async () => { await call(`/api/admin/candidate-fields/${id}`, { method: "PATCH", body: JSON.stringify(data) }, msg); });
  }

  function handleDelete(f: FieldDefinition) {
    if (!confirm(`حذف الحقل "${f.labelAr}"؟ ستُحذف قيمه من جميع المرشحين، وأي قالب يستخدم {{custom.${f.key}}} سيرفض الحفظ حتى تعديله.`)) return;
    start(async () => { await call(`/api/admin/candidate-fields/${f.id}`, { method: "DELETE" }, "تم حذف الحقل"); });
  }

  function move(idx: number, dir: -1 | 1) {
    const other = fields[idx + dir];
    if (!other) return;
    const a = fields[idx];
    start(async () => {
      await fetch(`/api/admin/candidate-fields/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: other.order }) });
      await fetch(`/api/admin/candidate-fields/${other.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: a.order }) });
      router.refresh();
    });
  }

  function startEdit(f: FieldDefinition) {
    setEditingId(f.id); setEditLabel(f.labelAr); setEditOptions(f.options.join("\n"));
  }
  function saveEdit(f: FieldDefinition) {
    const data: Record<string, unknown> = { labelAr: editLabel };
    if (f.type === "SELECT") data.options = editOptions.split("\n").map((s) => s.trim()).filter(Boolean);
    start(async () => {
      const ok = await call(`/api/admin/candidate-fields/${f.id}`, { method: "PATCH", body: JSON.stringify(data) }, "تم تحديث الحقل");
      if (ok) setEditingId(null);
    });
  }

  return (
    <div className="space-y-5" dir="rtl">
      {status && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{
          background: status.type === "success" ? "var(--color-success-bg)" : "var(--color-error-bg)",
          color: status.type === "success" ? "var(--color-success)" : "var(--color-error)",
          border: `1px solid ${status.type === "success" ? "rgba(34,122,78,0.25)" : "rgba(168,58,48,0.25)"}`,
        }}>
          {status.type === "success" ? <Check className="w-4 h-4 flex-shrink-0" /> : <X className="w-4 h-4 flex-shrink-0" />}
          <span className="font-mono-inline">{status.message}</span>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
        {fields.length === 0 ? (
          <div className="p-10 text-center">
            <ListChecks className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--color-dark)" }}>لا توجد حقول مخصصة بعد</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>أضف حقولاً مثل "الرقم الوظيفي" أو "الفرع" لتظهر في نموذج المرشح والعقود</p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {fields.map((f, idx) => {
              const editing = editingId === f.id;
              return (
                <li key={f.id} className="p-4 flex items-start gap-3">
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0 || isBusy} className="p-0.5 disabled:opacity-25" style={{ color: "var(--color-text-muted)", cursor: "pointer" }} aria-label="أعلى"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => move(idx, 1)} disabled={idx === fields.length - 1 || isBusy} className="p-0.5 disabled:opacity-25" style={{ color: "var(--color-text-muted)", cursor: "pointer" }} aria-label="أسفل"><ArrowDown className="w-3.5 h-3.5" /></button>
                  </div>

                  <div className="flex-1 min-w-0">
                    {editing ? (
                      <div className="space-y-2">
                        <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                        {f.type === "SELECT" && (
                          <textarea value={editOptions} onChange={(e) => setEditOptions(e.target.value)} rows={3} placeholder="خيار في كل سطر"
                            className={inputCls} style={inputStyle} />
                        )}
                        <div className="flex gap-2">
                          <button type="button" onClick={() => saveEdit(f)} disabled={isBusy} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--color-primary)", color: "white", cursor: "pointer" }}><Check className="w-3 h-3" /> حفظ</button>
                          <button type="button" onClick={() => setEditingId(null)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", cursor: "pointer" }}><X className="w-3 h-3" /> إلغاء</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>{f.labelAr}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>{TYPE_LABEL[f.type]}</span>
                          {f.isRequired && <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>مطلوب</span>}
                          {f.showToCandidate && <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-gold-muted)", color: "var(--color-primary-dark)" }}>يراه المرشح</span>}
                        </div>
                        <p dir="ltr" className="text-[11px] font-mono mt-1 text-right" style={{ color: "var(--color-text-muted)" }}>{`{{custom.${f.key}}}`}</p>
                        {f.type === "SELECT" && <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>{f.options.join(" · ")}</p>}
                      </>
                    )}
                  </div>

                  {!editing && (
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <Toggle on={f.isRequired} onClick={() => patch(f.id, { isRequired: !f.isRequired }, "تم التحديث")} label="مطلوب" iconOn={Asterisk} iconOff={Asterisk} />
                      <Toggle on={f.showToCandidate} onClick={() => patch(f.id, { showToCandidate: !f.showToCandidate }, "تم التحديث")} label="للمرشح" iconOn={Eye} iconOff={EyeOff} />
                      <button type="button" onClick={() => startEdit(f)} className="p-1.5 rounded-md" style={{ color: "var(--color-primary)", cursor: "pointer" }} aria-label="تعديل"><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => handleDelete(f)} className="p-1.5 rounded-md" style={{ color: "var(--color-error)", cursor: "pointer" }} aria-label="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add form */}
      {adding ? (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--color-primary)" }}>
          <h3 className="font-bold text-sm" style={{ color: "var(--color-dark)" }}>حقل جديد</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-dark)" }}>اسم الحقل (بالعربية) *</label>
              <input value={labelAr} onChange={(e) => { setLabelAr(e.target.value); if (!keyTouched) setKey(slugify(e.target.value)); }} required autoFocus placeholder="الرقم الوظيفي"
                className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-dark)" }}>المفتاح التقني (للقوالب) *</label>
              <input value={key} onChange={(e) => { setKey(e.target.value); setKeyTouched(true); }} required dir="ltr" placeholder="employee_number" pattern="^[a-z][a-z0-9_]{1,39}$"
                className={`${inputCls} font-mono`} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>أحرف إنجليزية صغيرة وأرقام و _ — لا يمكن تغييره لاحقاً</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-dark)" }}>النوع *</label>
              <select value={type} onChange={(e) => setType(e.target.value as FieldType)} className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label} — {t.hint}</option>)}
              </select>
              <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>لا يمكن تغيير النوع بعد الإنشاء حفاظاً على القيم المخزّنة</p>
            </div>
            {type === "SELECT" && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-dark)" }}>الخيارات (خيار في كل سطر) *</label>
                <textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={4} required placeholder={"الرياض\nجدة\nالدمام"} className={inputCls} style={inputStyle} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Toggle on={isRequired} onClick={() => setIsRequired(!isRequired)} label="مطلوب عند الإضافة" iconOn={Asterisk} iconOff={Asterisk} />
            <Toggle on={showToCandidate} onClick={() => setShowToCandidate(!showToCandidate)} label="يظهر للمرشح في ملفه" iconOn={Eye} iconOff={EyeOff} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isBusy} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--color-primary)", color: "white", cursor: "pointer", minHeight: 44 }}>
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} إضافة الحقل
            </button>
            <button type="button" onClick={resetDraft} className="px-4 py-2.5 rounded-xl text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", cursor: "pointer" }}>إلغاء</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 border-dashed transition-colors"
          style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)", background: "var(--color-primary-muted)", cursor: "pointer", minHeight: 48 }}>
          <Plus className="w-4 h-4" /> إضافة حقل مخصص
        </button>
      )}
    </div>
  );
}
