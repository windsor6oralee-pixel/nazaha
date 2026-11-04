#!/usr/bin/env node
/**
 * One-off test credentials email.
 * Uses the real production template and the real SMTP config stored in DB.
 * Does NOT touch any candidate row — the password shown is a throwaway for
 * this preview and is NOT written to DB (no login will work with it).
 */
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { createDecipheriv } from 'crypto';
import { candidateCredentials } from '../src/infrastructure/notifications/templates/credentials';
import { generateCandidatePassword } from '../src/lib/password-gen';

const prisma = new PrismaClient();

function decryptAesGcm(encoded: string): string {
  const hex = process.env.ENCRYPTION_KEY && /^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)
    ? process.env.ENCRYPTION_KEY
    : '0'.repeat(64);
  const [ivHex, tagHex, ctHex] = encoded.split(':');
  const d = createDecipheriv('aes-256-gcm', Buffer.from(hex, 'hex'), Buffer.from(ivHex, 'hex'));
  d.setAuthTag(Buffer.from(tagHex, 'hex'));
  return d.update(Buffer.from(ctHex, 'hex')).toString('utf8') + d.final('utf8');
}

async function main() {
  const to      = process.env.TEST_TO     || 'aa079a3@gmail.com';
  const name    = process.env.TEST_NAME   || 'اختبار نزاهة';
  const title   = process.env.TEST_TITLE  || 'اختبار الإرسال';
  const dept    = process.env.TEST_DEPT   || 'اختبار الإرسال';
  const loginUrl= process.env.TEST_URL    || 'https://www.nazahacareer.com';
  const orgId   = process.env.INBOXKIT_ORG_ID || 'cmtycklvh000013w5xfrq8z5t';

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { nameAr: true } });

  const rows = await prisma.systemSetting.findMany({
    where: { organizationId: orgId, key: { in: [
      'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user',
      'smtp_pass_enc', 'smtp_from_email', 'smtp_from_name',
    ] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (!map.smtp_host || !map.smtp_user || !map.smtp_pass_enc) {
    throw new Error('SMTP not configured for this org — run connect_inboxkit first');
  }

  console.log(`[test] from=${map.smtp_user} to=${to} via=${map.smtp_host}:${map.smtp_port}`);
  const transporter = nodemailer.createTransport({
    host:   map.smtp_host,
    port:   Number(map.smtp_port || 587),
    secure: map.smtp_secure === 'true',
    auth:   { user: map.smtp_user, pass: decryptAesGcm(map.smtp_pass_enc) },
    connectionTimeout: 20000,
    greetingTimeout:   20000,
    socketTimeout:     20000,
  });
  await transporter.verify();
  console.log('[test] SMTP handshake ok');

  const password = generateCandidatePassword(12);
  const { subject, html } = candidateCredentials({
    candidateName:    name,
    jobTitle:         title,
    department:       dept,
    organizationName: org.nameAr,
    loginEmail:       to,
    password,
    loginUrl,
  });

  const info = await transporter.sendMail({
    from: `${map.smtp_from_name || 'نزاهة التوظيف'} <${map.smtp_from_email || map.smtp_user}>`,
    to,
    subject,
    html,
  });

  console.log(`[test] sent OK  id=${info.messageId}  accepted=${JSON.stringify(info.accepted)}  rejected=${JSON.stringify(info.rejected)}`);
  console.log('[test] password NOT printed — check the recipient mailbox.');
  console.log('[test] NOTE: this is a preview only — the DB is NOT updated, no login will work with this password.');
}

main()
  .catch((e) => { console.error('[test] fatal:', e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
