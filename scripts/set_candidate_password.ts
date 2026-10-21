#!/usr/bin/env node
/**
 * يضبط حساب دخول مرشح (أو ينشئه).
 *
 * الحساب الدائم يُنشأ من طريقين: المرشح نفسه برمز الدعوة، أو المشغّل
 * من بوابة المنصة، أو هذا السكربت. كلمة المرور إما تُمرَّر صريحةً أو تُولَّد
 * عشوائية وتُطبع مرة واحدة — لا كلمة مرور افتراضية ثابتة.
 *
 * ── الاستخدام ────────────────────────────────────────────────────────────
 *   CANDIDATE_EMAIL=ahmed.omari@example.com \
 *   SETUP_PASSWORD='<password>' \
 *   npx ts-node … scripts/set_candidate_password.ts
 *
 *   # بلا SETUP_PASSWORD: تُولَّد كلمة مرور عشوائية وتُطبع
 *   CANDIDATE_EMAIL=ahmed.omari@example.com npx ts-node … scripts/set_candidate_password.ts
 *
 * Guard: الكتابة في قاعدة حيّة قرار إنساني — يُرفض التشغيل ما لم يُضبط
 * ALLOW_PRODUCTION_BOOTSTRAP=1.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { PrismaClient } from "@prisma/client";
import { hash as bcryptHash } from "bcryptjs";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { generatePassword } from "../src/lib/password";

const APP_DIR = resolve(__dirname, "..");

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

const CANDIDATE_EMAIL = (process.env.CANDIDATE_EMAIL ?? "").trim().toLowerCase();
if (!CANDIDATE_EMAIL) {
  console.error("❌ CANDIDATE_EMAIL is not set.");
  console.error("   Point it at the candidate's e-mail, e.g. CANDIDATE_EMAIL=ahmed.omari@example.com");
  process.exit(1);
}

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

async function main() {
  const candidates = await prisma.candidate.findMany({
    where: {
      OR: [{ loginEmail: CANDIDATE_EMAIL }, { email: CANDIDATE_EMAIL }],
    },
    select: {
      id: true,
      nameAr: true,
      email: true,
      loginEmail: true,
      organization: { select: { nameAr: true } },
    },
  });

  if (candidates.length === 0) {
    console.error(`❌ No candidate found for «${CANDIDATE_EMAIL}».`);
    process.exit(1);
  }

  const sharedPassword = process.env.SETUP_PASSWORD ?? null;
  const password = sharedPassword ?? generatePassword();
  const passwordHash = await bcryptHash(password, 12);
  const now = new Date();

  for (const c of candidates) {
    const loginEmail = c.loginEmail ?? c.email.trim().toLowerCase();
    const taken = await prisma.candidate.findUnique({
      where: { loginEmail },
      select: { id: true },
    });
    if (taken && taken.id !== c.id) {
      console.error(
        `❌ «${loginEmail}» is already used by another candidate — set CANDIDATE_EMAIL to the login e-mail instead.`,
      );
      process.exit(1);
    }

    await prisma.candidate.update({
      where: { id: c.id },
      data: {
        loginEmail,
        passwordHash,
        accountActivatedAt: now,
        passwordChangedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    console.log(`✅ ${c.nameAr} — ${c.organization.nameAr}`);
    console.log(`   login e-mail: ${loginEmail}`);
    if (!sharedPassword) {
      console.log(`   password:     ${password}`);
      console.log("   ⚠️  لن تُعرض كلمة المرور مرة أخرى — احفظها الآن.");
    }
  }
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
