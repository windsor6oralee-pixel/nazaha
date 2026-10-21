export type ApplicationStatus =
  | "pending"
  | "in_progress"
  | "under_review"
  | "approved"
  | "rejected"
  | "completed";

export type DocumentStatus =
  | "not_uploaded"
  | "uploaded"
  | "under_review"
  | "approved"
  | "rejected";

export interface Document {
  id: string;
  name: string;
  nameAr: string;
  required: boolean;
  status: DocumentStatus;
  uploadedAt?: string;
  rejectionReason?: string;
  fileUrl?: string;
  filePath?: string;
}

export interface Candidate {
  id: string;
  name: string;
  nationalId: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  acceptanceDate: string;
  startDate?: string;
  hrWelcomeNote?: string | null;
  status: ApplicationStatus;
  completionPercentage: number;
  documents: Document[];
  steps: OnboardingStep[];
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  order: number;
  dueDate?: string;
}

export interface HRStat {
  /** كل مرشحي الجهة. */
  total: number;
  /** مقبول — الطلب مُعتمد والمرشح في مرحلة الانضمام. */
  approved: number;
  /** قيد الإنجاز. */
  inProgress: number;
  /** تحت المراجعة. */
  underReview: number;
  /** يحتاج إجراء — لم يبدأ طلبه بعد. */
  pendingAction: number;
  /** مكتمل — أنهى مسيرته. */
  completed: number;
  /** مرفوض — ويشمل المنسحب (الحالة نفسها في واجهة القائمة). */
  rejected: number;
}
