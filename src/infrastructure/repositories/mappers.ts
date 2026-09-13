/**
 * Pure mapping functions from Prisma DB types → UI domain types.
 * No Prisma imports here — receives plain objects so mappers stay testable.
 */
import type {
  Application,
  Candidate as DBCandidate,
  Document as DBDocument,
  OnboardingProcess,
  OnboardingStep as DBOnboardingStep,
  WorkflowStep,
  DocumentReview,
} from "@prisma/client";
import type {
  Candidate,
  Document,
  OnboardingStep,
  ApplicationStatus,
  DocumentStatus,
} from "@/types";

// ── Status mappings ─────────────────────────────────────────────────────────

const appStatusMap: Record<string, ApplicationStatus> = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  UNDER_REVIEW: "under_review",
  APPROVED: "completed",
  COMPLETED: "completed",
  REJECTED: "rejected",
  WITHDRAWN: "rejected",
};

const docStatusMap: Record<string, DocumentStatus> = {
  NOT_UPLOADED: "not_uploaded",
  UPLOADED: "uploaded",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  REJECTED: "rejected",
};

// ── Document mapper ─────────────────────────────────────────────────────────

type DBDocWithReviews = DBDocument & {
  reviews: (DocumentReview & { reviewer: { nameAr: string } | null })[];
};

export function mapDocument(doc: DBDocWithReviews): Document {
  const rejected = doc.reviews.find((r) => r.decision === "REJECTED");
  return {
    id: doc.id,
    name: doc.nameAr, // UI uses nameAr in name field
    nameAr: doc.nameAr,
    required: doc.isRequired,
    status: (docStatusMap[doc.status] ?? "not_uploaded") as DocumentStatus,
    uploadedAt: doc.uploadedAt?.toISOString().split("T")[0],
    rejectionReason: rejected?.reason ?? undefined,
    fileUrl: doc.filePath ? `/api/files/${doc.filePath}` : undefined,
    filePath: doc.filePath ?? undefined,
  };
}

// ── OnboardingStep mapper ───────────────────────────────────────────────────

const stepStatusMap: Record<string, OnboardingStep["status"]> = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  SKIPPED: "skipped",
};

type DBStepWithWorkflow = DBOnboardingStep & { workflowStep: WorkflowStep };

export function mapOnboardingStep(step: DBStepWithWorkflow): OnboardingStep {
  return {
    id: step.id,
    title: step.workflowStep.nameAr,
    description: step.workflowStep.description ?? "",
    status: stepStatusMap[step.status] ?? "pending",
    order: step.workflowStep.order,
    dueDate: step.dueDate?.toISOString().split("T")[0],
  };
}

// ── completionPercentage computation ───────────────────────────────────────
// Never stored — always derived from step statuses.

export function computeCompletion(steps: OnboardingStep[]): number {
  if (steps.length === 0) return 0;
  const done = steps.filter((s) => s.status === "completed").length;
  return Math.round((done / steps.length) * 100);
}

// ── Full Candidate mapper ───────────────────────────────────────────────────

type DBCandidateWithRelations = DBCandidate & {
  applications: (Application & {
    documents: DBDocWithReviews[];
    onboardingProcess:
      | (OnboardingProcess & { steps: DBStepWithWorkflow[] })
      | null;
  })[];
};

export function mapCandidate(
  db: DBCandidateWithRelations,
  applicationId?: string
): Candidate {
  // Pick the requested application or the most recent active one
  const app =
    db.applications.find((a) => a.id === applicationId) ??
    db.applications[0];

  const steps = (app?.onboardingProcess?.steps ?? [])
    .map(mapOnboardingStep)
    .sort((a, b) => a.order - b.order);

  const documents = (app?.documents ?? []).map(mapDocument);

  return {
    id: db.id,
    name: db.nameAr,
    nationalId: db.nationalId,
    email: db.email ?? "",
    phone: db.phone ?? "",
    jobTitle: db.jobTitle ?? "",
    department: db.department ?? "",
    acceptanceDate: db.acceptanceDate?.toISOString().split("T")[0] ?? "",
    startDate: db.expectedStartDate?.toISOString().split("T")[0],
    status: (appStatusMap[app?.status ?? "PENDING"] ?? "pending") as ApplicationStatus,
    completionPercentage: computeCompletion(steps),
    hrWelcomeNote: app?.hrWelcomeNote ?? null,
    steps,
    documents,
  };
}
