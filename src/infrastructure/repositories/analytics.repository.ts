import { prisma } from "@/infrastructure/database/client";

export interface AnalyticsStats {
  total: number;
  completed: number;
  inProgress: number;
  underReview: number;
  rejected: number;
  pendingAction: number;
  avgCompletionDays: number | null;
  firstPassYieldPct: number | null;
}

export interface MonthlyPoint {
  month: string; // "2026-09"
  monthLabel: string; // "سبتمبر"
  completed: number;
  total: number;
}

export interface TopRejectedDoc {
  nameAr: string;
  rejections: number;
}

const AR_MONTHS: Record<number, string> = {
  1: "يناير", 2: "فبراير", 3: "مارس", 4: "أبريل",
  5: "مايو", 6: "يونيو", 7: "يوليو", 8: "أغسطس",
  9: "سبتمبر", 10: "أكتوبر", 11: "نوفمبر", 12: "ديسمبر",
};

// ── Main analytics for one organization ────────────────────

export async function getAnalytics(organizationId: string): Promise<{
  stats: AnalyticsStats;
  monthly: MonthlyPoint[];
  topRejected: TopRejectedDoc[];
}> {
  const [statusGroups, avgResult, firstPassResult, monthlyRaw, topRejectedRaw] =
    await Promise.all([
      // 1. Status distribution
      prisma.application.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { id: true },
      }),

      // 2. Average completion time in days (raw SQL — Prisma has no date diff)
      prisma.$queryRaw<{ avg_days: number | null }[]>`
        SELECT ROUND(AVG(
          EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400.0
        )::numeric, 1)::float AS avg_days
        FROM applications
        WHERE "organizationId" = ${organizationId}
          AND "completedAt" IS NOT NULL
      `,

      // 3. First-pass yield:
      //    (approved docs with zero prior rejections) / (all approved docs)
      prisma.$queryRaw<{ total_approved: number; first_pass: number }[]>`
        WITH doc_reviews AS (
          SELECT
            dr."documentId",
            dr.decision,
            dr."reviewedAt",
            ROW_NUMBER() OVER (PARTITION BY dr."documentId" ORDER BY dr."reviewedAt") AS rn
          FROM document_reviews dr
          JOIN documents d ON d.id = dr."documentId"
          JOIN applications a ON a.id = d."applicationId"
          WHERE a."organizationId" = ${organizationId}
        )
        SELECT
          COUNT(DISTINCT CASE WHEN d.status = 'APPROVED' THEN d.id END)::int AS total_approved,
          COUNT(DISTINCT CASE
            WHEN d.status = 'APPROVED'
             AND NOT EXISTS (
               SELECT 1 FROM doc_reviews r2
               WHERE r2."documentId" = d.id AND r2.decision = 'REJECTED'
             )
            THEN d.id END)::int AS first_pass
        FROM documents d
        JOIN applications a ON a.id = d."applicationId"
        WHERE a."organizationId" = ${organizationId}
      `,

      // 4. Monthly trend — last 6 months
      prisma.$queryRaw<{ yr: number; mo: number; completed: number; total: number }[]>`
        SELECT
          EXTRACT(YEAR  FROM "createdAt")::int AS yr,
          EXTRACT(MONTH FROM "createdAt")::int AS mo,
          COUNT(*)::int AS total,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int AS completed
        FROM applications
        WHERE "organizationId" = ${organizationId}
          AND "createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY yr, mo
        ORDER BY yr, mo
      `,

      // 5. Top rejected document types (by rejection count)
      prisma.$queryRaw<{ name_ar: string; rejections: number }[]>`
        SELECT
          d."nameAr" AS name_ar,
          COUNT(*)::int AS rejections
        FROM document_reviews dr
        JOIN documents d ON d.id = dr."documentId"
        JOIN applications a ON a.id = d."applicationId"
        WHERE a."organizationId" = ${organizationId}
          AND dr.decision = 'REJECTED'
        GROUP BY d."nameAr"
        ORDER BY rejections DESC
        LIMIT 5
      `,
    ]);

  // Map status groups
  const byStatus: Record<string, number> = {};
  for (const g of statusGroups) byStatus[g.status] = g._count.id;

  const total = Object.values(byStatus).reduce((s, n) => s + n, 0);

  const stats: AnalyticsStats = {
    total,
    completed: byStatus["COMPLETED"] ?? 0,
    inProgress: byStatus["IN_PROGRESS"] ?? 0,
    underReview: byStatus["UNDER_REVIEW"] ?? 0,
    rejected: byStatus["REJECTED"] ?? 0,
    pendingAction: byStatus["PENDING"] ?? 0,
    avgCompletionDays: avgResult[0]?.avg_days ?? null,
    firstPassYieldPct:
      firstPassResult[0]?.total_approved > 0
        ? Math.round((firstPassResult[0].first_pass / firstPassResult[0].total_approved) * 100)
        : null,
  };

  // Build monthly points (fill months with no data as 0)
  const monthly: MonthlyPoint[] = monthlyRaw.map((r) => ({
    month: `${r.yr}-${String(r.mo).padStart(2, "0")}`,
    monthLabel: AR_MONTHS[r.mo] ?? String(r.mo),
    completed: r.completed,
    total: r.total,
  }));

  // If fewer than 3 points, pad with the current month so chart isn't empty
  if (monthly.length === 0) {
    const now = new Date();
    monthly.push({
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      monthLabel: AR_MONTHS[now.getMonth() + 1] ?? "",
      completed: stats.completed,
      total: stats.total,
    });
  }

  const topRejected: TopRejectedDoc[] = topRejectedRaw.map((r) => ({
    nameAr: r.name_ar,
    rejections: r.rejections,
  }));

  return { stats, monthly, topRejected };
}
