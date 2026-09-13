import { notFound } from "next/navigation";
import { getTenantContext, tenantPrisma } from "@/infrastructure/tenant";
import { getContractForApplication } from "@/infrastructure/repositories/candidate.repository";
import { sanitizeContractHtml } from "@/infrastructure/contracts/html-sanitizer";
import {
  ContractSigningPanel,
  ContractLockedPanel,
  ContractWaitingPanel,
} from "@/components/candidate/ContractSigningPanel";

export default async function ContractPage() {
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "candidate" || !ctx.applicationId) return notFound();
  const { organizationId, applicationId, candidateId } = ctx;
  const db = tenantPrisma(organizationId);

  const [contract, application] = await Promise.all([
    getContractForApplication(organizationId, applicationId),
    db.application.findFirst({
      where: { id: applicationId, candidateId },
      select: {
        candidate: { select: { nameAr: true } },
        documents: { where: { isRequired: true }, select: { status: true } },
      },
    }),
  ]);
  if (!application) return notFound();

  const requiredDocs = application.documents;
  const totalRequired = requiredDocs.length;
  const approvedCount = requiredDocs.filter((d) => d.status === "APPROVED").length;
  const allApproved = totalRequired > 0 && approvedCount === totalRequired;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>
          التوقيع الإلكتروني
        </p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>
          توقيع وثائق التوظيف
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
        >
          مراجعة وتوقيع عقود التوظيف إلكترونياً بشكل آمن وملزم قانونياً
        </p>
      </div>

      {!allApproved ? (
        <ContractLockedPanel approvedCount={approvedCount} totalRequired={totalRequired} />
      ) : !contract ? (
        <ContractWaitingPanel />
      ) : (
        <ContractSigningPanel
          contract={{
            id: contract.id,
            nameAr: contract.nameAr,
            status: contract.status,
            generatedAt: contract.generatedAt?.toISOString() ?? null,
            signedAt: contract.signatures[0]?.signedAt?.toISOString() ?? null,
            renderedHtml: contract.renderedHtml ? sanitizeContractHtml(contract.renderedHtml) : null,
          }}
          candidateNameAr={application.candidate.nameAr}
        />
      )}
    </div>
  );
}
