import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

/*
 * شارة الحالة: done بـ success-500، review بـ warning-500، rejected بـ danger-500.
 * الشارة تحمل نصا وأيقونة دائما — اللون وحده لا يحمل المعنى.
 * neutral وbrand لحالات غير دلالية (لم يبدأ، مسودة، دور مستخدم…).
 */
export type BadgeTone = "done" | "review" | "rejected" | "neutral" | "brand";

const TONE_ICON: Record<BadgeTone, IconName> = {
  done: "approved",
  review: "pending",
  rejected: "close",
  neutral: "pending",
  brand: "integrity",
};

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
  /** أيقونة بديلة، أو false لإخفائها (فقط إن حمل النص المعنى كاملا). */
  icon?: IconName | false;
  className?: string;
}

export function Badge({ tone, children, icon, className }: BadgeProps) {
  const name = icon === false ? null : icon ?? TONE_ICON[tone];
  return (
    <span className={cn("nz-badge", `nz-badge--${tone}`, className)}>
      {name && <Icon name={name} size={16} label={false} />}
      {children}
    </span>
  );
}

/** نقطة ملونة مع نصها — لخلايا الجداول والقوائم الكثيفة. */
export function StatusDot({ tone, children, className }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn("nz-dot", `nz-dot--${tone}`, className)}>{children}</span>;
}
