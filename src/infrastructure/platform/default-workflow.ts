// Default onboarding workflow provisioned for every new tenant. No imports —
// prisma/seed.ts loads this through a relative path (ts-node has no alias support).

type StepType = "PERSONAL_DATA" | "DOCUMENTS" | "DOCUMENT_REVIEW" | "SIGNATURE" | "ORIENTATION";
type DocumentType =
  | "NATIONAL_ID" | "ACADEMIC_CERTIFICATE" | "EXPERIENCE_CERTIFICATE" | "CRIMINAL_RECORD"
  | "PERSONAL_PHOTO" | "BANK_ACCOUNT_IBAN" | "MEDICAL_REPORT";

export interface DefaultDocumentRule {
  documentType: DocumentType;
  nameAr: string;
  isRequired: boolean;
  maxFileSizeMb: number;
  allowedMimeTypes: string[];
  maxFileCount: number;
  requiresReview: boolean;
  askBeforeUpload?: boolean;
}

export interface DefaultWorkflowStep {
  order: number;
  nameAr: string;
  type: StepType;
  isRequired: boolean;
  canSkip: boolean;
  documents: DefaultDocumentRule[];
}

const PDF_IMG = ["application/pdf", "image/jpeg", "image/png"];

export const DEFAULT_WORKFLOW = {
  nameAr: "مسار الانضمام الموحد",
  nameEn: "Standard Onboarding",
  steps: [
    { order: 1, nameAr: "قبول العرض",           type: "PERSONAL_DATA",   isRequired: true, canSkip: false, documents: [] },
    {
      order: 2, nameAr: "رفع المستندات", type: "DOCUMENTS", isRequired: true, canSkip: false,
      // Default required set: ID, IBAN, Health certificate.
      // The health cert leads with the "do you already have one?" question so
      // candidates who don't have one are routed straight to the HR-configured
      // issuance portal.
      documents: [
        { documentType: "NATIONAL_ID",       nameAr: "صورة الهوية الوطنية",            isRequired: true, maxFileSizeMb: 5,  allowedMimeTypes: PDF_IMG,            maxFileCount: 1, requiresReview: true },
        { documentType: "BANK_ACCOUNT_IBAN", nameAr: "شهادة رقم الحساب البنكي (IBAN)", isRequired: true, maxFileSizeMb: 5,  allowedMimeTypes: PDF_IMG,            maxFileCount: 1, requiresReview: true },
        { documentType: "MEDICAL_REPORT",    nameAr: "الشهادة الصحية للتوظيف",         isRequired: true, maxFileSizeMb: 10, allowedMimeTypes: PDF_IMG,            maxFileCount: 1, requiresReview: true, askBeforeUpload: true },
      ],
    },
    { order: 3, nameAr: "مراجعة الموارد البشرية", type: "DOCUMENT_REVIEW", isRequired: true, canSkip: false, documents: [] },
    { order: 4, nameAr: "التوقيع الإلكتروني",     type: "SIGNATURE",       isRequired: true, canSkip: false, documents: [] },
    { order: 5, nameAr: "الاستعداد للمباشرة",     type: "ORIENTATION",     isRequired: true, canSkip: false, documents: [] },
  ] as DefaultWorkflowStep[],
};
