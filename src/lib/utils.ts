import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ApplicationStatus, DocumentStatus } from "@/types";
import type { BadgeTone } from "@/components/ui/Badge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStatusLabel(status: ApplicationStatus): string {
  const labels: Record<ApplicationStatus, string> = {
    pending: "قيد الانتظار",
    in_progress: "قيد الإنجاز",
    under_review: "تحت المراجعة",
    approved: "مقبول",
    rejected: "مرفوض",
    completed: "مكتمل",
  };
  return labels[status];
}

export function getDocStatusLabel(status: DocumentStatus): string {
  const labels: Record<DocumentStatus, string> = {
    not_uploaded: "لم يُرفع",
    uploaded: "تم الرفع",
    under_review: "تحت المراجعة",
    approved: "معتمد",
    rejected: "مرفوض",
  };
  return labels[status];
}

/* Status → design-system badge tone (see components/ui/Badge). */
export function getStatusTone(status: ApplicationStatus): BadgeTone {
  const tones: Record<ApplicationStatus, BadgeTone> = {
    pending:      "neutral",
    in_progress:  "brand",
    under_review: "review",
    approved:     "done",
    rejected:     "rejected",
    completed:    "done",
  };
  return tones[status];
}

export function getDocStatusTone(status: DocumentStatus): BadgeTone {
  const tones: Record<DocumentStatus, BadgeTone> = {
    not_uploaded: "neutral",
    uploaded:     "brand",
    under_review: "review",
    approved:     "done",
    rejected:     "rejected",
  };
  return tones[status];
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
