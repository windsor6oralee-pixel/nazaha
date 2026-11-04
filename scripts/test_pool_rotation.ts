#!/usr/bin/env node
/**
 * Fires N test credentials emails through the real MailboxPoolAdapter so we
 * can see rotation across the pool. Does NOT touch any candidate row.
 * The password shown in each mail is a throwaway — no login will work.
 */
import { PrismaClient } from '@prisma/client';
import { getMailboxPool } from '../src/infrastructure/notifications/mailbox-pool-config.service';
import { MailboxPoolAdapter } from '../src/infrastructure/notifications/mailbox-pool.adapter';
import { candidateCredentials } from '../src/infrastructure/notifications/templates/credentials';
import { generateCandidatePassword } from '../src/lib/password-gen';

const prisma = new PrismaClient();

async function main() {
  const to     = process.env.TEST_TO     || 'aa079a3@gmail.com';
  const count  = Number(process.env.TEST_COUNT || '3');
  const url    = process.env.TEST_URL    || 'https://www.nazahacareer.com';
  const orgId  = process.env.INBOXKIT_ORG_ID || 'cmtycklvh000013w5xfrq8z5t';

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { nameAr: true } });
  const pool = await getMailboxPool(orgId);
  if (!pool || !pool.length) throw new Error('no pool saved for this org — run connect_inboxkit_pool first');

  const adapter = new MailboxPoolAdapter(pool);
  console.log(`[rotate] pool size: ${adapter.size}`);
  console.log(`[rotate] rotation order (first ${Math.min(count, adapter.size)} picks will come from the top):`);
  for (const s of adapter.senders.slice(0, count)) console.log(`  → ${s}`);
  console.log(`[rotate] sending ${count} test mail(s) to ${to}…`);

  for (let i = 1; i <= count; i++) {
    const password = generateCandidatePassword(12);
    const { subject, html } = candidateCredentials({
      candidateName:    `اختبار #${i}`,
      jobTitle:         'اختبار تناوب الصناديق',
      department:       `طلب ${i}/${count}`,
      organizationName: org.nameAr,
      loginEmail:       to,
      password,
      loginUrl:         url,
    });
    try {
      await adapter.send({ to, subject, html });
      console.log(`[rotate] #${i} sent OK`);
    } catch (err) {
      console.error(`[rotate] #${i} FAILED :: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log('[rotate] done — check inbox: each mail should show a different "From" address.');
}

main()
  .catch((e) => { console.error('[rotate] fatal:', e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
