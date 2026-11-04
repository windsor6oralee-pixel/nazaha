#!/usr/bin/env node
/**
 * One-shot InboxKit connector — same flow as the admin UI, driven by env vars
 * so secrets never land in the shell history or in logs.
 *
 * Required env:
 *   INBOXKIT_API_KEY        — Bearer token from app.inboxkit.com
 *   INBOXKIT_MAILBOX_EMAIL  — the mailbox to send from (e.g. zoe@aspenguidehq.co)
 *   INBOXKIT_ORG_ID         — target Organization.id in this app's DB
 *
 * Optional:
 *   INBOXKIT_WORKSPACE_ID   — if empty, auto-discovered via /workspaces/list
 *   INBOXKIT_FROM_NAME      — defaults to "نزاهة التوظيف"
 *
 * Behavior:
 *   1. Discover the workspace (if id not provided).
 *   2. Fetch active mailboxes; pick the one matching INBOXKIT_MAILBOX_EMAIL.
 *   3. Fetch its credentials (app_password).
 *   4. Write inboxkit_* + smtp_* keys to SystemSetting (encrypted) for the org.
 *   5. Verify by re-reading SMTP config and printing which keys are now set.
 *
 * Does NOT send any mail. Does NOT print the api_key / app_password / tokens.
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes, createCipheriv } from 'crypto';

const prisma = new PrismaClient();
const BASE = 'https://api.inboxkit.com/v1';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`[connect] missing env ${name}`); process.exit(2); }
  return v;
}

// Mirror of src/lib/crypto.ts — must stay compatible with the live app's key.
function encrypt(plaintext: string): string {
  const hex = process.env.ENCRYPTION_KEY && /^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)
    ? process.env.ENCRYPTION_KEY
    : '0'.repeat(64);
  const key = Buffer.from(hex, 'hex');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
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
  // Try the documented listing endpoint; the exact path may differ by plan,
  // so we attempt a couple of plausible shapes before failing.
  const candidates = [
    `${BASE}/api/workspaces/list`,
    `${BASE}/api/workspaces`,
  ];
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

async function listMailboxes(apiKey: string, workspaceId: string) {
  const res = await fetch(`${BASE}/api/mailboxes/list`, {
    method: 'POST',
    headers: headers(apiKey, workspaceId),
    body: JSON.stringify({ page: 1, limit: 100, status: 'active', platform: 'GOOGLE' }),
  });
  if (!res.ok) throw new Error(`mailboxes/list ${res.status}`);
  const data = await res.json();
  return (data.mailboxes ?? []) as Array<{
    uid: string; username: string; domain_name: string;
  }>;
}

async function getCredentials(apiKey: string, workspaceId: string, uid: string) {
  const url = new URL(`${BASE}/api/mailboxes/show-credentials`);
  url.searchParams.set('uid', uid);
  const res = await fetch(url.toString(), { method: 'GET', headers: headers(apiKey, workspaceId) });
  if (!res.ok) throw new Error(`show-credentials ${res.status}`);
  const d = await res.json();
  const pwd = d.app_password || d.password;
  if (!pwd) throw new Error('no app_password returned for mailbox');
  return pwd as string;
}

async function upsertSetting(orgId: string, key: string, value: string) {
  await prisma.systemSetting.upsert({
    where:  { organizationId_key: { organizationId: orgId, key } },
    update: { value },
    create: { organizationId: orgId, key, value },
  });
}

async function main() {
  const apiKey       = requireEnv('INBOXKIT_API_KEY');
  const mailboxEmail = requireEnv('INBOXKIT_MAILBOX_EMAIL').toLowerCase();
  const orgId        = requireEnv('INBOXKIT_ORG_ID');
  const fromName     = process.env.INBOXKIT_FROM_NAME || 'نزاهة التوظيف';
  let workspaceId    = process.env.INBOXKIT_WORKSPACE_ID?.trim();

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, nameAr: true } });
  if (!org) throw new Error(`org ${orgId} not found`);
  console.log(`[connect] org: ${org.nameAr}`);

  if (!workspaceId) {
    console.log('[connect] workspace id not provided, discovering…');
    workspaceId = await discoverWorkspace(apiKey, process.env.INBOXKIT_WORKSPACE_NAME || 'Nano Galaxy');
  }
  console.log(`[connect] workspace: ${workspaceId}`);

  const mailboxes = await listMailboxes(apiKey, workspaceId);
  console.log(`[connect] mailboxes returned: ${mailboxes.length}`);
  const mb = mailboxes.find((m) => `${m.username}@${m.domain_name}`.toLowerCase() === mailboxEmail);
  if (!mb) {
    console.error(`[connect] mailbox ${mailboxEmail} not found. Available:`);
    for (const m of mailboxes) console.error(`  - ${m.username}@${m.domain_name}`);
    process.exit(3);
  }
  const resolvedEmail = `${mb.username}@${mb.domain_name}`;
  console.log(`[connect] selected mailbox: ${resolvedEmail} (uid=${mb.uid})`);

  const appPassword = await getCredentials(apiKey, workspaceId, mb.uid);
  console.log('[connect] credentials fetched (not printed)');

  // Write InboxKit config
  await upsertSetting(orgId, 'inboxkit_api_key_enc',   encrypt(apiKey));
  await upsertSetting(orgId, 'inboxkit_workspace_id',  workspaceId);
  await upsertSetting(orgId, 'inboxkit_mailbox_uid',   mb.uid);
  await upsertSetting(orgId, 'inboxkit_mailbox_email', resolvedEmail);

  // Write SMTP config (Google Workspace)
  await upsertSetting(orgId, 'smtp_host',       'smtp.gmail.com');
  await upsertSetting(orgId, 'smtp_port',       '587');
  await upsertSetting(orgId, 'smtp_secure',     'false');
  await upsertSetting(orgId, 'smtp_user',       resolvedEmail);
  await upsertSetting(orgId, 'smtp_pass_enc',   encrypt(appPassword));
  await upsertSetting(orgId, 'smtp_from_email', resolvedEmail);
  await upsertSetting(orgId, 'smtp_from_name',  fromName);

  // Verify
  const rows = await prisma.systemSetting.findMany({
    where: { organizationId: orgId, key: { in: [
      'smtp_host', 'smtp_user', 'smtp_pass_enc', 'smtp_from_email', 'smtp_from_name',
      'inboxkit_workspace_id', 'inboxkit_mailbox_email', 'inboxkit_mailbox_uid', 'inboxkit_api_key_enc',
    ] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, Boolean(r.value)]));
  console.log('[connect] stored keys:', map);
  console.log('[connect] done — provider ready. Run batch_send.sh (DRY-RUN first).');
}

main()
  .catch((e) => { console.error('[connect] fatal:', e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
