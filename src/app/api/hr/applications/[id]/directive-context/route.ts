/**
 * GET /api/hr/applications/[id]/directive-context — the data the HR editor
 * needs to render variable placeholders for a specific candidate.
 */
import { NextResponse } from "next/server";
import { requireHR, tenantPrisma, deny } from "@/infrastructure/tenant";
import { prisma } from "@/infrastructure/database/client";
import { buildContext, AVAILABLE_VARIABLES } from "@/infrastructure/directives/variables";

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const db = tenantPrisma(ctx.organizationId);
  const app = await db.application.findUnique({
    where: { id },
    select: {
      candidate: { select: { nameAr: true, jobTitle: true, department: true, email: true } },
      organization: { select: { nameAr: true, nameEn: true } },
    },
  });
  if (!app) return deny(404);

  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { nameAr: true } });

  const context = buildContext({
    candidate: {
      nameAr: app.candidate.nameAr, jobTitle: app.candidate.jobTitle,
      department: app.candidate.department, email: app.candidate.email,
    },
    organization: { nameAr: app.organization.nameAr, nameEn: app.organization.nameEn ?? null },
    hr: { nameAr: user?.nameAr ?? "فريق الموارد البشرية" },
  });

  return NextResponse.json({ context, variables: AVAILABLE_VARIABLES });
}
