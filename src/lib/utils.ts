import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ApplicationStatus, DocumentStatus } from "@/types";
import type React from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStatusLabel(status: ApplicationStatus): string {
  const labels: Record<ApplicationStatus, string> = {
    pending: "قيد الانتظار",
    in_progress: "قيد الإنجاز",
    under_review: "تحت المراجعة",
    approved: "معتمد",
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

/* Returns inline-style object for official brand status colors */
export function getStatusStyle(status: ApplicationStatus): React.CSSProperties {
  const styles: Record<ApplicationStatus, React.CSSProperties> = {
    pending:      { color: "#C48F1E", background: "#FBF6E4", borderColor: "rgba(196,143,30,0.25)" },
    in_progress:  { color: "#1D5FA8", background: "#EBF2FB", borderColor: "rgba(29,95,168,0.25)" },
    under_review: { color: "#C48F1E", background: "#FBF6E4", borderColor: "rgba(196,143,30,0.25)" },
    approved:     { color: "#227A4E", background: "#E8F5EE", borderColor: "rgba(34,122,78,0.25)" },
    rejected:     { color: "#A83A30", background: "#FAECEB", borderColor: "rgba(168,58,48,0.25)" },
    completed:    { color: "#195C30", background: "#E6F0E9", borderColor: "rgba(25,92,48,0.25)" },
  };
  return styles[status];
}

/* Legacy Tailwind className version — kept for backward compat */
export function getStatusColor(status: ApplicationStatus): string {
  const colors: Record<ApplicationStatus, string> = {
    pending:      "border",
    in_progress:  "border",
    under_review: "border",
    approved:     "border",
    rejected:     "border",
    completed:    "border",
  };
  return colors[status];
}

export function getDocStatusStyle(status: DocumentStatus): React.CSSProperties {
  const styles: Record<DocumentStatus, React.CSSProperties> = {
    not_uploaded: { color: "#6E7673", background: "#F7F5F1", borderColor: "rgba(110,118,115,0.2)" },
    uploaded:     { color: "#1D5FA8", background: "#EBF2FB", borderColor: "rgba(29,95,168,0.25)" },
    under_review: { color: "#C48F1E", background: "#FBF6E4", borderColor: "rgba(196,143,30,0.25)" },
    approved:     { color: "#227A4E", background: "#E8F5EE", borderColor: "rgba(34,122,78,0.25)" },
    rejected:     { color: "#A83A30", background: "#FAECEB", borderColor: "rgba(168,58,48,0.25)" },
  };
  return styles[status];
}

export function getDocStatusColor(status: DocumentStatus): string {
  return "border";
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
