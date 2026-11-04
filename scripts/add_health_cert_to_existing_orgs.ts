#!/usr/bin/env node
/**
 * Backfills the "Health certificate" document rule into every existing
 * organization's default workflow. Idempotent — orgs that already have a
 * MEDICAL_REPORT rule in their DOCUMENTS step are left untouched, and existing
 * applications' Document rows aren't disturbed either (new candidates only).
 *
 * Env:
 *   DRY_RUN=1 → print what would change, don't write
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.env.DRY_RUN === '1';
  const orgs = await prisma.organization.findMany({ select: { id: true, nameAr: true } });
  console.log(`[backfill] scanning ${orgs.length} org(s)  mode=${dryRun ? 'DRY-RUN' : 'LIVE'}`);

  let added = 0, skipped = 0;
  for (const org of orgs) {
    const wf = await prisma.workflow.findFirst({
      where:  { organizationId: org.id, isDefault: true, isActive: true },
      select: { id: true, steps: { where: { type: 'DOCUMENTS' }, select: { id: true }, orderBy: { order: 'asc' }, take: 1 } },
    });
    if (!wf || !wf.steps.length) {
      console.log(`[backfill] ! ${org.nameAr} :: no default workflow with DOCUMENTS step`);
      continue;
    }
    const stepId = wf.steps[0].id;
    const existing = await prisma.workflowStepDocument.findUnique({
      where: { workflowStepId_documentType: { workflowStepId: stepId, documentType: 'MEDICAL_REPORT' } },
    });
    if (existing) {
      skipped++;
      console.log(`[backfill] = ${org.nameAr} :: already has MEDICAL_REPORT (${existing.isRequired ? 'required' : 'optional'})`);
      continue;
    }
    if (dryRun) {
      added++;
      console.log(`[backfill] + ${org.nameAr} :: would add MEDICAL_REPORT required+askBeforeUpload`);
      continue;
    }
    await prisma.workflowStepDocument.create({
      data: {
        workflowStepId:   stepId,
        documentType:     'MEDICAL_REPORT',
        nameAr:           'الشهادة الصحية للتوظيف',
        isRequired:       true,
        maxFileSizeMb:    10,
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        maxFileCount:     1,
        requiresReview:   true,
        askBeforeUpload:  true,
      },
    });
    added++;
    console.log(`[backfill] + ${org.nameAr} :: added MEDICAL_REPORT`);
  }
  console.log(`[backfill] done — added=${added} skipped=${skipped}`);
}

main()
  .catch((e) => { console.error('[backfill] fatal:', e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
