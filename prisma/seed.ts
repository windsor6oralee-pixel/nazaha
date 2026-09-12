/**
 * Seed file: creates a minimal but complete dataset for development.
 * Covers one organization, roles, permissions, HR users,
 * one workflow, and one candidate with a full application.
 *
 * DEV ONLY — never run against production.
 * Credentials are read from environment variables so no secret value
 * is hard-coded. Set SEED_DEV_HR_PASSWORD and SEED_DEV_CANDIDATE_TOKEN
 * in .env (defaults are fine for local development only).
 */
import { PrismaClient, DocumentType, StepType } from "@prisma/client";
import { createHash } from "crypto";
import { hash as bcryptHash } from "bcryptjs";
import { DEFAULT_TEMPLATES } from "../src/infrastructure/contracts/default-templates";

const prisma = new PrismaClient();

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  console.log("🌱 Seeding database...");

  // ── 1. ORGANIZATION ──────────────────────────────────────────
  const orgBranding = {
    type: "GOVERNMENT" as const,
    officialNameAr: "وزارة المالية — المملكة العربية السعودية",
    authorizedSignerName: "وكيل الوزارة للموارد البشرية",
    authorizedSignerTitle: "وكيل الوزارة",
    address: "الرياض، المملكة العربية السعودية",
    contactEmail: "hr@mof.gov.sa",
  };
  const org = await prisma.organization.upsert({
    where: { slug: "mof" },
    update: orgBranding,
    create: {
      nameAr: "وزارة المالية",
      nameEn: "Ministry of Finance",
      slug: "mof",
      isActive: true,
      ...orgBranding,
    },
  });
  console.log(`  ✓ Organization: ${org.nameAr}`);

  // ── 2. ROLES (per-tenant; mirrors SYSTEM_ROLES in role.service.ts) ──
  const roles = await Promise.all(
    [
      { name: "admin",      nameAr: "مدير النظام" },
      { name: "hr_manager", nameAr: "مدير الموارد البشرية" },
      { name: "hr_officer", nameAr: "موظف الموارد البشرية" },
    ].map((r) =>
      prisma.role.upsert({
        where: { organizationId_name: { organizationId: org.id, name: r.name } },
        update: { isSystem: true, nameAr: r.nameAr },
        create: { organizationId: org.id, name: r.name, nameAr: r.nameAr, isSystem: true },
      })
    )
  );
  const [adminRole, hrManagerRole, hrOfficerRole] = roles;
  console.log(`  ✓ Roles: ${roles.map((r) => r.name).join(", ")}`);

  // ── 3. PERMISSIONS ───────────────────────────────────────────
  const permissionDefs = [
    { resource: "candidates", action: "read" },
    { resource: "candidates", action: "write" },
    { resource: "documents", action: "read" },
    { resource: "documents", action: "review" },
    { resource: "documents", action: "approve" },
    { resource: "applications", action: "read" },
    { resource: "applications", action: "write" },
    { resource: "applications", action: "approve" },
    { resource: "workflows", action: "read" },
    { resource: "workflows", action: "write" },
    { resource: "reports", action: "read" },
    { resource: "settings", action: "write" },
  ];
  const permissions = await Promise.all(
    permissionDefs.map((p) =>
      prisma.permission.upsert({
        where: { resource_action: p },
        update: {},
        create: p,
      })
    )
  );

  // Assign all permissions to admin
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }
  // hr_manager: all except settings
  for (const perm of permissions.filter((p) => p.resource !== "settings")) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: hrManagerRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: hrManagerRole.id, permissionId: perm.id },
    });
  }
  // hr_officer: read candidates, read/review documents
  const officerPerms = permissions.filter(
    (p) =>
      (p.resource === "candidates" && p.action === "read") ||
      (p.resource === "documents" && ["read", "review"].includes(p.action)) ||
      (p.resource === "applications" && p.action === "read")
  );
  for (const perm of officerPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: hrOfficerRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: hrOfficerRole.id, permissionId: perm.id },
    });
  }
  console.log(`  ✓ Permissions assigned`);

  // ── 4. HR USERS ──────────────────────────────────────────────
  // Password for dev HR accounts — read from env, never hard-coded.
  // Default is acceptable ONLY in a local development environment.
  const devHRPassword = process.env.SEED_DEV_HR_PASSWORD ?? "change-me-dev-only";
  const passwordHash = await bcryptHash(devHRPassword, 10);

  const hrManager = await prisma.user.upsert({
    where: { email: "salma.rashidi@mof.gov.sa" },
    update: { passwordHash }, // always refresh hash on re-seed
    create: {
      email: "salma.rashidi@mof.gov.sa",
      passwordHash,
      nameAr: "سلمى الرشيدي",
      nameEn: "Salma Al-Rashidi",
      phone: "+966501234567",
      organizationId: org.id,
      roleId: hrManagerRole.id,
    },
  });

  const hrOfficer = await prisma.user.upsert({
    where: { email: "faisal.mansour@mof.gov.sa" },
    update: { passwordHash }, // always refresh hash on re-seed
    create: {
      email: "faisal.mansour@mof.gov.sa",
      passwordHash,
      nameAr: "فيصل المنصور",
      nameEn: "Faisal Al-Mansour",
      phone: "+966509876543",
      organizationId: org.id,
      roleId: hrOfficerRole.id,
    },
  });
  console.log(`  ✓ HR Users: ${hrManager.nameAr}, ${hrOfficer.nameAr}`);

  // ── 4b. PLATFORM ADMIN (operates the SaaS; no organization) ──
  const platformEmail = (process.env.SEED_DEV_PLATFORM_EMAIL ?? "platform@nazaha.local").toLowerCase();
  const platformHash = await bcryptHash(process.env.SEED_DEV_PLATFORM_PASSWORD ?? "change-me-platform-dev", 12);
  const platformAdmin = await prisma.platformAdmin.upsert({
    where: { email: platformEmail },
    update: { passwordHash: platformHash },
    create: { email: platformEmail, passwordHash: platformHash, nameAr: "مشغّل المنصة" },
  });
  console.log(`  ✓ Platform admin: ${platformAdmin.email}`);

  // ── 5. WORKFLOW ───────────────────────────────────────────────
  const workflow = await prisma.workflow.upsert({
    where: {
      id: "workflow-mof-standard",
    },
    update: {},
    create: {
      id: "workflow-mof-standard",
      nameAr: "مسار الانضمام الحكومي الموحد",
      nameEn: "Standard Government Onboarding",
      isDefault: true,
      isActive: true,
      organizationId: org.id,
    },
  });

  // Workflow steps in order
  const stepDefs = [
    {
      order: 1,
      nameAr: "قبول العرض",
      type: StepType.PERSONAL_DATA,
      isRequired: true,
      canSkip: false,
      documents: [],
    },
    {
      order: 2,
      nameAr: "رفع المستندات",
      type: StepType.DOCUMENTS,
      isRequired: true,
      canSkip: false,
      documents: [
        {
          documentType: DocumentType.NATIONAL_ID,
          nameAr: "بطاقة الهوية الوطنية",
          isRequired: true,
          maxFileSizeMb: 5,
          allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
          maxFileCount: 1,
          requiresReview: true,
        },
        {
          documentType: DocumentType.ACADEMIC_CERTIFICATE,
          nameAr: "الشهادة الأكاديمية",
          isRequired: true,
          maxFileSizeMb: 10,
          allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
          maxFileCount: 2,
          requiresReview: true,
        },
        {
          documentType: DocumentType.EXPERIENCE_CERTIFICATE,
          nameAr: "شهادة الخبرة",
          isRequired: true,
          maxFileSizeMb: 10,
          allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
          maxFileCount: 3,
          requiresReview: true,
        },
        {
          documentType: DocumentType.CRIMINAL_RECORD,
          nameAr: "صحيفة الحالة الجنائية",
          isRequired: true,
          maxFileSizeMb: 5,
          allowedMimeTypes: ["application/pdf", "image/jpeg"],
          maxFileCount: 1,
          requiresReview: true,
        },
        {
          documentType: DocumentType.PERSONAL_PHOTO,
          nameAr: "الصورة الشخصية",
          isRequired: true,
          maxFileSizeMb: 3,
          allowedMimeTypes: ["image/jpeg", "image/png"],
          maxFileCount: 1,
          requiresReview: false,
        },
        {
          documentType: DocumentType.BANK_ACCOUNT_IBAN,
          nameAr: "شهادة رقم الحساب البنكي (IBAN)",
          isRequired: true,
          maxFileSizeMb: 5,
          allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
          maxFileCount: 1,
          requiresReview: true,
        },
        {
          documentType: DocumentType.MEDICAL_REPORT,
          nameAr: "التقرير الطبي",
          isRequired: false,
          maxFileSizeMb: 10,
          allowedMimeTypes: ["application/pdf"],
          maxFileCount: 1,
          requiresReview: true,
        },
      ],
    },
    {
      order: 3,
      nameAr: "مراجعة الموارد البشرية",
      type: StepType.DOCUMENT_REVIEW,
      isRequired: true,
      canSkip: false,
      documents: [],
    },
    {
      order: 4,
      nameAr: "التوقيع الإلكتروني",
      type: StepType.SIGNATURE,
      isRequired: true,
      canSkip: false,
      documents: [],
    },
    {
      order: 5,
      nameAr: "الاستعداد للمباشرة",
      type: StepType.ORIENTATION,
      isRequired: true,
      canSkip: false,
      documents: [],
    },
  ];

  const workflowSteps = [];
  for (const def of stepDefs) {
    const stepId = `ws-mof-${def.order}`;
    const step = await prisma.workflowStep.upsert({
      where: { id: stepId },
      update: {},
      create: {
        id: stepId,
        order: def.order,
        nameAr: def.nameAr,
        type: def.type,
        isRequired: def.isRequired,
        canSkip: def.canSkip,
        workflowId: workflow.id,
      },
    });
    workflowSteps.push(step);

    for (const doc of def.documents) {
      await prisma.workflowStepDocument.upsert({
        where: {
          workflowStepId_documentType: {
            workflowStepId: step.id,
            documentType: doc.documentType,
          },
        },
        update: {},
        create: {
          ...doc,
          workflowStepId: step.id,
        },
      });
    }
  }
  console.log(`  ✓ Workflow: ${workflow.nameAr} (${workflowSteps.length} steps)`);

  // ── 6. CANDIDATE + APPLICATION + ONBOARDING ──────────────────
  const candidate = await prisma.candidate.upsert({
    where: {
      organizationId_nationalId: {
        organizationId: org.id,
        nationalId: "1098765432",
      },
    },
    update: {},
    create: {
      nationalId: "1098765432",
      nameAr: "أحمد محمد العمري",
      nameEn: "Ahmed Mohammed Al-Omari",
      email: "ahmed.omari@example.com",
      phone: "+966501234567",
      jobTitle: "محلل بيانات أول",
      department: "إدارة التحول الرقمي",
      acceptanceDate: new Date("2026-09-01"),
      expectedStartDate: new Date("2026-10-01"),
      organizationId: org.id,
    },
  });

  // Verification token — raw value only ever in env/.env, only hash stored in DB.
  // Re-seeding always resets usedAt so the token is valid again for dev testing.
  const rawToken = process.env.SEED_DEV_CANDIDATE_TOKEN ?? "change-me-dev-token";
  const tokenHash = sha256(rawToken);
  await prisma.verificationToken.upsert({
    where: { tokenHash },
    update: {
      usedAt: null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // reset expiry
    },
    create: {
      tokenHash,
      candidateId: candidate.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  const application = await prisma.application.upsert({
    where: { id: "app-ahmed-mof-2026" },
    update: {},
    create: {
      id: "app-ahmed-mof-2026",
      candidateId: candidate.id,
      organizationId: org.id,
      workflowId: workflow.id,
      status: "IN_PROGRESS",
    },
  });

  // Onboarding process
  const process_ = await prisma.onboardingProcess.upsert({
    where: { applicationId: application.id },
    update: {},
    create: { applicationId: application.id },
  });

  // Create onboarding steps from workflow steps
  const stepStatuses = ["COMPLETED", "IN_PROGRESS", "PENDING", "PENDING", "PENDING"] as const;
  for (let i = 0; i < workflowSteps.length; i++) {
    const ws = workflowSteps[i];
    const stepId = `os-ahmed-${i + 1}`;
    await prisma.onboardingStep.upsert({
      where: { id: stepId },
      update: {},
      create: {
        id: stepId,
        onboardingProcessId: process_.id,
        workflowStepId: ws.id,
        status: stepStatuses[i],
        startedAt: i <= 1 ? new Date("2026-09-02") : undefined,
        completedAt: i === 0 ? new Date("2026-09-02") : undefined,
      },
    });
  }

  // Documents for the application
  const docSeeds = [
    { type: DocumentType.NATIONAL_ID, nameAr: "بطاقة الهوية الوطنية", status: "APPROVED", filePath: "dev/national-id.pdf" },
    { type: DocumentType.ACADEMIC_CERTIFICATE, nameAr: "الشهادة الأكاديمية", status: "UNDER_REVIEW", filePath: "dev/certificate.pdf" },
    { type: DocumentType.EXPERIENCE_CERTIFICATE, nameAr: "شهادة الخبرة", status: "UPLOADED", filePath: "dev/experience.pdf" },
    { type: DocumentType.CRIMINAL_RECORD, nameAr: "صحيفة الحالة الجنائية", status: "REJECTED", filePath: "dev/criminal-record.pdf" },
    { type: DocumentType.PERSONAL_PHOTO, nameAr: "الصورة الشخصية", status: "APPROVED", filePath: "dev/photo.jpg" },
    { type: DocumentType.BANK_ACCOUNT_IBAN, nameAr: "شهادة رقم الحساب البنكي (IBAN)", status: "NOT_UPLOADED", filePath: null },
    { type: DocumentType.MEDICAL_REPORT, nameAr: "التقرير الطبي", status: "NOT_UPLOADED", filePath: null },
  ] as const;

  for (const doc of docSeeds) {
    const docId = `doc-ahmed-${doc.type.toLowerCase()}`;
    const created = await prisma.document.upsert({
      where: { id: docId },
      update: {},
      create: {
        id: docId,
        type: doc.type,
        nameAr: doc.nameAr,
        isRequired: doc.type !== DocumentType.MEDICAL_REPORT,
        status: doc.status,
        filePath: doc.filePath,
        uploadedAt: doc.filePath ? new Date("2026-09-05") : undefined,
        applicationId: application.id,
      },
    });

    // Add review record for rejected doc
    if (doc.status === "REJECTED") {
      await prisma.documentReview.upsert({
        where: { id: `dr-ahmed-${doc.type.toLowerCase()}` },
        update: {},
        create: {
          id: `dr-ahmed-${doc.type.toLowerCase()}`,
          documentId: created.id,
          reviewerId: hrOfficer.id,
          decision: "REJECTED",
          reason: "الصورة غير واضحة. يرجى إعادة رفع نسخة أوضح.",
        },
      });
    }
    if (doc.status === "APPROVED") {
      await prisma.documentReview.upsert({
        where: { id: `dr-ahmed-${doc.type.toLowerCase()}-approve` },
        update: {},
        create: {
          id: `dr-ahmed-${doc.type.toLowerCase()}-approve`,
          documentId: created.id,
          reviewerId: hrOfficer.id,
          decision: "APPROVED",
        },
      });
    }
  }

  // Audit log entries
  await prisma.auditLog.createMany({
    skipDuplicates: true,
    data: [
      {
        id: "al-001",
        actorType: "SYSTEM",
        action: "application.created",
        resource: "Application",
        resourceId: application.id,
        applicationId: application.id,
        candidateId: candidate.id,
        metadata: { workflowId: workflow.id },
      },
      {
        id: "al-002",
        actorType: "CANDIDATE",
        action: "document.uploaded",
        resource: "Document",
        resourceId: `doc-ahmed-${DocumentType.NATIONAL_ID.toLowerCase()}`,
        applicationId: application.id,
        candidateId: candidate.id,
      },
      {
        id: "al-003",
        actorType: "USER",
        action: "document.rejected",
        resource: "Document",
        resourceId: `doc-ahmed-${DocumentType.CRIMINAL_RECORD.toLowerCase()}`,
        applicationId: application.id,
        userId: hrOfficer.id,
        metadata: { reason: "الصورة غير واضحة" },
      },
    ],
  });

  // Welcome notification for candidate
  await prisma.notification.upsert({
    where: { id: "notif-ahmed-welcome" },
    update: {},
    create: {
      id: "notif-ahmed-welcome",
      type: "WELCOME",
      titleAr: "أهلاً بك في نزاهة التوظيف",
      bodyAr: "تم إنشاء حسابك بنجاح. ابدأ برفع مستنداتك لإكمال رحلة الانضمام.",
      candidateId: candidate.id,
    },
  });

  await prisma.notification.upsert({
    where: { id: "notif-ahmed-rejected" },
    update: {},
    create: {
      id: "notif-ahmed-rejected",
      type: "DOCUMENT_REJECTED",
      titleAr: "مستند يحتاج إعادة رفع",
      bodyAr: "صحيفة الحالة الجنائية: الصورة غير واضحة. يرجى إعادة رفع نسخة أوضح.",
      candidateId: candidate.id,
    },
  });

  // System settings
  const settingDefs = [
    { key: "max_document_size_mb", value: "10", description: "الحد الأقصى لحجم ملف المستند" },
    { key: "magic_link_expires_minutes", value: "60", description: "مدة صلاحية رابط الدخول بالدقائق" },
    { key: "reminder_interval_days", value: "3", description: "الفترة بين إشعارات التذكير للمرشح" },
    { key: "welcome_message_ar", value: "مرحباً بك في منصة نزاهة التوظيف", description: "رسالة الترحيب الرئيسية" },
  ];
  for (const s of settingDefs) {
    await prisma.systemSetting.upsert({
      where: { organizationId_key: { organizationId: org.id, key: s.key } },
      update: {},
      create: { ...s, organizationId: org.id },
    });
  }

  console.log(`  ✓ Candidate: ${candidate.nameAr}`);
  console.log(`  ✓ Application: ${application.id} (${application.status})`);
  console.log(`  ✓ Documents: ${docSeeds.length} seeded`);
  console.log(`  ✓ System settings: ${settingDefs.length} seeded`);

  // Contract templates (version 1 only if the tenant has none of that type)
  for (const t of DEFAULT_TEMPLATES) {
    const exists = await prisma.contractTemplate.findFirst({
      where: { organizationId: org.id, type: t.type },
      select: { id: true },
    });
    if (!exists) {
      await prisma.contractTemplate.create({
        data: { organizationId: org.id, type: t.type, nameAr: t.nameAr, bodyHtml: t.bodyHtml, version: 1, isActive: true },
      });
    }
  }
  console.log(`  ✓ Contract templates: ${DEFAULT_TEMPLATES.length} ensured`);
  console.log("\n✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
