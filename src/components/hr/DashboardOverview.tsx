"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, UserCheck, PlayCircle, CheckCircle, Clock, Activity, Mail, TrendingUp, Eye, MousePointerClick, AlertCircle } from "lucide-react";

interface Stats {
  totalCandidates: number;
  invited: number;
  accountsActivated: number;
  startedJourney: number;
  completedProfiles: number;
  pendingProfiles: number;
  stuckByStep: Array<{ step: string; count: number }>;
  onlineNow: number;
  activeToday: number;
  completionRate: number;
  avgDaysToComplete: number | null;
  email: {
    sent: number;
    opened: number;
    clicked: number;
    openRate: number;
    clickRate: number;
    unopenedCount: number;
  };
  unopenedInvitations: Array<{
    candidateId: string;
    candidateName: string;
    candidateEmail: string;
    emailId: string;
    sentAt: string;
    hoursAgo: number;
  }>;
}

const CARDS: Array<{ key: keyof Stats; label: string; Icon: typeof Users; color: string }> = [
  { key: "onlineNow",        label: "متصلون الآن",       Icon: Activity,     color: "#227A4E" },
  { key: "activeToday",      label: "نشطاء خلال 24 ساعة", Icon: Clock,        color: "#013A2B" },
  { key: "totalCandidates",  label: "إجمالي المرشحين",    Icon: Users,        color: "#013A2B" },
  { key: "invited",          label: "دعوات مُرسَلة",       Icon: Mail,         color: "#C9A94A" },
  { key: "accountsActivated", label: "حسابات مُفعَّلة",    Icon: UserCheck,    color: "#013A2B" },
  { key: "startedJourney",   label: "بدأوا الإجراءات",    Icon: PlayCircle,   color: "#C9A94A" },
  { key: "completedProfiles", label: "ملفات مكتملة",      Icon: CheckCircle,  color: "#227A4E" },
  { key: "completionRate",   label: "معدل الإكمال",      Icon: TrendingUp,   color: "#013A2B" },
];

/**
 * Overview strip on the HR dashboard. Polls /api/hr/stats every 60 s so the
 * live metrics (onlineNow / activeToday) stay reasonably fresh without
 * flooding the server.
 */
export function DashboardOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/hr/stats", { cache: "no-store" });
        if (!r.ok) { if (!cancelled) setErr(true); return; }
        const j: Stats = await r.json();
        if (!cancelled) { setStats(j); setErr(false); }
      } catch { if (!cancelled) setErr(true); }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (err && !stats) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-4">
        {CARDS.map(({ key, label, Icon, color }) => {
          const raw = stats?.[key];
          const suffix = key === "completionRate" ? "%" : "";
          const value = raw == null ? "…" : `${raw}${suffix}`;
          return (
            <div key={key} className="rounded-2xl border p-4 flex items-center gap-3"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}1A`, color }}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{label}</p>
                <p className="text-xl font-bold font-numeric" style={{ color: "var(--color-dark)" }}>{value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {stats?.email && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <div className="rounded-2xl border p-4 flex items-center gap-3"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#013A2B1A", color: "#013A2B" }}>
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>بريد مُرسَل (المجموع)</p>
              <p className="text-xl font-bold font-numeric" style={{ color: "var(--color-dark)" }}>{stats.email.sent}</p>
            </div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-3"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#227A4E1A", color: "#227A4E" }}>
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>معدل الفتح</p>
              <p className="text-xl font-bold font-numeric" style={{ color: "var(--color-dark)" }}>
                {stats.email.openRate}% <span className="text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>({stats.email.opened})</span>
              </p>
            </div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-3"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#013A2B1A", color: "#E8D27A" }}>
              <MousePointerClick className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>معدل الضغط</p>
              <p className="text-xl font-bold font-numeric" style={{ color: "var(--color-dark)" }}>
                {stats.email.clickRate}% <span className="text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>({stats.email.clicked})</span>
              </p>
            </div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-3"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#A83A301A", color: "#A83A30" }}>
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>لم يفتحوا بعد 24 ساعة</p>
              <p className="text-xl font-bold font-numeric" style={{ color: "var(--color-dark)" }}>{stats.email.unopenedCount}</p>
            </div>
          </div>
        </div>
      )}

      {stats?.unopenedInvitations && stats.unopenedInvitations.length > 0 && (
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <p className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: "var(--color-dark)" }}>
            <AlertCircle className="w-4 h-4" style={{ color: "#A83A30" }} />
            مرشحون لم يفتحوا دعوتهم بعد
          </p>
          <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {stats.unopenedInvitations.map((u) => (
              <Link key={u.emailId} href={`/hr/candidates/${u.candidateId}`}
                className="flex items-center justify-between py-2 hover:bg-[var(--color-surface-alt)] rounded-lg px-2 -mx-2 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--color-dark)" }}>{u.candidateName}</p>
                  <p className="text-[11px] truncate" dir="ltr" style={{ color: "var(--color-text-muted)" }}>{u.candidateEmail}</p>
                </div>
                <span className="text-[11px] flex-shrink-0" style={{ color: "var(--color-text-muted)" }}>
                  مضى {u.hoursAgo < 24 ? `${u.hoursAgo} ساعة` : `${Math.round(u.hoursAgo / 24)} يوم`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {stats && (stats.avgDaysToComplete != null || stats.stuckByStep.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {stats.avgDaysToComplete != null && (
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
              <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>متوسط أيام إكمال الملف</p>
              <p className="text-2xl font-bold font-numeric mt-1" style={{ color: "var(--color-dark)" }}>
                {stats.avgDaysToComplete} <span className="text-sm font-normal" style={{ color: "var(--color-text-muted)" }}>يوم</span>
              </p>
            </div>
          )}
          {stats.stuckByStep.length > 0 && (
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-dark)" }}>مرشحون متوقّفون عند خطوة</p>
              <div className="space-y-1.5">
                {stats.stuckByStep.map((s) => {
                  const maxCount = Math.max(...stats.stuckByStep.map((x) => x.count));
                  const pct = maxCount ? Math.round((s.count / maxCount) * 100) : 0;
                  return (
                    <div key={s.step}>
                      <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                        <span>{s.step}</span>
                        <span className="font-numeric">{s.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden mt-0.5" style={{ background: "var(--color-border)" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-primary)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
