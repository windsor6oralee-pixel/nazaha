import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ImportBatchDetailClient } from "@/components/hr/ImportBatchDetailClient";
import { getImportBatch } from "@/infrastructure/services/import-batch.service";
import { getTenantContext } from "@/infrastructure/tenant";

export const metadata = { title: "تفاصيل دفعة الاستيراد" };

interface Props { params: Promise<{ id: string }> }

export default async function ImportBatchDetailPage({ params }: Props) {
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "hr") redirect("/auth/login?type=hr");

  const { id } = await params;
  const batch = await getImportBatch(ctx.organizationId, id);
  if (!batch) notFound();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/hr" className="hover:underline" style={{ color: "var(--color-primary)" }}>الموارد البشرية</Link>
        <span>/</span>
        <Link href="/hr/import-batches" className="hover:underline" style={{ color: "var(--color-primary)" }}>دفعة الاستيراد</Link>
        <span>/</span>
        <span className="font-medium font-mono text-xs" style={{ color: "var(--color-dark)" }} dir="ltr">{batch.reference}</span>
      </div>

      <ImportBatchDetailClient initial={JSON.parse(JSON.stringify(batch))} />
    </div>
  );
}
