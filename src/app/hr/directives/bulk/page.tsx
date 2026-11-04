import Link from "next/link";
import { getTenantContext, tenantPrisma } from "@/infrastructure/tenant";
import { prisma } from "@/infrastructure/database/client";
import { listDirectiveTemplates } from "@/infrastructure/directives/directive.service";
import { BulkDirectiveForm } from "@/components/hr/BulkDirectiveForm";

interface Props {
  searchParams: Promise<{ mode?: string }>;
}

export default async function BulkDirectivesPage({ searchParams }: Props) {
  const { mode } = await searchParams;
  const initialMode = mode === "invitation" ? "invitation" : "directive";

  const ctx = await getTenantContext();
  const db  = tenantPrisma(ctx!.organizationId);

  // Pull candidates whose current application is still a live journey — anyone
  // whose status is final (completed / rejected / withdrawn) is excluded by default.
  const candidates = await db.candidate.findMany({
    select: {
      id: true, nameAr: true, jobTitle: true, department: true,
      invitationSent: true, invitationSentAt: true, lastLoginAt: true,
      applications: { select: { status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  // Engagement signal: fastest opened/clicked time per candidate across all their logged emails.
  // One grouped query keeps this O(1) regardless of the candidate count on screen.
  const engagement = candidates.length
    ? await prisma.emailLog.groupBy({
        by: ["candidateId"],
        where: { organizationId: ctx!.organizationId, candidateId: { in: candidates.map((c) => c.id) } },
        _min: { firstOpenedAt: true, firstClickedAt: true },
      })
    : [];
  const engagementById = new Map(engagement.map((e) => [e.candidateId!, {
    firstOpenedAt:  e._min.firstOpenedAt?.toISOString()  ?? null,
    firstClickedAt: e._min.firstClickedAt?.toISOString() ?? null,
  }]));

  const rows = candidates.map((c) => {
    const eng = engagementById.get(c.id);
    return {
      id:        c.id,
      name:      c.nameAr,
      jobTitle:  c.jobTitle,
      department: c.department,
      status:    (c.applications[0]?.status ?? "pending").toLowerCase(),
      invitationSent:   c.invitationSent,
      invitationSentAt: c.invitationSentAt?.toISOString() ?? null,
      lastLoginAt:      c.lastLoginAt?.toISOString() ?? null,
      firstOpenedAt:    eng?.firstOpenedAt  ?? null,
      firstClickedAt:   eng?.firstClickedAt ?? null,
    };
  });
  const departments = Array.from(new Set(rows.map((r) => r.department))).sort();
  const templates   = (await listDirectiveTemplates(ctx!.organizationId))
    .map((t) => ({ id: t.id, title: t.title, body: t.body, type: t.type }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/hr" className="hover:underline" style={{ color: "var(--color-primary)" }}>الموارد البشرية</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>إرسال توجيه جماعي</span>
      </div>

      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-primary)" }}>أدوات الإدارة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>إرسال توجيه لمجموعة مرشحين</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          فلتر، حدِّد، اختر قالباً، أرسل. يُستبدَل اسم كل مرشح وبياناته تلقائياً من المتغيّرات.
        </p>
      </div>

      <BulkDirectiveForm candidates={rows} templates={templates} departments={departments} initialMode={initialMode} />
    </div>
  );
}
