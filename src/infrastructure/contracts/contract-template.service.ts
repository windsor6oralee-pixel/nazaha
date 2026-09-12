import type { ContractType, Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/client";
import { DEFAULT_TEMPLATES } from "./default-templates";
import {
  renderTemplate,
  hashContent,
  formatArabicDate,
  findUnknownPlaceholders,
  listPlaceholders,
} from "./template-renderer";
import { listFieldDefinitions, getCandidateTemplateValues } from "@/infrastructure/custom-fields/field.service";

export async function listTemplates(organizationId: string) {
  return prisma.contractTemplate.findMany({
    where: { organizationId },
    orderBy: [{ type: "asc" }, { version: "desc" }],
    select: { id: true, type: true, nameAr: true, version: true, isActive: true, updatedAt: true, bodyHtml: true },
  });
}

export async function getActiveTemplate(organizationId: string, type: ContractType) {
  return prisma.contractTemplate.findFirst({
    where: { organizationId, type, isActive: true },
    orderBy: { version: "desc" },
  });
}

export async function getPlaceholdersForOrg(organizationId: string) {
  const defs = await listFieldDefinitions(organizationId);
  return listPlaceholders(defs);
}

async function customKeysForOrg(organizationId: string): Promise<string[]> {
  const defs = await listFieldDefinitions(organizationId);
  return defs.map((d) => d.key);
}

// Saving never mutates a version that a contract may point at: it deactivates the
// current one and inserts version+1, so frozen contracts keep a valid templateId.
export async function saveTemplateVersion(
  organizationId: string,
  type: ContractType,
  input: { nameAr: string; bodyHtml: string }
) {
  const unknown = findUnknownPlaceholders(input.bodyHtml, await customKeysForOrg(organizationId));
  if (unknown.length) {
    throw new Error(`متغيرات غير معروفة في القالب: ${unknown.map((u) => `{{${u}}}`).join("، ")}`);
  }

  return prisma.$transaction(async (tx) => {
    const latest = await tx.contractTemplate.findFirst({
      where: { organizationId, type },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await tx.contractTemplate.updateMany({
      where: { organizationId, type, isActive: true },
      data: { isActive: false },
    });
    return tx.contractTemplate.create({
      data: {
        organizationId,
        type,
        nameAr: input.nameAr.trim(),
        bodyHtml: input.bodyHtml,
        version: (latest?.version ?? 0) + 1,
        isActive: true,
      },
    });
  });
}

// Idempotent: seeds the built-in templates for a tenant that has none of that type yet.
// Accepts a transaction client so tenant provisioning can include it atomically.
export async function ensureDefaultTemplates(
  organizationId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  let created = 0;
  for (const t of DEFAULT_TEMPLATES) {
    const exists = await db.contractTemplate.findFirst({
      where: { organizationId, type: t.type },
      select: { id: true },
    });
    if (!exists) {
      await db.contractTemplate.create({
        data: { organizationId, type: t.type, nameAr: t.nameAr, bodyHtml: t.bodyHtml, version: 1, isActive: true },
      });
      created++;
    }
  }
  return created;
}

export interface RenderInput {
  organizationId: string;
  type: ContractType;
  candidate: {
    id: string;
    nameAr: string; nationalId: string; email: string; jobTitle: string; department: string;
    expectedStartDate: Date | null;
  };
}

export async function renderContractForCandidate(input: RenderInput) {
  const template = await getActiveTemplate(input.organizationId, input.type);
  if (!template) throw new Error("لا يوجد قالب نشط لهذا النوع من العقود — أنشئه من الإعدادات أولاً");

  const [org, customValues] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
      select: {
        nameAr: true, officialNameAr: true, authorizedSignerName: true,
        authorizedSignerTitle: true, address: true, commercialRegNo: true,
      },
    }),
    getCandidateTemplateValues(input.organizationId, input.candidate.id),
  ]);

  const values: Record<string, string> = {
    "candidate.nameAr":     input.candidate.nameAr,
    "candidate.nationalId": input.candidate.nationalId,
    "candidate.email":      input.candidate.email,
    "candidate.jobTitle":   input.candidate.jobTitle,
    "candidate.department": input.candidate.department,
    "candidate.startDate":  input.candidate.expectedStartDate ? formatArabicDate(input.candidate.expectedStartDate) : "",
    "org.nameAr":           org.nameAr,
    "org.officialNameAr":   org.officialNameAr ?? org.nameAr,
    "org.signerName":       org.authorizedSignerName ?? "",
    "org.signerTitle":      org.authorizedSignerTitle ?? "",
    "org.address":          org.address ?? "",
    "org.commercialRegNo":  org.commercialRegNo ?? "",
    "contract.date":        formatArabicDate(new Date()),
    "contract.nameAr":      template.nameAr,
    ...customValues,
  };

  const customKeys = Object.keys(customValues).map((k) => k.slice("custom.".length));
  const renderedHtml = renderTemplate(template.bodyHtml, values, customKeys);
  return {
    templateId: template.id,
    nameAr: template.nameAr,
    renderedHtml,
    contentHash: hashContent(renderedHtml),
  };
}

// Preview with sample data for the admin editor — never persisted.
export async function renderPreview(organizationId: string, bodyHtml: string, nameAr: string) {
  const [org, defs] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { nameAr: true } }),
    listFieldDefinitions(organizationId),
  ]);
  const orgNameAr = org?.nameAr ?? "";
  const values: Record<string, string> = {
    "candidate.nameAr": "أحمد محمد العمري", "candidate.nationalId": "1XXXXXXXXX",
    "candidate.email": "candidate@example.com", "candidate.jobTitle": "محلل بيانات أول",
    "candidate.department": "إدارة التحول الرقمي", "candidate.startDate": formatArabicDate(new Date()),
    "org.nameAr": orgNameAr, "org.officialNameAr": orgNameAr, "org.signerName": "اسم المعتمد الرسمي",
    "org.signerTitle": "منصب المعتمد", "org.address": "العنوان", "org.commercialRegNo": "",
    "contract.date": formatArabicDate(new Date()), "contract.nameAr": nameAr,
  };
  for (const d of defs) values[`custom.${d.key}`] = `[${d.labelAr}]`;
  return renderTemplate(bodyHtml, values, defs.map((d) => d.key));
}
