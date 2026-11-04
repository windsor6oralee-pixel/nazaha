#!/usr/bin/env node
/**
 * Idempotent create-or-update for a PlatformAdmin row. Reads target email,
 * display name, and new plaintext password from env — never from argv — so
 * the password doesn't land in shell history.
 *
 * Env:
 *   ADMIN_EMAIL     — required
 *   ADMIN_NAME      — defaults to "مشغّل المنصة"
 *   ADMIN_PASSWORD  — required (plaintext; hashed before write)
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email    = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const nameAr   = process.env.ADMIN_NAME || 'مشغّل المنصة';
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('[admin] ADMIN_EMAIL and ADMIN_PASSWORD are required');
    process.exit(2);
  }

  const passwordHash = await hash(password, 12);
  const row = await prisma.platformAdmin.upsert({
    where: { email },
    update: {
      passwordHash,
      nameAr,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date(),
    },
    create: {
      email,
      passwordHash,
      nameAr,
      isActive: true,
    },
    select: { id: true, email: true, nameAr: true, isActive: true, createdAt: true },
  });

  console.log('[admin] upsert ok:', row);
}

main()
  .catch((e) => { console.error('[admin] fatal:', e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
