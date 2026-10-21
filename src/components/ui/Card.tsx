import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

/*
 * بطاقة المحتوى: surface-100، حد border-100، حواف radius-20، هامش space-24.
 * تفصل عن الأرضية بالحد لا بالظل. interactive فقط حين تكون البطاقة كلها قابلة للنقر.
 */
export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  /** عنصر في رأس البطاقة مقابل العنوان (زر، شارة…). */
  action?: ReactNode;
  interactive?: boolean;
  /** false يلغي حركة الظهور. */
  animate?: boolean;
  /** plain: أرضية بيضاء surface-000 بدل surface-100. */
  plain?: boolean;
  /** بلا هامش داخلي — لبطاقة تحتضن جدولا أو قائمة. */
  flush?: boolean;
  as?: "div" | "section" | "article";
}

export function Card({
  title, description, action, interactive, animate = true, plain, flush, as: Tag = "section", className, children, ...rest
}: CardProps) {
  return (
    <Tag
      className={cn(
        "nz-card",
        interactive && "nz-card--interactive",
        animate && "nz-enter",
        plain && "nz-card--plain",
        flush && "nz-card--flush",
        className,
      )}
      {...rest}
    >
      {(title || action) && (
        <div className="nz-card__head" style={flush ? { padding: "var(--space-24) var(--space-24) 0" } : undefined}>
          <div style={{ minWidth: 0 }}>
            {title && <h3 className="nz-card__title">{title}</h3>}
            {description && <p className="nz-card__desc">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </Tag>
  );
}

/* بطاقة المؤشر: رقم بخط latin 28/32 وتسمية caption وأيقونة icon-32 بلون green-700.
   مع `href` تصبح بطاقة رابط: البطاقة كلها هدف الضغط وتنتقل إلى قائمة مُصفّاة. */
export function StatCard({
  value, label, icon, hint, href, className,
}: { value: ReactNode; label: ReactNode; icon?: IconName; hint?: ReactNode; href?: string; className?: string }) {
  const body = (
    <>
      {icon && <Icon name={icon} size={32} label={false} className="nz-stat__icon" />}
      <div style={{ minWidth: 0 }}>
        <div className="nz-stat__num">{value}</div>
        <div className="nz-stat__label">{label}</div>
        {hint && <div className="nz-stat__hint">{hint}</div>}
      </div>
      {href && (
        <Icon
          name="chevron"
          size={16}
          label={false}
          className="nz-stat__go"
        />
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn("nz-stat nz-stat--link", className)}>
        {body}
      </Link>
    );
  }

  return <div className={cn("nz-stat", className)}>{body}</div>;
}

export function EmptyState({
  icon = "documents", title, children, action,
}: { icon?: IconName; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="nz-empty">
      <Icon name={icon} size={48} label={false} />
      <p className="nz-empty__title">{title}</p>
      {children && <div>{children}</div>}
      {action && <div style={{ marginTop: "var(--space-16)" }}>{action}</div>}
    </div>
  );
}

/* تنبيه سطري هادئ. gold للتنبيهات الهادئة (gold-200 مع ink). */
export function Alert({
  tone = "info", icon, title, children, className,
}: { tone?: "info" | "gold" | "success" | "error"; icon?: IconName; title?: ReactNode; children?: ReactNode; className?: string }) {
  const fallback: Record<string, IconName> = { info: "notifications", gold: "flag", success: "approved", error: "flag" };
  return (
    <div className={cn("nz-alert", `nz-alert--${tone}`, className)} role={tone === "error" ? "alert" : undefined}>
      <Icon name={icon ?? fallback[tone]} size={20} label={false} />
      <div style={{ minWidth: 0 }}>
        {title && <p style={{ margin: 0, fontWeight: 600 }}>{title}</p>}
        {children && <div style={{ color: title ? "var(--ink-muted)" : undefined }}>{children}</div>}
      </div>
    </div>
  );
}
