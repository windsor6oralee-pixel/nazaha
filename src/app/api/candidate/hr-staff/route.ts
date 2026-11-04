/**
 * GET /api/candidate/hr-staff — HR contacts for the candidate's org that have
 * a WhatsApp number on file. Candidate-only; returns name + role label + a
 * ready-to-tap wa.me link with a pre-filled Arabic greeting.
 */
import { NextResponse } from "next/server";
import { getTenantContext } from "@/infrastructure/tenant";
import { prisma } from "@/infrastructure/database/client";
import { whatsappLink } from "@/lib/whatsapp";

const ROLE_LABEL: Record<string, string> = {
  admin:      "مدير النظام",
  hr_manager: "مدير الموارد البشرية",
  hr_officer: "موظف الموارد البشرية",
};

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "candidate") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [candidate, org, staff] = await Promise.all([
    prisma.candidate.findUnique({ where: { id: ctx.candidateId }, select: { nameAr: true } }),
    prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { nameAr: true } }),
    prisma.user.findMany({
      where: {
        organizationId: ctx.organizationId,
        isActive: true,
        phone: { not: null },
      },
      select: {
        id: true, nameAr: true, phone: true,
        role: { select: { name: true } },
      },
      orderBy: [{ role: { name: "asc" } }, { nameAr: "asc" }],
    }),
  ]);

  const greeting = `مرحباً، أنا ${candidate?.nameAr ?? "أحد المقبولين"}، أحد المقبولين للتوظيف لدى ${org?.nameAr ?? "جهتكم"}. أرغب في الاستفسار بخصوص استكمال إجراءات التوظيف.`;

  const contacts = staff
    .map((u) => {
      const link = whatsappLink(u.phone, { message: greeting });
      if (!link) return null;
      return {
        id:    u.id,
        name:  u.nameAr,
        role:  ROLE_LABEL[u.role?.name ?? ""] ?? u.role?.name ?? "موظف",
        whatsappUrl: link,
      };
    })
    .filter((c): c is { id: string; name: string; role: string; whatsappUrl: string } => c !== null);

  return NextResponse.json({ contacts });
}
