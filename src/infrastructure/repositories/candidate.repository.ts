import { prisma } from "@/infrastructure/database/client";
import { mapCandidate, mapAppStatus } from "./mappers";
import type { ApplicationStatus, Candidate, HRStat } from "@/types";
import {
  listDocumentRules,
  listExternalActions,
  type DocumentRule,
  type ExternalAction,
} from "@/infrastructure/workflow/document-rules.service";

type OrgDocMeta = {
  actions: Record<string, ExternalAction>;
  askByType: Map<DocumentRule["documentType"], boolean>;
};

async function loadOrgDocMeta(organizationId: string): Promise<OrgDocMeta> {
  const rules = await listDocumentRules(organizationId);
  const actions: Record<string, ExternalAction> = {};
  const askByType = new Map<DocumentRule["documentType"], boolean>();
  for (const r of rules) askByType.set(r.documentType, r.askBeforeUpload);
  if (rules.some((r) => r.externalActionUrl)) {
    Object.assign(actions, await listExternalActions(organizationId));
  }
  return { actions, askByType };
}

/**
 * Attaches HR-configured CTAs to document views, matched by DocumentType, and
 * appends the candidate's own e-mail to each action URL as `?email=`.
 *
 * `meta` is computed once per request (by caller) and reused across candidates —
 * both values depend only on organizationId, so computing them per-candidate
 * exhausted the Prisma connection pool on the HR list page.
 */
function enrichDocumentActions(candidate: Candidate, meta: OrgDocMeta): Candidate {
  if (!candidate.documents.length) return candidate;
  const { actions, askByType } = meta;
  const email = candidate.email;
  const name  = candidate.name;
  const docs = candidate.documents.map((d) => {
    const type = (d as unknown as { _type?: string })._type;
    const copy = { ...(d as unknown as { _type?: string }) };
    delete copy._type;
    if (type && askByType.get(type as never)) {
      Object.assign(copy, { askBeforeUpload: true });
    }
    const action = type ? actions[type] : undefined;
    if (action) {
      const params = new URLSearchParams();
      if (email)                       params.set("email",    email);
      if (name)                        params.set("name",     name);
      if (action.amount != null)       params.set("amount",   String(action.amount));
      if (action.currency)             params.set("currency", action.currency);
      const sep = action.url.includes("?") ? "&" : "?";
      const url = params.toString() ? `${action.url}${sep}${params.toString()}` : action.url;
      Object.assign(copy, {
        externalActionUrl:   url,
        externalActionLabel: action.label,
        externalFeeLabel:    action.fee,
        candidateEmail:      email,
      });
    }
    return copy as typeof d;
  });
  return { ...candidate, documents: docs };
}

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
  const meta = await loadOrgDocMeta(organizationId);
  return enrichDocumentActions(mapCandidate(db), meta);
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
  const meta = await loadOrgDocMeta(organizationId);
  return enrichDocumentActions(mapCandidate(db, applicationId), meta);
}

/**
 * Returns all candidates for an organization, mapped to UI shape.
 * Used by HR candidates list.
 */
export async function getCandidatesByOrganization(
  organizationId: string,
  opts: { take?: number } = {}
): Promise<Candidate[]> {
  const dbs = await prisma.candidate.findMany({
    where: { organizationId },
    include: candidateInclude,
    orderBy: { createdAt: "desc" },
    ...(opts.take ? { take: opts.take } : {}),
  });
  const mapped = dbs.map((db) => mapCandidate(db));
  // Load org-wide document meta ONCE, then enrich each candidate synchronously —
  // previously this spawned 2 × N parallel workflow queries and exhausted the Prisma pool.
  const meta = await loadOrgDocMeta(organizationId);
  const enriched = mapped.map((c) => enrichDocumentActions(c, meta));

  // Splice in latest email engagement per candidate — one batched lookup.
  const { getLatestEmailStatusPerCandidate } = await import("@/infrastructure/notifications/email-stats.service");
  const latest = await getLatestEmailStatusPerCandidate(organizationId, enriched.map((c) => c.id));
  for (const c of enriched) {
    const row = latest.get(c.id);
    if (row) {
      c.emailStatus = row.code;
      c.lastEmailAt = row.createdAt.toISOString();
    } else {
      c.emailStatus = "not_sent";
    }
  }
  return enriched;
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
