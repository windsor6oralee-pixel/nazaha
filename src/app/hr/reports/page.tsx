import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Users, CheckCircle, Clock, PenLine, TrendingUp, FileWarning, AlertTriangle,
  BarChart3, Download, Building2, ListChecks, FileSignature,
} from "lucide-react";
import { getTenantContext, tenantPrisma } from "@/infrastructure/tenant";
import { getReports, parsePeriod, PERIODS, type Reports } from "@/infrastructure/reports/reports.service";
import { FIELD_TYPE_LABELS, formatValue } from "@/infrastructure/custom-fields/field.service";

interface Props { searchParams: Promise<{ period?: string }> }

const APP_STATUS = [
  { key: "COMPLETED",    label: "مكتملة",       color: "var(--color-success)" },
  { key: "UNDER_REVIEW", label: "قيد المراجعة", color: "var(--color-gold)" },
  { key: "IN_PROGRESS",  label: "قيد الإنجاز",  color: "var(--color-primary)" },
  { key: "PENDING",      label: "معلقة",        color: "var(--color-text-muted)" },
  { key: "REJECTED",     label: "مرفوضة",       color: "var(--color-error)" },
];
const DOC_STATUS = [
  { key: "APPROVED",     label: "معتمدة",         color: "var(--color-success)" },
  { key: "UNDER_REVIEW", label: "قيد المراجعة",   color: "var(--color-gold)" },
  { key: "UPLOADED",     label: "مرفوعة",         color: "var(--color-primary)" },
  { key: "NOT_UPLOADED", label: "لم تُرفع",       color: "var(--color-border)" },
  { key: "REJECTED",     label: "مرفوضة",         color: "var(--color-error)" },
];

export default async function ReportsPage({ searchParams }: Props) {
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "hr") return notFound();
  const period = parsePeriod((await searchParams).period);
  const r = await getReports(tenantPrisma(ctx.organizationId), ctx.organizationId, period);
  const o = r.overview;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      {/* Header + controls */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>التقارير</p>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>مؤشرات الانضمام</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
            أرقام حيّة من قاعدة البيانات — تشمل الحقول المخصصة لجهتك
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-border)", background: "white" }}>
            {PERIODS.map((p) => (
              <Link key={p.value} href={`/hr/reports?period=${p.value}`}
                className="px-3.5 py-2 text-xs font-medium"
                style={{
                  background: p.value === period ? "var(--color-primary)" : "transparent",
                  color: p.value === period ? "white" : "var(--color-text-muted)",
                  fontFamily: "'IBM Plex Sans Arabic', sans-serif",
                }}>
                {p.label}
              </Link>
            ))}
          </div>
          <a href="/api/reports/candidates.csv"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold"
            style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)", background: "var(--color-primary-muted)" }}>
            <Download className="w-3.5 h-3.5" /> تصدير CSV
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={Users} label="المرشحون في الفترة" value={String(o.total)} desc={`${o.byStatus.COMPLETED ?? 0} مكتمل`} />
        <Kpi icon={CheckCircle} label="نسبة الإكمال" value={o.completionPct == null ? "—" : `${o.completionPct}%`} desc="من إجمالي طلبات الفترة" accent />
        <Kpi icon={Clock} label="متوسط مدة الإنجاز" value={o.avgCompletionDays == null ? "—" : `${o.avgCompletionDays} يوم`} desc="من القبول إلى الاكتمال" />
        <Kpi icon={PenLine} label="متوسط الوصول للتوقيع" value={o.avgDaysToSignature == null ? "—" : `${o.avgDaysToSignature} يوم`} desc="من القبول إلى توقيع العقد" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi icon={FileWarning} label="مستندات بانتظار المراجعة" value={String(r.documents.awaitingReview)} desc="تحتاج إجراءً من الموارد البشرية" warn={r.documents.awaitingReview > 0} />
        <Kpi icon={TrendingUp} label="النجاح من أول مرة" value={o.firstPassYieldPct == null ? "—" : `${o.firstPassYieldPct}%`} desc="مستندات اعتُمدت دون رفض سابق" />
        <Kpi icon={FileSignature} label="عقود بانتظار التوقيع" value={String(r.contracts.pending)} desc={`${r.contracts.signed} موقَّع`} />
        <Kpi icon={AlertTriangle} label="طلبات مرفوضة" value={String(o.byStatus.REJECTED ?? 0)} desc="في الفترة المحددة" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card title="توزيع حالات الطلبات">
          <Bars total={o.total} rows={APP_STATUS.map((s) => ({ label: s.label, value: o.byStatus[s.key] ?? 0, color: s.color }))} />
        </Card>
        <Card title="حالة المستندات">
          <Bars total={Object.values(r.documents.byStatus).reduce((a, b) => a + b, 0)}
            rows={DOC_STATUS.map((s) => ({ label: s.label, value: r.documents.byStatus[s.key] ?? 0, color: s.color }))} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card title="الاتجاه الشهري" subtitle="آخر 6 أشهر — الأخضر: المكتمل">
          <Monthly points={r.monthly} />
        </Card>
        <Card title="مسار الانضمام" subtitle="كم مرشحاً أكمل كل خطوة">
          {r.funnel.length ? <Funnel steps={r.funnel} total={o.total} /> : <Empty label="لا توجد خطوات بعد" />}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card title="حسب الإدارة" icon={Building2}>
          {r.byDepartment.length
            ? <Bars total={Math.max(...r.byDepartment.map((d) => d.total))} rows={r.byDepartment.map((d) => ({ label: d.department, value: d.total, sub: `${d.completed} مكتمل`, color: "var(--color-primary)" }))} wideLabel />
            : <Empty label="لا توجد بيانات" />}
        </Card>
        <Card title="أكثر المستندات رفضاً" icon={AlertTriangle}>
          {r.documents.topRejected.length
            ? <Bars total={r.documents.topRejected[0].rejections} rows={r.documents.topRejected.map((d) => ({ label: d.nameAr, value: d.rejections, color: "var(--color-error)" }))} wideLabel />
            : <Empty label="لا توجد مستندات مرفوضة" />}
        </Card>
      </div>

      {/* Custom fields */}
      <Card title="الحقول المخصصة" subtitle="توزيع القيم عبر جميع المرشحين — كل الجهة، بغضّ النظر عن الفترة" icon={ListChecks} className="mb-6">
        {r.customFields.length === 0 ? (
          <Empty label="لا توجد حقول مخصصة — أضفها من الإعدادات" />
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {r.customFields.map((f) => <CustomFieldPanel key={f.id} f={f} />)}
          </div>
        )}
      </Card>

      {/* Attention */}
      <Card title="بانتظار إجرائك" subtitle="أقدم المستندات المرفوعة التي لم تُراجَع بعد" icon={FileWarning}>
        {r.attention.length === 0 ? (
          <Empty label="لا شيء بانتظار المراجعة — أحسنت" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <th className="text-right font-medium pb-2">المرشح</th>
                  <th className="text-right font-medium pb-2">المستند</th>
                  <th className="text-right font-medium pb-2">منذ</th>
                </tr>
              </thead>
              <tbody>
                {r.attention.map((a) => (
                  <tr key={a.documentId} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                    <td className="py-2.5">
                      <Link href={`/hr/candidates/${a.candidateId}`} className="font-medium hover:underline" style={{ color: "var(--color-primary)" }}>{a.candidateName}</Link>
                    </td>
                    <td className="py-2.5" style={{ color: "var(--color-dark)" }}>{a.documentName}</td>
                    <td className="py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        background: a.daysWaiting >= 3 ? "var(--color-error-bg)" : "var(--color-warning-bg)",
                        color: a.daysWaiting >= 3 ? "var(--color-error)" : "var(--color-warning)",
                      }}>
                        {a.daysWaiting === 0 ? "اليوم" : `${a.daysWaiting} يوم`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Presentational pieces (server components, Tailwind only) ─────────────────

function Kpi({ icon: Icon, label, value, desc, accent, warn }: {
  icon: React.ElementType; label: string; value: string; desc: string; accent?: boolean; warn?: boolean;
}) {
  const color = warn ? "var(--color-error)" : accent ? "var(--color-success)" : "var(--color-dark)";
  return (
    <div className="stat-card bg-white rounded-2xl border p-4" style={{ borderColor: "var(--color-border)" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />
        <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{label}</p>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>{desc}</p>
    </div>
  );
}

function Card({ title, subtitle, icon: Icon, children, className = "" }: {
  title: string; subtitle?: string; icon?: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border p-5 ${className}`} style={{ borderColor: "var(--color-border)" }}>
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-4 h-4" style={{ color: "var(--color-primary)" }} />}
        <div>
          <h2 className="font-bold text-sm" style={{ color: "var(--color-dark)" }}>{title}</h2>
          {subtitle && <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Bars({ rows, total, wideLabel }: {
  rows: { label: string; value: number; color: string; sub?: string }[]; total: number; wideLabel?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className={`text-xs flex-shrink-0 truncate ${wideLabel ? "w-40" : "w-24"}`} style={{ color: "var(--color-dark)" }} title={row.label}>{row.label}</span>
          <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-alt)" }}>
            <div className="h-full rounded-full" style={{ width: total > 0 ? `${(row.value / total) * 100}%` : 0, background: row.color, transition: "width var(--motion-base) var(--ease-standard)" }} />
          </div>
          <span className="text-xs font-semibold tabular-nums w-16 text-left flex-shrink-0" style={{ color: "var(--color-dark)" }}>
            {row.value}{row.sub && <span className="font-normal" style={{ color: "var(--color-text-muted)" }}> · {row.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function Monthly({ points }: { points: Reports["monthly"] }) {
  if (!points.length) return <Empty label="لا توجد طلبات في آخر 6 أشهر" />;
  const max = Math.max(...points.map((p) => p.total), 1);
  return (
    <div className="flex items-end gap-3" style={{ height: 150 }}>
      {points.map((p) => {
        const h = Math.max((p.total / max) * 110, 6);
        const done = p.total ? (p.completed / p.total) * 100 : 0;
        return (
          <div key={p.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--color-dark)" }}>{p.total}</span>
            <div className="w-full rounded-t-lg overflow-hidden relative" style={{ height: h, background: "var(--color-primary-muted)" }}>
              <div className="absolute bottom-0 inset-x-0" style={{ height: `${done}%`, background: "var(--color-success)" }} />
            </div>
            <span className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Funnel({ steps, total }: { steps: Reports["funnel"]; total: number }) {
  return (
    <div className="space-y-2">
      {steps.map((s) => {
        const pct = total > 0 ? (s.completed / total) * 100 : 0;
        return (
          <div key={s.order} className="flex items-center gap-3">
            <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0" style={{ background: "var(--color-primary)", color: "white" }}>{s.order}</span>
            <span className="text-xs w-36 truncate" style={{ color: "var(--color-dark)" }}>{s.nameAr}</span>
            <div className="flex-1 h-5 rounded-md overflow-hidden flex" style={{ background: "var(--color-surface-alt)" }}>
              <div style={{ width: `${pct}%`, background: "var(--color-primary)" }} />
              <div style={{ width: total > 0 ? `${(s.inProgress / total) * 100}%` : 0, background: "var(--color-gold)" }} />
            </div>
            <span className="text-xs tabular-nums w-20 text-left flex-shrink-0" style={{ color: "var(--color-text-muted)" }}>
              <b style={{ color: "var(--color-dark)" }}>{s.completed}</b> / {total}
            </span>
          </div>
        );
      })}
      <p className="text-[10px] pt-1" style={{ color: "var(--color-text-muted)" }}>الأخضر: أكمل الخطوة · الذهبي: يعمل عليها الآن</p>
    </div>
  );
}

function CustomFieldPanel({ f }: { f: Reports["customFields"][number] }) {
  const typeLabel = FIELD_TYPE_LABELS[f.type as keyof typeof FIELD_TYPE_LABELS] ?? f.type;
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>{f.labelAr}</p>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white" style={{ color: "var(--color-text-muted)" }}>{typeLabel} · {f.filled} مُعبّأ</span>
      </div>
      {f.distribution?.length ? (
        <Bars total={f.filled} rows={f.distribution.map((d) => ({
          label: f.type === "BOOLEAN" ? (d.value === "true" ? "نعم" : "لا") : d.value,
          value: d.count, color: "var(--color-gold)",
        }))} />
      ) : f.numeric ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["الأدنى", f.numeric.min], ["المتوسط", f.numeric.avg], ["الأعلى", f.numeric.max]].map(([l, v]) => (
            <div key={String(l)} className="bg-white rounded-lg py-2">
              <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{l}</p>
              <p className="text-base font-bold tabular-nums" style={{ color: "var(--color-dark)" }}>{formatValue({ type: "NUMBER" }, String(v))}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {f.filled === 0 ? "لم تُعبَّأ لأي مرشح بعد" : "حقل نصي/تاريخ — يُعرض في تصدير CSV"}
        </p>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-6 gap-2">
      <BarChart3 className="w-7 h-7" style={{ color: "var(--color-border)" }} />
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</p>
    </div>
  );
}
