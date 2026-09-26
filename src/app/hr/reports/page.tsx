import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { Card, StatCard, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Table, Td } from "@/components/ui/Table";
import { getTenantContext, tenantPrisma } from "@/infrastructure/tenant";
import { getReports, parsePeriod, PERIODS, type Reports } from "@/infrastructure/reports/reports.service";
import { FIELD_TYPE_LABELS, formatValue } from "@/infrastructure/custom-fields/field.service";

interface Props { searchParams: Promise<{ period?: string }> }

/* Bars use flat brand tokens only: green-700 for the main measure, gold-500 for the secondary one. */
const BAR_MAIN = "var(--green-700)";
const BAR_ALT = "var(--gold-500)";

const APP_STATUS = [
  { key: "COMPLETED",    label: "مكتملة" },
  { key: "UNDER_REVIEW", label: "قيد المراجعة" },
  { key: "IN_PROGRESS",  label: "قيد الإنجاز" },
  { key: "PENDING",      label: "معلقة" },
  { key: "REJECTED",     label: "مرفوضة" },
];
const DOC_STATUS = [
  { key: "APPROVED",     label: "معتمدة" },
  { key: "UNDER_REVIEW", label: "قيد المراجعة" },
  { key: "UPLOADED",     label: "مرفوعة" },
  { key: "NOT_UPLOADED", label: "لم تُرفع" },
  { key: "REJECTED",     label: "مرفوضة" },
];

export default async function ReportsPage({ searchParams }: Props) {
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "hr") return notFound();
  const period = parsePeriod((await searchParams).period);
  const r = await getReports(tenantPrisma(ctx.organizationId), ctx.organizationId, period);
  const o = r.overview;

  return (
    <div className="nz-page">
      {/* Header + controls */}
      <div className="nz-page__head">
        <div>
          <h1 className="nz-page__title">مؤشرات الانضمام</h1>
          <p className="nz-page__lead">
            أرقام حيّة من قاعدة البيانات — تشمل الحقول المخصصة لجهتك
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <nav
            aria-label="الفترة الزمنية"
            className="flex overflow-hidden"
            style={{ border: "1px solid var(--border-100)", borderRadius: "var(--radius-12)", background: "var(--surface-000)" }}
          >
            {PERIODS.map((p) => {
              const active = p.value === period;
              return (
                <Link
                  key={p.value}
                  href={`/hr/reports?period=${p.value}`}
                  aria-current={active ? "page" : undefined}
                  className="inline-flex items-center"
                  style={{
                    minHeight: "var(--tap-target-min)",
                    padding: "0 var(--space-16)",
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    textDecoration: "none",
                    background: active ? "var(--green-700)" : "transparent",
                    color: active ? "var(--ink-invert)" : "var(--ink-muted)",
                    transition: "background-color var(--motion-fast) var(--ease-standard)",
                  }}
                >
                  {p.label}
                </Link>
              );
            })}
          </nav>
          <a href="/api/reports/candidates.csv" className="nz-btn nz-btn--primary">
            <Download size={20} strokeWidth={1.75} aria-hidden />
            تصدير CSV
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="nz-stats nz-stagger" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <StatCard icon="candidates" label="المرشحون في الفترة" value={o.total} hint={`${o.byStatus.COMPLETED ?? 0} مكتمل`} />
        <StatCard icon="approved" label="نسبة الإكمال" value={o.completionPct == null ? "—" : `${o.completionPct}%`} hint="من إجمالي طلبات الفترة" />
        <StatCard icon="pending" label="متوسط مدة الإنجاز" value={o.avgCompletionDays == null ? "—" : <>{o.avgCompletionDays} <Unit>يوم</Unit></>} hint="من القبول إلى الاكتمال" />
        <StatCard icon="justice" label="متوسط الوصول للتوقيع" value={o.avgDaysToSignature == null ? "—" : <>{o.avgDaysToSignature} <Unit>يوم</Unit></>} hint="من القبول إلى توقيع العقد" />
        <StatCard icon="documents" label="مستندات بانتظار المراجعة" value={r.documents.awaitingReview} hint="تحتاج إجراءً من الموارد البشرية" />
        <StatCard icon="reports" label="النجاح من أول مرة" value={o.firstPassYieldPct == null ? "—" : `${o.firstPassYieldPct}%`} hint="مستندات اعتُمدت دون رفض سابق" />
        <StatCard icon="justice" label="عقود بانتظار التوقيع" value={r.contracts.pending} hint={`${r.contracts.signed} موقَّع`} />
        <StatCard icon="flag" label="طلبات مرفوضة" value={o.byStatus.REJECTED ?? 0} hint="في الفترة المحددة" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="توزيع حالات الطلبات">
          <Bars total={o.total} rows={APP_STATUS.map((s) => ({ label: s.label, value: o.byStatus[s.key] ?? 0, color: BAR_MAIN }))} />
        </Card>
        <Card title="حالة المستندات">
          <Bars total={Object.values(r.documents.byStatus).reduce((a, b) => a + b, 0)}
            rows={DOC_STATUS.map((s) => ({ label: s.label, value: r.documents.byStatus[s.key] ?? 0, color: BAR_MAIN }))} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="الاتجاه الشهري" description="آخر 6 أشهر — الأخضر: المكتمل">
          <Monthly points={r.monthly} />
        </Card>
        <Card title="مسار الانضمام" description="كم مرشحاً أكمل كل خطوة">
          {r.funnel.length ? <Funnel steps={r.funnel} total={o.total} /> : <Empty label="لا توجد خطوات بعد" />}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title={<Titled icon="dashboard">حسب الإدارة</Titled>}>
          {r.byDepartment.length
            ? <Bars total={Math.max(...r.byDepartment.map((d) => d.total))} rows={r.byDepartment.map((d) => ({ label: d.department, value: d.total, sub: `${d.completed} مكتمل`, color: BAR_MAIN }))} wideLabel />
            : <Empty label="لا توجد بيانات" />}
        </Card>
        <Card title={<Titled icon="flag">أكثر المستندات رفضاً</Titled>}>
          {r.documents.topRejected.length
            ? <Bars total={r.documents.topRejected[0].rejections} rows={r.documents.topRejected.map((d) => ({ label: d.nameAr, value: d.rejections, color: BAR_ALT }))} wideLabel />
            : <Empty label="لا توجد مستندات مرفوضة" />}
        </Card>
      </div>

      {/* Custom fields */}
      <Card title={<Titled icon="reports">الحقول المخصصة</Titled>} description="توزيع القيم عبر جميع المرشحين — كل الجهة، بغضّ النظر عن الفترة">
        {r.customFields.length === 0 ? (
          <Empty label="لا توجد حقول مخصصة — أضفها من الإعدادات" />
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {r.customFields.map((f) => <CustomFieldPanel key={f.id} f={f} />)}
          </div>
        )}
      </Card>

      {/* Attention */}
      <Card title={<Titled icon="documents">بانتظار إجرائك</Titled>} description="أقدم المستندات المرفوعة التي لم تُراجَع بعد">
        <Table
          caption="المستندات بانتظار المراجعة"
          columns={["المرشح", "المستند", { label: "منذ", width: "1%" }]}
          empty={<Empty label="لا شيء بانتظار المراجعة — أحسنت" />}
        >
          {r.attention.map((a) => (
            <tr key={a.documentId}>
              <Td>
                <Link href={`/hr/candidates/${a.candidateId}`} className="hover:underline" style={{ fontWeight: 600, color: "var(--green-700)" }}>
                  {a.candidateName}
                </Link>
              </Td>
              <Td>{a.documentName}</Td>
              <Td>
                <Badge tone={a.daysWaiting >= 3 ? "rejected" : "review"} icon="pending">
                  {a.daysWaiting === 0 ? "اليوم" : <><span className="font-numeric">{a.daysWaiting}</span> يوم</>}
                </Badge>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

// ── Presentational pieces (server components) ─────────────────

function Unit({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 500 }}>{children}</span>;
}

function Titled({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon name={icon} size={24} label={false} style={{ color: "var(--green-700)" }} />
      {children}
    </span>
  );
}

function Bars({ rows, total, wideLabel }: {
  rows: { label: string; value: number; color: string; sub?: string }[]; total: number; wideLabel?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-4">
          <span className={`ds-caption flex-shrink-0 truncate ${wideLabel ? "w-40" : "w-24"}`} style={{ color: "var(--ink)" }} title={row.label}>{row.label}</span>
          <div className="flex-1 overflow-hidden" style={{ height: 8, borderRadius: "var(--radius-full)", background: "var(--surface-200)" }}>
            <div style={{
              height: "100%", width: "100%", borderRadius: "var(--radius-full)", background: row.color,
              transformOrigin: "right", transform: `scaleX(${total > 0 ? row.value / total : 0})`,
              transition: "transform var(--motion-slow) var(--ease-standard)",
            }} />
          </div>
          <span className="ds-caption font-numeric flex-shrink-0 text-left" style={{ minWidth: 64, fontWeight: 600, color: "var(--ink)" }}>
            {row.value}{row.sub && <span style={{ fontWeight: 400, color: "var(--ink-muted)", fontFamily: "var(--font-sans)" }}> · {row.sub}</span>}
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
    <div className="flex items-end gap-4" style={{ height: 160 }}>
      {points.map((p) => {
        const h = Math.max((p.total / max) * 112, 8);
        const done = p.total ? (p.completed / p.total) * 100 : 0;
        return (
          <div key={p.month} className="flex-1 flex flex-col items-center gap-2 min-w-0">
            <span className="ds-caption font-numeric" style={{ fontWeight: 600, color: "var(--ink)" }}>{p.total}</span>
            <div
              className="w-full overflow-hidden relative"
              style={{ height: h, background: "var(--gold-200)", borderRadius: "var(--radius-8) var(--radius-8) 0 0" }}
              title={`${p.completed} / ${p.total}`}
            >
              <div className="absolute bottom-0 inset-x-0" style={{ height: `${done}%`, background: BAR_MAIN }} />
            </div>
            <span className="ds-caption truncate" style={{ color: "var(--ink-muted)" }}>{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Funnel({ steps, total }: { steps: Reports["funnel"]; total: number }) {
  return (
    <div className="flex flex-col gap-4">
      {steps.map((s) => {
        const pct = total > 0 ? (s.completed / total) * 100 : 0;
        return (
          <div key={s.order} className="flex items-center gap-4">
            <span
              className="font-numeric flex items-center justify-center flex-shrink-0"
              style={{ width: 24, height: 24, borderRadius: "var(--radius-full)", fontSize: 12, fontWeight: 700, background: "var(--green-700)", color: "var(--ink-invert)" }}
            >
              {s.order}
            </span>
            <span className="ds-caption w-36 truncate" style={{ color: "var(--ink)" }}>{s.nameAr}</span>
            <div className="flex-1 overflow-hidden flex" style={{ height: 16, borderRadius: "var(--radius-8)", background: "var(--surface-200)" }}>
              <div style={{ width: `${pct}%`, background: BAR_MAIN }} />
              <div style={{ width: total > 0 ? `${(s.inProgress / total) * 100}%` : 0, background: BAR_ALT }} />
            </div>
            <span className="ds-caption font-numeric flex-shrink-0 text-left" style={{ minWidth: 80, color: "var(--ink-muted)" }}>
              <b style={{ color: "var(--ink)" }}>{s.completed}</b> / {total}
            </span>
          </div>
        );
      })}
      <p className="ds-caption" style={{ margin: 0, color: "var(--ink-muted)" }}>الأخضر: أكمل الخطوة · الذهبي: يعمل عليها الآن</p>
    </div>
  );
}

function CustomFieldPanel({ f }: { f: Reports["customFields"][number] }) {
  const typeLabel = FIELD_TYPE_LABELS[f.type as keyof typeof FIELD_TYPE_LABELS] ?? f.type;
  return (
    <div style={{ border: "1px solid var(--border-100)", borderRadius: "var(--radius-12)", background: "var(--surface-000)", padding: "var(--space-16)" }}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <p style={{ margin: 0, fontWeight: 600, color: "var(--ink)" }}>{f.labelAr}</p>
        <Badge tone="neutral" icon={false}>{typeLabel} · <span className="font-numeric">{f.filled}</span> مُعبّأ</Badge>
      </div>
      {f.distribution?.length ? (
        <Bars total={f.filled} rows={f.distribution.map((d) => ({
          label: f.type === "BOOLEAN" ? (d.value === "true" ? "نعم" : "لا") : d.value,
          value: d.count, color: BAR_ALT,
        }))} />
      ) : f.numeric ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["الأدنى", f.numeric.min], ["المتوسط", f.numeric.avg], ["الأعلى", f.numeric.max]].map(([l, v]) => (
            <div key={String(l)} style={{ background: "var(--surface-100)", borderRadius: "var(--radius-8)", padding: "var(--space-8)" }}>
              <p className="ds-caption" style={{ margin: 0, color: "var(--ink-muted)" }}>{l}</p>
              <p className="font-numeric" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{formatValue({ type: "NUMBER" }, String(v))}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="ds-caption" style={{ margin: 0, color: "var(--ink-muted)" }}>
          {f.filled === 0 ? "لم تُعبَّأ لأي مرشح بعد" : "حقل نصي/تاريخ — يُعرض في تصدير CSV"}
        </p>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2" style={{ padding: "var(--space-24) 0", color: "var(--ink-muted)" }}>
      <Icon name="reports" size={32} label={false} />
      <p className="ds-caption" style={{ margin: 0 }}>{label}</p>
    </div>
  );
}
