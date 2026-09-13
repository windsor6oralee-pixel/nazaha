import { Mail, Phone, Building, Calendar } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { HRDocumentCard } from "@/components/hr/HRDocumentCard";
import { HRContractSection } from "@/components/hr/HRContractSection";
import { HRPreboardingPanel } from "@/components/hr/HRPreboardingPanel";
import { ProgressTracker } from "@/components/candidate/ProgressTracker";
import { InvitationCodeCard } from "@/components/hr/InvitationCodeCard";
import { getLatestInvitation } from "@/infrastructure/services/invitation.service";
import {
  getCandidateById,
  getContractForApplication,
} from "@/infrastructure/repositories/candidate.repository";
import { getTenantContext, tenantPrisma } from "@/infrastructure/tenant";
import { getCandidateFields } from "@/infrastructure/custom-fields/field.service";
import { getStatusLabel, getStatusStyle, formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CandidateDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "hr") return notFound();
  const orgId = ctx.organizationId;
  const db = tenantPrisma(orgId);

  // Every lookup is tenant-scoped: an id from another organization resolves to 404.
  const [candidate, appRow, customFields] = await Promise.all([
    getCandidateById(orgId, id),
    db.application.findFirst({
      where: { candidateId: id },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
    getCandidateFields(orgId, id),
  ]);
  if (!candidate) return notFound();

  const applicationId = appRow?.id ?? "";
  // Candidate already authorized above (tenant-scoped); the invitation lookup is by candidate id.
  const [contract, invitation] = await Promise.all([
    applicationId ? getContractForApplication(orgId, applicationId) : Promise.resolve(null),
    getLatestInvitation(candidate.id),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/hr" className="hover:underline" style={{ color: "var(--color-primary)" }}>لوحة التحكم</Link>
        <span>/</span>
        <Link href="/hr/candidates" className="hover:underline" style={{ color: "var(--color-primary)" }}>المرشحون</Link>
        <span>/</span>
        <span style={{ color: "var(--color-dark)" }} className="font-medium">{candidate.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border p-6 mb-6 shadow-sm" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--color-primary)", boxShadow: "0 2px 8px rgba(25,92,48,0.3)" }}
            >
              <span className="text-white text-xl font-bold" style={{ fontFamily: "'Noto Kufi Arabic', sans-serif" }}>
                {candidate.name.charAt(0)}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--color-dark)" }}>{candidate.name}</h1>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{candidate.jobTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge style={getStatusStyle(candidate.status)}>
              {getStatusLabel(candidate.status)}
            </Badge>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-4 mt-5 pt-5 border-t" style={{ borderColor: "var(--color-border)" }}>
          {[
            { Icon: Building, text: candidate.department },
            { Icon: Mail, text: candidate.email },
            { Icon: Phone, text: candidate.phone },
            { Icon: Calendar, text: formatDate(candidate.acceptanceDate) },
          ].map(({ Icon, text }, i) => (
            <div key={i} className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
              {text}
            </div>
          ))}
        </div>

        {customFields.length > 0 && (
          <div className="mt-5 pt-5 border-t" style={{ borderColor: "var(--color-border)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--color-primary)" }}>بيانات إضافية</p>
            <dl className="grid sm:grid-cols-3 gap-x-6 gap-y-3">
              {customFields.map((f) => (
                <div key={f.id}>
                  <dt className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{f.labelAr}</dt>
                  <dd className="text-sm font-medium mt-0.5" style={{ color: f.value === null ? "var(--color-text-muted)" : "var(--color-dark)" }}>{f.display}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <InvitationCodeCard
        candidateId={candidate.id}
        candidateEmail={candidate.email}
        invitation={invitation ? {
          code: invitation.code,
          status: invitation.status,
          createdAt: invitation.createdAt.toISOString(),
          expiresAt: invitation.expiresAt.toISOString(),
          usedAt: invitation.usedAt?.toISOString() ?? null,
        } : null}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Progress */}
        <div className="lg:col-span-1">
          {candidate.steps.length > 0 && (
            <ProgressTracker
              steps={candidate.steps}
              completionPercentage={candidate.completionPercentage}
            />
          )}

          {applicationId && (
            <HRContractSection
              applicationId={applicationId}
              existingContract={contract ? {
                id: contract.id,
                nameAr: contract.nameAr,
                status: contract.status,
                generatedAt: contract.generatedAt?.toISOString() ?? new Date().toISOString(),
              } : null}
            />
          )}

          {contract?.status === "FULLY_SIGNED" && applicationId && (
            <HRPreboardingPanel
              applicationId={applicationId}
              candidateName={candidate.name}
            />
          )}
        </div>

        {/* Documents */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-900">مستندات المرشح</h2>
              <span className="text-xs text-slate-500">
                {candidate.documents.filter((d) => d.status === "approved").length}/{candidate.documents.length} مكتملة
              </span>
            </div>
            {candidate.documents.length > 0 ? (
              <div className="space-y-3">
                {candidate.documents.map((doc) => (
                  <HRDocumentCard key={doc.id} document={doc} />
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm text-center py-8">
                لم يُرفع أي مستند بعد
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
