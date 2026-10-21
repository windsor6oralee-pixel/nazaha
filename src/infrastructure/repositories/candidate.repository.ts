import { prisma } from "@/infrastructure/database/client";
import { mapCandidate, mapAppStatus } from "./mappers";
import type { ApplicationStatus, Candidate, HRStat } from "@/types";

// ── Shared Prisma include ────────────────────────────────────────────────────

const candidateInclude = {
  applications: {
    orderBy: { createdAt: "desc" as const },
    include: {
      documents: {
        include: {
          reviews: {
            include: { reviewer: { select: { nameAr: true } } },
          },
        },
        orderBy: { createdAt: "asc" as const },
      },
      onboardingProcess: {
        include: {
          steps: {
            include: { workflowStep: true },
            orderBy: { workflowStep: { order: "asc" as const } },
          },
        },
      },
    },
  },
} as const;

// ── Queries ──────────────────────────────────────────────────────────────────

// Every lookup takes the caller's organizationId first: a request-supplied id is never
// enough on its own, so a candidate from another tenant resolves to null (→ 404).

export async function getCandidateById(organizationId: string, id: string): Promise<Candidate | null> {
  const db = await prisma.candidate.findFirst({
    where: { id, organizationId },
    include: candidateInclude,
  });
  if (!db) return null;
  return mapCandidate(db);
}

/**
 * Returns the candidate associated with an applicationId.
 * Used by the candidate portal where the session carries applicationId.
 */
export async function getCandidateByApplicationId(
  organizationId: string,
  applicationId: string
): Promise<Candidate | null> {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, organizationId },
    select: { candidateId: true },
  });
  if (!application) return null;

  const db = await prisma.candidate.findFirst({
    where: { id: application.candidateId, organizationId },
    include: candidateInclude,
  });
  if (!db) return null;
  return mapCandidate(db, applicationId);
}

/**
 * Returns all candidates for an organization, mapped to UI shape.
 * Used by HR candidates list.
 */
export async function getCandidatesByOrganization(
  organizationId: string
): Promise<Candidate[]> {
  const dbs = await prisma.candidate.findMany({
    where: { organizationId },
    include: candidateInclude,
    orderBy: { createdAt: "desc" },
  });
  return dbs.map((db) => mapCandidate(db));
}

/**
 * HR dashboard statistics — always computed from DB state.
 *
 * Counts **candidates**, not applications: every candidate is counted once, under
 * the status of their latest application — the exact status the candidates list
 * shows. A counter and the list it links to can therefore never disagree.
 */
export async function getHRStats(organizationId: string): Promise<HRStat> {
  const candidates = await prisma.candidate.findMany({
    where: { organizationId },
    select: {
      applications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });

  const counts: Record<ApplicationStatus, number> = {
    pending: 0,
    in_progress: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    completed: 0,
  };
  for (const c of candidates) {
    counts[mapAppStatus(c.applications[0]?.status)] += 1;
  }

  return {
    total: candidates.length,
    approved: counts.approved,
    inProgress: counts.in_progress,
    underReview: counts.under_review,
    pendingAction: counts.pending,
    completed: counts.completed,
    rejected: counts.rejected,
  };
}

// ── Contract query ────────────────────────────────────────────────────────────

export async function getContractForApplication(organizationId: string, applicationId: string) {
  return prisma.contract.findFirst({
    where: { applicationId, organizationId, status: { in: ["PENDING_SIGNATURE", "FULLY_SIGNED"] } },
    select: {
      id: true,
      type: true,
      nameAr: true,
      status: true,
      generatedAt: true,
      renderedHtml: true,
      contentHash: true,
      signatures: {
        where: { signerType: "CANDIDATE" },
        select: { signedAt: true },
        orderBy: { signedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
