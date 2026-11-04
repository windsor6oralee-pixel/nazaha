/**
 * Service for the HR admin's document-rules editor.
 * Reads and mutates the WorkflowStepDocument rows of the org's default
 * workflow — the step whose `type = DOCUMENTS`. Existing applications keep
 * whatever documents they already have (their Document rows are per-application);
 * new candidates created after the change see the updated required set.
 */
import { prisma } from "@/infrastructure/database/client";

export type DocumentTypeCode =
  | "NATIONAL_ID"
  | "ACADEMIC_CERTIFICATE"
  | "EXPERIENCE_CERTIFICATE"
  | "CRIMINAL_RECORD"
  | "PERSONAL_PHOTO"
  | "BANK_ACCOUNT_IBAN"
  | "MEDICAL_REPORT"
  | "MARRIAGE_CERTIFICATE"
  | "BIRTH_CERTIFICATE"
  | "MILITARY_STATUS"
  | "CUSTOM";

export interface DocumentRule {
  id: string;
  documentType: DocumentTypeCode;
  nameAr: string;
  isRequired: boolean;
  maxFileSizeMb: number;
  allowedMimeTypes: string[];
  maxFileCount: number;
  requiresReview: boolean;
  notes: string | null;
  externalActionUrl:   string | null;
  externalActionLabel: string | null;
  externalFeeLabel:    string | null;
  externalFeeAmount:   number | null;
  externalFeeCurrency: string | null;
  askBeforeUpload:     boolean;
}

export interface DocumentCatalogEntry {
  documentType: DocumentTypeCode;
  defaultNameAr: string;
  defaultMimeTypes: string[];
  defaultSizeMb: number;
}

const PDF_IMG = ["application/pdf", "image/jpeg", "image/png"];

/** Fallback catalog shown in the admin UI when adding a new rule. */
export const DOCUMENT_CATALOG: DocumentCatalogEntry[] = [
  { documentType: "NATIONAL_ID",            defaultNameAr: "صورة الهوية الوطنية",            defaultMimeTypes: PDF_IMG,                      defaultSizeMb: 5  },
  { documentType: "BANK_ACCOUNT_IBAN",      defaultNameAr: "شهادة رقم الحساب البنكي (IBAN)", defaultMimeTypes: PDF_IMG,                      defaultSizeMb: 5  },
  { documentType: "PERSONAL_PHOTO",         defaultNameAr: "الصورة الشخصية",                 defaultMimeTypes: ["image/jpeg","image/png"],  defaultSizeMb: 3  },
  { documentType: "ACADEMIC_CERTIFICATE",   defaultNameAr: "الشهادة الأكاديمية",             defaultMimeTypes: PDF_IMG,                      defaultSizeMb: 10 },
  { documentType: "EXPERIENCE_CERTIFICATE", defaultNameAr: "شهادة الخبرة",                   defaultMimeTypes: PDF_IMG,                      defaultSizeMb: 10 },
  { documentType: "CRIMINAL_RECORD",        defaultNameAr: "صحيفة الحالة الجنائية",          defaultMimeTypes: PDF_IMG,                      defaultSizeMb: 5  },
  { documentType: "MEDICAL_REPORT",         defaultNameAr: "التقرير الطبي",                  defaultMimeTypes: ["application/pdf"],          defaultSizeMb: 10 },
  { documentType: "MARRIAGE_CERTIFICATE",   defaultNameAr: "عقد الزواج",                    defaultMimeTypes: PDF_IMG,                      defaultSizeMb: 5  },
  { documentType: "BIRTH_CERTIFICATE",      defaultNameAr: "شهادة الميلاد",                  defaultMimeTypes: PDF_IMG,                      defaultSizeMb: 5  },
  { documentType: "MILITARY_STATUS",        defaultNameAr: "وثيقة الموقف من الخدمة العسكرية", defaultMimeTypes: PDF_IMG,                      defaultSizeMb: 5  },
  { documentType: "CUSTOM",                 defaultNameAr: "مستند مخصّص",                   defaultMimeTypes: PDF_IMG,                      defaultSizeMb: 5  },
];

/** Resolves the single "DOCUMENTS" step of the org's default workflow. */
async function findDocsStep(organizationId: string): Promise<{ workflowId: string; stepId: string } | null> {
  const wf = await prisma.workflow.findFirst({
    where:   { organizationId, isDefault: true, isActive: true },
    select:  { id: true, steps: { where: { type: "DOCUMENTS" }, select: { id: true }, orderBy: { order: "asc" }, take: 1 } },
  });
  if (!wf || !wf.steps.length) return null;
  return { workflowId: wf.id, stepId: wf.steps[0].id };
}

export async function listDocumentRules(organizationId: string): Promise<DocumentRule[]> {
  const target = await findDocsStep(organizationId);
  if (!target) return [];
  const rows = await prisma.workflowStepDocument.findMany({
    where:   { workflowStepId: target.stepId },
    orderBy: [{ isRequired: "desc" }, { nameAr: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    documentType: r.documentType as DocumentTypeCode,
    nameAr: r.nameAr,
    isRequired: r.isRequired,
    maxFileSizeMb: r.maxFileSizeMb,
    allowedMimeTypes: r.allowedMimeTypes,
    maxFileCount: r.maxFileCount,
    requiresReview: r.requiresReview,
    notes: r.notes,
    externalActionUrl:   r.externalActionUrl,
    externalActionLabel: r.externalActionLabel,
    externalFeeLabel:    r.externalFeeLabel,
    externalFeeAmount:   r.externalFeeAmount,
    externalFeeCurrency: r.externalFeeCurrency,
    askBeforeUpload:     r.askBeforeUpload,
  }));
}

export interface UpsertDocumentRuleInput {
  documentType: DocumentTypeCode;
  nameAr?: string;
  isRequired?: boolean;
  maxFileSizeMb?: number;
  allowedMimeTypes?: string[];
  maxFileCount?: number;
  requiresReview?: boolean;
  notes?: string | null;
  externalActionUrl?:   string | null;
  externalActionLabel?: string | null;
  externalFeeLabel?:    string | null;
  externalFeeAmount?:   number | null;
  externalFeeCurrency?: string | null;
  askBeforeUpload?:     boolean;
}

export async function upsertDocumentRule(organizationId: string, input: UpsertDocumentRuleInput): Promise<DocumentRule> {
  const target = await findDocsStep(organizationId);
  if (!target) throw new Error("لا يوجد workflow افتراضي لهذه الجهة");

  const catalog = DOCUMENT_CATALOG.find((d) => d.documentType === input.documentType);
  // Normalize: an empty string from the UI clears the field. undefined leaves it.
  const nn = (v: string | null | undefined): string | null | undefined =>
    v === undefined ? undefined : (v === "" || v === null ? null : v);

  const row = await prisma.workflowStepDocument.upsert({
    where:  { workflowStepId_documentType: { workflowStepId: target.stepId, documentType: input.documentType } },
    update: {
      nameAr:           input.nameAr        ?? undefined,
      isRequired:       input.isRequired    ?? undefined,
      maxFileSizeMb:    input.maxFileSizeMb ?? undefined,
      allowedMimeTypes: input.allowedMimeTypes?.length ? input.allowedMimeTypes : undefined,
      maxFileCount:     input.maxFileCount  ?? undefined,
      requiresReview:   input.requiresReview ?? undefined,
      notes:            input.notes         ?? undefined,
      externalActionUrl:   nn(input.externalActionUrl),
      externalActionLabel: nn(input.externalActionLabel),
      externalFeeLabel:    nn(input.externalFeeLabel),
      externalFeeAmount:   input.externalFeeAmount === undefined ? undefined : (input.externalFeeAmount ?? null),
      externalFeeCurrency: nn(input.externalFeeCurrency),
      askBeforeUpload:     input.askBeforeUpload ?? undefined,
    },
    create: {
      workflowStepId:   target.stepId,
      documentType:     input.documentType,
      nameAr:           input.nameAr        ?? catalog?.defaultNameAr    ?? String(input.documentType),
      isRequired:       input.isRequired    ?? true,
      maxFileSizeMb:    input.maxFileSizeMb ?? catalog?.defaultSizeMb    ?? 5,
      allowedMimeTypes: input.allowedMimeTypes?.length ? input.allowedMimeTypes : (catalog?.defaultMimeTypes ?? PDF_IMG),
      maxFileCount:     input.maxFileCount  ?? 1,
      requiresReview:   input.requiresReview ?? true,
      notes:            input.notes         ?? null,
      externalActionUrl:   nn(input.externalActionUrl)   ?? null,
      externalActionLabel: nn(input.externalActionLabel) ?? null,
      externalFeeLabel:    nn(input.externalFeeLabel)    ?? null,
      externalFeeAmount:   input.externalFeeAmount ?? null,
      externalFeeCurrency: nn(input.externalFeeCurrency) ?? null,
      askBeforeUpload:     input.askBeforeUpload         ?? false,
    },
  });
  return {
    id: row.id,
    documentType: row.documentType as DocumentTypeCode,
    nameAr: row.nameAr,
    isRequired: row.isRequired,
    maxFileSizeMb: row.maxFileSizeMb,
    allowedMimeTypes: row.allowedMimeTypes,
    maxFileCount: row.maxFileCount,
    requiresReview: row.requiresReview,
    notes: row.notes,
    externalActionUrl:   row.externalActionUrl,
    externalActionLabel: row.externalActionLabel,
    externalFeeLabel:    row.externalFeeLabel,
    externalFeeAmount:   row.externalFeeAmount,
    externalFeeCurrency: row.externalFeeCurrency,
    askBeforeUpload:     row.askBeforeUpload,
  };
}

/** The CTA/action settings for a given document type in an org's active workflow. */
export interface ExternalAction {
  url:      string;
  label:    string;
  fee:      string | null;
  amount:   number | null;
  currency: string | null;
}
function toAction(r: DocumentRule): ExternalAction {
  const amount = r.externalFeeAmount ?? null;
  // Derive a sensible display label if the admin didn't set a free-text one.
  const currency = r.externalFeeCurrency ?? (amount !== null ? "SAR" : null);
  const feeDisplay = r.externalFeeLabel
    ?? (amount !== null ? `${amount} ${currency === "SAR" ? "ريال" : currency ?? ""}`.trim() : null);
  return {
    url:   r.externalActionUrl!,
    label: r.externalActionLabel || "اذهب لإصدار المستند",
    fee:   feeDisplay,
    amount,
    currency,
  };
}
export async function getExternalActionForType(organizationId: string, type: DocumentTypeCode): Promise<ExternalAction | null> {
  const rows = await listDocumentRules(organizationId);
  const rule = rows.find((r) => r.documentType === type);
  if (!rule?.externalActionUrl) return null;
  return toAction(rule);
}

/** Map of all document types that have an external action for an org. */
export async function listExternalActions(organizationId: string): Promise<Record<string, ExternalAction>> {
  const rows = await listDocumentRules(organizationId);
  const out: Record<string, ExternalAction> = {};
  for (const r of rows) if (r.externalActionUrl) out[r.documentType] = toAction(r);
  return out;
}

export async function deleteDocumentRule(organizationId: string, ruleId: string): Promise<void> {
  const target = await findDocsStep(organizationId);
  if (!target) throw new Error("لا يوجد workflow افتراضي لهذه الجهة");
  // Belt-and-suspenders: ensure the rule actually belongs to this org's step.
  const row = await prisma.workflowStepDocument.findUnique({ where: { id: ruleId }, select: { workflowStepId: true } });
  if (!row || row.workflowStepId !== target.stepId) return;
  await prisma.workflowStepDocument.delete({ where: { id: ruleId } });
}
