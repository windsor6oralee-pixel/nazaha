/**
 * Stores InboxKit connection settings per organization in SystemSetting.
 * Keys: inboxkit_api_key_enc, inboxkit_workspace_id,
 *       inboxkit_mailbox_uid, inboxkit_mailbox_email
 */
import { prisma } from "@/infrastructure/database/client";
import { encrypt, decrypt } from "@/lib/crypto";

export interface InboxKitConfig {
  apiKey: string;
  workspaceId: string;
  mailboxUid: string;
  mailboxEmail: string;
}

const KEYS = [
  "inboxkit_api_key_enc",
  "inboxkit_workspace_id",
  "inboxkit_mailbox_uid",
  "inboxkit_mailbox_email",
] as const;

export async function getInboxKitConfig(
  organizationId: string
): Promise<InboxKitConfig | null> {
  const rows = await prisma.systemSetting.findMany({
    where: { organizationId, key: { in: [...KEYS] } },
  });

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (!map.inboxkit_api_key_enc || !map.inboxkit_workspace_id) return null;

  return {
    apiKey:       decrypt(map.inboxkit_api_key_enc),
    workspaceId:  map.inboxkit_workspace_id,
    mailboxUid:   map.inboxkit_mailbox_uid ?? "",
    mailboxEmail: map.inboxkit_mailbox_email ?? "",
  };
}

export async function saveInboxKitConfig(
  organizationId: string,
  config: InboxKitConfig
): Promise<void> {
  const entries: Record<string, string> = {
    inboxkit_api_key_enc:   encrypt(config.apiKey),
    inboxkit_workspace_id:  config.workspaceId,
    inboxkit_mailbox_uid:   config.mailboxUid,
    inboxkit_mailbox_email: config.mailboxEmail,
  };

  await prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { organizationId_key: { organizationId, key } },
        update: { value },
        create: { organizationId, key, value },
      })
    )
  );
}

export async function deleteInboxKitConfig(
  organizationId: string
): Promise<void> {
  await prisma.systemSetting.deleteMany({
    where: { organizationId, key: { in: [...KEYS] } },
  });
}
