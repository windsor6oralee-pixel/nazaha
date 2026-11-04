import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/infrastructure/database/client";
import { tenantPrisma } from "@/infrastructure/tenant/scoped-prisma";
import { provisionOrganization } from "@/infrastructure/platform/provisioning.service";
import { createCandidate } from "@/infrastructure/services/candidate.service";
import { createStaff } from "@/infrastructure/services/staff.service";
import {
  acceptOffer,
  getApplicationLifecycle,
  LifecycleError,
  performLifecycleAction,
  refreshApplicationProgress,
} from "@/infrastructure/applications/lifecycle.service";
import { getWorkQueues } from "@/infrastructure/applications/work-queues.service";
import {
  availableActions,
  checkTransition,
  deriveAutoStatus,
  deriveStepStatus,
  uploadBlockedReason,
  type LifecycleSnapshot,
} from "@/infrastructure/applications/lifecycle";
import { isPrincipalActive } from "@/infrastructure/auth/credentials.service";

/*
 * محرك دورة حياة الطلب:
 *  - القواعد الخالصة (الانتقالات، الصلاحيات، الشروط، اشتقاق الخطوات).
 *  - الرحلة كاملة على قاعدة حقيقية عبر دور التشغيل الخاضع لـ RLS:
 *    دعوة ← قبول العرض ← مستندات ← اعتماد ← عقد ← توقيع ← إكمال.
 */

const base: LifecycleSnapshot = {
  status: "IN_PROGRESS",
  offerAccepted: true,
  requiredDocuments: ["APPROVED", "APPROVED"],
  requiresContract: true,
  hasSignedContract: false,
  hasPendingContract: false,
};

describe("lifecycle rules", () => {
  it("derives the automatic status from the facts", () => {
    expect(deriveAutoStatus({ ...base, status: "PENDING", offerAccepted: false })).toBe("PENDING");
    expect(deriveAutoStatus({ ...base, requiredDocuments: ["APPROVED", "UPLOADED"] })).toBe("IN_PROGRESS");
    expect(deriveAutoStatus(base)).toBe("UNDER_REVIEW");
    // A rejected document sends a reviewed application back to the candidate.
    expect(deriveAutoStatus({ ...base, status: "UNDER_REVIEW", requiredDocuments: ["APPROVED", "REJECTED"] })).toBe("IN_PROGRESS");
  });

  it("never overrides a manual decision", () => {
    for (const status of ["APPROVED", "REJECTED", "WITHDRAWN", "COMPLETED"] as const) {
      expect(deriveAutoStatus({ ...base, status, requiredDocuments: ["NOT_UPLOADED"] })).toBe(status);
    }
  });

  it("derives each step from its type, not its position", () => {
    const pending = { ...base, status: "PENDING" as const, offerAccepted: false, requiredDocuments: ["NOT_UPLOADED" as const] };
    expect(deriveStepStatus("PERSONAL_DATA", pending, "PENDING")).toBe("IN_PROGRESS");
    expect(deriveStepStatus("DOCUMENTS", pending, "PENDING")).toBe("PENDING");

    const signed = { ...base, status: "APPROVED" as const, hasSignedContract: true };
    expect(deriveStepStatus("PERSONAL_DATA", signed, "PENDING")).toBe("COMPLETED");
    expect(deriveStepStatus("DOCUMENTS", signed, "PENDING")).toBe("COMPLETED");
    expect(deriveStepStatus("DOCUMENT_REVIEW", signed, "PENDING")).toBe("COMPLETED");
    expect(deriveStepStatus("SIGNATURE", signed, "PENDING")).toBe("COMPLETED");
    expect(deriveStepStatus("ORIENTATION", signed, "PENDING")).toBe("IN_PROGRESS");
    expect(deriveStepStatus("ORIENTATION", { ...signed, status: "COMPLETED" }, "IN_PROGRESS")).toBe("COMPLETED");
    expect(deriveStepStatus("MEDICAL", signed, "SKIPPED")).toBe("SKIPPED");
  });

  it("enforces roles, states, reasons and guards", () => {
    const review = { ...base, status: "UNDER_REVIEW" as const };
    expect(checkTransition("approve", review, "hr_officer", null)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(checkTransition("approve", review, "hr_manager", null)).toEqual({ ok: true, to: "APPROVED" });
    expect(checkTransition("approve", { ...review, requiredDocuments: ["UPLOADED"] }, "admin", null)).toMatchObject({ ok: false, code: "GUARD" });
    expect(checkTransition("approve", base, "admin", null)).toMatchObject({ ok: false, code: "INVALID_STATE" });
    expect(checkTransition("reject", review, "admin", "  ")).toMatchObject({ ok: false, code: "REASON_REQUIRED" });
    expect(checkTransition("withdraw", review, "hr_officer", "اعتذر")).toEqual({ ok: true, to: "WITHDRAWN" });

    const approved = { ...base, status: "APPROVED" as const };
    expect(checkTransition("complete", approved, "admin", null)).toMatchObject({ ok: false, code: "GUARD" });
    expect(checkTransition("complete", { ...approved, hasSignedContract: true }, "admin", null)).toEqual({ ok: true, to: "COMPLETED" });
    expect(checkTransition("complete", { ...approved, requiresContract: false }, "admin", null)).toEqual({ ok: true, to: "COMPLETED" });
  });

  it("reopens to wherever the facts stand", () => {
    expect(checkTransition("reopen", { ...base, status: "REJECTED", offerAccepted: false }, "admin", "خطأ")).toEqual({ ok: true, to: "PENDING" });
    expect(checkTransition("reopen", { ...base, status: "WITHDRAWN" }, "admin", "عاد")).toEqual({ ok: true, to: "UNDER_REVIEW" });
  });

  it("lists only the actions a role can take, with the blocking reason", () => {
    const review = { ...base, status: "UNDER_REVIEW" as const, requiredDocuments: ["UPLOADED" as const] };
    expect(availableActions(review, "hr_officer").map((a) => a.action)).toEqual(["withdraw"]);
    const manager = availableActions(review, "hr_manager");
    expect(manager.map((a) => a.action)).toEqual(["approve", "reject", "withdraw"]);
    expect(manager[0].blockedReason).toBeTruthy();
  });

  it("locks documents outside the collection stage", () => {
    expect(uploadBlockedReason("PENDING", "NOT_UPLOADED")).toBeTruthy();
    expect(uploadBlockedReason("IN_PROGRESS", "REJECTED")).toBeNull();
    expect(uploadBlockedReason("UNDER_REVIEW", "APPROVED")).toBeTruthy();
    expect(uploadBlockedReason("APPROVED", "NOT_UPLOADED")).toBeTruthy();
  });
});

// ── End to end ──────────────────────────────────────────────────────────────

const STAMP = Date.now();
let orgId: string;
let otherOrgId: string;
let adminId: string;
let officerId: string;
let candidateId: string;
let applicationId: string;

async function steps() {
  const rows = await prisma.onboardingStep.findMany({
    where: { onboardingProcess: { applicationId } },
    select: { status: true, workflowStep: { select: { type: true } } },
  });
  return Object.fromEntries(rows.map((r) => [r.workflowStep.type, r.status]));
}

async function appRow() {
  return prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
}

beforeAll(async () => {
  const org = await provisionOrganization({
    nameAr: "شركة اختبار الدورة", slug: `lifecycle-${STAMP}`, type: "PRIVATE",
    admin: { email: `lifecycle-admin-${STAMP}@test.local`, nameAr: "مدير النظام", password: "StrongPass123!" },
  });
  orgId = org.organizationId;
  adminId = org.adminUserId;
  otherOrgId = (await provisionOrganization({
    nameAr: "شركة أخرى", slug: `lifecycle-other-${STAMP}`, type: "PRIVATE",
    admin: { email: `lifecycle-other-${STAMP}@test.local`, nameAr: "مدير آخر", password: "StrongPass123!" },
  })).organizationId;

  officerId = (await createStaff(orgId, adminId, {
    email: `lifecycle-officer-${STAMP}@test.local`, nameAr: "موظف الموارد", role: "hr_officer", password: "StrongPass123!",
  })).id;

  const created = await createCandidate({
    nameAr: "مرشح الدورة", nationalId: `1${String(STAMP).slice(-9)}`, email: `lifecycle-cand-${STAMP}@test.local`,
    jobTitle: "محاسب", department: "المالية", acceptanceDate: new Date("2026-10-01"),
    organizationId: orgId, createdByUserId: officerId,
  });
  candidateId = created.candidateId;
  applicationId = created.applicationId;
});

afterAll(async () => {
  // audit_logs is append-only and references these rows; retire the tenants instead.
  await prisma.organization.updateMany({ where: { id: { in: [orgId, otherOrgId] } }, data: { isActive: false } });
  await prisma.$disconnect();
});

describe("application journey", () => {
  it("starts PENDING with the offer step open", async () => {
    expect((await appRow()).status).toBe("PENDING");
    await refreshApplicationProgress(orgId, applicationId);
    expect(await steps()).toMatchObject({ PERSONAL_DATA: "IN_PROGRESS", DOCUMENTS: "PENDING" });
  });

  it("shows the pending candidate in the offer queue", async () => {
    const queues = await getWorkQueues(orgId);
    const offer = queues.find((q) => q.key === "offer_not_accepted")!;
    expect(offer.items.map((i) => i.applicationId)).toContain(applicationId);
  });

  it("is invisible to another tenant", async () => {
    expect(await getApplicationLifecycle(otherOrgId, applicationId, "admin")).toBeNull();
    await expect(performLifecycleAction({
      organizationId: otherOrgId, userId: adminId, role: "admin", applicationId, action: "reject", reason: "x",
    })).rejects.toMatchObject({ status: 404 });
  });

  it("moves to IN_PROGRESS when the candidate accepts the offer", async () => {
    const r = await acceptOffer({ organizationId: orgId, candidateId, applicationId });
    expect(r.status).toBe("IN_PROGRESS");
    expect((await appRow()).offerAcceptedAt).not.toBeNull();
    expect(await steps()).toMatchObject({ PERSONAL_DATA: "COMPLETED", DOCUMENTS: "IN_PROGRESS" });
    // Idempotent.
    expect((await acceptOffer({ organizationId: orgId, candidateId, applicationId })).status).toBe("IN_PROGRESS");
  });

  it("refuses approval while documents are outstanding", async () => {
    await expect(performLifecycleAction({
      organizationId: orgId, userId: adminId, role: "admin", applicationId, action: "approve",
    })).rejects.toMatchObject({ status: 409 });
  });

  it("reaches UNDER_REVIEW once every required document is approved", async () => {
    await prisma.document.updateMany({ where: { applicationId, isRequired: true }, data: { status: "APPROVED" } });
    const r = await refreshApplicationProgress(orgId, applicationId);
    expect(r).toEqual({ status: "UNDER_REVIEW", changed: true });
    expect(await steps()).toMatchObject({ DOCUMENTS: "COMPLETED", DOCUMENT_REVIEW: "IN_PROGRESS" });

    const queues = await getWorkQueues(orgId);
    expect(queues.find((q) => q.key === "awaiting_approval")!.items.map((i) => i.applicationId)).toContain(applicationId);
  });

  it("lets only managers approve", async () => {
    await expect(performLifecycleAction({
      organizationId: orgId, userId: officerId, role: "hr_officer", applicationId, action: "approve",
    })).rejects.toBeInstanceOf(LifecycleError);

    const r = await performLifecycleAction({
      organizationId: orgId, userId: adminId, role: "admin", applicationId, action: "approve",
    });
    expect(r).toEqual({ from: "UNDER_REVIEW", to: "APPROVED" });
    const app = await appRow();
    expect(app.approvedAt).not.toBeNull();
    expect(await steps()).toMatchObject({ DOCUMENT_REVIEW: "COMPLETED", SIGNATURE: "IN_PROGRESS" });

    const audit = await prisma.auditLog.findFirst({ where: { applicationId, action: "application.approve" } });
    expect(audit?.userId).toBe(adminId);
  });

  it("will not complete before the contract is signed", async () => {
    await expect(performLifecycleAction({
      organizationId: orgId, userId: adminId, role: "admin", applicationId, action: "complete",
    })).rejects.toMatchObject({ status: 422 });
  });

  it("completes after signature and closes every step", async () => {
    const db = tenantPrisma(orgId);
    await db.contract.create({
      data: {
        type: "EMPLOYMENT_CONTRACT", nameAr: "عقد", status: "FULLY_SIGNED",
        organizationId: orgId, applicationId, renderedHtml: "<p>x</p>", contentHash: "h",
      },
    });
    await refreshApplicationProgress(orgId, applicationId);
    expect(await steps()).toMatchObject({ SIGNATURE: "COMPLETED", ORIENTATION: "IN_PROGRESS" });

    const queues = await getWorkQueues(orgId);
    expect(queues.find((q) => q.key === "ready_to_complete")!.items.map((i) => i.applicationId)).toContain(applicationId);

    await performLifecycleAction({ organizationId: orgId, userId: adminId, role: "admin", applicationId, action: "complete" });
    const app = await appRow();
    expect(app.status).toBe("COMPLETED");
    expect(app.completedAt).not.toBeNull();
    expect(Object.values(await steps()).every((s) => s === "COMPLETED")).toBe(true);
    const proc = await prisma.onboardingProcess.findUniqueOrThrow({ where: { applicationId } });
    expect(proc.completedAt).not.toBeNull();
  });
});

describe("closing and reopening", () => {
  let appId: string;
  let candId: string;

  beforeAll(async () => {
    const c = await createCandidate({
      nameAr: "مرشح الرفض", nationalId: `2${String(STAMP).slice(-9)}`, email: `lifecycle-rej-${STAMP}@test.local`,
      jobTitle: "مهندس", department: "التقنية", acceptanceDate: new Date("2026-10-01"),
      organizationId: orgId, createdByUserId: adminId,
    });
    appId = c.applicationId;
    candId = c.candidateId;
    await prisma.candidate.update({ where: { id: candId }, data: { accountActivatedAt: new Date() } });
    await acceptOffer({ organizationId: orgId, candidateId: candId, applicationId: appId });
    await tenantPrisma(orgId).contract.create({
      data: { type: "EMPLOYMENT_CONTRACT", nameAr: "عقد", status: "PENDING_SIGNATURE", organizationId: orgId, applicationId: appId },
    });
  });

  it("requires a reason to reject", async () => {
    await expect(performLifecycleAction({
      organizationId: orgId, userId: adminId, role: "admin", applicationId: appId, action: "reject", reason: "",
    })).rejects.toMatchObject({ status: 422 });
  });

  it("rejecting cancels the pending contract and ends the candidate's session", async () => {
    const principal = { sessionType: "candidate" as const, id: candId, organizationId: orgId, sessionIssuedAt: new Date() };
    expect(await isPrincipalActive(principal)).toBe(true);

    await performLifecycleAction({
      organizationId: orgId, userId: adminId, role: "admin", applicationId: appId, action: "reject", reason: "لم يستوفِ الشروط",
    });
    const app = await prisma.application.findUniqueOrThrow({ where: { id: appId } });
    expect(app).toMatchObject({ status: "REJECTED", statusReason: "لم يستوفِ الشروط" });
    expect(await prisma.contract.count({ where: { applicationId: appId, status: "PENDING_SIGNATURE" } })).toBe(0);
    expect(await prisma.contract.count({ where: { applicationId: appId, status: "CANCELLED" } })).toBe(1);
    expect(await isPrincipalActive(principal)).toBe(false);
  });

  it("reopening restores the collection stage and access", async () => {
    const r = await performLifecycleAction({
      organizationId: orgId, userId: adminId, role: "hr_manager", applicationId: appId, action: "reopen", reason: "قرار خاطئ",
    });
    expect(r).toEqual({ from: "REJECTED", to: "IN_PROGRESS" });
    expect((await prisma.application.findUniqueOrThrow({ where: { id: appId } })).rejectedAt).toBeNull();
    expect(await isPrincipalActive({ sessionType: "candidate", id: candId, organizationId: orgId, sessionIssuedAt: new Date() })).toBe(true);
  });

  it("an officer can record a withdrawal but not reopen it", async () => {
    await performLifecycleAction({
      organizationId: orgId, userId: officerId, role: "hr_officer", applicationId: appId, action: "withdraw", reason: "قبل عرضاً آخر",
    });
    await expect(performLifecycleAction({
      organizationId: orgId, userId: officerId, role: "hr_officer", applicationId: appId, action: "reopen", reason: "عاد",
    })).rejects.toMatchObject({ status: 403 });
  });
});
