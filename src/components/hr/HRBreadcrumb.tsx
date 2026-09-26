import Link from "next/link";
import { Fragment } from "react";

/** مسار التنقل لصفحات الموارد البشرية الفرعية. آخر عنصر هو الصفحة الحالية (بلا رابط). */
export function HRBreadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="مسار التنقل" className="ds-caption flex items-center gap-2 flex-wrap" style={{ color: "var(--ink-muted)" }}>
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden>/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:underline" style={{ color: "var(--green-700)", fontWeight: 500 }}>
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" style={{ color: "var(--ink)", fontWeight: 500 }}>{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
