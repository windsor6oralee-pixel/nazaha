/*
 * محرك دورة حياة الطلب — قواعد خالصة بلا قاعدة بيانات.
 *
 * الحالة تتقدّم بطريقتين:
 *  - تلقائياً من الوقائع (قبول العرض، اعتماد المستندات، التوقيع) — `deriveAutoStatus`.
 *  - يدوياً بقرار من الموارد البشرية — `LIFECYCLE_ACTIONS`.
 *
 * وخطوات الرحلة لا تُخزَّن قراراتها في أي مكان آخر: تُشتق من الوقائع نفسها
 * بحسب نوع الخطوة (`deriveStepStatus`)، فلا يعتمد شيء على رقم الخطوة في المسار.
 */
import type { ApplicationStatus, DocumentStatus, StepStatus, StepType } from "@prisma/client";

/** الوقائع التي تُبنى عليها كل القرارات. */
export interface LifecycleSnapshot {
  status: ApplicationStatus;
  offerAccepted: boolean;
  requiredDocuments: DocumentStatus[];
  /** في المسار خطوة توقيع/عقد — فالإكمال يشترط عقداً موقّعاً. */
  requiresContract: boolean;
  hasSignedContract: boolean;
  hasPendingContract: boolean;
}

export const TERMINAL_STATUSES: readonly ApplicationStatus[] = ["REJECTED", "WITHDRAWN", "COMPLETED"];
export const ACTIVE_STATUSES: readonly ApplicationStatus[] = ["PENDING", "IN_PROGRESS", "UNDER_REVIEW", "APPROVED"];

export function isTerminal(status: ApplicationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

const SUBMITTED: readonly DocumentStatus[] = ["UPLOADED", "UNDER_REVIEW", "APPROVED"];

export function allRequiredSubmitted(s: LifecycleSnapshot): boolean {
  return s.requiredDocuments.every((d) => SUBMITTED.includes(d));
}

export function allRequiredApproved(s: LifecycleSnapshot): boolean {
  return s.requiredDocuments.every((d) => d === "APPROVED");
}

// ── الانتقالات التلقائية ─────────────────────────────────────────────────────

/**
 * الحالة التي تفرضها الوقائع على طلب في مرحلة الاستكمال.
 * القرارات اليدوية (مقبول، مرفوض، منسحب، مكتمل) لا تُلمس هنا أبداً.
 */
export function deriveAutoStatus(s: LifecycleSnapshot): ApplicationStatus {
  if (!["PENDING", "IN_PROGRESS", "UNDER_REVIEW"].includes(s.status)) return s.status;
  if (!s.offerAccepted) return "PENDING";
  return allRequiredApproved(s) ? "UNDER_REVIEW" : "IN_PROGRESS";
}

// ── الخطوات ─────────────────────────────────────────────────────────────────

const AFTER_APPROVAL: readonly ApplicationStatus[] = ["APPROVED", "COMPLETED"];

/** حالة خطوة واحدة بحسب نوعها. SKIPPED يحترم ما قرّره المسار. */
export function deriveStepStatus(type: StepType, s: LifecycleSnapshot, current: StepStatus): StepStatus {
  if (current === "SKIPPED") return current;
  const completed = s.status === "COMPLETED";

  switch (type) {
    case "PERSONAL_DATA":
      return s.offerAccepted ? "COMPLETED" : "IN_PROGRESS";

    case "DOCUMENTS":
      if (allRequiredSubmitted(s) && s.offerAccepted) return "COMPLETED";
      return s.offerAccepted ? "IN_PROGRESS" : "PENDING";

    case "DOCUMENT_REVIEW":
      if (AFTER_APPROVAL.includes(s.status)) return "COMPLETED";
      return s.offerAccepted && s.requiredDocuments.some((d) => SUBMITTED.includes(d)) ? "IN_PROGRESS" : "PENDING";

    case "CONTRACT":
    case "SIGNATURE":
      if (s.hasSignedContract) return "COMPLETED";
      return s.hasPendingContract || AFTER_APPROVAL.includes(s.status) ? "IN_PROGRESS" : "PENDING";

    case "ORIENTATION":
      if (completed) return "COMPLETED";
      return s.hasSignedContract || (!s.requiresContract && s.status === "APPROVED") ? "IN_PROGRESS" : "PENDING";

    default:
      // خطوات لا تتبعها المنصة آلياً (فحص طبي، تجهيز تقني…) تُغلق بإكمال الطلب.
      if (completed) return "COMPLETED";
      return AFTER_APPROVAL.includes(s.status) ? "IN_PROGRESS" : "PENDING";
  }
}

// ── القرارات اليدوية ────────────────────────────────────────────────────────

export type LifecycleAction = "approve" | "complete" | "reject" | "withdraw" | "reopen";

const MANAGERS = ["admin", "hr_manager"];
const ALL_HR = ["admin", "hr_manager", "hr_officer"];

interface ActionRule {
  labelAr: string;
  /** وصف قصير يظهر في نافذة التأكيد. */
  descriptionAr: string;
  from: readonly ApplicationStatus[];
  roles: readonly string[];
  requiresReason: boolean;
  tone: "primary" | "danger" | "secondary";
  /** شرط إضافي على الوقائع؛ يعيد سبب المنع بالعربية أو null. */
  guard?: (s: LifecycleSnapshot) => string | null;
}

export const LIFECYCLE_ACTIONS: Record<LifecycleAction, ActionRule> = {
  approve: {
    labelAr: "اعتماد الملف",
    descriptionAr: "يعتمد ملف المرشح بعد مراجعة مستنداته، فيصبح جاهزاً لإصدار العقد.",
    from: ["UNDER_REVIEW"],
    roles: MANAGERS,
    requiresReason: false,
    tone: "primary",
    guard: (s) => (allRequiredApproved(s) ? null : "يجب اعتماد كل المستندات المطلوبة أولاً"),
  },
  complete: {
    labelAr: "إكمال الانضمام",
    descriptionAr: "يُغلق رحلة المرشح بعد مباشرته العمل. لا يمكن التراجع عن هذا الإجراء.",
    from: ["APPROVED"],
    roles: MANAGERS,
    requiresReason: false,
    tone: "primary",
    guard: (s) => (s.requiresContract && !s.hasSignedContract ? "يجب أن يوقّع المرشح العقد أولاً" : null),
  },
  reject: {
    labelAr: "رفض الطلب",
    descriptionAr: "يُنهي الطلب ويُغلق دخول المرشح ويلغي أي عقد بانتظار التوقيع.",
    from: ACTIVE_STATUSES,
    roles: MANAGERS,
    requiresReason: true,
    tone: "danger",
  },
  withdraw: {
    labelAr: "تسجيل انسحاب",
    descriptionAr: "يسجّل انسحاب المرشح من الوظيفة ويُغلق دخوله ويلغي أي عقد بانتظار التوقيع.",
    from: ACTIVE_STATUSES,
    roles: ALL_HR,
    requiresReason: true,
    tone: "secondary",
  },
  reopen: {
    labelAr: "إعادة فتح الطلب",
    descriptionAr: "يعيد الطلب إلى مرحلة الاستكمال ويعيد للمرشح إمكانية الدخول.",
    from: ["REJECTED", "WITHDRAWN"],
    roles: MANAGERS,
    requiresReason: true,
    tone: "secondary",
  },
};

export const LIFECYCLE_ACTION_KEYS = Object.keys(LIFECYCLE_ACTIONS) as LifecycleAction[];

export function isLifecycleAction(v: unknown): v is LifecycleAction {
  return typeof v === "string" && v in LIFECYCLE_ACTIONS;
}

export interface ActionAvailability {
  action: LifecycleAction;
  labelAr: string;
  descriptionAr: string;
  tone: ActionRule["tone"];
  requiresReason: boolean;
  /** null = متاح؛ وإلا سبب المنع. */
  blockedReason: string | null;
}

/** الإجراءات التي تنطبق على الحالة الحالية ودور المستخدم، مع سبب المنع إن وُجد. */
export function availableActions(s: LifecycleSnapshot, role: string): ActionAvailability[] {
  return LIFECYCLE_ACTION_KEYS
    .filter((a) => LIFECYCLE_ACTIONS[a].from.includes(s.status) && LIFECYCLE_ACTIONS[a].roles.includes(role))
    .map((a) => {
      const rule = LIFECYCLE_ACTIONS[a];
      return {
        action: a,
        labelAr: rule.labelAr,
        descriptionAr: rule.descriptionAr,
        tone: rule.tone,
        requiresReason: rule.requiresReason,
        blockedReason: rule.guard?.(s) ?? null,
      };
    });
}

export type TransitionCheck =
  | { ok: true; to: ApplicationStatus }
  | { ok: false; code: "FORBIDDEN" | "INVALID_STATE" | "GUARD" | "REASON_REQUIRED"; message: string };

/** الحالة التي ينتهي إليها الإجراء. إعادة الفتح تعود إلى حيث تقف الوقائع. */
function targetOf(action: LifecycleAction, s: LifecycleSnapshot): ApplicationStatus {
  switch (action) {
    case "approve": return "APPROVED";
    case "complete": return "COMPLETED";
    case "reject": return "REJECTED";
    case "withdraw": return "WITHDRAWN";
    case "reopen": return deriveAutoStatus({ ...s, status: "IN_PROGRESS" });
  }
}

export function checkTransition(
  action: LifecycleAction,
  s: LifecycleSnapshot,
  role: string,
  reason: string | null | undefined,
): TransitionCheck {
  const rule = LIFECYCLE_ACTIONS[action];
  if (!rule.roles.includes(role)) {
    return { ok: false, code: "FORBIDDEN", message: "لا تملك صلاحية هذا الإجراء" };
  }
  if (!rule.from.includes(s.status)) {
    return { ok: false, code: "INVALID_STATE", message: "هذا الإجراء غير متاح لحالة الطلب الحالية" };
  }
  if (rule.requiresReason && !reason?.trim()) {
    return { ok: false, code: "REASON_REQUIRED", message: "السبب مطلوب لهذا الإجراء" };
  }
  const blocked = rule.guard?.(s);
  if (blocked) return { ok: false, code: "GUARD", message: blocked };
  return { ok: true, to: targetOf(action, s) };
}

/** هل يُسمح برفع مستند في هذه الحالة؟ يعيد سبب المنع أو null. */
export function uploadBlockedReason(status: ApplicationStatus, documentStatus: DocumentStatus): string | null {
  if (status === "PENDING") return "يجب قبول العرض الوظيفي أولاً قبل رفع المستندات";
  if (!["IN_PROGRESS", "UNDER_REVIEW"].includes(status)) return "لا يمكن تعديل المستندات في هذه المرحلة من الطلب";
  if (documentStatus === "APPROVED") return "هذا المستند معتمد ولا يمكن استبداله";
  return null;
}

export const APPLICATION_STATUS_AR: Record<ApplicationStatus, string> = {
  PENDING: "بانتظار قبول العرض",
  IN_PROGRESS: "قيد الاستكمال",
  UNDER_REVIEW: "بانتظار الاعتماد",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  WITHDRAWN: "منسحب",
  COMPLETED: "مكتمل",
};
