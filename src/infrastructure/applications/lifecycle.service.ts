/*
 * خدمة دورة حياة الطلب — كل تغيير لحالة الطلب أو خطواته يمرّ من هنا.
 *
 * تعمل دائماً داخل معاملة الجهة (withTenantTransaction)، فتنطبق RLS على كل
 * قراءة وكتابة، ويُسجَّل كل انتقال في سجل التدقيق.
 */
import type { ApplicationStatus, Prisma } from "@prisma/client";
import { tenantPrisma, withTenantTransaction, type TenantTx } from "@/infrastructure/tenant/scoped-prisma";
import { getOrgNotifier, templates } from "@/infrastructure/notifications";
import {
  availableActions,
  checkTransition,
  deriveAutoStatus,
  deriveStepStatus,
  type ActionAvailability,
  type LifecycleAction,
  type LifecycleSnapshot,
} from "./lifecycle";

export class LifecycleError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 422,
    message: string,
  ) {
    super(message);
    this.name = "LifecycleError";
  }
}

const CONTRACT_STEP_TYPES = new Set(["CONTRACT", "SIGNATURE"]);

async function loadState(tx: TenantTx, applicationId: string) {
  const app = await tx.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      offerAcceptedAt: true,
      statusReason: true,
      statusChangedAt: true,
      candidateId: true,
      documents: { select: { status: true, isRequired: true } },
      contracts: { select: { status: true } },
      workflow: { select: { steps: { select: { type: true } } } },
      onboardingProcess: {
        select: { id: true, completedAt: true, steps: { select: { id: true, status: true, workflowStep: { select: { type: true } } } } },
      },
    },
  });
  if (!app) throw new LifecycleError(404, "الطلب غير موجود");

  const snapshot: LifecycleSnapshot = {
    status: app.status,
    offerAccepted: !!app.offerAcceptedAt,
    requiredDocuments: app.documents.filter((d) => d.isRequired).map((d) => d.status),
    requiresContract: app.workflow.steps.some((s) => CONTRACT_STEP_TYPES.has(s.type)),
    hasSignedContract: app.contracts.some((c) => c.status === "FULLY_SIGNED"),
    hasPendingContract: app.contracts.some((c) => c.status === "PENDING_SIGNATURE"),
  };
  return { app, snapshot };
}

type Actor =
  | { kind: "USER"; userId: string }
  | { kind: "CANDIDATE"; candidateId: string }
  | { kind: "SYSTEM" };

function auditActor(actor: Actor) {
  if (actor.kind === "USER") return { actorType: "USER" as const, userId: actor.userId };
  if (actor.kind === "CANDIDATE") return { actorType: "CANDIDATE" as const };
  return { actorType: "SYSTEM" as const };
}

/**
 * يطابق حالة الطلب وخطواته مع الوقائع الحالية. يُستدعى بعد كل حدث يغيّرها
 * (رفع مستند، مراجعة، عقد، توقيع، قرار يدوي). آمن للتكرار: لا يكتب إلا ما تغيّر.
 */
export async function syncApplicationProgress(
  tx: TenantTx,
  applicationId: string,
  actor: Actor = { kind: "SYSTEM" },
): Promise<{ status: ApplicationStatus; changed: boolean }> {
  const { app, snapshot } = await loadState(tx, applicationId);

  const nextStatus = deriveAutoStatus(snapshot);
  const changed = nextStatus !== app.status;
  if (changed) {
    await tx.application.update({
      where: { id: applicationId },
      data: { status: nextStatus, statusChangedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        ...auditActor(actor),
        candidateId: app.candidateId,
        applicationId,
        action: "application.status_changed",
        resource: "Application",
        resourceId: applicationId,
        metadata: { from: app.status, to: nextStatus, trigger: "auto" },
      },
    });
  }

  const effective = { ...snapshot, status: nextStatus };
  const process = app.onboardingProcess;
  if (process) {
    const now = new Date();
    for (const step of process.steps) {
      const next = deriveStepStatus(step.workflowStep.type, effective, step.status);
      if (next === step.status) continue;
      await tx.onboardingStep.update({
        where: { id: step.id },
        data: {
          status: next,
          ...(next === "IN_PROGRESS" ? { startedAt: now } : {}),
          completedAt: next === "COMPLETED" ? now : null,
        },
      });
    }
    const processDone = nextStatus === "COMPLETED";
    if (processDone !== !!process.completedAt) {
      await tx.onboardingProcess.update({
        where: { id: process.id },
        data: { completedAt: processDone ? now : null },
      });
    }
  }

  return { status: nextStatus, changed };
}

/** نسخة مستقلة لمسارات لا تملك معاملة مفتوحة. */
export async function refreshApplicationProgress(organizationId: string, applicationId: string, actor?: Actor) {
  const db = tenantPrisma(organizationId);
  return withTenantTransaction(db, organizationId, (tx) => syncApplicationProgress(tx, applicationId, actor));
}

export interface ApplicationLifecycleView {
  applicationId: string;
  status: ApplicationStatus;
  statusReason: string | null;
  statusChangedAt: Date | null;
  offerAcceptedAt: Date | null;
  snapshot: LifecycleSnapshot;
  actions: ActionAvailability[];
}

export async function getApplicationLifecycle(
  organizationId: string,
  applicationId: string,
  role: string,
): Promise<ApplicationLifecycleView | null> {
  const db = tenantPrisma(organizationId);
  return withTenantTransaction(db, organizationId, async (tx) => {
    try {
      const { app, snapshot } = await loadState(tx, applicationId);
      return {
        applicationId,
        status: app.status,
        statusReason: app.statusReason,
        statusChangedAt: app.statusChangedAt,
        offerAcceptedAt: app.offerAcceptedAt,
        snapshot,
        actions: availableActions(snapshot, role),
      };
    } catch (e) {
      if (e instanceof LifecycleError && e.status === 404) return null;
      throw e;
    }
  });
}

const STATUS_TIMESTAMP: Partial<Record<ApplicationStatus, keyof Prisma.ApplicationUpdateInput>> = {
  APPROVED: "approvedAt",
  REJECTED: "rejectedAt",
  WITHDRAWN: "withdrawnAt",
  COMPLETED: "completedAt",
};

async function notifyCandidate(organizationId: string, applicationId: string, status: ApplicationStatus, reason: string | null) {
  const db = tenantPrisma(organizationId);
  const app = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      candidate: { select: { nameAr: true, email: true, jobTitle: true } },
      organization: { select: { nameAr: true } },
    },
  });
  if (!app) return;
  const message = templates.applicationStatusChanged({
    candidateName: app.candidate.nameAr,
    jobTitle: app.candidate.jobTitle,
    organizationName: app.organization.nameAr,
    status,
    reason,
  });
  if (!message) return;
  const notifier = await getOrgNotifier(organizationId);
  await notifier.send({ to: app.candidate.email, ...message });
}

/** قرار يدوي من الموارد البشرية على طلب. */
export async function performLifecycleAction(input: {
  organizationId: string;
  userId: string;
  role: string;
  applicationId: string;
  action: LifecycleAction;
  reason?: string | null;
}): Promise<{ from: ApplicationStatus; to: ApplicationStatus }> {
  const { organizationId, applicationId, action } = input;
  const reason = input.reason?.trim() || null;
  const db = tenantPrisma(organizationId);

  const result = await withTenantTransaction(db, organizationId, async (tx) => {
    const { app, snapshot } = await loadState(tx, applicationId);
    const check = checkTransition(action, snapshot, input.role, reason);
    if (!check.ok) {
      throw new LifecycleError(check.code === "FORBIDDEN" ? 403 : check.code === "INVALID_STATE" ? 409 : 422, check.message);
    }

    const now = new Date();
    const stamp = STATUS_TIMESTAMP[check.to];
    await tx.application.update({
      where: { id: applicationId },
      data: {
        status: check.to,
        statusReason: reason,
        statusChangedAt: now,
        ...(stamp ? { [stamp]: now } : {}),
        // إعادة الفتح تمحو تواريخ القرار النهائي السابق.
        ...(action === "reopen" ? { rejectedAt: null, withdrawnAt: null } : {}),
      },
    });

    // طلب انتهى لا يبقى له عقد ينتظر التوقيع.
    if (check.to === "REJECTED" || check.to === "WITHDRAWN") {
      await tx.contract.updateMany({
        where: { applicationId, status: "PENDING_SIGNATURE" },
        data: { status: "CANCELLED" },
      });
    }

    await tx.auditLog.create({
      data: {
        actorType: "USER",
        userId: input.userId,
        candidateId: app.candidateId,
        applicationId,
        action: `application.${action}`,
        resource: "Application",
        resourceId: applicationId,
        metadata: { from: app.status, to: check.to, reason },
      },
    });

    await syncApplicationProgress(tx, applicationId, { kind: "USER", userId: input.userId });
    return { from: app.status, to: check.to };
  });

  // البريد خارج المعاملة: فشله لا يُلغي القرار.
  notifyCandidate(organizationId, applicationId, result.to, reason).catch((e) =>
    console.error("[lifecycle] notify failed", e),
  );
  return result;
}

/** قبول المرشح للعرض الوظيفي — الخطوة الأولى في رحلته. */
export async function acceptOffer(input: {
  organizationId: string;
  candidateId: string;
  applicationId: string;
}): Promise<{ status: ApplicationStatus }> {
  const db = tenantPrisma(input.organizationId);
  return withTenantTransaction(db, input.organizationId, async (tx) => {
    const app = await tx.application.findFirst({
      where: { id: input.applicationId, candidateId: input.candidateId },
      select: { id: true, status: true, offerAcceptedAt: true },
    });
    if (!app) throw new LifecycleError(404, "الطلب غير موجود");
    if (app.offerAcceptedAt) return { status: app.status };
    if (app.status !== "PENDING") throw new LifecycleError(409, "لا يمكن قبول العرض في هذه المرحلة");

    await tx.application.update({
      where: { id: app.id },
      data: { offerAcceptedAt: new Date(), submittedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorType: "CANDIDATE",
        candidateId: input.candidateId,
        applicationId: app.id,
        action: "application.offer_accepted",
        resource: "Application",
        resourceId: app.id,
      },
    });
    const { status } = await syncApplicationProgress(tx, app.id, { kind: "CANDIDATE", candidateId: input.candidateId });
    return { status };
  });
}
