"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle, Save, Loader2, XCircle, Zap, RefreshCw } from "lucide-react";
import type { SendingMode, SendingPolicy } from "@/infrastructure/notifications/sending-policy.service";

interface CapacitySummary {
  cap: number;
  used: number;
  totalCap: number;
  remaining: number;
  byDomain: Array<{ domain: string; used: number; cap: number; mailboxes: number }>;
}

interface Props {
  organizationId: string;
  organizationName: string;
  initial: SendingPolicy;
  availableDomains: string[];
  hasPool: boolean;
  poolSize: number;
  todaySummary: CapacitySummary | null;
}

type Zone = "primary" | "overflow" | "excluded" | "unused";

const MODE_LABEL: Record<SendingMode, { ar: string; hint: string }> = {
  exclusive: { ar: "حصري", hint: "يرسل فقط من الدومينات الأساسية — تجاهل الاحتياطي" },
  overflow:  { ar: "فيض",  hint: "يبدأ من الأساسي، ويستعين بالاحتياطي عند تجاوز العتبة" },
  shared:    { ar: "مشترك", hint: "يستخدم كل الدومينات بالتناوب (أساسي + احتياطي)" },
};

export function SendingPolicyEditor({
  organizationId,
  organizationName,
  initial,
  availableDomains,
  hasPool,
  poolSize,
  todaySummary,
}: Props) {
  const [mode, setMode] = useState<SendingMode>(initial.mode);
  const [dailyCap, setDailyCap] = useState<number>(initial.dailyCapPerMailbox);
  const [threshold, setThreshold] = useState<number>(initial.overflowThresholdPercent);
  const [zones, setZones] = useState<Map<string, Zone>>(() => {
    const m = new Map<string, Zone>();
    for (const d of availableDomains) {
      if (initial.excluded.includes(d)) m.set(d, "excluded");
      else if (initial.primary.includes(d)) m.set(d, "primary");
      else if (initial.overflow.includes(d)) m.set(d, "overflow");
      else m.set(d, "unused");
    }
    return m;
  });
  const [saving, saveStart] = useTransition();
  const [refreshing, refreshStart] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const current = useMemo<SendingPolicy>(() => ({
    mode,
    dailyCapPerMailbox: dailyCap,
    overflowThresholdPercent: threshold,
    primary:  [...zones.entries()].filter(([, z]) => z === "primary").map(([d]) => d),
    overflow: [...zones.entries()].filter(([, z]) => z === "overflow").map(([d]) => d),
    excluded: [...zones.entries()].filter(([, z]) => z === "excluded").map(([d]) => d),
  }), [mode, dailyCap, threshold, zones]);

  function setZone(domain: string, zone: Zone) {
    setZones((prev) => { const n = new Map(prev); n.set(domain, zone); return n; });
    setStatus(null);
  }

  function handleSave() {
    setStatus(null);
    saveStart(async () => {
      const res = await fetch(`/api/platform/organizations/${organizationId}/sending`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus({ ok: false, text: json?.error ?? "فشل حفظ الخطة" }); return; }
      setStatus({ ok: true, text: "تم حفظ خطة الإرسال بنجاح" });
    });
  }

  function handleRefresh() {
    if (!confirm("سيُعاد سحب كل الصناديق من InboxKit وتُستبدل القائمة المحفوظة. متابعة؟")) return;
    setStatus(null);
    refreshStart(async () => {
      const res = await fetch(`/api/platform/organizations/${organizationId}/sending/refresh`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus({ ok: false, text: json?.error ?? "فشل تحديث الصناديق" }); return; }
      setStatus({ ok: true, text: `تم تحديث القائمة — ${json.mailboxes} صندوق في ${json.domains.length} دومين. أعد تحميل الصفحة لرؤية الدومينات الجديدة.` });
    });
  }

  if (!hasPool) {
    return <BootstrapForm organizationId={organizationId} organizationName={organizationName} />;
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

      {todaySummary && (
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>الاستخدام اليوم (UTC)</p>
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {todaySummary.used} / {todaySummary.totalCap} ({todaySummary.totalCap ? Math.round((todaySummary.used / todaySummary.totalCap) * 100) : 0}%)
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
            <div style={{
              width: `${todaySummary.totalCap ? Math.min(100, (todaySummary.used / todaySummary.totalCap) * 100) : 0}%`,
              height: "100%", background: "var(--color-primary)",
            }} />
          </div>
          <div className="grid gap-1 mt-3 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            {todaySummary.byDomain.map((d) => (
              <div key={d.domain} className="flex items-center justify-between">
                <code dir="ltr">{d.domain}</code>
                <span>{d.used} / {d.cap} <span className="opacity-60">({d.mailboxes} صندوق)</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-dark)" }}>وضع التشغيل</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["exclusive", "overflow", "shared"] as SendingMode[]).map((m) => {
            const active = mode === m;
            return (
              <button key={m} type="button" onClick={() => { setMode(m); setStatus(null); }}
                className="text-right p-3 rounded-xl border transition-all"
                style={{
                  borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                  background:  active ? "var(--color-primary-muted)" : "var(--color-surface-alt)",
                  cursor: "pointer",
                }}>
                <p className="text-sm font-bold" style={{ color: "var(--color-dark)" }}>{MODE_LABEL[m].ar}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{MODE_LABEL[m].hint}</p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mt-5">
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--color-dark)" }}>السقف اليومي لكل صندوق</span>
            <div className="flex items-center gap-3 mt-2">
              <input type="range" min={50} max={1000} step={10} value={dailyCap}
                onChange={(e) => { setDailyCap(Number(e.target.value)); setStatus(null); }}
                className="flex-1" />
              <span className="font-mono text-sm" style={{ color: "var(--color-primary-dark)" }}>{dailyCap}</span>
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--color-dark)" }}>عتبة تفعيل الاحتياطي (overflow)</span>
            <div className="flex items-center gap-3 mt-2">
              <input type="range" min={0} max={100} step={5} value={threshold}
                onChange={(e) => { setThreshold(Number(e.target.value)); setStatus(null); }}
                className="flex-1" disabled={mode !== "overflow"} />
              <span className="font-mono text-sm" style={{ color: "var(--color-primary-dark)" }}>{threshold}%</span>
            </div>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>
            الدومينات المتاحة لـ {organizationName}
          </p>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <span>{availableDomains.length} دومين · {poolSize} صندوق</span>
            <button type="button" onClick={handleRefresh} disabled={refreshing}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border"
              style={{ borderColor: "var(--color-border)", cursor: refreshing ? "not-allowed" : "pointer" }}>
              {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              تحديث من InboxKit
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {availableDomains.map((d) => {
            const z = zones.get(d) ?? "unused";
            return (
              <div key={d} className="flex items-center justify-between gap-3 p-3 rounded-xl border"
                style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
                <code dir="ltr" className="text-sm font-mono" style={{ color: "var(--color-dark)" }}>{d}</code>
                <div className="flex items-center gap-1">
                  {(["primary", "overflow", "unused", "excluded"] as Zone[]).map((option) => {
                    const active = z === option;
                    const label = option === "primary" ? "أساسي" : option === "overflow" ? "احتياطي" : option === "excluded" ? "مستبعد" : "غير مستخدم";
                    return (
                      <button key={option} type="button" onClick={() => setZone(d, option)}
                        className="text-[11px] px-2.5 py-1 rounded-md border transition-colors"
                        style={{
                          borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                          background:  active ? "var(--color-primary)" : "var(--color-surface)",
                          color:       active ? "white" : "var(--color-text-muted)",
                          cursor: "pointer",
                        }}>{label}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border p-4 text-xs" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>
        <p>الخلاصة الحالية:</p>
        <p className="mt-1" style={{ color: "var(--color-dark)" }}>
          وضع <b>{MODE_LABEL[mode].ar}</b> · سقف يومي <b>{dailyCap}</b> لكل صندوق
          {mode === "overflow" && <> · عتبة الاحتياطي <b>{threshold}%</b></>}
          · أساسي <b>{current.primary.length}</b> / احتياطي <b>{current.overflow.length}</b> / مستبعد <b>{current.excluded.length}</b>
        </p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: saving ? "#6B9E82" : "var(--color-primary)", color: "white", cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ خطة الإرسال
        </button>
      </div>
    </div>
  );
}

/**
 * First-time setup card shown when the org has no mailbox pool yet.
 * Lets the super admin paste the InboxKit API key + workspace id, with an
 * optional domain-exclusion field for the platform's own domain(s). On save
 * it provisions the pool and the surrounding page reloads to show the editor.
 */
function BootstrapForm({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const [apiKey, setApiKey] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [excludeDomains, setExcludeDomains] = useState("anticorruptiongov.com");
  const [fromName, setFromName] = useState("نزاهة التوظيف");
  const [busy, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    start(async () => {
      const res = await fetch(`/api/platform/organizations/${organizationId}/sending/bootstrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, workspaceId, excludeDomains, fromName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus({ ok: false, text: json?.error ?? "فشل الربط" }); return; }
      setStatus({ ok: true, text: `تم ربط ${json.mailboxes} صندوق من ${json.domains?.length ?? 0} دومين. أعد تحميل الصفحة لرؤية المحرّر.` });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-dark)" }}>الربط الأوّل لـ {organizationName}</p>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          أدخل بيانات InboxKit لهذه الجهة. سيُسحب كل صندوق نشط (Google + Microsoft) تلقائياً.
        </p>

        {status && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4"
            style={{
              background: status.ok ? "var(--color-success-bg)" : "var(--color-error-bg)",
              color:      status.ok ? "var(--color-success)"    : "var(--color-error)",
              border: `1px solid ${status.ok ? "rgba(34,122,78,0.25)" : "rgba(168,58,48,0.25)"}`,
            }}>
            {status.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {status.text}
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--color-dark)" }}>API Key *</span>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} required dir="ltr"
              placeholder="ik_live_••••••••••••••••"
              className="w-full px-3 py-2 mt-1 rounded-xl border text-sm font-mono"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--color-dark)" }}>Workspace ID *</span>
            <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} required dir="ltr"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-3 py-2 mt-1 rounded-xl border text-sm font-mono"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--color-dark)" }}>دومينات تُستثنى من الـ pool (مفصولة بفاصلة)</span>
            <input value={excludeDomains} onChange={(e) => setExcludeDomains(e.target.value)} dir="ltr"
              placeholder="anticorruptiongov.com, example.com"
              className="w-full px-3 py-2 mt-1 rounded-xl border text-sm font-mono"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }} />
            <span className="text-[11px] mt-1 block" style={{ color: "var(--color-text-muted)" }}>
              يُستحسن استبعاد دومين المنصة نفسه (مُدخَل تلقائياً).
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--color-dark)" }}>اسم المُرسِل</span>
            <input value={fromName} onChange={(e) => setFromName(e.target.value)}
              className="w-full px-3 py-2 mt-1 rounded-xl border text-sm"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }} />
          </label>
        </div>

        <div className="flex items-center justify-end mt-5">
          <button type="submit" disabled={busy || !apiKey || !workspaceId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: busy ? "#6B9E82" : "var(--color-primary)", color: "white", cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            ربط الآن
          </button>
        </div>
      </div>
    </form>
  );
}
