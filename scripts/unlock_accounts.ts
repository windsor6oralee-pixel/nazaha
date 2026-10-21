#!/usr/bin/env node
/**
 * Clears login lockouts for every staff account, platform operator and candidate.
 *
 * The auth service locks an account for 15 minutes after 5 failed attempts
 * (src/infrastructure/auth/credentials.service.ts). That is the right default
 * for production, but it means one mistyped password in a test run locks the
 * whole test matrix out — and the lock cannot be lifted through the UI.
 *
 * This script resets the failed-attempt counters and the lockout deadlines.
 * It does NOT touch passwords, roles, organisations or candidate data.
 *
 *   # local dev DB (reads .env automatically)
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"skipLibCheck":true}' scripts/unlock_accounts.ts
 *
 *   # hosted DB — run inside a Vercel build, where the env vars exist:
 *   npm run unlock:accounts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

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

// A direct (unpooled) URL is the reliable choice for writes on Neon.
const OVERRIDE_URL = process.env.BOOTSTRAP_DATABASE_URL ?? process.env.NEON_DATABASE_URL_UNPOOLED;
const prisma = new PrismaClient({ datasourceUrl: OVERRIDE_URL } as never);

async function main() {
  const now = new Date();

  const lockedUsers = await prisma.user.findMany({
    where: { OR: [{ lockedUntil: { not: null } }, { failedLoginAttempts: { gt: 0 } }] },
    select: { email: true, failedLoginAttempts: true, lockedUntil: true },
  });

  const lockedAdmins = await prisma.platformAdmin.findMany({
    where: { OR: [{ lockedUntil: { not: null } }, { failedLoginAttempts: { gt: 0 } }] },
    select: { email: true, failedLoginAttempts: true, lockedUntil: true },
  });

  const lockedCandidates = await prisma.candidate.findMany({
    where: { OR: [{ lockedUntil: { not: null } }, { failedLoginAttempts: { gt: 0 } }] },
    select: { loginEmail: true, nameAr: true, failedLoginAttempts: true, lockedUntil: true },
  });

  const userRes = await prisma.user.updateMany({
    where: { OR: [{ lockedUntil: { not: null } }, { failedLoginAttempts: { gt: 0 } }] },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  const adminRes = await prisma.platformAdmin.updateMany({
    where: { OR: [{ lockedUntil: { not: null } }, { failedLoginAttempts: { gt: 0 } }] },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  const candidateRes = await prisma.candidate.updateMany({
    where: { OR: [{ lockedUntil: { not: null } }, { failedLoginAttempts: { gt: 0 } }] },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  console.log("🔓 Lockouts cleared");
  for (const u of lockedUsers) {
    console.log(
      `   staff   ${u.email.padEnd(32)} attempts=${u.failedLoginAttempts} lockedUntil=${u.lockedUntil?.toISOString() ?? "-"}`,
    );
  }
  for (const a of lockedAdmins) {
    console.log(
      `   operator ${a.email.padEnd(31)} attempts=${a.failedLoginAttempts} lockedUntil=${a.lockedUntil?.toISOString() ?? "-"}`,
    );
  }
  for (const c of lockedCandidates) {
    console.log(
      `   candidate ${(c.loginEmail ?? "(no login e-mail)").padEnd(31)} attempts=${c.failedLoginAttempts} lockedUntil=${c.lockedUntil?.toISOString() ?? "-"}`,
    );
  }
  console.log(
    `\n   updated: ${userRes.count} staff account(s), ${adminRes.count} operator account(s), ${candidateRes.count} candidate account(s)`,
  );
  console.log(`   (${now.toISOString()})`);
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
