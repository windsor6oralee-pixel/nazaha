import type { ReactNode, TdHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/*
 * جدول البيانات: رأس green-900 بنص ink-invert، صفوف متناوبة surface-100، فواصل border-100.
 * الصفوف تظهر بتتابع 40ms حتى الصف الثامن ثم دفعة واحدة. الأرقام الرسمية بلا عد تصاعدي.
 */
export interface Column {
  label: ReactNode;
  /** عرض ثابت للعمود (مثلا "1%" لعمود الإجراءات). */
  width?: string;
  /** يخفى تحت عرض معين. */
  hideBelow?: "sm" | "md" | "lg";
}

const HIDE: Record<NonNullable<Column["hideBelow"]>, string> = {
  sm: "max-sm:hidden",
  md: "max-md:hidden",
  lg: "max-lg:hidden",
};

export function Table({
  columns, children, empty, caption, className,
}: {
  columns: (Column | string)[];
  children?: ReactNode;
  /** يعرض بدل الصفوف حين لا توجد بيانات. */
  empty?: ReactNode;
  caption?: string;
  className?: string;
}) {
  const cols = columns.map((c) => (typeof c === "string" ? { label: c } : c));
  const hasRows = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return (
    <div className={cn("nz-table-wrap", className)}>
      <table className="nz-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} scope="col" style={c.width ? { width: c.width } : undefined} className={c.hideBelow ? HIDE[c.hideBelow] : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasRows ? children : (
            <tr style={{ animation: "none", background: "transparent" }}>
              <td colSpan={cols.length} className="nz-table__empty">{empty ?? "لا توجد بيانات"}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({
  numeric, hideBelow, className, ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; hideBelow?: Column["hideBelow"] }) {
  return <td className={cn(numeric && "nz-table__num", hideBelow && HIDE[hideBelow], className)} {...rest} />;
}
