#!/usr/bin/env node
/**
 * Provisions ALL active InboxKit mailboxes for one org as a sending pool.
 * Reads INBOXKIT_API_KEY (+ optional INBOXKIT_WORKSPACE_ID / _WORKSPACE_NAME /
 * _ORG_ID) from env. Lists mailboxes → fetches app_password per mailbox →
 * stores them as one encrypted JSON blob (`inboxkit_mailboxes_enc`) so the
 * MailboxPoolAdapter can round-robin across them.
 *
 * Prints only mailbox e-mails and counts. Never prints api keys, passwords,
 * ciphertext, or any InboxKit response body.
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes, createCipheriv } from 'crypto';

const prisma = new PrismaClient();
const BASE = 'https://api.inboxkit.com/v1';

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`[pool] missing env ${name}`); process.exit(2); }
  return v;
}
function encrypt(plaintext: string): string {
  const hex = process.env.ENCRYPTION_KEY && /^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)
    ? process.env.ENCRYPTION_KEY : '0'.repeat(64);
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', Buffer.from(hex, 'hex'), iv);
  const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  return [iv.toString('hex'), c.getAuthTag().toString('hex'), ct.toString('hex')].join(':');
}
function headers(apiKey: string, workspaceId?: string) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (workspaceId) h['X-Workspace-Id'] = workspaceId;
  return h;
}
async function discoverWorkspace(apiKey: string, want: string): Promise<string> {
  const candidates = [`${BASE}/api/workspaces/list`, `${BASE}/api/workspaces`];
  for (const url of candidates) {
    const res = await fetch(url, { method: 'GET', headers: headers(apiKey) });
    if (!res.ok) continue;
    const data = await res.json().catch(() => ({}));
    const list = (data.workspaces ?? data.data ?? data) as Array<{ uid?: string; id?: string; name?: string }>;
    if (!Array.isArray(list)) continue;
    const hit = list.find((w) => (w.name ?? '').toLowerCase() === want.toLowerCase());
    const uid = hit?.uid ?? hit?.id;
    if (uid) return uid;
  }
  throw new Error(`workspace "${want}" not found — set INBOXKIT_WORKSPACE_ID explicitly`);
}

type Platform = 'GOOGLE' | 'MICROSOFT';
interface Mailbox { uid: string; username: string; domain_name: string; platform: Platform }

async function listMailboxes(apiKey: string, workspaceId: string): Promise<Mailbox[]> {
  const all: Mailbox[] = [];
  const pageSize = 100;
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`${BASE}/api/mailboxes/list`, {
      method: 'POST', headers: headers(apiKey, workspaceId),
      body: JSON.stringify({ page, limit: pageSize, status: 'active' }),
    });
    if (!res.ok) throw new Error(`mailboxes/list ${res.status}`);
    const d = await res.json();
    const rows = (d.mailboxes ?? []) as Mailbox[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}
function smtpConfigFor(platform: Platform): { host: string; port: number; secure: boolean } {
  return platform === 'MICROSOFT'
    ? { host: 'smtp.office365.com', port: 587, secure: false }
    : { host: 'smtp.gmail.com',     port: 587, secure: false };
}
async function getCredentials(apiKey: string, workspaceId: string, uid: string): Promise<string> {
  const url = new URL(`${BASE}/api/mailboxes/show-credentials`);
  url.searchParams.set('uid', uid);
  const res = await fetch(url.toString(), { method: 'GET', headers: headers(apiKey, workspaceId) });
  if (!res.ok) throw new Error(`show-credentials ${res.status}`);
  const d = await res.json();
  const pwd = d.app_password || d.password;
  if (!pwd) throw new Error('no app_password returned');
  return pwd as string;
}

async function main() {
  const apiKey   = reqEnv('INBOXKIT_API_KEY');
  const orgId    = process.env.INBOXKIT_ORG_ID || 'cmtycklvh000013w5xfrq8z5t';
  const fromName = process.env.INBOXKIT_FROM_NAME || 'نزاهة التوظيف';
  let workspaceId = process.env.INBOXKIT_WORKSPACE_ID?.trim();

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { nameAr: true } });
  if (!org) throw new Error(`org ${orgId} not found`);
  console.log(`[pool] org: ${org.nameAr}`);

  if (!workspaceId) {
    console.log('[pool] discovering workspace…');
    workspaceId = await discoverWorkspace(apiKey, process.env.INBOXKIT_WORKSPACE_NAME || 'Nano Galaxy');
  }
  console.log(`[pool] workspace: ${workspaceId}`);

  const mailboxes = await listMailboxes(apiKey, workspaceId);
  console.log(`[pool] mailboxes found: ${mailboxes.length}`);

  // Optional domain-based exclusion — comma-separated. Lets ops carve out
  // reserved domains (e.g. the platform's own sign-in address) that must
  // never land in the sending rotation.
  const excludeDomains = (process.env.INBOXKIT_EXCLUDE_DOMAINS || '')
    .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (excludeDomains.length) console.log(`[pool] excluding domains: ${excludeDomains.join(', ')}`);

  const pool: Array<{
    host: string; port: number; secure: boolean;
    user: string; pass: string; fromEmail: string; fromName: string; uid: string;
  }> = [];
  let ok = 0, fail = 0, skipped = 0;
  for (const mb of mailboxes) {
    const email = `${mb.username}@${mb.domain_name}`;
    if (excludeDomains.includes(mb.domain_name.toLowerCase())) {
      skipped++;
      console.log(`[pool] - ${email} (excluded)`);
      continue;
    }
    try {
      const pass = await getCredentials(apiKey, workspaceId, mb.uid);
      const smtp = smtpConfigFor(mb.platform);
      pool.push({
        host: smtp.host, port: smtp.port, secure: smtp.secure,
        user: email, pass,
        fromEmail: email, fromName,
        uid: mb.uid,
      });
      ok++;
      console.log(`[pool] + ${email} (${mb.platform})`);
    } catch (e) {
      fail++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[pool] ! ${email} :: ${msg.slice(0, 120)}`);
    }
  }
  if (skipped) console.log(`[pool] ${skipped} mailbox(es) skipped via INBOXKIT_EXCLUDE_DOMAINS`);
  if (!pool.length) throw new Error('no mailbox credentials fetched — nothing to save');

  const { saveMailboxPool } = await import('../src/infrastructure/notifications/mailbox-pool-config.service');
  await saveMailboxPool(orgId, pool);

  console.log(`[pool] saved pool: ${pool.length} mailbox(es)  (ok=${ok} fail=${fail})`);
  console.log('[pool] senders in rotation:');
  for (const p of pool) console.log(`  - ${p.fromEmail}`);
  console.log('[pool] done — notifier will now round-robin across these mailboxes.');
}

main()
  .catch((e) => { console.error('[pool] fatal:', e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
