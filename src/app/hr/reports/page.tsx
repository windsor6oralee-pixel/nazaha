import { TrendingUp, Users, Clock, CheckCircle, AlertTriangle, BarChart3 } from "lucide-react";
import { auth } from "@/infrastructure/auth/auth";
import { redirect } from "next/navigation";
import { getAnalytics } from "@/infrastructure/repositories/analytics.repository";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user || session.user.sessionType !== "hr_user") redirect("/auth/login");

  const orgId = session.user.organizationId;
  const { stats, monthly, topRejected } = await getAnalytics(orgId);

  const completionPct = stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;

  const maxRejections = topRejected[0]?.rejections ?? 1;
  const maxMonthlyTotal = Math.max(...monthly.map((m) => m.total), 1);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" style={{ direction: "rtl" }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--color-dark)" }}>
          التقارير والمؤشرات
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          مؤشرات أداء منصة نزاهة التوظيف — بيانات حقيقية من قاعدة البيانات
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          icon={Clock}
          label="متوسط وقت الإنجاز"
          value={stats.avgCompletionDays != null ? `${stats.avgCompletionDays} يوم` : "—"}
          desc="من القبول إلى الاكتمال"
        />
        <KPICard
          icon={CheckCircle}
          label="نسبة الإكمال"
          value={`${completionPct}%`}
          desc={`${stats.completed} من أصل ${stats.total} مرشح`}
        />
        <KPICard
          icon={Users}
          label="قيد الإنجاز"
          value={String(stats.inProgress + stats.underReview)}
          desc={`${stats.underReview} قيد المراجعة، ${stats.inProgress} قيد التجهيز`}
        />
        <KPICard
          icon={TrendingUp}
          label="معدل النجاح من أول مرة"
          value={stats.firstPassYieldPct != null ? `${stats.firstPassYieldPct}%` : "—"}
          desc="مستندات اعتُمدت دون رفض سابق"
        />
      </div>

      {/* Status breakdown */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border p-6 shadow-sm" style={{ borderColor: "var(--color-border)" }}>
          <h2 className="font-bold mb-5" style={{ color: "var(--color-dark)" }}>
            توزيع حالات الطلبات
          </h2>
          <div className="space-y-3">
            {[
              { label: "مكتملة", value: stats.completed, color: "#6EE7B7", bg: "#ECFDF5" },
              { label: "قيد الإنجاز", value: stats.inProgress, color: "#93C5FD", bg: "#EFF6FF" },
              { label: "قيد المراجعة", value: stats.underReview, color: "#FCD34D", bg: "#FFFBEB" },
              { label: "معلقة", value: stats.pendingAction, color: "#D1D5DB", bg: "#F9FAFB" },
              { label: "مرفوضة", value: stats.rejected, color: "#FCA5A5", bg: "#FEF2F2" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-sm w-28 flex-shrink-0" style={{ color: "var(--color-text-muted)" }}>
                  {item.label}
                </span>
                <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "#F1F5F9" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: stats.total > 0 ? `${(item.value / stats.total) * 100}%` : "0%",
                      background: item.color,
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-6 text-left flex-shrink-0" style={{ color: "var(--color-dark)" }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly trend */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm" style={{ borderColor: "var(--color-border)" }}>
          <h2 className="font-bold mb-5" style={{ color: "var(--color-dark)" }}>
            الاتجاه الشهري للطلبات
          </h2>
          {monthly.length > 0 ? (
            <div className="flex items-end gap-3 h-36">
              {monthly.map((m) => {
                const heightPct = (m.total / maxMonthlyTotal) * 100;
                const completedPct = m.total > 0 ? (m.completed / m.total) * 100 : 0;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium" style={{ color: "var(--color-dark)" }}>
                      {m.total}
                    </span>
                    <div
                      className="w-full rounded-t-lg overflow-hidden relative"
                      style={{ height: `${Math.max(heightPct, 8)}px`, background: "#E2E8F0", maxHeight: "100px" }}
                    >
                      <div
                        className="absolute bottom-0 w-full rounded-t-lg"
                        style={{
                          height: `${completedPct}%`,
                          background: "var(--color-primary)",
                        }}
                      />
                    </div>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {m.monthLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState label="لا توجد بيانات شهرية بعد" />
          )}
        </div>
      </div>

      {/* Top rejected documents */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2 mb-5">
          <AlertTriangle className="w-4 h-4" style={{ color: "var(--color-error)" }} />
          <h2 className="font-bold" style={{ color: "var(--color-dark)" }}>
            أكثر المستندات التي تُرفض
          </h2>
        </div>
        {topRejected.length > 0 ? (
          <div className="space-y-3">
            {topRejected.map((item) => (
              <div key={item.nameAr} className="flex items-center gap-3">
                <p className="text-sm w-52 truncate flex-shrink-0" style={{ color: "var(--color-dark)" }}>
                  {item.nameAr}
                </p>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#F1F5F9" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(item.rejections / maxRejections) * 100}%`,
                      background: "#FCA5A5",
                    }}
                  />
                </div>
                <span className="text-xs w-16 text-left flex-shrink-0" style={{ color: "var(--color-text-muted)" }}>
                  {item.rejections} {item.rejections === 1 ? "مرة" : "مرات"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState label="لا توجد مستندات مرفوضة بعد" />
        )}
      </div>
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  desc,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  desc: string;
}) {
  return (
    <div className="bg-white rounded-2xl border p-5 shadow-sm" style={{ borderColor: "var(--color-border)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</p>
      </div>
      <p className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{desc}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-8 gap-2">
      <BarChart3 className="w-8 h-8" style={{ color: "var(--color-border)" }} />
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{label}</p>
    </div>
  );
}
