import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, Clock, Fingerprint } from "lucide-react";
import { getTenantContext, tenantPrisma } from "@/infrastructure/tenant";

interface Props { params: Promise<{ id: string }> }

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING_SIGNATURE: { label: "بانتظار التوقيع", bg: "var(--color-warning-bg)", color: "var(--color-warning)" },
  FULLY_SIGNED:      { label: "موقَّع",           bg: "var(--color-success-bg)", color: "var(--color-success)" },
  EXPIRED:           { label: "منتهي",            bg: "var(--color-error-bg)",   color: "var(--color-error)" },
  CANCELLED:         { label: "ملغى",             bg: "var(--color-error-bg)",   color: "var(--color-error)" },
  DRAFT:             { label: "مسودة",            bg: "var(--color-surface-alt)", color: "var(--color-text-muted)" },
};

export default async function HRContractViewPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "hr") return notFound();
  const db = tenantPrisma(ctx.organizationId);

  const contract = await db.contract.findUnique({
    where: { id },
    include: {
      template: { select: { version: true } },
      application: { select: { candidate: { select: { id: true, nameAr: true, jobTitle: true } } } },
      signatures: { orderBy: { signedAt: "desc" }, select: { signedAt: true, signatureData: true, method: true, ipAddress: true, contentHash: true } },
    },
  });
  if (!contract) return notFound();

  const st = STATUS[contract.status] ?? STATUS.DRAFT;
  const cand = contract.application.candidate;
  const sig = contract.signatures[0];
  const fmt = (d: Date) => d.toLocaleString("ar-SA", { dateStyle: "long", timeStyle: "short" });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/hr/candidates" className="hover:underline" style={{ color: "var(--color-primary)" }}>المرشحون</Link>
        <span>/</span>
        <Link href={`/hr/candidates/${cand.id}`} className="hover:underline" style={{ color: "var(--color-primary)" }}>{cand.nameAr}</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>{contract.nameAr}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>{contract.nameAr}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            {cand.nameAr} · {cand.jobTitle}
            {contract.template && <> · القالب v{contract.template.version}</>}
          </p>
        </div>
        <span className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
      </div>

      <div className="grid md:grid-cols-[1fr_260px] gap-5">
        <div className="bg-white rounded-2xl border p-6 sm:p-8" style={{ borderColor: "var(--color-border)" }}>
          {contract.renderedHtml
            ? <div className="contract-body" dangerouslySetInnerHTML={{ __html: contract.renderedHtml }} />
            : <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>هذا العقد أُنشئ قبل اعتماد القوالب ولا يحتوي نسخة نصية محفوظة.</p>}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--color-border)" }}>
            <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--color-dark)" }}>
              <Clock className="w-3.5 h-3.5" /> الجدول الزمني
            </p>
            <div className="text-xs space-y-1.5" style={{ color: "var(--color-text-muted)" }}>
              <p>أُنشئ: <span style={{ color: "var(--color-dark)" }}>{contract.generatedAt ? fmt(contract.generatedAt) : "—"}</span></p>
              <p>وُقّع: <span style={{ color: "var(--color-dark)" }}>{sig ? fmt(sig.signedAt) : "لم يُوقَّع بعد"}</span></p>
            </div>
          </div>

          {sig && (
            <div className="bg-white rounded-2xl border p-4 space-y-2" style={{ borderColor: "var(--color-border)" }}>
              <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--color-dark)" }}>
                <ShieldCheck className="w-3.5 h-3.5" /> بيانات التوقيع
              </p>
              <div className="text-xs space-y-1.5" style={{ color: "var(--color-text-muted)" }}>
                <p>الاسم الموقِّع: <span className="font-semibold" style={{ color: "var(--color-primary-dark)" }}>{sig.signatureData}</span></p>
                <p>الطريقة: {sig.method === "TYPED" ? "اسم مكتوب" : sig.method}</p>
                {sig.ipAddress && <p dir="ltr" className="text-left">IP: {sig.ipAddress}</p>}
              </div>
            </div>
          )}

          {contract.contentHash && (
            <div className="bg-white rounded-2xl border p-4 space-y-2" style={{ borderColor: "var(--color-border)" }}>
              <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--color-dark)" }}>
                <Fingerprint className="w-3.5 h-3.5" /> بصمة المحتوى (SHA-256)
              </p>
              <p dir="ltr" className="font-mono text-[10px] break-all text-left" style={{ color: "var(--color-text-muted)" }}>{contract.contentHash}</p>
              {sig?.contentHash && (
                <p className="text-[11px]" style={{ color: sig.contentHash === contract.contentHash ? "var(--color-success)" : "var(--color-error)" }}>
                  {sig.contentHash === contract.contentHash ? "✓ مطابقة لبصمة التوقيع" : "✗ لا تطابق بصمة التوقيع"}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
