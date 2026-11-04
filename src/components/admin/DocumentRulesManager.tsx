"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, Plus, Trash2, ExternalLink, Save } from "lucide-react";
import type { DocumentRule, DocumentCatalogEntry, DocumentTypeCode } from "@/infrastructure/workflow/document-rules.service";

interface Props {
  initialRules: DocumentRule[];
  catalog: DocumentCatalogEntry[];
}

type Status = { ok: boolean; text: string } | null;

export function DocumentRulesManager({ initialRules, catalog }: Props) {
  const router = useRouter();
  const [rules, setRules] = useState<DocumentRule[]>(initialRules);
  const [status, setStatus] = useState<Status>(null);
  const [busy, start] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Local draft of CTA fields while editing a rule inline.
  const [draft, setDraft] = useState<{ id: string; url: string; label: string; fee: string; amount: string; currency: string; ask: boolean } | null>(null);

  const enabledTypes = new Set(rules.map((r) => r.documentType));
  const available = catalog.filter((c) => !enabledTypes.has(c.documentType));

  function startEditCTA(r: DocumentRule) {
    setExpandedId(r.id);
    setDraft({
      id: r.id,
      url:      r.externalActionUrl    ?? "",
      label:    r.externalActionLabel  ?? "",
      fee:      r.externalFeeLabel     ?? "",
      amount:   r.externalFeeAmount    != null ? String(r.externalFeeAmount) : "",
      currency: r.externalFeeCurrency  ?? "SAR",
      ask:      r.askBeforeUpload,
    });
  }
  function saveCTA() {
    if (!draft) return;
    const rule = rules.find((r) => r.id === draft.id);
    if (!rule) return;
    setStatus(null);
    start(async () => {
      const res = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: rule.documentType,
          externalActionUrl:   draft.url.trim(),
          externalActionLabel: draft.label.trim(),
          externalFeeLabel:    draft.fee.trim(),
          externalFeeAmount:   draft.amount.trim() === "" ? null : Number(draft.amount),
          externalFeeCurrency: draft.currency.trim() || "SAR",
          askBeforeUpload:     draft.ask,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus({ ok: false, text: json?.error ?? "فشل الحفظ" }); return; }
      setRules((prev) => prev.map((r) => r.id === rule.id ? json.rule : r));
      setStatus({ ok: true, text: "حُفظت التفاصيل" });
      setDraft(null);
      setExpandedId(null);
      router.refresh();
    });
  }

  function patch(ruleId: string, updates: Partial<DocumentRule>) {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;
    const next = { ...rule, ...updates };
    setStatus(null);
    start(async () => {
      const res = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: next.documentType,
          nameAr: next.nameAr,
          isRequired: next.isRequired,
          maxFileSizeMb: next.maxFileSizeMb,
          allowedMimeTypes: next.allowedMimeTypes,
          maxFileCount: next.maxFileCount,
          requiresReview: next.requiresReview,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus({ ok: false, text: json?.error ?? "فشل الحفظ" }); return; }
      setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, ...updates } : r));
      router.refresh();
    });
  }

  function addFromCatalog(code: DocumentTypeCode) {
    setPickerOpen(false);
    setStatus(null);
    start(async () => {
      const res = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: code, isRequired: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus({ ok: false, text: json?.error ?? "فشل الإضافة" }); return; }
      setRules((prev) => [...prev, json.rule]);
      setStatus({ ok: true, text: "تمت الإضافة" });
      router.refresh();
    });
  }

  function remove(ruleId: string) {
    if (!confirm("حذف هذا المستند من قائمة الطلبات؟ لن يُحذف من المرشحين السابقين، فقط من الطلبات الجديدة.")) return;
    setStatus(null);
    start(async () => {
      const res = await fetch(`/api/admin/documents/${ruleId}`, { method: "DELETE" });
      if (!res.ok) { setStatus({ ok: false, text: "فشل الحذف" }); return; }
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
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

      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          التعديلات تنعكس على **المرشحين الجدد** فقط. الطلبات القائمة تحتفظ بقائمة مستنداتها كما هي.
        </p>
      </div>

      <div className="space-y-2">
        {rules.length === 0 && (
          <div className="rounded-2xl border p-6 text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>لا توجد مستندات مطلوبة بعد. أضف من "تفعيل مستند جديد".</p>
          </div>
        )}
        {rules.map((r) => (
          <div key={r.id} className="rounded-2xl border p-4"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>{r.nameAr}</p>
                  <code dir="ltr" className="text-[11px] px-1.5 py-0.5 rounded-md"
                    style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>{r.documentType}</code>
                  {r.isRequired
                    ? <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: "var(--color-primary-muted)", color: "var(--color-primary-dark)" }}>مطلوب</span>
                    : <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>اختياري</span>}
                  {r.externalActionUrl && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md"
                      style={{ background: "#FBF6E4", color: "#7A5500" }}>
                      <ExternalLink className="w-3 h-3" /> رابط إصدار
                    </span>
                  )}
                </div>
                <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>
                  حد الحجم: {r.maxFileSizeMb} MB · ملفات مسموحة: {r.maxFileCount} · أنواع: <span dir="ltr">{r.allowedMimeTypes.join(", ")}</span>
                  {r.requiresReview && <> · يحتاج مراجعة HR</>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                <button type="button" onClick={() => (expandedId === r.id ? setExpandedId(null) : startEditCTA(r))}
                  className="text-[11px] px-2 py-1 rounded-md border inline-flex items-center gap-1"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-primary-dark)", cursor: "pointer" }}>
                  <ExternalLink className="w-3 h-3" /> رابط الإصدار
                </button>
                <button type="button" onClick={() => patch(r.id, { isRequired: !r.isRequired })} disabled={busy}
                  className="text-[11px] px-2 py-1 rounded-md border"
                  style={{ borderColor: "var(--color-border)", cursor: "pointer", color: "var(--color-text)" }}>
                  {r.isRequired ? "اجعله اختيارياً" : "اجعله مطلوباً"}
                </button>
                <button type="button" onClick={() => remove(r.id)} disabled={busy}
                  className="text-[11px] px-2 py-1 rounded-md border flex items-center gap-1"
                  style={{ color: "var(--color-error)", borderColor: "rgba(168,58,48,0.3)", cursor: "pointer" }}>
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  حذف
                </button>
              </div>
            </div>

            {expandedId === r.id && draft && draft.id === r.id && (
              <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: "var(--color-border)" }}>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  يظهر للمرشح زر CTA على بطاقة هذه الوثيقة يوجّهه للرابط أدناه مع إلحاق بريده الإلكتروني تلقائياً كـ <code dir="ltr">?email=</code>.
                </p>
                <label className="block">
                  <span className="text-[11px] font-medium" style={{ color: "var(--color-dark)" }}>رابط الإصدار الخارجي (URL)</span>
                  <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                    dir="ltr" placeholder="https://health.example.sa/apply"
                    className="w-full px-3 py-2 mt-1 rounded-xl border text-sm font-mono"
                    style={{ borderColor: "var(--color-border)" }} />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium" style={{ color: "var(--color-dark)" }}>نص الزر</span>
                  <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    placeholder="استخرج الشهادة الصحية"
                    className="w-full px-3 py-2 mt-1 rounded-xl border text-sm"
                    style={{ borderColor: "var(--color-border)" }} />
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-[11px] font-medium" style={{ color: "var(--color-dark)" }}>
                      القيمة المطلوبة <span style={{ color: "var(--color-text-muted)" }}>(تُرسَل للموقع)</span>
                    </span>
                    <input type="number" inputMode="numeric" min={0} value={draft.amount}
                      onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                      placeholder="250"
                      className="w-full px-3 py-2 mt-1 rounded-xl border text-sm font-mono"
                      style={{ borderColor: "var(--color-border)" }} />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium" style={{ color: "var(--color-dark)" }}>العملة</span>
                    <select value={draft.currency}
                      onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
                      className="w-full px-3 py-2 mt-1 rounded-xl border text-sm"
                      style={{ borderColor: "var(--color-border)" }}>
                      <option value="SAR">SAR — ريال سعودي</option>
                      <option value="USD">USD — دولار</option>
                      <option value="AED">AED — درهم إماراتي</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium" style={{ color: "var(--color-dark)" }}>
                      نص عرض بديل <span style={{ color: "var(--color-text-muted)" }}>(اختياري)</span>
                    </span>
                    <input value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: e.target.value })}
                      placeholder={draft.amount ? `${draft.amount} ${draft.currency === "SAR" ? "ريال" : draft.currency}` : "تلقائي"}
                      className="w-full px-3 py-2 mt-1 rounded-xl border text-sm"
                      style={{ borderColor: "var(--color-border)" }} />
                  </label>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft.ask} onChange={(e) => setDraft({ ...draft, ask: e.target.checked })} />
                  <span className="text-xs" style={{ color: "var(--color-dark)" }}>
                    اسأل المرشح قبل الرفع: "هل لديك {r.nameAr} أصلاً؟" — إن أجاب "لا" يُوجَّه مباشرةً لرابط الإصدار
                  </span>
                </label>
                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={() => { setExpandedId(null); setDraft(null); }}
                    className="text-xs px-3 py-1.5 rounded-md border"
                    style={{ borderColor: "var(--color-border)", cursor: "pointer" }}>إلغاء</button>
                  <button type="button" onClick={saveCTA} disabled={busy}
                    className="text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1"
                    style={{ background: "var(--color-primary)", color: "white", cursor: busy ? "not-allowed" : "pointer" }}>
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    حفظ التفاصيل
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>تفعيل مستند جديد</p>
          <button type="button" onClick={() => setPickerOpen((v) => !v)}
            className="text-[11px] px-2 py-1 rounded-md border flex items-center gap-1"
            style={{ borderColor: "var(--color-border)", cursor: "pointer", color: "var(--color-primary-dark)" }}>
            <Plus className="w-3 h-3" /> {pickerOpen ? "إخفاء" : "اختر مستنداً"}
          </button>
        </div>
        {pickerOpen && (
          available.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>كل المستندات المتاحة مُفعَّلة بالفعل.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {available.map((c) => (
                <button key={c.documentType} type="button" onClick={() => addFromCatalog(c.documentType)} disabled={busy}
                  className="text-right p-3 rounded-xl border transition-all"
                  style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)", cursor: busy ? "not-allowed" : "pointer" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>{c.defaultNameAr}</p>
                  <p className="text-[11px] mt-0.5" dir="ltr" style={{ color: "var(--color-text-muted)" }}>{c.documentType}</p>
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
