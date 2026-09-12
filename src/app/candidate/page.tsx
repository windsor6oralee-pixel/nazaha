import { Calendar, Building, Briefcase, Phone, Mail } from "lucide-react";
import { ProgressTracker } from "@/components/candidate/ProgressTracker";
import { NextAction } from "@/components/candidate/NextAction";
import { DocumentCard } from "@/components/candidate/DocumentCard";
import { ContractCard } from "@/components/candidate/ContractCard";
import { SignedContractCard } from "@/components/candidate/SignedContractCard";
import { WelcomeMessage } from "@/components/candidate/WelcomeMessage";
import { PreboardingHub } from "@/components/candidate/PreboardingHub";
import { CountdownCard } from "@/components/candidate/CountdownCard";
import { auth } from "@/infrastructure/auth/auth";
import {
  getCandidateByApplicationId,
  getContractForApplication,
} from "@/infrastructure/repositories/candidate.repository";
import { getOrganizationBranding } from "@/infrastructure/services/organization.service";
import { getCandidateFields } from "@/infrastructure/custom-fields/field.service";
import { formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function CandidateDashboard() {
  const session = await auth();
  const applicationId = session!.user.applicationId;

  if (!applicationId) return notFound();

  const [candidate, contract, org, customFields] = await Promise.all([
    getCandidateByApplicationId(applicationId),
    getContractForApplication(applicationId),
    getOrganizationBranding(session!.user.organizationId),
    getCandidateFields(session!.user.organizationId, session!.user.id, { candidateVisibleOnly: true }),
  ]);
  if (!candidate) return notFound();

  const firstName = candidate.name.split(" ")[0];
  const step5Active = candidate.steps.some(
    (s) => s.order === 5 && (s.status === "in_progress" || s.status === "completed")
  );
  const requiredDocs = candidate.documents.filter((d) => d.required);
  const optionalDocs = candidate.documents.filter((d) => !d.required);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Welcome Banner */}
      <div className="relative rounded-2xl p-6 mb-4 overflow-hidden"
        style={{ background: "var(--color-primary)" }}>
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-32 -translate-y-32" />
        <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full translate-x-16 translate-y-16"
          style={{ background: "var(--color-gold)", opacity: 0.1 }} />
        <div className="relative">
          <p className="text-sm mb-1" style={{ color: "#A8D5B8" }}>مرحباً بك في نزاهة التوظيف</p>
          <h1 className="text-2xl font-bold mb-1 text-white">{candidate.name}</h1>
          <p className="text-sm" style={{ color: "#C8E8D4" }}>
            {candidate.jobTitle} · {candidate.department}
          </p>

          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#A8D5B8" }}>
              <Calendar className="w-3.5 h-3.5" />
              تاريخ القبول: {formatDate(candidate.acceptanceDate)}
            </div>
            {candidate.startDate && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "#A8D5B8" }}>
                <Briefcase className="w-3.5 h-3.5" />
                تاريخ المباشرة: {formatDate(candidate.startDate)}
              </div>
            )}
            {customFields.filter((f) => f.value !== null).map((f) => (
              <div key={f.id} className="flex items-center gap-1.5 text-xs" style={{ color: "#A8D5B8" }}>
                <Building className="w-3.5 h-3.5" />
                {f.labelAr}: {f.display}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Institutional Welcome Message */}
      <WelcomeMessage
        firstName={firstName}
        department={candidate.department}
        jobTitle={candidate.jobTitle}
      />

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        {/* Right: Progress + Next Action + Countdown */}
        <div className="lg:col-span-1 space-y-4">
          <ProgressTracker
            steps={candidate.steps}
            completionPercentage={candidate.completionPercentage}
          />
          <NextAction candidate={candidate} firstName={firstName} />

          {candidate.startDate && (
            <CountdownCard
              firstName={firstName}
              startDate={candidate.startDate}
              acceptanceDate={candidate.acceptanceDate}
            />
          )}

          {contract?.status === "PENDING_SIGNATURE" && (
            <ContractCard
              contractId={contract.id}
              contractName={contract.nameAr}
              candidateName={candidate.name}
              jobTitle={candidate.jobTitle}
              organization={org.nameAr}
              generatedAt={contract.generatedAt?.toISOString() ?? new Date().toISOString()}
              renderedHtml={contract.renderedHtml}
            />
          )}
          {contract?.status === "FULLY_SIGNED" && (
            <SignedContractCard
              contractName={contract.nameAr}
              candidateName={candidate.name}
              signedAt={contract.signatures?.[0]?.signedAt?.toISOString()}
            />
          )}

          {step5Active && (
            <PreboardingHub
              applicationId={applicationId}
              firstName={firstName}
            />
          )}

          {/* Contact Card */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm"
            style={{ borderColor: "var(--color-border)" }}>
            <h3 className="font-bold text-sm mb-3" style={{ color: "var(--color-dark)" }}>
              بياناتك
            </h3>
            <div className="space-y-2">
              {candidate.phone && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <Phone className="w-3.5 h-3.5" />
                  {candidate.phone}
                </div>
              )}
              {candidate.email && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <Mail className="w-3.5 h-3.5" />
                  {candidate.email}
                </div>
              )}
              {candidate.department && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <Building className="w-3.5 h-3.5" />
                  {candidate.department}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Left: Documents */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border p-6 shadow-sm"
            style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-base" style={{ color: "var(--color-dark)" }}>
                  {firstName}، هذه مستنداتك المطلوبة
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {requiredDocs.filter((d) => d.status === "approved").length} من{" "}
                  {requiredDocs.length} مستندات مكتملة
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {requiredDocs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  candidateFirstName={firstName}
                />
              ))}
            </div>

            {optionalDocs.length > 0 && (
              <>
                <h3 className="font-semibold text-sm mb-3"
                  style={{ color: "var(--color-text-muted)" }}>
                  مستندات اختيارية
                </h3>
                <div className="space-y-3">
                  {optionalDocs.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      candidateFirstName={firstName}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
