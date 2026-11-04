"use client";

import { useEffect, useState } from "react";
import { Mail, Check, X, Clock, AlertTriangle } from "lucide-react";

interface Row {
  id: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  status: "QUEUED" | "SENT" | "FAILED" | "BOUNCED" | "DELIVERED" | "UNKNOWN";
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

const TONE: Record<Row["status"], { label: string; color: string; Icon: typeof Mail }> = {
  QUEUED:    { label: "قيد الإرسال", color: "#C9A94A", Icon: Clock },
  SENT:      { label: "مُرسَل",       color: "#013A2B", Icon: Check },
  DELIVERED: { label: "تم التسليم",   color: "#227A4E", Icon: Check },
  FAILED:    { label: "فشل",          color: "#A83A30", Icon: X },
  BOUNCED:   { label: "ارتدَّ",       color: "#A83A30", Icon: AlertTriangle },
  UNKNOWN:   { label: "غير معروف",    color: "#6E7673", Icon: Mail },
};

export function CandidateEmailLog({ candidateId }: { candidateId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/hr/candidates/${candidateId}/emails`, { cache: "no-store" });
        if (!r.ok) { setRows([]); return; }
        const j = await r.json();
        setRows(j.rows ?? []);
      } catch { setRows([]); }
    })();
  }, [candidateId]);

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <p className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: "var(--color-dark)" }}>
        <Mail className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
        سجل البريد الإلكتروني
      </p>

      {rows === null && <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>جارٍ التحميل…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>لا توجد رسائل مرسلة لهذا المرشح بعد.</p>
      )}

      <div className="space-y-2">
        {rows?.map((r) => {
          const t = TONE[r.status];
          const Icon = t.Icon;
          return (
            <div key={r.id} className="rounded-xl border" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
              <button type="button" onClick={() => setOpen((v) => v === r.id ? null : r.id)}
                className="w-full text-right p-3"
                style={{ cursor: "pointer" }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.color }} />
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--color-dark)" }}>{r.subject}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                      style={{ background: `${t.color}1A`, color: t.color }}>{t.label}</span>
                    {r.firstOpenedAt && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
                        style={{ background: "#E6F0E9", color: "#227A4E" }}
                        title="فتح البريد (قد يكون تلقائياً من عميل البريد — غير مؤكد)">
                        👁 فُتح {r.openCount > 1 ? `×${r.openCount}` : ""}
                      </span>
                    )}
                    {r.firstClickedAt && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
                        style={{ background: "#013A2B", color: "#E8D27A" }}
                        title="ضغط رابطاً داخل البريد — إجراء مؤكَّد من المستخدم">
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
                  {r.firstOpenedAt && (
                    <> · أول فتح: {new Date(r.firstOpenedAt).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" })}</>
                  )}
                </p>
              </button>
              {open === r.id && (
                <div className="px-3 pb-3 pt-0 text-xs space-y-2" style={{ color: "var(--color-dark)" }}>
                  {r.errorMessage && (
                    <div className="rounded p-2" style={{ background: "var(--color-error-bg)", color: "var(--color-error)" }}>
                      {r.errorMessage}
                    </div>
                  )}
                  {r.bodyPreview && (
                    <p className="whitespace-pre-wrap" style={{ color: "var(--color-text-muted)" }}>{r.bodyPreview}</p>
                  )}
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
    </div>
  );
}
