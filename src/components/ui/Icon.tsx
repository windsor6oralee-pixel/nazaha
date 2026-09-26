import type { ReactElement, SVGProps } from "react";

/*
 * نظام أيقونات نزاهة — 19 أيقونة خطية على شبكة 24×24، سمك 1.75، نهايات مستديرة،
 * ومعها chevron وclose للاستخدام داخل المكونات. أعيد رسمها من لوحة دليل الهوية.
 */

export type IconName =
  | "profile" | "candidates" | "documents" | "integrity" | "approved"
  | "reports" | "filter" | "search" | "privacy" | "justice" | "flag"
  | "pending" | "messages" | "notifications" | "calendar" | "upload"
  | "review" | "settings" | "dashboard" | "chevron" | "close";

export type IconSize = 16 | 20 | 24 | 32 | 48;

const PATHS: Record<IconName, ReactElement> = {
  profile: <><circle cx="12" cy="8" r="3.4" /><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0" /></>,
  candidates: <><circle cx="9" cy="8" r="3.2" /><path d="M2.6 20.2a6.4 6.4 0 0 1 12.8 0" /><path d="M16.8 6.4 19.8 9.4 16.8 12.4" /></>,
  documents: <><path d="M13.6 3H7.2A1.2 1.2 0 0 0 6 4.2v15.6A1.2 1.2 0 0 0 7.2 21h9.6a1.2 1.2 0 0 0 1.2-1.2V7.6z" /><path d="M13.6 3v4.6H18" /><path d="M9 12.6h6" /><path d="M9 16.2h4" /></>,
  integrity: <><path d="M12 3 19 6v5.1c0 4.4-2.9 7.9-7 9.9-4.1-2-7-5.5-7-9.9V6z" /><path d="m8.8 11.9 2.2 2.2 4.2-4.2" /></>,
  approved: <><circle cx="12" cy="12" r="8.8" /><path d="m8.4 12.3 2.6 2.6 4.6-5" /></>,
  reports: <><path d="M4.4 20h15.2" /><path d="M7.6 20v-5.2" /><path d="M12 20V8.4" /><path d="M16.4 20v-8" /></>,
  filter: <path d="M4.2 5h15.6l-6 7.2V19l-3.6 1.8v-8.6z" />,
  search: <><circle cx="11" cy="11" r="6.4" /><path d="m15.8 15.8 4 4" /></>,
  privacy: <><rect x="4.8" y="10" width="14.4" height="10.2" rx="2" /><path d="M8.2 10V7.2a3.8 3.8 0 0 1 7.6 0V10" /><circle cx="12" cy="15.1" r="1.3" /></>,
  justice: <><path d="M12 4v16" /><path d="M6.2 20h11.6" /><path d="M3.6 8.6h16.8" /><path d="M7.6 4.8 12 8.6l4.4-3.8" /><path d="M6.6 8.6 3.6 14.6a3 3 0 0 0 6 0z" /><path d="m17.4 8.6 3 6a3 3 0 0 1-6 0z" /></>,
  flag: <><path d="M6.2 21V4" /><path d="M6.2 4.4h11.2l-2.2 3.8 2.2 3.8H6.2" /></>,
  pending: <><circle cx="12" cy="12" r="8.8" /><path d="M12 7.2V12l3.4 2" /></>,
  messages: <><path d="M4.2 5.4h15.6v10.2H9.6l-5.4 4z" /><circle cx="9" cy="10.4" r="1" /><circle cx="12" cy="10.4" r="1" /><circle cx="15" cy="10.4" r="1" /></>,
  notifications: <><path d="M18.2 16.4V11a6.2 6.2 0 1 0-12.4 0v5.4L4.2 19h15.6z" /><path d="M9.8 19a2.2 2.2 0 0 0 4.4 0" /></>,
  calendar: <><rect x="4.2" y="5.4" width="15.6" height="15" rx="2" /><path d="M4.2 10.2h15.6" /><path d="M8.4 3v4" /><path d="M15.6 3v4" /><circle cx="8.6" cy="14" r="0.9" /><circle cx="12" cy="14" r="0.9" /><circle cx="15.4" cy="14" r="0.9" /></>,
  upload: <><path d="M12 15.2V3.8" /><path d="m8.2 7.6 3.8-3.8 3.8 3.8" /><path d="M4.4 15.4v3.4a1.4 1.4 0 0 0 1.4 1.4h12.4a1.4 1.4 0 0 0 1.4-1.4v-3.4" /></>,
  review: <><path d="M2.8 12S6.4 6.2 12 6.2 21.2 12 21.2 12 17.6 17.8 12 17.8 2.8 12 2.8 12" /><circle cx="12" cy="12" r="2.6" /></>,
  settings: <><circle cx="12" cy="12" r="3.4" /><path d="M12 3.4v2.2" /><path d="M12 18.4v2.2" /><path d="M3.4 12h2.2" /><path d="M18.4 12h2.2" /><path d="m5.9 5.9 1.6 1.6" /><path d="m16.5 16.5 1.6 1.6" /><path d="m18.1 5.9-1.6 1.6" /><path d="m7.5 16.5-1.6 1.6" /></>,
  dashboard: <><rect x="4" y="4" width="7" height="7" rx="1.6" /><rect x="13" y="4" width="7" height="7" rx="1.6" /><rect x="4" y="13" width="7" height="7" rx="1.6" /><rect x="13" y="13" width="7" height="7" rx="1.6" /></>,
  chevron: <path d="m6.6 9.6 5.4 5.2 5.4-5.2" />,
  close: <><path d="m6.4 6.4 11.2 11.2" /><path d="m17.6 6.4-11.2 11.2" /></>,
};

export const ICON_LABELS: Record<IconName, string> = {
  profile: "الملف الشخصي", candidates: "المرشحون", documents: "الطلبات والمستندات",
  integrity: "النزاهة والحماية", approved: "اعتماد ناجح", reports: "التقارير",
  filter: "التصفية", search: "البحث", privacy: "الخصوصية", justice: "العدالة والتقييم",
  flag: "بلاغ أو ملاحظة", pending: "قيد المراجعة", messages: "المراسلات",
  notifications: "التنبيهات", calendar: "المواعيد", upload: "رفع الملفات",
  review: "المراجعة والاطلاع", settings: "الإعدادات", dashboard: "لوحة التحكم",
  chevron: "سهم", close: "إغلاق",
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** أحد المقاسات الخمسة المعتمدة فقط. الافتراضي 24. */
  size?: IconSize;
  /** وصف بديل. مرر false حين يجاور الأيقونة نص يحمل المعنى نفسه. */
  label?: string | false;
  /** تعبئة كاملة — للعنصر المحدد في القائمة الجانبية فقط. */
  filled?: boolean;
}

export function Icon({ name, size = 24, label, filled, className, ...rest }: IconProps) {
  const a11y =
    label === false
      ? { "aria-hidden": true as const }
      : { role: "img", "aria-label": label || ICON_LABELS[name] };
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      fillOpacity={filled ? 0.18 : undefined}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `nz-icon ${className}` : "nz-icon"}
      focusable="false"
      {...a11y}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
