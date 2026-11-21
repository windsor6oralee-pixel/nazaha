#!/usr/bin/env node
/**
 * Batch invitation sender — now driven by the production sendInvitation()
 * service so policy, mailbox pool, and daily caps are enforced automatically.
 *
 * Safety contract:
 *   - DRY-RUN by default. Pass --send (or SEND_FOR_REAL=1) to send.
 *   - Uses the real template + credentials provisioning. Each candidate gets
 *     their account hashed+written only after SMTP accepts.
 *   - Logs per-message outcome. Never logs tokens, passwords, API keys, or
 *     any payload containing them.
 *   - Stops the batch when the pool reports "all mailboxes exhausted today"
 *     so operators don't burn through retries once the daily cap is hit.
 */
import { PrismaClient } from '@prisma/client';
import { sendInvitation, InvitationError } from '../src/infrastructure/services/invitation.service';

const prisma = new PrismaClient();

function parseFlags() {
  const argv = process.argv.slice(2);
  const flag = (name: string) => argv.includes(`--${name}`);
  const sendForReal = flag('send') || process.env.SEND_FOR_REAL === '1';
  return {
    dryRun: !sendForReal,
    batchSize: Number(process.env.BATCH_SIZE || '60'),
    delayMs:   Number(process.env.DELAY_MS || '2000'),
    orgId:     process.env.ORG_ID || 'cmtycklvh000013w5xfrq8z5t',
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { dryRun, batchSize, delayMs, orgId } = parseFlags();
  const loginBase = (process.env.BATCH_LOGIN_URL || "https://www.anticorruptiongov.com").replace(/\/$/, "");
  console.log(`[batch] org=${orgId} batchSize=${batchSize} delayMs=${delayMs} mode=${dryRun ? 'DRY-RUN' : 'LIVE'} loginUrl=${loginBase}`);

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { nameAr: true } });
  if (!org) throw new Error(`org ${orgId} not found`);
  console.log(`[batch] org name: ${org.nameAr}`);

  const candidates = await prisma.candidate.findMany({
    where: {
      organizationId: orgId,
      invitationSent: false,
      applications: { some: { status: 'APPROVED' } },
    },
    select: { id: true, email: true },
    take: batchSize,
  });
  console.log(`[batch] found ${candidates.length} approved candidates awaiting invitation`);

  if (dryRun) {
    console.log('[batch] DRY-RUN: no mail will be sent, no DB writes performed. Pass --send (or SEND_FOR_REAL=1) to send.');
    return;
  }

  let ok = 0, fail = 0, exhausted = false;
  for (const c of candidates) {
    try {
      const result = await sendInvitation(c.id, { loginUrl: loginBase });
      if (result.delivered) ok++;
      else {
        fail++;
        console.error(`[SKIP] ${c.email} :: no transport-backed provider — check SMTP/InboxKit config`);
      }
      console.log(`[OK]   ${c.email}`);
      await sleep(delayMs);
    } catch (err) {
      fail++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[FAIL] ${c.email} :: ${msg.slice(0, 180)}`);
      if (msg.includes('سقفها اليومي') || msg.includes('all eligible mailboxes failed')) {
        // Nothing to send through — stop retrying so we don't DoS the pool.
        exhausted = true;
        break;
      }
      if (err instanceof InvitationError && err.code === 'EMAIL_TAKEN') {
        // Non-fatal — continue with the rest.
        continue;
      }
    }
  }
  console.log(`[batch] done: ok=${ok} fail=${fail}${exhausted ? ' (stopped — daily cap reached)' : ''}`);
}

main()
  .catch((e) => { console.error('[batch] fatal:', e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
