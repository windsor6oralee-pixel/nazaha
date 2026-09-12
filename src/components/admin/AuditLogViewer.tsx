"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Filter, Loader2, RotateCcw, Search, ShieldCheck, User, UserCheck, Cpu } from "lucide-react";
import type { AuditEntry, AuditPage } from "@/infrastructure/audit/audit.service";

interface Props {
  initial: AuditPage;
  query: Record<string, string>;
  options: { actions: string[]; resources: string[]; users: { id: string; nameAr: string }[] };
  actionLabels: Record<string, string>;
  resourceLabels: Record<string, string>;
}

const ACTOR_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  USER:      { label: "موظف",  icon: User,      color: "var(--color-primary)" },
  CANDIDATE: { label: "مرشح",  icon: UserCheck, color: "var(--color-gold)" },
  SYSTEM:    { label: "النظام", icon: Cpu,       color: "var(--color-text-muted)" },
};

const inputCls = "w-full px-3 py-2 rounded-xl border text-xs outline-none";
const inputStyle: React.CSSProperties = { borderColor: "var(--color-border)", background: "white", color: "var(--color-text)" };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}
function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "نعم" : "لا";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// Visual diff for the `metadata.changes = { field: { from, to } }` convention.
function ChangesDiff({ changes }: { changes: Record<string, { from: unknown; to: unknown }> }) {
  return (
    <div className="space-y-1.5">
      {Object.entries(changes).map(([field, c]) => (
        <div key={field} className="grid grid-cols-[110px_1fr] gap-2 items-start text-xs">
          <span className="font-mono text-[11px] pt-1" dir="ltr" style={{ color: "var(--color-text-muted)" }}>{field}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 line-through decoration-red-400 break-all">{show(c.from)}</span>
            <span aria-hidden style={{ color: "var(--color-text-muted)" }}>←</span>
            <span className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 break-all">{show(c.to)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Metadata({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== "object") return <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>لا توجد تفاصيل إضافية</p>;
  const { changes, ...rest } = metadata as Record<string, unknown>;
  const hasChanges = !!changes && typeof changes === "object" && Object.keys(changes as object).length > 0;
  const restEntries = Object.entries(rest).filter(([, v]) => v !== null && v !== undefined);
  return (
    <div className="space-y-3">
      {hasChanges && (
        <div>
          <p className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--color-dark)" }}>التغييرات</p>
          <ChangesDiff changes={changes as Record<string, { from: unknown; to: unknown }>} />
        </div>
      )}
      {restEntries.length > 0 && (
        <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1 text-xs">
          {restEntries.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-[11px]" dir="ltr" style={{ color: "var(--color-text-muted)" }}>{k}</dt>
              <dd className="break-all" style={{ color: "var(--color-dark)" }}>{show(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {!hasChanges && restEntries.length === 0 && <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>لا توجد تفاصيل إضافية</p>}
    </div>
  );
}

export function AuditLogViewer({ initial, query, options, actionLabels, resourceLabels }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>(initial.entries);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    action: query.action ?? "", actorType: query.actorType ?? "", userId: query.userId ?? "",
    resource: query.resource ?? "", resourceId: query.resourceId ?? "", from: query.from ?? "", to: query.to ?? "",
  });
  const [isLoading, start] = useTransition();
  const activeFilters = Object.values(form).filter(Boolean).length;

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) if (v) sp.set(k, v);
    router.push(`/admin/audit${sp.size ? `?${sp}` : ""}`);
  }
  function reset() {
    setForm({ action: "", actorType: "", userId: "", resource: "", resourceId: "", from: "", to: "" });
    router.push("/admin/audit");
  }
  function loadMore() {
    if (!nextCursor) return;
    start(async () => {
      const sp = new URLSearchParams(query);
      sp.set("cursor", nextCursor);
      const res = await fetch(`/api/admin/audit?${sp}`);
      if (!res.ok) return;
      const page: AuditPage = await res.json();
      setEntries((prev) => [...prev, ...page.entries]);
      setNextCursor(page.nextCursor);
    });
  }
  function toggle(id: string) {
    setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4" dir="rtl">
      {/* Filters */}
      <form onSubmit={apply} className="bg-white rounded-2xl border p-4" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5" style={{ color: "var(--color-primary)" }} />
          <p className="text-xs font-semibold" style={{ color: "var(--color-dark)" }}>تصفية مركّبة</p>
          {activeFilters > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-primary-muted)", color: "var(--color-primary-dark)" }}>{activeFilters} فلتر</span>}
        </div>
        <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          <select value={form.action} onChange={set("action")} className={inputCls} style={inputStyle}>
            <option value="">كل الأفعال</option>
            {options.actions.map((a) => <option key={a} value={a}>{actionLabels[a] ?? a}</option>)}
          </select>
          <select value={form.actorType} onChange={set("actorType")} className={inputCls} style={inputStyle}>
            <option value="">كل الفاعلين</option>
            <option value="USER">موظف</option><option value="CANDIDATE">مرشح</option><option value="SYSTEM">النظام</option>
          </select>
          <select value={form.userId} onChange={set("userId")} className={inputCls} style={inputStyle}>
            <option value="">أي موظف</option>
            {options.users.map((u) => <option key={u.id} value={u.id}>{u.nameAr}</option>)}
          </select>
          <select value={form.resource} onChange={set("resource")} className={inputCls} style={inputStyle}>
            <option value="">كل الموارد</option>
            {options.resources.map((r) => <option key={r} value={r}>{resourceLabels[r] ?? r}</option>)}
          </select>
          <input value={form.resourceId} onChange={set("resourceId")} placeholder="معرّف المورد (اختياري)" dir="ltr" className={`${inputCls} font-mono`} style={inputStyle} />
          <input type="date" value={form.from} onChange={set("from")} dir="ltr" className={inputCls} style={inputStyle} aria-label="من تاريخ" />
          <input type="date" value={form.to} onChange={set("to")} dir="ltr" className={inputCls} style={inputStyle} aria-label="إلى تاريخ" />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold" style={{ background: "var(--color-primary)", color: "white", cursor: "pointer" }}>
              <Search className="w-3.5 h-3.5" /> تطبيق
            </button>
            <button type="button" onClick={reset} className="px-3 py-2 rounded-xl border text-xs" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)", cursor: "pointer" }} aria-label="إعادة ضبط">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b text-[11px]" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>
          <span>{entries.length} سجل معروض{nextCursor ? " — يوجد المزيد" : ""}</span>
          <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" style={{ color: "var(--color-success)" }} /> سجل للقراءة فقط — لا يُعدَّل ولا يُحذف</span>
        </div>

        {entries.length === 0 ? (
          <p className="p-10 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>لا توجد سجلات مطابقة</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {entries.map((e) => {
              const meta = ACTOR_META[e.actorType] ?? ACTOR_META.SYSTEM;
              const Icon = meta.icon;
              const isOpen = open.has(e.id);
              const hasChanges = !!(e.metadata && typeof e.metadata === "object" && "changes" in (e.metadata as object));
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => toggle(e.id)} className="w-full text-right px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-surface-alt)]" style={{ cursor: "pointer" }}>
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--color-surface-alt)" }}>
                      <Icon className="w-4 h-4" style={{ color: meta.color }} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>{actionLabels[e.action] ?? e.action}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>{resourceLabels[e.resource] ?? e.resource}</span>
                        {hasChanges && <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--color-gold-muted)", color: "var(--color-primary-dark)" }}>تغييرات</span>}
                      </span>
                      <span className="block text-[11px] mt-0.5 truncate" style={{ color: "var(--color-text-muted)" }}>
                        {meta.label}{e.actorName ? `: ${e.actorName}` : ""}
                        {e.candidateName && e.actorType !== "CANDIDATE" ? ` · المرشح: ${e.candidateName}` : ""}
                      </span>
                    </span>
                    <span className="text-[11px] tabular-nums flex-shrink-0" style={{ color: "var(--color-text-muted)" }}>{fmt(e.createdAt)}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pr-[60px] space-y-3">
                      <Metadata metadata={e.metadata} />
                      <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                        {e.resourceId && <div className="contents"><dt>المورد</dt><dd className="font-mono break-all" dir="ltr">{e.resourceId}</dd></div>}
                        {e.applicationId && <div className="contents"><dt>الطلب</dt><dd className="font-mono break-all" dir="ltr">{e.applicationId}</dd></div>}
                        {e.ipAddress && <div className="contents"><dt>IP</dt><dd className="font-mono" dir="ltr">{e.ipAddress}</dd></div>}
                        <div className="contents"><dt>معرّف السجل</dt><dd className="font-mono break-all" dir="ltr">{e.id}</dd></div>
                      </dl>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {nextCursor && (
          <div className="p-3 border-t" style={{ borderColor: "var(--color-border)" }}>
            <button type="button" onClick={loadMore} disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border"
              style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)", background: "var(--color-primary-muted)", cursor: "pointer" }}>
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} تحميل المزيد
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
