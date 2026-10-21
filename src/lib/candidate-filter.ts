import type { ApplicationStatus } from "@/types";

/*
 * تصفية قائمة المرشحين — مفاتيح الحالة كما تراها الواجهة.
 *
 * عدّادات لوحة الموارد البشرية (/hr) تشير إلى /hr/candidates?status=<key>
 * بهذه المفاتيح نفسها، فيطابق الرقم ما يراه المستخدم بعد الضغط.
 */
export const STATUS_FILTER_KEYS = [
  "approved",
  "in_progress",
  "under_review",
  "pending",
  "completed",
  "rejected",
] as const satisfies readonly ApplicationStatus[];

export type StatusFilter = ApplicationStatus | "all";

/** يقرأ قيمة ?status= ويتجاهل أي قيمة غير معروفة. */
export function parseStatusFilter(raw: string | string[] | undefined): StatusFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (STATUS_FILTER_KEYS as readonly string[]).includes(value ?? "")
    ? (value as ApplicationStatus)
    : "all";
}
