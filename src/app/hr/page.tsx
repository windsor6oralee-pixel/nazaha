import { Users, CheckCircle, Clock, AlertCircle, XCircle } from "lucide-react";
import { StatCard } from "@/components/hr/StatCard";
import { CandidateRow } from "@/components/hr/CandidateRow";
import { auth } from "@/infrastructure/auth/auth";
import {
  getCandidatesByOrganization,
  getHRStats,
} from "@/infrastructure/repositories/candidate.repository";
import Link from "next/link";

export default async function HRDashboard() {
  const session = await auth();
  const organizationId = session!.user.organizationId;

  const [stats, candidates] = await Promise.all([
    getHRStats(organizationId),
    getCandidatesByOrganization(organizationId),
  ]);

  const recentCandidates = candidates.slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>
          لوحة التحكم
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          نظرة عامة على حالة المرشحين وإجراءات الانضمام
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="إجمالي المرشحين"
          value={stats.total}
          icon={Users}
          color="muted"
        />
        <StatCard
          label="مكتمل"
          value={stats.completed}
          icon={CheckCircle}
          color="green"
          trend={stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% من الكل` : undefined}
        />
        <StatCard
          label="قيد الإنجاز"
          value={stats.inProgress}
          icon={Clock}
          color="blue"
        />
        <StatCard
          label="يحتاج إجراء"
          value={stats.pendingAction}
          icon={AlertCircle}
          color="gold"
          trend="يحتاج متابعة"
        />
        <StatCard
          label="مرفوض"
          value={stats.rejected}
          icon={XCircle}
          color="red"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Candidates Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden"
          style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center justify-between p-5 border-b"
            style={{ borderColor: "var(--color-border)" }}>
            <div>
              <h2 className="font-bold" style={{ color: "var(--color-dark)" }}>
                آخر المرشحين
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                المرشحون الأحدث نشاطاً
              </p>
            </div>
            <Link
              href="/hr/candidates"
              className="text-xs font-medium hover:underline"
              style={{ color: "var(--color-primary)" }}
            >
              عرض الكل
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {recentCandidates.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: "var(--color-text-muted)" }}>
                لا يوجد مرشحون بعد
              </p>
            ) : (
              recentCandidates.map((candidate) => (
                <CandidateRow key={candidate.id} candidate={candidate} />
              ))
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Pending Action Alert */}
          {stats.pendingAction > 0 && (
            <div className="rounded-2xl p-5"
              style={{ background: "var(--color-warning-bg)", border: "1px solid #FDE68A" }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4" style={{ color: "var(--color-warning)" }} />
                <p className="font-semibold text-sm" style={{ color: "#92400E" }}>يحتاج متابعة</p>
              </div>
              <p className="text-sm" style={{ color: "#B45309" }}>
                <strong>{stats.pendingAction}</strong> مرشحاً لديهم مستندات تحتاج مراجعتك.
              </p>
              <Link
                href="/hr/candidates"
                className="inline-block mt-3 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "#FEF3C7", color: "#92400E" }}
              >
                مراجعة المستندات
              </Link>
            </div>
          )}

          {/* Distribution */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm"
            style={{ borderColor: "var(--color-border)" }}>
            <h3 className="font-bold text-sm mb-4" style={{ color: "var(--color-dark)" }}>
              توزيع الحالات
            </h3>
            <div className="space-y-3">
              {[
                { label: "مكتمل", value: stats.completed, color: "var(--color-success)" },
                { label: "قيد الإنجاز", value: stats.inProgress, color: "var(--color-info)" },
                { label: "يحتاج إجراء", value: stats.pendingAction, color: "var(--color-warning)" },
                { label: "مرفوض", value: stats.rejected, color: "var(--color-error)" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1"
                    style={{ color: "var(--color-text-muted)" }}>
                    <span>{item.label}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--color-beige-dark)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        background: item.color,
                        width: stats.total > 0
                          ? `${Math.round((item.value / stats.total) * 100)}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
