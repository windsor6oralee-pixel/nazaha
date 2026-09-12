import { hash as bcryptHash } from "bcryptjs";
import type { OrgType, Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/client";
import { ensureSystemRoles } from "@/infrastructure/services/role.service";
import { ensureDefaultTemplates } from "@/infrastructure/contracts/contract-template.service";
import { DEFAULT_WORKFLOW } from "./default-workflow";

export interface ProvisionInput {
  nameAr: string;
  nameEn?: string;
  slug: string;
  type: OrgType;
  admin: { email: string; nameAr: string; password: string };
}

export interface ProvisionResult {
  organizationId: string;
  slug: string;
  adminUserId: string;
  roles: number;
  workflowSteps: number;
  templates: number;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export function validateProvisionInput(input: Partial<ProvisionInput>): string | null {
  if (!input.nameAr || input.nameAr.trim().length < 2) return "اسم الجهة مطلوب";
  if (!input.slug || !SLUG_RE.test(input.slug)) return "المعرّف يجب أن يكون بأحرف إنجليزية صغيرة وأرقام وشرطات (3–40 حرفاً)";
  if (!["GOVERNMENT", "SEMI_GOVERNMENT", "PRIVATE"].includes(input.type ?? "")) return "نوع الجهة غير صالح";
  const a = input.admin;
  if (!a?.email || !a.email.includes("@")) return "بريد المشرف الأول غير صالح";
  if (!a.nameAr || a.nameAr.trim().length < 2) return "اسم المشرف الأول مطلوب";
  if (!a.password || a.password.length < 10) return "كلمة مرور المشرف يجب ألا تقل عن 10 أحرف";
  return null;
}

export async function seedDefaultWorkflow(tx: Prisma.TransactionClient, organizationId: string) {
  const workflow = await tx.workflow.create({
    data: {
      nameAr: DEFAULT_WORKFLOW.nameAr,
      nameEn: DEFAULT_WORKFLOW.nameEn,
      isDefault: true,
      isActive: true,
      organizationId,
    },
  });
  for (const step of DEFAULT_WORKFLOW.steps) {
    await tx.workflowStep.create({
      data: {
        workflowId: workflow.id,
        order: step.order,
        nameAr: step.nameAr,
        type: step.type,
        isRequired: step.isRequired,
        canSkip: step.canSkip,
        documentRequirements: { create: step.documents },
      },
    });
  }
  return { workflowId: workflow.id, steps: DEFAULT_WORKFLOW.steps.length };
}

// One transaction: organization → system roles → default workflow → contract templates → first admin.
// Any failure (duplicate slug, duplicate admin email, …) rolls everything back.
export async function provisionOrganization(input: ProvisionInput): Promise<ProvisionResult> {
  const passwordHash = await bcryptHash(input.admin.password, 12);

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        nameAr: input.nameAr.trim(),
        nameEn: input.nameEn?.trim() || null,
        slug: input.slug,
        type: input.type,
        officialNameAr: input.nameAr.trim(),
        isActive: true,
      },
    });

    const roles = await ensureSystemRoles(org.id, tx);
    const { steps } = await seedDefaultWorkflow(tx, org.id);
    const templates = await ensureDefaultTemplates(org.id, tx);

    const admin = await tx.user.create({
      data: {
        email: input.admin.email.trim().toLowerCase(),
        nameAr: input.admin.nameAr.trim(),
        passwordHash,
        organizationId: org.id,
        roleId: roles.admin.id,
        isActive: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: "SYSTEM",
        action: "organization.provisioned",
        resource: "Organization",
        resourceId: org.id,
        metadata: { slug: org.slug, adminUserId: admin.id },
      },
    });

    return {
      organizationId: org.id,
      slug: org.slug,
      adminUserId: admin.id,
      roles: Object.keys(roles).length,
      workflowSteps: steps,
      templates,
    };
  });
}

export async function listOrganizations() {
  return prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, nameAr: true, slug: true, type: true, isActive: true, createdAt: true,
      _count: { select: { users: true, candidates: true } },
    },
  });
}

export async function setOrganizationActive(id: string, isActive: boolean) {
  return prisma.organization.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } });
}
