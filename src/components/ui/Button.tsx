import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

/*
 * primary: زر واحد فقط في كل شاشة. secondary: الإجراءات المساندة.
 * gold: الإجراء المميز النادر — لا يجاور primary في المجموعة نفسها.
 * ghost وdanger: إجراءات ثانوية داخل البطاقات والجداول.
 */
export type ButtonVariant = "primary" | "secondary" | "gold" | "ghost" | "danger";

interface CommonProps {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  block?: boolean;
  /** أيقونة من نظام نزاهة قبل النص. */
  icon?: IconName;
  /** أيقونة أو عنصر مخصص قبل النص (مثلا أيقونة lucide لا مقابل لها في النظام). */
  leading?: ReactNode;
  children?: ReactNode;
}

function classes({ variant = "primary", size = "md", block }: CommonProps, className?: string) {
  return cn("nz-btn", `nz-btn--${variant}`, size === "sm" && "nz-btn--sm", block && "nz-btn--block", className);
}

export interface ButtonProps extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** يعطل الزر ويعرض مؤشر دوران. */
  loading?: boolean;
}

export function Button({
  variant, size, block, icon, leading, loading, disabled, className, children, type = "button", ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="nz-btn__spin" aria-hidden />
      ) : icon ? (
        <Icon name={icon} size={20} label={false} />
      ) : (
        leading
      )}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends CommonProps, Omit<ComponentProps<typeof Link>, "children"> {}

export function ButtonLink({ variant, size, block, icon, leading, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classes({ variant, size, block }, className)} {...rest}>
      {icon ? <Icon name={icon} size={20} label={false} /> : leading}
      {children}
    </Link>
  );
}
