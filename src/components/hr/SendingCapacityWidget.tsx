"use client";

import { useEffect, useState } from "react";
import { Mail, AlertTriangle } from "lucide-react";

interface Response {
  configured: boolean;
  mode: string;
  cap: number;
  used: number;
  totalCap: number;
  remaining: number;
  byDomain: Array<{ domain: string; used: number; cap: number; mailboxes: number }>;
}

const MODE_AR: Record<string, string> = { exclusive: "حصري", overflow: "فيض", shared: "مشترك" };

/**
 * Compact "today's send capacity" card for the HR dashboard. Polls every
 * 60 s so operators planning a batch can see how much headroom they have.
 */
export function SendingCapacityWidget() {
  const [data, setData] = useState<Response | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/hr/sending-usage", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: Response = await res.json();
        if (!cancelled) { setData(json); setErr(null); }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "تعذّر جلب الطاقة");
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (err) return null;  // silently hide — not critical to the dashboard
  if (!data) {
    return (
      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>جارٍ قراءة طاقة الإرسال…</p>
      </div>
    );
  }
  if (!data.configured) {
    return (
      <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-gold)" }} />
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          لم تُربط بعد صناديق بريد لجهتك — تواصل مع مشغّل المنصة لضبط خطة الإرسال.
        </p>
      </div>
    );
  }

  const pct = data.totalCap > 0 ? Math.min(100, Math.round((data.used / data.totalCap) * 100)) : 0;
  const tone = pct >= 90 ? "var(--color-error)" : pct >= 70 ? "var(--color-gold)" : "var(--color-primary)";
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--color-dark)" }}>
          <Mail className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
          طاقة الإرسال اليوم
        </p>
        <span className="text-[11px] px-2 py-0.5 rounded-md"
          style={{ background: "var(--color-primary-muted)", color: "var(--color-primary-dark)" }}>
          {MODE_AR[data.mode] ?? data.mode}
        </span>
      </div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>مستخدم</p>
          <p className="text-xl font-bold" style={{ color: "var(--color-dark)" }}>
            {data.used.toLocaleString("ar-SA-u-nu-latn")} / {data.totalCap.toLocaleString("ar-SA-u-nu-latn")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>متبقٍ</p>
          <p className="text-xl font-bold" style={{ color: tone }}>
            {data.remaining.toLocaleString("ar-SA-u-nu-latn")}
          </p>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: tone }} />
      </div>
      {data.byDomain.length > 0 && (
        <div className="grid gap-1 mt-3 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          {data.byDomain.map((d) => (
            <div key={d.domain} className="flex items-center justify-between">
              <code dir="ltr">{d.domain}</code>
              <span>{d.used} / {d.cap} <span className="opacity-60">({d.mailboxes})</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
