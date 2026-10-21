#!/usr/bin/env node
/**
 * Test-account matrix for the Nazaha employment platform.
 *
 * Creates (or resets) one login per role so every interface can be exercised:
 *   - Platform operator  → /platform/login
 *   - Tenant admin       → /auth/login   (role: admin)
 *   - HR manager         → /auth/login   (role: hr_manager)
 *   - HR officer         → /auth/login   (role: hr_officer)
 *   - Candidate          → /auth/candidate (magic-link token)
 *
 * It is idempotent: running it twice only refreshes passwords and unlocks
 * accounts (failed-login counters are reset, lockouts cleared).
 *
 * ── Usage ────────────────────────────────────────────────────────────────
 *   # local dev DB (reads .env automatically)
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"skipLibCheck":true}' scripts/create_test_accounts.ts
 *
 *   # production DB (Vercel → Settings → Environment Variables)
 *   export NEON_DATABASE_URL="postgresql://<user>:<pass>@<host>:5432/<db>?schema=public"
 *   export NEON_DATABASE_URL_UNPOOLED="$NEON_DATABASE_URL"
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"skipLibCheck":true}' scripts/create_test_accounts.ts
 *
 * Optional overrides:
 *   TEST_PASSWORD      password shared by every account (required — no default)
 *   TEST_PLATFORM_EMAIL / TEST_CANDIDATE_TOKEN
 *
 * Guard: when the target database is NOT a local one, the script refuses to run
 * unless ALLOW_PRODUCTION_BOOTSTRAP=1 is set explicitly — writing test accounts
 * into a live database must be a deliberate act, never an accident.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { PrismaClient, OrgType, StepType, DocumentType, ApplicationStatus, TokenPurpose } from "@prisma/client";
import { hash as bcryptHash } from "bcryptjs";
import { createHash } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { DEFAULT_TEMPLATES } from "../src/infrastructure/contracts/default-templates";
import { DEFAULT_WORKFLOW } from "../src/infrastructure/platform/default-workflow";

const APP_DIR = resolve(__dirname, "..");

// ── Environment ────────────────────────────────────────────────────────────
// The Prisma schema reads NEON_DATABASE_URL / NEON_DATABASE_URL_UNPOOLED.
// Fall back to app-project/.env so local runs need no extra exports.
function loadDotEnv() {
  const envPath = resolve(APP_DIR, ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] !== undefined) continue;
    process.env[key] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotEnv();

if (!process.env.NEON_DATABASE_URL) {
  console.error("❌ NEON_DATABASE_URL is not set (and .env has no value).");
  console.error("   Point it at the hosted database, then re-run this script.");
  process.exit(1);
}
if (!process.env.NEON_DATABASE_URL_UNPOOLED) {
  process.env.NEON_DATABASE_URL_UNPOOLED = process.env.NEON_DATABASE_URL;
}

// BOOTSTRAP_DATABASE_URL overrides the datasource — used on Vercel builds where the
// owner URL (NEON_DATABASE_URL_UNPOOLED) is the reliable choice for writes.
const OVERRIDE_URL = process.env.BOOTSTRAP_DATABASE_URL;
const prisma = new PrismaClient(
  OVERRIDE_URL ? ({ datasourceUrl: OVERRIDE_URL } as never) : undefined
);

// The script never carries a password of its own — the caller supplies one.
if (!process.env.TEST_PASSWORD) {
  console.error("❌ TEST_PASSWORD is not set.");
  console.error("   This script never ships a default password — set one and re-run:");
  console.error("   TEST_PASSWORD='<your password>' npx ts-node … scripts/create_test_accounts.ts");
  process.exit(1);
}
const PASSWORD: string = process.env.TEST_PASSWORD!;
const PLATFORM_EMAIL = (process.env.TEST_PLATFORM_EMAIL ?? "platform@nazaha.sa").toLowerCase();
const candidateTokenEnv = process.env.TEST_CANDIDATE_TOKEN;
if (!candidateTokenEnv) {
  console.error("❌ TEST_CANDIDATE_TOKEN is not set.");
  console.error("   Supply a fresh test token explicitly; no default token is permitted.");
  process.exit(1);
}
const CANDIDATE_TOKEN: string = candidateTokenEnv;

/**
 * قاعدة البيانات المستهدفة محلية أم مستضافة؟
 *
 * الكتابة في قاعدة حيّة قرار يتّخذه الإنسان، لا نتيجة تشغيل script عادي.
 */
function isLocalDatabase(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host === "db" ||
      host === "postgres" ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

const TARGET_URL = OVERRIDE_URL ?? process.env.NEON_DATABASE_URL!;
if (!isLocalDatabase(TARGET_URL) && process.env.ALLOW_PRODUCTION_BOOTSTRAP !== "1") {
  // يُطبع المضيف فقط — رابط الاتصال يحمل كلمة مرور قاعدة البيانات.
  console.error(`❌ Refusing to write test accounts into a hosted database (${new URL(TARGET_URL).hostname}).`);
  console.error("   Re-run with ALLOW_PRODUCTION_BOOTSTRAP=1 if that is really what you want.");
  process.exit(1);
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

const PERMISSIONS = [
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

const ROLE_DEFS = [
  { name: "admin", nameAr: "مدير النظام" },
  { name: "hr_manager", nameAr: "مدير الموارد البشرية" },
  { name: "hr_officer", nameAr: "موظف الموارد البشرية" },
];

async function ensurePermissions() {
  const perms = [];
  for (const p of PERMISSIONS) {
    perms.push(
      await prisma.permission.upsert({
        where: { resource_action: p },
        update: {},
        create: p,
      })
    );
  }
  return perms;
}

async function ensureOrg(input: {
  slug: string;
  nameAr: string;
  nameEn: string;
  type: OrgType;
  branding: Partial<{
    officialNameAr: string;
    authorizedSignerName: string;
    authorizedSignerTitle: string;
    address: string;
    contactEmail: string;
  }>;
}) {
  const org = await prisma.organization.upsert({
    where: { slug: input.slug },
    update: { isActive: true, ...input.branding },
    create: {
      slug: input.slug,
      nameAr: input.nameAr,
      nameEn: input.nameEn,
      type: input.type,
      isActive: true,
      officialNameAr: input.branding.officialNameAr ?? input.nameAr,
      ...input.branding,
    },
  });

  // roles
  const roles: Record<string, { id: string }> = {};
  for (const r of ROLE_DEFS) {
    const role = await prisma.role.upsert({
      where: { organizationId_name: { organizationId: org.id, name: r.name } },
      update: { isSystem: true, nameAr: r.nameAr },
      create: { organizationId: org.id, name: r.name, nameAr: r.nameAr, isSystem: true },
    });
    roles[r.name] = role;
  }

  // permissions → role mappings
  const perms = await ensurePermissions();
  const assign = async (roleId: string, list: typeof perms) => {
    for (const p of list) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: p.id } },
        update: {},
        create: { roleId, permissionId: p.id },
      });
    }
  };
  await assign(roles.admin.id, perms);
  await assign(roles.hr_manager.id, perms.filter((p) => p.resource !== "settings"));
  await assign(
    roles.hr_officer.id,
    perms.filter(
      (p) =>
        (p.resource === "candidates" && p.action === "read") ||
        (p.resource === "documents" && ["read", "review"].includes(p.action)) ||
        (p.resource === "applications" && p.action === "read")
    )
  );

  // default workflow (+ per-step document rules)
  let workflow = await prisma.workflow.findFirst({
    where: { organizationId: org.id, isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  if (!workflow) {
    workflow = await prisma.workflow.create({
      data: {
        nameAr: DEFAULT_WORKFLOW.nameAr,
        nameEn: DEFAULT_WORKFLOW.nameEn,
        isDefault: true,
        isActive: true,
        organizationId: org.id,
      },
    });
    for (const step of DEFAULT_WORKFLOW.steps) {
      await prisma.workflowStep.create({
        data: {
          workflowId: workflow.id,
          order: step.order,
          nameAr: step.nameAr,
          type: step.type as StepType,
          isRequired: step.isRequired,
          canSkip: step.canSkip,
          documentRequirements: { create: step.documents },
        },
      });
    }
  }

  // contract templates
  for (const t of DEFAULT_TEMPLATES) {
    const exists = await prisma.contractTemplate.findFirst({
      where: { organizationId: org.id, type: t.type },
      select: { id: true },
    });
    if (!exists) {
      await prisma.contractTemplate.create({
        data: {
          organizationId: org.id,
          type: t.type,
          nameAr: t.nameAr,
          bodyHtml: t.bodyHtml,
          version: 1,
          isActive: true,
        },
      });
    }
  }

  return { org, roles, workflow };
}

async function ensureUser(input: {
  email: string;
  nameAr: string;
  roleId: string;
  organizationId: string;
  passwordHash: string;
  phone?: string;
}) {
  return prisma.user.upsert({
    where: { email: input.email.toLowerCase() },
    update: {
      passwordHash: input.passwordHash,
      // تهيئة حساب اختبار لا «تغيير كلمة مرور» — فلا يُبطل جلسات قائمة.
      passwordChangedAt: null,
      nameAr: input.nameAr,
      roleId: input.roleId,
      organizationId: input.organizationId,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      nameAr: input.nameAr,
      roleId: input.roleId,
      organizationId: input.organizationId,
      isActive: true,
      phone: input.phone,
    },
  });
}

async function ensureCandidate(orgId: string, workflowId: string) {
  const email = "ahmed.omari@example.com";
  const candidate = await prisma.candidate.upsert({
    where: { organizationId_nationalId: { organizationId: orgId, nationalId: "1098765432" } },
    update: {},
    create: {
      nationalId: "1098765432",
      nameAr: "أحمد محمد العمري",
      nameEn: "Ahmed Mohammed Al-Omari",
      email,
      phone: "+966501234567",
      jobTitle: "محلل بيانات أول",
      department: "إدارة التحول الرقمي",
      acceptanceDate: new Date(),
      expectedStartDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21),
      organizationId: orgId,
    },
  });

  let application = await prisma.application.findFirst({
    where: { candidateId: candidate.id, organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });
  if (!application) {
    application = await prisma.application.create({
      data: {
        candidateId: candidate.id,
        organizationId: orgId,
        workflowId,
        status: ApplicationStatus.IN_PROGRESS,
      },
    });
  }

  const process = await prisma.onboardingProcess.findUnique({
    where: { applicationId: application.id },
  });
  if (!process) {
    const steps = await prisma.workflowStep.findMany({
      where: { workflowId },
      orderBy: { order: "asc" },
    });
    await prisma.onboardingProcess.create({
      data: {
        applicationId: application.id,
        steps: { create: steps.map((s) => ({ workflowStepId: s.id, status: "PENDING" })) },
      },
    });
  }

  // magic-link token (raw value is never stored — only its SHA-256 hash)
  await prisma.verificationToken.upsert({
    where: { tokenHash: sha256(CANDIDATE_TOKEN) },
    update: { usedAt: null, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) },
    create: {
      tokenHash: sha256(CANDIDATE_TOKEN),
      candidateId: candidate.id,
      purpose: TokenPurpose.LOGIN,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  return candidate;
}

async function main() {
  const target = (() => {
    try {
      return new URL(TARGET_URL).host;
    } catch {
      return "(unknown host)";
    }
  })();

  console.log("🎯 Test-account matrix");
  console.log(`   database host: ${target}`);
  // لا تُطبع كلمة المرور نفسها — السجلات تبقى صالحة للتشخيص.
  console.log("   shared password: (from TEST_PASSWORD)\n");

  // Diagnostics — what already exists in this database.
  const [orgCount, userCount, adminCount, candCount] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.platformAdmin.count(),
    prisma.candidate.count(),
  ]);
  console.log(
    `   existing: ${orgCount} org(s), ${userCount} staff user(s), ${adminCount} platform admin(s), ${candCount} candidate(s)\n`
  );

  // 1) platform operator
  const platformHash = await bcryptHash(PASSWORD, 12);
  await prisma.platformAdmin.upsert({
    where: { email: PLATFORM_EMAIL },
    update: {
      passwordHash: platformHash,
      passwordChangedAt: null,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: { email: PLATFORM_EMAIL, passwordHash: platformHash, nameAr: "مشغّل المنصة" },
  });

  // 2) tenant #1 — Ministry of Finance (3 staff roles + 1 candidate)
  const mof = await ensureOrg({
    slug: "mof",
    nameAr: "وزارة المالية",
    nameEn: "Ministry of Finance",
    type: OrgType.GOVERNMENT,
    branding: {
      officialNameAr: "وزارة المالية — المملكة العربية السعودية",
      authorizedSignerName: "وكيل الوزارة للموارد البشرية",
      authorizedSignerTitle: "وكيل الوزارة",
      address: "الرياض، المملكة العربية السعودية",
      contactEmail: "hr@mof.gov.sa",
    },
  });

  await ensureUser({
    email: "admin@mof.gov.sa",
    nameAr: "مشرف الجهة",
    roleId: mof.roles.admin.id,
    organizationId: mof.org.id,
    passwordHash: platformHash,
    phone: "+966501111111",
  });
  await ensureUser({
    email: "salma.rashidi@mof.gov.sa",
    nameAr: "سلمى الرشيدي",
    roleId: mof.roles.hr_manager.id,
    organizationId: mof.org.id,
    passwordHash: platformHash,
    phone: "+966501234567",
  });
  await ensureUser({
    email: "faisal.mansour@mof.gov.sa",
    nameAr: "فيصل المنصور",
    roleId: mof.roles.hr_officer.id,
    organizationId: mof.org.id,
    passwordHash: platformHash,
    phone: "+966509876543",
  });
  await ensureCandidate(mof.org.id, mof.workflow.id);

  // 3) tenant #2 — Digital Government Authority (tenant-isolation testing)
  const dga = await ensureOrg({
    slug: "dga",
    nameAr: "هيئة الحكومة الرقمية",
    nameEn: "Digital Government Authority",
    type: OrgType.GOVERNMENT,
    branding: {
      officialNameAr: "هيئة الحكومة الرقمية — المملكة العربية السعودية",
      contactEmail: "hr@dga.gov.sa",
    },
  });
  await ensureUser({
    email: "admin@dga.gov.sa",
    nameAr: "مشرف الهيئة",
    roleId: dga.roles.admin.id,
    organizationId: dga.org.id,
    passwordHash: platformHash,
    phone: "+966502222222",
  });

  const rows = [
    { role: "مشغّل المنصة", portal: "/platform/login", email: PLATFORM_EMAIL },
    { role: "مدير النظام (admin)", portal: "/auth/login", email: "admin@mof.gov.sa" },
    { role: "مدير الموارد البشرية", portal: "/auth/login", email: "salma.rashidi@mof.gov.sa" },
    { role: "موظف الموارد البشرية", portal: "/auth/login", email: "faisal.mansour@mof.gov.sa" },
    { role: "مشرف جهة أخرى (dga)", portal: "/auth/login", email: "admin@dga.gov.sa" },
    { role: "مرشح (magic link)", portal: "/auth/candidate", email: "ahmed.omari@example.com" },
  ];

  console.log("✅ Accounts ready:\n");
  for (const r of rows) {
    console.log(`   ${r.role.padEnd(30)} ${r.portal.padEnd(18)} ${r.email}`);
  }
  // كلمة المرور لا تُطبع — سجلّات CI تحتفظ بها، والمصدر لا يحملها.
  console.log("\n   (كلمة المرور هي القيمة التي مرّرتَها في TEST_PASSWORD)");
  console.log("   (كل الحسابات مقفلة من محاولات الدخول الفاشلة ومُحدَّثة كلمة المرور)");
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
