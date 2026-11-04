#!/usr/bin/env node
/**
 * One-off password reset for a PlatformAdmin row.
 * Reads target email + new password from env:
 *   RESET_EMAIL      — the platform admin's email (defaults to platform@nazaha.sa)
 *   RESET_PASSWORD   — the new plaintext password to set (required)
 * Clears any failed-login lockout at the same time. Never prints the password.
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email    = (process.env.RESET_EMAIL || 'platform@nazaha.sa').toLowerCase();
  const password = process.env.RESET_PASSWORD;
  if (!password) {
    console.error('[reset] RESET_PASSWORD env is required');
    process.exit(2);
  }

  const existing = await prisma.platformAdmin.findUnique({
    where: { email }, select: { id: true, isActive: true },
  });
  if (!existing) {
    console.error(`[reset] no platform admin found with email ${email}`);
    process.exit(3);
  }

  const passwordHash = await hash(password, 12);
  await prisma.platformAdmin.update({
    where: { email },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date(),
      isActive: true,
    },
  });
  console.log(`[reset] ok — platform admin ${email} password updated (hash length=${passwordHash.length})`);
}

main()
  .catch((e) => { console.error('[reset] fatal:', e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
