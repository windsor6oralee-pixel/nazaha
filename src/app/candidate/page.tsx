import { Phone } from "lucide-react";
import { Card, StatCard } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ProgressTracker } from "@/components/candidate/ProgressTracker";
import { NextAction } from "@/components/candidate/NextAction";
import { DocumentCard } from "@/components/candidate/DocumentCard";
import { ContractCard } from "@/components/candidate/ContractCard";
import { SignedContractCard } from "@/components/candidate/SignedContractCard";
import { WhatsAppContact } from "@/components/candidate/WhatsAppContact";
import { WelcomeMessage } from "@/components/candidate/WelcomeMessage";
import { PreboardingHub } from "@/components/candidate/PreboardingHub";
import { CountdownCard } from "@/components/candidate/CountdownCard";
import { OnboardingComplete } from "@/components/candidate/OnboardingComplete";
import { getTenantContext } from "@/infrastructure/tenant";
import {
  getCandidateByApplicationId,
  getContractForApplication,
} from "@/infrastructure/repositories/candidate.repository";
import { getOrganizationBranding } from "@/infrastructure/services/organization.service";
import { getCandidateFields } from "@/infrastructure/custom-fields/field.service";
import { sanitizeContractHtml } from "@/infrastructure/contracts/html-sanitizer";
import { formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function CandidateDashboard() {
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "candidate" || !ctx.applicationId) return notFound();
  const { organizationId, applicationId, candidateId } = ctx;

  const [candidate, contract, org, customFields] = await Promise.all([
    getCandidateByApplicationId(organizationId, applicationId),
    getContractForApplication(organizationId, applicationId),
    getOrganizationBranding(organizationId),
    getCandidateFields(organizationId, candidateId, { candidateVisibleOnly: true }),
  ]);
  if (!candidate) return notFound();

  const firstName = candidate.name.split(" ")[0];
  const step5Active = candidate.steps.some(
    (s) => s.order === 5 && (s.status === "in_progress" || s.status === "completed")
  );
  const requiredDocs = candidate.documents.filter((d) => d.required);
  const optionalDocs = candidate.documents.filter((d) => !d.required);
  const isComplete = candidate.completionPercentage === 100;
  const approvedRequired = requiredDocs.filter((d) => d.status === "approved").length;
  const completedSteps = candidate.steps.filter((s) => s.status === "completed").length;

  return (
    <div className="nz-page" dir="rtl">

      {/* Onboarding complete celebration */}
      {isComplete && (
        <OnboardingComplete
          candidateName={candidate.name}
          jobTitle={candidate.jobTitle}
          organization={org.nameAr}
        />
      )}

      {/* Page head (replaces the old welcome banner) */}
      <div className="nz-page__head">
        <div style={{ minWidth: 0 }}>
          <p className="text-green-700" style={{ margin: "0 0 var(--space-8)", fontSize: 13, fontWeight: 500 }}>
            مرحباً بك في نزاهة التوظيف
          </p>
          <h1 className="nz-page__title">{candidate.name}</h1>
          <p className="nz-page__lead">
            {candidate.jobTitle} · {candidate.department}
          </p>
          {!isComplete && (
            <div
              className="flex flex-wrap text-ink-muted"
              style={{ gap: "var(--space-8) var(--space-24)", marginTop: "var(--space-16)", fontSize: 13 }}
            >
              <span className="inline-flex items-center gap-2">
                <Icon name="calendar" size={16} label={false} />
                تاريخ القبول: {formatDate(candidate.acceptanceDate)}
              </span>
              {candidate.startDate && (
                <span className="inline-flex items-center gap-2">
                  <Icon name="calendar" size={16} label={false} />
                  تاريخ المباشرة: {formatDate(candidate.startDate)}
                </span>
              )}
              {customFields.filter((f) => f.value !== null).map((f) => (
                <span key={f.id} className="inline-flex items-center gap-2">
                  <Icon name="profile" size={16} label={false} />
                  {f.labelAr}: {f.display}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Indicator cards */}
      <div className="nz-stats nz-stagger">
        <StatCard
          icon="reports"
          value={`${candidate.completionPercentage}%`}
          label="نسبة إنجاز رحلتك"
        />
        <StatCard
          icon="documents"
          value={`${approvedRequired} / ${requiredDocs.length}`}
          label="المستندات المطلوبة المعتمدة"
        />
        <StatCard
          icon="approved"
          value={`${completedSteps} / ${candidate.steps.length}`}
          label="الخطوات المكتملة"
        />
      </div>

      {/* HR welcome note or generic welcome */}
      <WelcomeMessage
        firstName={firstName}
        department={candidate.department}
        jobTitle={candidate.jobTitle}
        hrWelcomeNote={candidate.hrWelcomeNote}
      />

      {/*
        Mobile layout: documents come FIRST so the candidate immediately sees
        what they need to upload. Sidebar (progress, actions, contract) follows.
        Desktop: 3-column grid — sidebar right, documents left.
        CSS `order` handles the swap without duplicating markup.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Documents — order-1 on mobile (first), order-2 on desktop (right 2/3) */}
        <div className="order-1 lg:order-2 lg:col-span-2 min-w-0">
          <Card
            title={`${firstName}، هذه مستنداتك المطلوبة`}
            description={
              <>
                <span className="font-numeric">{approvedRequired}</span> من{" "}
                <span className="font-numeric">{requiredDocs.length}</span> مستندات مكتملة
              </>
            }
          >
            <div className="flex flex-col gap-2">
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
                <h3 className="text-ink-muted" style={{ margin: "var(--space-24) 0 var(--space-16)", fontSize: 15, fontWeight: 600 }}>
                  مستندات اختيارية
                </h3>
                <div className="flex flex-col gap-2">
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
          </Card>
        </div>

        {/* Sidebar — order-2 on mobile (after docs), order-1 on desktop (left 1/3) */}
        <div className="order-2 lg:order-1 lg:col-span-1 flex flex-col gap-6 min-w-0">
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
              renderedHtml={contract.renderedHtml ? sanitizeContractHtml(contract.renderedHtml) : null}
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
          <Card title="بياناتك">
            <div className="flex flex-col gap-2 text-ink-muted" style={{ fontSize: 14 }}>
              {candidate.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={16} strokeWidth={1.75} aria-hidden />
                  <span dir="ltr">{candidate.phone}</span>
                </div>
              )}
              {candidate.email && (
                <div className="flex items-center gap-2">
                  <Icon name="messages" size={16} label={false} />
                  <span dir="ltr" style={{ overflowWrap: "anywhere" }}>{candidate.email}</span>
                </div>
              )}
              {candidate.department && (
                <div className="flex items-center gap-2">
                  <Icon name="dashboard" size={16} label={false} />
                  {candidate.department}
                </div>
              )}
            </div>
          </Card>

          {/* WhatsApp — رقم جهة المرشح، يظهر بعد دخوله برمز الدعوة */}
          <WhatsAppContact
            phone={org.contactPhone}
            orgName={org.nameAr}
            candidateName={candidate.name}
          />
        </div>
      </div>
    </div>
  );
}
