import { Prisma } from "@prisma/client";
import { withTenantTransaction, type TenantPrisma } from "@/infrastructure/tenant/scoped-prisma";

// Every query below runs on ONE connection inside withTenantTransaction, so
// app.current_org is set once and PostgreSQL RLS filters all of them — the raw SQL
// never has to remember the tenant predicate itself. Aggregations happen in SQL;
// nothing here loads rows to count them in JS.

export type Period = "30" | "90" | "365" | "all";
export const PERIODS: { value: Period; label: string }[] = [
  { value: "30",  label: "30 يوماً" },
  { value: "90",  label: "90 يوماً" },
  { value: "365", label: "سنة" },
  { value: "all", label: "الكل" },
];

export interface Overview {
  total: number;
  byStatus: Record<string, number>;
  completionPct: number | null;
  avgCompletionDays: number | null;
  avgDaysToSignature: number | null;
  firstPassYieldPct: number | null;
}
export interface MonthlyPoint { month: string; label: string; total: number; completed: number }
export interface DepartmentRow { department: string; total: number; completed: number }
export interface DocumentStats {
  byStatus: Record<string, number>;
  awaitingReview: number;
  topRejected: { nameAr: string; rejections: number }[];
}
export interface FunnelStep { order: number; nameAr: string; completed: number; inProgress: number }
export interface ContractStats { pending: number; signed: number; cancelled: number }
export interface CustomFieldReport {
  id: string; key: string; labelAr: string; type: string;
  filled: number;
  distribution?: { value: string; count: number }[];
  numeric?: { min: number; avg: number; max: number };
}
export interface AttentionRow {
  documentId: string; candidateId: string; candidateName: string; documentName: string; daysWaiting: number;
}

export interface Reports {
  period: Period;
  overview: Overview;
  monthly: MonthlyPoint[];
  byDepartment: DepartmentRow[];
  documents: DocumentStats;
  funnel: FunnelStep[];
  contracts: ContractStats;
  customFields: CustomFieldReport[];
  attention: AttentionRow[];
}

const AR_MONTHS = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function since(period: Period): Prisma.Sql {
  if (period === "all") return Prisma.sql`TRUE`;
  const days = Number(period);
  return Prisma.sql`a."createdAt" >= NOW() - (${days} || ' days')::interval`;
}

export function parsePeriod(v: string | undefined): Period {
  return (PERIODS.some((p) => p.value === v) ? v : "90") as Period;
}

export async function getReports(db: TenantPrisma, organizationId: string, period: Period): Promise<Reports> {
  return withTenantTransaction(db, organizationId, async (tx) => {
    const inPeriod = since(period);

    const statusRows = await tx.$queryRaw<{ status: string; n: number }[]>`
      SELECT a.status::text AS status, COUNT(*)::int AS n
      FROM applications a WHERE ${inPeriod} GROUP BY a.status`;

    const timing = await tx.$queryRaw<{ avg_completion: number | null; avg_to_sign: number | null }[]>`
      SELECT
        ROUND(AVG(EXTRACT(EPOCH FROM (a."completedAt" - a."createdAt")) / 86400.0)::numeric, 1)::float AS avg_completion,
        ROUND(AVG(EXTRACT(EPOCH FROM (s."signedAt"    - a."createdAt")) / 86400.0)::numeric, 1)::float AS avg_to_sign
      FROM applications a
      LEFT JOIN contracts c ON c."applicationId" = a.id AND c.status = 'FULLY_SIGNED'
      LEFT JOIN LATERAL (
        SELECT MIN("signedAt") AS "signedAt" FROM signatures WHERE "contractId" = c.id AND "signerType" = 'CANDIDATE'
      ) s ON TRUE
      WHERE ${inPeriod}`;

    const firstPass = await tx.$queryRaw<{ approved: number; first_pass: number }[]>`
      SELECT
        COUNT(*)::int AS approved,
        COUNT(*) FILTER (WHERE NOT EXISTS (
          SELECT 1 FROM document_reviews r WHERE r."documentId" = d.id AND r.decision = 'REJECTED'
        ))::int AS first_pass
      FROM documents d JOIN applications a ON a.id = d."applicationId"
      WHERE d.status = 'APPROVED' AND ${inPeriod}`;

    const monthlyRows = await tx.$queryRaw<{ yr: number; mo: number; total: number; completed: number }[]>`
      SELECT EXTRACT(YEAR FROM a."createdAt")::int AS yr, EXTRACT(MONTH FROM a."createdAt")::int AS mo,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE a.status = 'COMPLETED')::int AS completed
      FROM applications a
      WHERE a."createdAt" >= date_trunc('month', NOW()) - INTERVAL '5 months'
      GROUP BY yr, mo ORDER BY yr, mo`;

    const deptRows = await tx.$queryRaw<DepartmentRow[]>`
      SELECT c.department, COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE a.status = 'COMPLETED')::int AS completed
      FROM applications a JOIN candidates c ON c.id = a."candidateId"
      WHERE ${inPeriod}
      GROUP BY c.department ORDER BY total DESC, c.department LIMIT 8`;

    const docStatusRows = await tx.$queryRaw<{ status: string; n: number }[]>`
      SELECT d.status::text AS status, COUNT(*)::int AS n
      FROM documents d JOIN applications a ON a.id = d."applicationId"
      WHERE ${inPeriod} GROUP BY d.status`;

    const topRejected = await tx.$queryRaw<{ nameAr: string; rejections: number }[]>`
      SELECT d."nameAr" AS "nameAr", COUNT(*)::int AS rejections
      FROM document_reviews r JOIN documents d ON d.id = r."documentId" JOIN applications a ON a.id = d."applicationId"
      WHERE r.decision = 'REJECTED' AND ${inPeriod}
      GROUP BY d."nameAr" ORDER BY rejections DESC LIMIT 5`;

    const funnel = await tx.$queryRaw<FunnelStep[]>`
      SELECT ws."order", ws."nameAr" AS "nameAr",
             COUNT(*) FILTER (WHERE os.status = 'COMPLETED')::int   AS completed,
             COUNT(*) FILTER (WHERE os.status = 'IN_PROGRESS')::int AS "inProgress"
      FROM onboarding_steps os
      JOIN workflow_steps ws ON ws.id = os."workflowStepId"
      JOIN onboarding_processes op ON op.id = os."onboardingProcessId"
      JOIN applications a ON a.id = op."applicationId"
      WHERE ${inPeriod}
      GROUP BY ws."order", ws."nameAr" ORDER BY ws."order"`;

    const contractRows = await tx.$queryRaw<{ status: string; n: number }[]>`
      SELECT c.status::text AS status, COUNT(*)::int AS n
      FROM contracts c JOIN applications a ON a.id = c."applicationId"
      WHERE ${inPeriod} GROUP BY c.status`;

    // Custom fields: definitions + per-value distribution + numeric aggregates — three
    // set-based queries regardless of how many fields or candidates exist.
    const defs = await tx.$queryRaw<{ id: string; key: string; labelAr: string; type: string; filled: number }[]>`
      SELECT f.id, f.key, f."labelAr" AS "labelAr", f.type::text AS type,
             (SELECT COUNT(*) FROM candidate_field_values v WHERE v."definitionId" = f.id AND v.value <> '')::int AS filled
      FROM candidate_field_definitions f ORDER BY f."order", f."createdAt"`;

    const dist = await tx.$queryRaw<{ definitionId: string; value: string; n: number }[]>`
      SELECT v."definitionId" AS "definitionId", v.value, COUNT(*)::int AS n
      FROM candidate_field_values v JOIN candidate_field_definitions f ON f.id = v."definitionId"
      WHERE f.type IN ('SELECT', 'BOOLEAN') AND v.value <> ''
      GROUP BY v."definitionId", v.value ORDER BY n DESC`;

    const numeric = await tx.$queryRaw<{ definitionId: string; min: number; avg: number; max: number }[]>`
      SELECT v."definitionId" AS "definitionId",
             MIN(v.value::numeric)::float AS min, ROUND(AVG(v.value::numeric), 2)::float AS avg, MAX(v.value::numeric)::float AS max
      FROM candidate_field_values v JOIN candidate_field_definitions f ON f.id = v."definitionId"
      WHERE f.type = 'NUMBER' AND v.value ~ '^-?[0-9]+(\\.[0-9]+)?$'
      GROUP BY v."definitionId"`;

    const attention = await tx.$queryRaw<AttentionRow[]>`
      SELECT d.id AS "documentId", c.id AS "candidateId", c."nameAr" AS "candidateName", d."nameAr" AS "documentName",
             FLOOR(EXTRACT(EPOCH FROM (NOW() - d."uploadedAt")) / 86400)::int AS "daysWaiting"
      FROM documents d
      JOIN applications a ON a.id = d."applicationId"
      JOIN candidates c ON c.id = a."candidateId"
      WHERE d.status IN ('UPLOADED', 'UNDER_REVIEW') AND d."uploadedAt" IS NOT NULL
      ORDER BY d."uploadedAt" ASC LIMIT 10`;

    const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, r.n]));
    const total = statusRows.reduce((s, r) => s + r.n, 0);
    const completed = byStatus.COMPLETED ?? 0;
    const fp = firstPass[0];

    const distByDef = new Map<string, { value: string; count: number }[]>();
    for (const r of dist) {
      if (!distByDef.has(r.definitionId)) distByDef.set(r.definitionId, []);
      distByDef.get(r.definitionId)!.push({ value: r.value, count: r.n });
    }
    const numByDef = new Map(numeric.map((r) => [r.definitionId, { min: r.min, avg: r.avg, max: r.max }]));

    const docByStatus = Object.fromEntries(docStatusRows.map((r) => [r.status, r.n]));
    const contractByStatus = Object.fromEntries(contractRows.map((r) => [r.status, r.n]));

    return {
      period,
      overview: {
        total,
        byStatus,
        completionPct: total > 0 ? Math.round((completed / total) * 100) : null,
        avgCompletionDays: timing[0]?.avg_completion ?? null,
        avgDaysToSignature: timing[0]?.avg_to_sign ?? null,
        firstPassYieldPct: fp && fp.approved > 0 ? Math.round((fp.first_pass / fp.approved) * 100) : null,
      },
      monthly: monthlyRows.map((r) => ({
        month: `${r.yr}-${String(r.mo).padStart(2, "0")}`, label: AR_MONTHS[r.mo] ?? String(r.mo),
        total: r.total, completed: r.completed,
      })),
      byDepartment: deptRows,
      documents: {
        byStatus: docByStatus,
        awaitingReview: (docByStatus.UPLOADED ?? 0) + (docByStatus.UNDER_REVIEW ?? 0),
        topRejected,
      },
      funnel,
      contracts: {
        pending: contractByStatus.PENDING_SIGNATURE ?? 0,
        signed: contractByStatus.FULLY_SIGNED ?? 0,
        cancelled: contractByStatus.CANCELLED ?? 0,
      },
      customFields: defs.map((d) => ({
        ...d,
        distribution: distByDef.get(d.id),
        numeric: numByDef.get(d.id),
      })),
      attention,
    };
  });
}

// Flat candidate export with custom fields pivoted into columns — two queries total.
export async function getCandidateExportRows(db: TenantPrisma, organizationId: string) {
  return withTenantTransaction(db, organizationId, async (tx) => {
    const defs = await tx.$queryRaw<{ id: string; key: string; labelAr: string; type: string }[]>`
      SELECT id, key, "labelAr", type::text AS type FROM candidate_field_definitions ORDER BY "order", "createdAt"`;

    const rows = await tx.$queryRaw<{
      id: string; nameAr: string; nationalId: string; email: string; phone: string | null; jobTitle: string; department: string;
      acceptanceDate: Date; expectedStartDate: Date | null; status: string | null; completedAt: Date | null;
      docsTotal: number; docsApproved: number; contractStatus: string | null; custom: Record<string, string> | null;
    }[]>`
      SELECT c.id, c."nameAr", c."nationalId", c.email, c.phone, c."jobTitle", c.department,
             c."acceptanceDate", c."expectedStartDate", a.status::text AS status, a."completedAt",
             (SELECT COUNT(*) FROM documents d WHERE d."applicationId" = a.id)::int AS "docsTotal",
             (SELECT COUNT(*) FROM documents d WHERE d."applicationId" = a.id AND d.status = 'APPROVED')::int AS "docsApproved",
             (SELECT ct.status::text FROM contracts ct WHERE ct."applicationId" = a.id AND ct.status IN ('PENDING_SIGNATURE','FULLY_SIGNED') ORDER BY ct."createdAt" DESC LIMIT 1) AS "contractStatus",
             (SELECT jsonb_object_agg(v."definitionId", v.value) FROM candidate_field_values v WHERE v."candidateId" = c.id) AS custom
      FROM candidates c
      LEFT JOIN LATERAL (SELECT * FROM applications ap WHERE ap."candidateId" = c.id ORDER BY ap."createdAt" DESC LIMIT 1) a ON TRUE
      ORDER BY c."createdAt" DESC`;

    return { defs, rows };
  });
}
