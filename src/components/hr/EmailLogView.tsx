"use client";

import { useEffect, useState } from "react";
import { Mail, Search, Loader2, RefreshCcw } from "lucide-react";

type Status = "QUEUED" | "SENT" | "FAILED" | "BOUNCED" | "DELIVERED" | "UNKNOWN";

interface Row {
  id: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  status: Status;
  provider: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  bodyPreview: string | null;
  sentAt: string | null;
  firstOpenedAt: string | null;
  openCount: number;
  firstClickedAt: string | null;
  clickCount: number;
  createdAt: string;
}

interface Summary { total: number; QUEUED: number; SENT: number; FAILED: number; BOUNCED: number; DELIVERED: number; UNKNOWN: number }

const TONE: Record<Status, { label: string; color: string }> = {
  QUEUED:    { label: "قيد الإرسال", color: "#C9A94A" },
  SENT:      { label: "مُرسَل",       color: "#013A2B" },
  DELIVERED: { label: "تم التسليم",   color: "#227A4E" },
  FAILED:    { label: "فشل",          color: "#A83A30" },
  BOUNCED:   { label: "ارتدَّ",       color: "#A83A30" },
  UNKNOWN:   { label: "غير معروف",    color: "#6E7673" },
};

export function EmailLogView() {
  const [rows, setRows]       = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cursor, setCursor]   = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch]   = useState("");
  const [status, setStatus]   = useState<"" | Status>("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState<string | null>(null);

  async function load(reset = false) {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (!reset && cursor) params.set("cursor", cursor);
    try {
      const r = await fetch(`/api/hr/emails?${params.toString()}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setRows(reset ? j.rows : [...rows, ...j.rows]);
      setNextCursor(j.nextCursor ?? null);
      if (reset) setSummary(j.summary);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(true); setCursor(null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function applyFilters() { setCursor(null); setRows([]); void load(true); }
  function loadMore() { if (nextCursor) { setCursor(nextCursor); void load(false); } }

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {(["total","SENT","QUEUED","DELIVERED","FAILED","BOUNCED"] as const).map((k) => {
            const label = k === "total" ? "الإجمالي" : TONE[k as Status].label;
            const value = (summary as unknown as Record<string, number>)[k] ?? 0;
            const color = k === "total" ? "var(--color-primary)" : TONE[k as Status].color;
            return (
              <div key={k} className="rounded-2xl border p-3" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{label}</p>
                <p className="text-xl font-bold font-numeric" style={{ color }}>{value}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border p-3 flex flex-wrap items-center gap-2"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="بحث: الموضوع أو البريد المستلم"
            className="w-full pr-9 pl-3 py-2 rounded-xl border text-sm"
            style={{ borderColor: "var(--color-border)" }} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status | "")}
          className="px-3 py-2 rounded-xl border text-sm"
          style={{ borderColor: "var(--color-border)" }}>
          <option value="">كل الحالات</option>
          {(["SENT","QUEUED","DELIVERED","FAILED","BOUNCED","UNKNOWN"] as Status[]).map((s) => (
            <option key={s} value={s}>{TONE[s].label}</option>
          ))}
        </select>
        <button type="button" onClick={applyFilters}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "var(--color-primary)", color: "white", cursor: "pointer" }}>
          <RefreshCcw className="w-3.5 h-3.5" /> تطبيق
        </button>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && !loading && (
          <div className="rounded-2xl border p-10 text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <Mail className="w-5 h-5 mx-auto mb-1.5" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>لا توجد رسائل مطابقة</p>
          </div>
        )}
        {rows.map((r) => {
          const t = TONE[r.status];
          return (
            <div key={r.id} className="rounded-2xl border" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
              <button type="button" onClick={() => setOpen((v) => v === r.id ? null : r.id)}
                className="w-full text-right p-3" style={{ cursor: "pointer" }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--color-dark)" }}>{r.subject}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                      style={{ background: `${t.color}1A`, color: t.color }}>{t.label}</span>
                    {r.firstOpenedAt && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
                        style={{ background: "#E6F0E9", color: "#227A4E" }}
                        title="فتح البريد — قد يكون تلقائياً من عميل البريد">
                        👁 فُتح {r.openCount > 1 ? `×${r.openCount}` : ""}
                      </span>
                    )}
                    {r.firstClickedAt && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
                        style={{ background: "#013A2B", color: "#E8D27A" }}
                        title="ضغط رابطاً داخل البريد — إجراء مؤكَّد">
                        🖱 ضُغط {r.clickCount > 1 ? `×${r.clickCount}` : ""}
                      </span>
                    )}
                    <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                      {new Date(r.createdAt).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>
                  إلى <span dir="ltr">{r.toAddress}</span> · من <span dir="ltr">{r.fromAddress}</span>
                </p>
              </button>
              {open === r.id && (
                <div className="px-3 pb-3 text-xs space-y-2" style={{ color: "var(--color-dark)" }}>
                  {r.errorMessage && (
                    <div className="rounded p-2" style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>{r.errorMessage}</div>
                  )}
                  {r.bodyPreview && <p className="whitespace-pre-wrap" style={{ color: "var(--color-text-muted)" }}>{r.bodyPreview}</p>}
                  {r.providerMessageId && (
                    <p className="text-[10px] font-mono" dir="ltr" style={{ color: "var(--color-text-muted)" }}>
                      msg-id: {r.providerMessageId}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <button type="button" onClick={loadMore} disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs border"
            style={{ borderColor: "var(--color-border)", cursor: loading ? "not-allowed" : "pointer", color: "var(--color-text)" }}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />} تحميل المزيد
          </button>
        </div>
      )}
    </div>
  );
}
