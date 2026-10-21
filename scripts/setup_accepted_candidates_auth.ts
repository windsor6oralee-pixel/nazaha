#!/usr/bin/env node
/**
 * تجهيز حسابات دخول المرشحين المقبولين.
 *
 * يحوّل قائمة المقبولين (طلبات بحالة نشطة: PENDING / IN_PROGRESS /
 * UNDER_REVIEW / APPROVED) إلى حسابات دخول دائمة: بريد دخول مميّز وكلمة مرور
 * مشفّرة. يصفّر عدّاد المحاولات الفاشلة ويفكّ الحظر، فتبدأ كل حسابات
 * المقبولين من نقطة نظيفة.
 *
 * كلمة المرور:
 *   - إن مُرّرت `SETUP_PASSWORD` فكل الحسابات تأخذها (مفيد لبيئة اختبار).
 *   - وإلا تُولَّد كلمة مرور عشوائية **لكل مرشح** وتُطبع مرة واحدة في
 *     الخرج — لا كلمة مرور افتراضية ثابتة أبداً.
 *
 * ── الاستخدام ────────────────────────────────────────────────────────────
 *   SETUP_PASSWORD='<password>' npx ts-node … scripts/setup_accepted_candidates_auth.ts
 *   npx ts-node … scripts/setup_accepted_candidates_auth.ts --dry-run
 *
 * Guard: الكتابة في قاعدة حيّة قرار إنساني — يُرفض التشغيل ما لم يُضبط
 * ALLOW_PRODUCTION_BOOTSTRAP=1.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { PrismaClient, ApplicationStatus } from "@prisma/client";
import { hash as bcryptHash } from "bcryptjs";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { generatePassword } from "../src/lib/password";

const APP_DIR = resolve(__dirname, "..");

// ── Environment ────────────────────────────────────────────────────────────
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
  process.exit(1);
}
if (!process.env.NEON_DATABASE_URL_UNPOOLED) {
  process.env.NEON_DATABASE_URL_UNPOOLED = process.env.NEON_DATABASE_URL;
}

const OVERRIDE_URL = process.env.BOOTSTRAP_DATABASE_URL;
const prisma = new PrismaClient(
  OVERRIDE_URL ? ({ datasourceUrl: OVERRIDE_URL } as never) : undefined
);

const DRY_RUN = process.argv.includes("--dry-run");

/** الحالات التي يُسمح فيها بدخول المرشح — مطابقة لقاعدة المصادقة. */
const ACCEPTED_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.PENDING,
  ApplicationStatus.IN_PROGRESS,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.APPROVED,
];

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
  console.error(
    `❌ Refusing to write into a hosted database (${new URL(TARGET_URL).hostname}).`,
  );
  console.error("   Re-run with ALLOW_PRODUCTION_BOOTSTRAP=1 if that is really what you want.");
  process.exit(1);
}

interface Row {
  candidateId: string;
  nameAr: string;
  contactEmail: string;
  loginEmail: string;
  organizationName: string;
}

async function main() {
  // كلمة المرور إمّا comes من البيئة وإمّا تُولَّد لكل مرشح.
  const sharedPassword = process.env.SETUP_PASSWORD ?? null;

  const candidates = await prisma.candidate.findMany({
    where: {
      applications: { some: { status: { in: ACCEPTED_STATUSES } } },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      nameAr: true,
      email: true,
      loginEmail: true,
      passwordHash: true,
      organization: { select: { nameAr: true } },
      applications: {
        where: { status: { in: ACCEPTED_STATUSES } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  console.log("🎯 تجهيز حسابات دخول المرشحين المقبولين");
  console.log(`   database host: ${new URL(TARGET_URL).host}`);
  console.log(`   mode: ${DRY_RUN ? "dry-run (لا كتابة)" : "كتابة فعلية"}`);
  console.log(`   password: ${sharedPassword ? "من SETUP_PASSWORD" : "مولَّدة لكل مرشح"}\n`);
  console.log(`   eligible candidates: ${candidates.length}\n`);

  const results: Row[] = [];
  const skipped: { nameAr: string; reason: string }[] = [];
  const takenLogins = new Set<string>();

  for (const c of candidates) {
    const contact = c.email.trim().toLowerCase();

    // بريد الدخول: القائم، وإلا بريد التواصل إن كان متاحاً.
    let loginEmail = c.loginEmail?.trim().toLowerCase() ?? null;
    if (!loginEmail) {
      const taken = await prisma.candidate.findUnique({
        where: { loginEmail: contact },
        select: { id: true },
      });
      if ((taken && taken.id !== c.id) || takenLogins.has(contact)) {
        skipped.push({
          nameAr: c.nameAr,
          reason: `بريد التواصل «${contact}» مستخدم في حساب آخر — لم يُلمس الحساب`,
        });
        continue;
      }
      loginEmail = contact;
    }
    takenLogins.add(loginEmail);

    const password = sharedPassword ?? generatePassword();
    const passwordHash = await bcryptHash(password, 12);
    const now = new Date();

    if (!DRY_RUN) {
      await prisma.candidate.update({
        where: { id: c.id },
        data: {
          loginEmail,
          passwordHash,
          accountActivatedAt: now,
          passwordChangedAt: now,
          // تهيئة حساب لا «تغيير كلمة مرور» — فلا يُبطل جلسات قائمة.
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    results.push({
      candidateId: c.id,
      nameAr: c.nameAr,
      contactEmail: c.email,
      loginEmail,
      organizationName: c.organization.nameAr,
    });

    if (!sharedPassword) {
      // تُطبع كلمة المرور مرة واحدة فقط — Delivery responsibility للمشغّل.
      console.log(`   🔑 ${c.nameAr} — ${loginEmail} — كلمة المرور: ${password}`);
    }
  }

  console.log(`\n✅ ${DRY_RUN ? "سيُجهَّز" : "جُهِّز"} ${results.length} حساب`);

  if (!sharedPassword && results.length > 0) {
    console.log("   ⚠️  كلمات المرور المعروضة أعلاه لن تُعرض مرة أخرى — احفظها الآن.");
  }

  if (skipped.length > 0) {
    console.log(`\n⚠️  ${skipped.length} مرشّح لم يُجهَّز:`);
    for (const s of skipped) console.log(`   - ${s.nameAr}: ${s.reason}`);
  }

  console.log("\n   الجدول:");
  console.log("   " + "الاسم".padEnd(24) + "بريد الدخول".padEnd(32) + "الجهة");
  for (const r of results) {
    console.log(
      "   " + r.nameAr.padEnd(24) + r.loginEmail.padEnd(32) + r.organizationName,
    );
  }
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
