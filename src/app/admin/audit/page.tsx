import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantContext, tenantPrisma } from "@/infrastructure/tenant";
import {
  listAuditLogs, getAuditFilterOptions, parseAuditFilters, ACTION_LABELS, RESOURCE_LABELS,
} from "@/infrastructure/audit/audit.service";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";

interface Props { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function AuditLogPage({ searchParams }: Props) {
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "hr") return notFound();

  const raw = await searchParams;
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && v) query[k] = v;
  const sp = new URLSearchParams(query);

  const db = tenantPrisma(ctx.organizationId);
  const [page, options] = await Promise.all([
    listAuditLogs(db, parseAuditFilters(sp), sp.get("cursor")),
    getAuditFilterOptions(db),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/admin" className="hover:underline" style={{ color: "var(--color-primary)" }}>الإعدادات</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>سجل التدقيق</span>
      </div>

      <div className="mb-6">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>الحوكمة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>سجل التدقيق</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          من فعل ماذا ومتى — كل عملية على بيانات جهتك، بترتيب زمني تنازلي، لا تُعدَّل ولا تُحذف.
        </p>
      </div>

      <AuditLogViewer
        initial={page}
        query={query}
        options={options}
        actionLabels={ACTION_LABELS}
        resourceLabels={RESOURCE_LABELS}
      />
    </div>
  );
}
