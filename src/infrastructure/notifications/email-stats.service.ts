/**
 * Aggregated email engagement stats for the HR dashboard and candidate list.
 *
 * The three queries below all read directly from `email_logs` with indexed
 * filters (orgId, candidateId, status) so they stay cheap even as the log
 * grows. Called from /api/hr/stats and from the candidate list repository.
 */
import { prisma } from "@/infrastructure/database/client";
import type { EmailStatus } from "@prisma/client";

const DELIVERED_OR_SENT: EmailStatus[] = ["SENT", "DELIVERED"];

export interface EmailFunnel {
  totalSent:      number;   // distinct recipient-rows that reached a transport
  totalOpened:    number;   // rows with firstOpenedAt set
  totalClicked:   number;   // rows with firstClickedAt set
  openRate:       number;   // 0-100
  clickRate:      number;   // 0-100
  unopenedCount:  number;   // sent > 24h ago and still not opened
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getEmailFunnel(organizationId: string): Promise<EmailFunnel> {
  const oneDayAgo = new Date(Date.now() - DAY_MS);
  // A row counts as "sent" for the funnel if the transport accepted it —
  // QUEUED (still trying) and FAILED are explicitly excluded.
  const sentWhere = { organizationId, status: { in: DELIVERED_OR_SENT } };

  const [totalSent, totalOpened, totalClicked, unopenedCount] = await Promise.all([
    prisma.emailLog.count({ where: sentWhere }),
    prisma.emailLog.count({ where: { ...sentWhere, firstOpenedAt: { not: null } } }),
    prisma.emailLog.count({ where: { ...sentWhere, firstClickedAt: { not: null } } }),
    prisma.emailLog.count({ where: { ...sentWhere, firstOpenedAt: null, createdAt: { lt: oneDayAgo } } }),
  ]);

  return {
    totalSent,
    totalOpened,
    totalClicked,
    openRate:  totalSent ? Math.round((totalOpened  / totalSent) * 100) : 0,
    clickRate: totalSent ? Math.round((totalClicked / totalSent) * 100) : 0,
    unopenedCount,
  };
}

export type EmailStatusSimple = "not_sent" | "sent" | "opened" | "clicked" | "bounced" | "failed";

/**
 * Latest email status per candidate — returned as a Map so the caller can
 * splice into each row without extra queries. Picks the most recent email
 * matched to each candidate (any status) and simplifies to a UI code.
 */
export async function getLatestEmailStatusPerCandidate(
  organizationId: string,
  candidateIds: string[],
): Promise<Map<string, { code: EmailStatusSimple; openedAt: Date | null; clickedAt: Date | null; createdAt: Date }>> {
  if (!candidateIds.length) return new Map();
  // One grouped-by lookup — Prisma doesn't expose DISTINCT ON, so we take all
  // rows, sort client-side, and keep the first per candidate. The row count
  // is bounded by candidateIds.length × (avg mails per candidate) which is
  // small for typical HR usage.
  const rows = await prisma.emailLog.findMany({
    where: { organizationId, candidateId: { in: candidateIds } },
    orderBy: { createdAt: "desc" },
    select: {
      candidateId: true,
      status: true,
      firstOpenedAt: true,
      firstClickedAt: true,
      createdAt: true,
    },
  });

  const latest = new Map<string, { code: EmailStatusSimple; openedAt: Date | null; clickedAt: Date | null; createdAt: Date }>();
  for (const r of rows) {
    if (!r.candidateId || latest.has(r.candidateId)) continue;
    let code: EmailStatusSimple = "sent";
    if (r.status === "BOUNCED")        code = "bounced";
    else if (r.status === "FAILED")    code = "failed";
    else if (r.firstClickedAt)         code = "clicked";
    else if (r.firstOpenedAt)          code = "opened";
    else if (r.status === "DELIVERED" || r.status === "SENT") code = "sent";
    else                               code = "sent";
    latest.set(r.candidateId, {
      code,
      openedAt:  r.firstOpenedAt,
      clickedAt: r.firstClickedAt,
      createdAt: r.createdAt,
    });
  }
  return latest;
}

export interface UnopenedInvitationRow {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  emailId: string;
  sentAt: Date;
  hoursAgo: number;
}

/**
 * Candidates whose last outbound mail is >24h old and still has no open —
 * the HR "needs a nudge" shortlist. Ordered newest unfilled first, capped
 * at `limit` so the dashboard stays snappy.
 */
export async function listUnopenedInvitations(
  organizationId: string,
  limit = 10,
): Promise<UnopenedInvitationRow[]> {
  const oneDayAgo = new Date(Date.now() - DAY_MS);
  const rows = await prisma.emailLog.findMany({
    where: {
      organizationId,
      status: { in: DELIVERED_OR_SENT },
      firstOpenedAt: null,
      createdAt: { lt: oneDayAgo },
      candidateId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, createdAt: true, candidateId: true },
  });
  if (!rows.length) return [];

  // Resolve candidate names separately — email_logs.candidateId is a loose FK
  // without a Prisma relation defined.
  const candidateIds = Array.from(new Set(rows.map((r) => r.candidateId!).filter(Boolean)));
  const candidates = await prisma.candidate.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true, nameAr: true, email: true },
  });
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const now = Date.now();
  return rows
    .map((r) => {
      const c = r.candidateId ? byId.get(r.candidateId) : undefined;
      if (!c) return null;
      return {
        emailId:        r.id,
        sentAt:         r.createdAt,
        hoursAgo:       Math.round((now - r.createdAt.getTime()) / (60 * 60 * 1000)),
        candidateId:    c.id,
        candidateName:  c.nameAr,
        candidateEmail: c.email,
      };
    })
    .filter((r): r is UnopenedInvitationRow => r !== null);
}
