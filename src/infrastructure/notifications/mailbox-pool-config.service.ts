/**
 * Pool of InboxKit-provisioned mailboxes for an org.
 * Stored as ONE encrypted JSON blob in SystemSetting (key: inboxkit_mailboxes_enc)
 * — simpler than N rows, atomic to update, and keeps credentials off any index.
 */
import { prisma } from "@/infrastructure/database/client";
import { encrypt, decrypt } from "@/lib/crypto";
import type { PoolMailbox } from "./mailbox-pool.adapter";

const KEY = "inboxkit_mailboxes_enc";

interface StoredMailbox {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  uid?: string;
}

export async function getMailboxPool(organizationId: string): Promise<PoolMailbox[] | null> {
  const row = await prisma.systemSetting.findUnique({
    where: { organizationId_key: { organizationId, key: KEY } },
  });
  if (!row?.value) return null;
  let plain: string;
  try { plain = decrypt(row.value); } catch { return null; }
  try {
    const parsed = JSON.parse(plain) as StoredMailbox[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return parsed.map((m) => ({
      host:      m.host,
      port:      Number(m.port),
      secure:    Boolean(m.secure),
      user:      m.user,
      pass:      m.pass,
      fromEmail: m.fromEmail,
      fromName:  m.fromName,
    }));
  } catch {
    return null;
  }
}

export async function saveMailboxPool(organizationId: string, mailboxes: StoredMailbox[]): Promise<void> {
  const value = encrypt(JSON.stringify(mailboxes));
  await prisma.systemSetting.upsert({
    where:  { organizationId_key: { organizationId, key: KEY } },
    update: { value },
    create: { organizationId, key: KEY, value },
  });
}

export async function deleteMailboxPool(organizationId: string): Promise<void> {
  await prisma.systemSetting.deleteMany({ where: { organizationId, key: KEY } });
}
