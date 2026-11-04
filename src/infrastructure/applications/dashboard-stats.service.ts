/**
 * Lightweight dashboard aggregates — single query per metric, every count
 * tenant-scoped. Called from the HR dashboard; also exposed as /api/hr/stats
 * so a client widget can refresh without re-rendering the whole page.
 */
import { prisma } from "@/infrastructure/database/client";

export interface DashboardStats {
  totalCandidates: number;
  invited: number;
  accountsActivated: number;
  startedJourney: number;        // ≥1 completed onboarding step
  completedProfiles: number;     // all docs approved + contract signed
  pendingProfiles: number;       // activated but not completed
  stuckByStep: Array<{ step: string; count: number }>;
  onlineNow: number;             // candidates with lastAccessAt in last 5 min
  activeToday: number;           // lastAccessAt within last 24 h
  completionRate: number;        // 0–100
  avgDaysToComplete: number | null;
  // Email engagement funnel (per-row, newest-first)
  email: {
    sent:          number;
    opened:        number;
    clicked:       number;
    openRate:      number;       // 0–100
    clickRate:     number;       // 0–100
    unopenedCount: number;       // sent >24h ago and still unopened
  };
  unopenedInvitations: Array<{
    candidateId: string;
    candidateName: string;
    candidateEmail: string;
    emailId: string;
    sentAt: string;              // ISO
    hoursAgo: number;
  }>;
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const DAY_MS           = 24 * 60 * 60 * 1000;

export async function getDashboardStats(organizationId: string): Promise<DashboardStats> {
  const now = new Date();
  const onlineCutoff = new Date(now.getTime() - ONLINE_WINDOW_MS);
  const todayCutoff  = new Date(now.getTime() - DAY_MS);

  const { getEmailFunnel, listUnopenedInvitations } = await import("@/infrastructure/notifications/email-stats.service");

  const [
    totalCandidates,
    invited,
    accountsActivated,
    onlineNow,
    activeToday,
    appsCompleted,
    appsStarted,
    _appsPending,
    stuck,
    completionTimes,
    emailFunnel,
    unopened,
  ] = await Promise.all([
    prisma.candidate.count({ where: { organizationId } }),
    prisma.candidate.count({ where: { organizationId, invitationSent: true } }),
    prisma.candidate.count({ where: { organizationId, accountActivatedAt: { not: null } } }),
    prisma.candidate.count({ where: { organizationId, lastAccessAt: { gte: onlineCutoff } } }),
    prisma.candidate.count({ where: { organizationId, lastAccessAt: { gte: todayCutoff } } }),
    prisma.application.count({ where: { organizationId, status: "COMPLETED" } }),
    prisma.application.count({ where: { organizationId, status: { in: ["APPROVED","IN_PROGRESS"] as const } } }),
    prisma.application.count({ where: { organizationId, status: { in: ["PENDING","UNDER_REVIEW"] as const } } }),
    prisma.onboardingStep.groupBy({
      by: ["workflowStepId"],
      where: {
        onboardingProcess: { application: { organizationId, status: { in: ["APPROVED","IN_PROGRESS"] as const } } },
        status: "IN_PROGRESS",
      },
      _count: { _all: true },
    }),
    prisma.application.findMany({
      where: { organizationId, status: "COMPLETED" },
      select: { createdAt: true, updatedAt: true },
      take: 200,  // sample size — avoids scanning the full table
    }),
    getEmailFunnel(organizationId),
    listUnopenedInvitations(organizationId, 10),
  ]);

  // Resolve workflow step names in one query so the stuck-by-step chart reads
  // naturally for the operator.
  let stuckByStep: Array<{ step: string; count: number }> = [];
  if (stuck.length) {
    const stepIds = stuck.map((s) => s.workflowStepId);
    const steps = await prisma.workflowStep.findMany({
      where: { id: { in: stepIds } },
      select: { id: true, nameAr: true },
    });
    const nameOf = new Map(steps.map((s) => [s.id, s.nameAr]));
    stuckByStep = stuck
      .map((s) => ({ step: nameOf.get(s.workflowStepId) ?? "خطوة", count: s._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }

  const avgDays = completionTimes.length
    ? Math.round(
        completionTimes.reduce((acc, a) => acc + (a.updatedAt.getTime() - a.createdAt.getTime()) / DAY_MS, 0) /
        completionTimes.length,
      )
    : null;

  const completionRate = totalCandidates ? Math.round((appsCompleted / totalCandidates) * 100) : 0;
  const pendingProfiles = accountsActivated - appsCompleted;

  return {
    totalCandidates,
    invited,
    accountsActivated,
    startedJourney: appsStarted,
    completedProfiles: appsCompleted,
    pendingProfiles: pendingProfiles < 0 ? 0 : pendingProfiles,
    stuckByStep,
    onlineNow,
    activeToday,
    completionRate,
    avgDaysToComplete: avgDays,
    email: {
      sent:          emailFunnel.totalSent,
      opened:        emailFunnel.totalOpened,
      clicked:       emailFunnel.totalClicked,
      openRate:      emailFunnel.openRate,
      clickRate:     emailFunnel.clickRate,
      unopenedCount: emailFunnel.unopenedCount,
    },
    unopenedInvitations: unopened.map((u) => ({
      candidateId:    u.candidateId,
      candidateName:  u.candidateName,
      candidateEmail: u.candidateEmail,
      emailId:        u.emailId,
      sentAt:         u.sentAt.toISOString(),
      hoursAgo:       u.hoursAgo,
    })),
  };
}
