import { auth } from "@/infrastructure/auth/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/infrastructure/database/client";
import { getContractForApplication } from "@/infrastructure/repositories/candidate.repository";
import {
  ContractSigningPanel,
  ContractLockedPanel,
  ContractWaitingPanel,
} from "@/components/candidate/ContractSigningPanel";

export default async function ContractPage() {
  const session = await auth();
  const applicationId = session?.user?.applicationId;
  if (!applicationId) redirect("/candidate");

  const [contract, candidate] = await Promise.all([
    getContractForApplication(applicationId),
    prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        candidate: { select: { nameAr: true } },
        documents: {
          where: { isRequired: true },
          select: { status: true },
        },
      },
    }),
  ]);

  const requiredDocs = candidate?.documents ?? [];
  const totalRequired = requiredDocs.length;
  const approvedCount = requiredDocs.filter((d) => d.status === "APPROVED").length;
  const allApproved = totalRequired > 0 && approvedCount === totalRequired;
  const candidateName = candidate?.candidate.nameAr ?? "";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
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

      {/* Content: conditional on state */}
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
            renderedHtml: contract.renderedHtml,
          }}
          candidateNameAr={candidateName}
        />
      )}
    </div>
  );
}
