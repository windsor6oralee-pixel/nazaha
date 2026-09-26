import { StatCard, Card, Alert } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { CandidatesTable } from "@/components/hr/CandidateRow";
import { auth } from "@/infrastructure/auth/auth";
import {
  getCandidatesByOrganization,
  getHRStats,
} from "@/infrastructure/repositories/candidate.repository";

export default async function HRDashboard() {
  const session = await auth();
  const organizationId = session!.user.organizationId;

  const [stats, candidates] = await Promise.all([
    getHRStats(organizationId),
    getCandidatesByOrganization(organizationId),
  ]);

  const recentCandidates = candidates.slice(0, 5);

  return (
    <div className="nz-page">
      {/* Page Header */}
      <div className="nz-page__head">
        <div>
          <h1 className="nz-page__title">لوحة التحكم</h1>
          <p className="nz-page__lead">
            نظرة عامة على حالة المرشحين وإجراءات الانضمام
          </p>
        </div>
        <ButtonLink href="/hr/candidates/new" icon="candidates">
          إضافة مرشح جديد
        </ButtonLink>
      </div>

      {/* Stats Grid */}
      <div className="nz-stats nz-stagger">
        <StatCard label="إجمالي المرشحين" value={stats.total} icon="candidates" />
        <StatCard
          label="مكتمل"
          value={stats.completed}
          icon="approved"
          hint={stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% من الكل` : undefined}
        />
        <StatCard label="قيد الإنجاز" value={stats.inProgress} icon="pending" />
        <StatCard label="يحتاج إجراء" value={stats.pendingAction} icon="flag" hint="يحتاج متابعة" />
        <StatCard label="مرفوض" value={stats.rejected} icon="close" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Candidates Table */}
        <Card
          className="lg:col-span-2"
          flush
          title="آخر المرشحين"
          description="المرشحون الأحدث نشاطاً"
          action={
            <ButtonLink href="/hr/candidates" variant="ghost" size="sm">
              عرض الكل
            </ButtonLink>
          }
        >
          <CandidatesTable candidates={recentCandidates} emptyText="لا يوجد مرشحون بعد" />
        </Card>

        {/* Side panel */}
        <div className="flex flex-col gap-6">
          {/* Pending Action Alert */}
          {stats.pendingAction > 0 && (
            <Alert tone="gold" icon="flag" title="يحتاج متابعة">
              <p style={{ margin: 0 }}>
                <strong className="font-numeric" style={{ color: "var(--ink)" }}>{stats.pendingAction}</strong> مرشحاً لديهم مستندات تحتاج مراجعتك.
              </p>
              <ButtonLink href="/hr/candidates" variant="secondary" size="sm" icon="review" className="mt-4">
                مراجعة المستندات
              </ButtonLink>
            </Alert>
          )}

          {/* Distribution */}
          <Card title="توزيع الحالات">
            <div className="flex flex-col gap-4">
              {[
                { label: "مكتمل", value: stats.completed },
                { label: "قيد الإنجاز", value: stats.inProgress },
                { label: "يحتاج إجراء", value: stats.pendingAction },
                { label: "مرفوض", value: stats.rejected },
              ].map((item) => {
                const pct = stats.total > 0 ? Math.round((item.value / stats.total) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="nz-progress__row">
                      <span>{item.label}</span>
                      <span className="nz-progress__val">{item.value}</span>
                    </div>
                    <div
                      className="nz-progress__track"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                      aria-label={item.label}
                    >
                      <div className="nz-progress__bar" style={{ transform: `scaleX(${pct / 100})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
