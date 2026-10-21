import { StatCard, Card, Alert } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { CandidatesTable } from "@/components/hr/CandidateRow";
import { type IconName } from "@/components/ui/Icon";
import { auth } from "@/infrastructure/auth/auth";
import type { ApplicationStatus } from "@/types";
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

  const pct = (value: number) =>
    stats.total > 0 ? `${Math.round((value / stats.total) * 100)}% من الكل` : undefined;

  /* كل عدّاد رابط: ينقل إلى قائمة المرشحين مُصفّاة بالحالة نفسها. */
  const statCards: {
    label: string;
    value: number;
    icon: IconName;
    status: ApplicationStatus | "all";
    hint?: string;
  }[] = [
    { label: "إجمالي المرشحين", value: stats.total, icon: "candidates", status: "all" },
    { label: "مقبول", value: stats.approved, icon: "approved", status: "approved", hint: pct(stats.approved) },
    { label: "قيد الإنجاز", value: stats.inProgress, icon: "pending", status: "in_progress" },
    { label: "تحت المراجعة", value: stats.underReview, icon: "review", status: "under_review" },
    { label: "يحتاج إجراء", value: stats.pendingAction, icon: "flag", status: "pending", hint: "يحتاج متابعة" },
    { label: "مكتمل", value: stats.completed, icon: "integrity", status: "completed" },
    { label: "مرفوض", value: stats.rejected, icon: "close", status: "rejected" },
  ];

  /* توزيع الحالات — كل الحالات الستّ حتى يكون المجموع 100%. */
  const distribution = [
    { label: "مقبول", value: stats.approved },
    { label: "مكتمل", value: stats.completed },
    { label: "قيد الإنجاز", value: stats.inProgress },
    { label: "تحت المراجعة", value: stats.underReview },
    { label: "يحتاج إجراء", value: stats.pendingAction },
    { label: "مرفوض", value: stats.rejected },
  ];

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

      {/* Stats Grid — كل بطاقة عدّاد وزر تصفية في آن واحد */}
      <div className="nz-stats nz-stagger">
        {statCards.map((card) => (
          <StatCard
            key={card.status}
            label={card.label}
            value={card.value}
            icon={card.icon}
            hint={card.hint}
            href={
              card.status === "all"
                ? "/hr/candidates"
                : `/hr/candidates?status=${card.status}`
            }
          />
        ))}
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
              <ButtonLink
                href="/hr/candidates?status=pending"
                variant="secondary"
                size="sm"
                icon="review"
                className="mt-4"
              >
                مراجعة المستندات
              </ButtonLink>
            </Alert>
          )}

          {/* Distribution */}
          <Card title="توزيع الحالات">
            <div className="flex flex-col gap-4">
              {distribution.map((item) => {
                const p = stats.total > 0 ? Math.round((item.value / stats.total) * 100) : 0;
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
                      aria-valuenow={p}
                      aria-label={item.label}
                    >
                      <div className="nz-progress__bar" style={{ transform: `scaleX(${p / 100})` }} />
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
