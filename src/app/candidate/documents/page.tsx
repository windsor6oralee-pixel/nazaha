import { DocumentCard } from "@/components/candidate/DocumentCard";
import { auth } from "@/infrastructure/auth/auth";
import { getCandidateByApplicationId } from "@/infrastructure/repositories/candidate.repository";
import { notFound } from "next/navigation";

export default async function DocumentsPage() {
  const session = await auth();
  const applicationId = session!.user.applicationId;

  if (!applicationId) return notFound();

  const candidate = await getCandidateByApplicationId(session!.user.organizationId, applicationId);
  if (!candidate) return notFound();

  const approvedCount = candidate.documents.filter((d) => d.status === "approved").length;
  const total = candidate.documents.length;
  const pct = total > 0 ? Math.round((approvedCount / total) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--color-dark)" }}>
          إدارة المستندات
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          {approvedCount} من {total} مستندات معتمدة
        </p>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-2xl border p-5 mb-6 shadow-sm"
        style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: "var(--color-dark)" }}>
            تقدم المستندات
          </span>
          <span className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>
            {pct}%
          </span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden"
          style={{ background: "var(--color-beige-dark)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: "var(--color-primary)" }}
          />
        </div>
      </div>

      {/* Documents */}
      <div className="space-y-3">
        {candidate.documents.map((doc) => (
          <DocumentCard key={doc.id} document={doc} />
        ))}
      </div>
    </div>
  );
}
