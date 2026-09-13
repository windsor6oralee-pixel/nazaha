/**
 * Candidate creation service.
 * Creates Candidate + Application + OnboardingProcess + Documents in one transaction,
 * then sends the invitation email.
 */
import { prisma } from "@/infrastructure/database/client";
import { sendInvitation } from "./invitation.service";

export interface CreateCandidateInput {
  nameAr: string;
  nationalId: string;
  email: string;
  phone?: string;
  jobTitle: string;
  department: string;
  acceptanceDate: Date;
  expectedStartDate?: Date;
  hrWelcomeNote?: string;
  organizationId: string;
  createdByUserId: string;
  customValues?: { definitionId: string; value: string }[];
}

export interface CreateCandidateResult {
  candidateId: string;
  applicationId: string;
  rawToken: string;
  email: string;
}

export async function createCandidate(
  input: CreateCandidateInput
): Promise<CreateCandidateResult> {
  // 1. Verify no duplicate nationalId in this org
  const existing = await prisma.candidate.findUnique({
    where: {
      organizationId_nationalId: {
        organizationId: input.organizationId,
        nationalId: input.nationalId,
      },
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error("يوجد مرشح بنفس رقم الهوية في هذه المنظمة");
  }

  // 2. Get the default workflow for this org
  const workflow = await prisma.workflow.findFirst({
    where: { organizationId: input.organizationId, isDefault: true, isActive: true },
    include: {
      steps: {
        orderBy: { order: "asc" },
        include: { documentRequirements: true },
      },
    },
  });
  if (!workflow) {
    throw new Error("لا يوجد سير عمل افتراضي للمنظمة. يرجى إعداد سير عمل أولاً");
  }

  // 3. Create everything in a transaction
  const { candidateId, applicationId } = await prisma.$transaction(async (tx) => {
    // Create candidate
    const candidate = await tx.candidate.create({
      data: {
        nameAr: input.nameAr,
        nationalId: input.nationalId,
        email: input.email,
        phone: input.phone,
        jobTitle: input.jobTitle,
        department: input.department,
        acceptanceDate: input.acceptanceDate,
        expectedStartDate: input.expectedStartDate,
        organizationId: input.organizationId,
      },
    });

    if (input.customValues?.length) {
      await tx.candidateFieldValue.createMany({
        data: input.customValues.map((v) => ({ candidateId: candidate.id, ...v })),
      });
    }

    // Create application
    const application = await tx.application.create({
      data: {
        candidateId: candidate.id,
        organizationId: input.organizationId,
        workflowId: workflow.id,
        ...(input.hrWelcomeNote ? { hrWelcomeNote: input.hrWelcomeNote.trim() } : {}),
      },
    });

    // Create onboarding process + steps
    const process = await tx.onboardingProcess.create({
      data: {
        applicationId: application.id,
        steps: {
          create: workflow.steps.map((step) => ({
            workflowStepId: step.id,
            status: "PENDING",
          })),
        },
      },
    });

    // Create document records from workflow step documents
    const allDocs = workflow.steps.flatMap((step) =>
      step.documentRequirements.map((req) => ({
        type: req.documentType,
        nameAr: req.nameAr,
        isRequired: req.isRequired,
        applicationId: application.id,
      }))
    );

    if (allDocs.length > 0) {
      await tx.document.createMany({ data: allDocs });
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        actorType: "USER",
        action: "candidate.created",
        resource: "Candidate",
        resourceId: candidate.id,
        applicationId: application.id,
        candidateId: candidate.id,
        userId: input.createdByUserId,
        metadata: { jobTitle: input.jobTitle, department: input.department },
      },
    });

    // Silence unused variable warning
    void process;

    return { candidateId: candidate.id, applicationId: application.id };
  });

  // 4. Send invitation (outside transaction — network call)
  const { rawToken, email } = await sendInvitation(candidateId);

  return { candidateId, applicationId, rawToken, email };
}
