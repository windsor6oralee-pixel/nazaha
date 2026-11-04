/**
 * InboxKit API client
 * Base URL: https://api.inboxkit.com/v1
 * Auth: Bearer token in Authorization header + X-Workspace-Id header
 *
 * Supports both Google-Workspace and Microsoft/Azure mailboxes. The platform
 * value flows back to the pool-saver so the right SMTP host is chosen per
 * mailbox at send time.
 */

const BASE = "https://api.inboxkit.com/v1";

export type MailboxPlatform = "GOOGLE" | "MICROSOFT";

export interface InboxKitMailbox {
  uid: string;
  username: string;
  domain_name: string;
  platform: MailboxPlatform;
  status: string;
  first_name: string;
  last_name: string;
}

export interface InboxKitCredentials {
  password: string;
  app_password: string;
  secret: string;
}

function headers(apiKey: string, workspaceId: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "X-Workspace-Id": workspaceId,
    "Content-Type": "application/json",
  };
}

/**
 * All active mailboxes for a workspace, across all platforms. Pages through
 * until the API runs out of rows so pools >100 mailboxes come back whole.
 */
export async function listInboxKitMailboxes(
  apiKey: string,
  workspaceId: string,
): Promise<InboxKitMailbox[]> {
  const all: InboxKitMailbox[] = [];
  const pageSize = 100;
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`${BASE}/api/mailboxes/list`, {
      method: "POST",
      headers: headers(apiKey, workspaceId),
      body: JSON.stringify({ page, limit: pageSize, status: "active" }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message ?? `InboxKit error ${res.status}`);
    }

    const data = await res.json();
    const rows = (data.mailboxes ?? []) as InboxKitMailbox[];
    all.push(...rows);
    if (rows.length < pageSize) break;  // last page
  }
  return all;
}

/** Retrieve credentials (app_password) for a specific mailbox */
export async function getInboxKitCredentials(
  apiKey: string,
  workspaceId: string,
  mailboxUid: string,
): Promise<InboxKitCredentials> {
  const url = new URL(`${BASE}/api/mailboxes/show-credentials`);
  url.searchParams.set("uid", mailboxUid);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: headers(apiKey, workspaceId),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? `InboxKit credentials error ${res.status}`);
  }

  const data = await res.json();
  return {
    password:     data.password ?? "",
    app_password: data.app_password ?? "",
    secret:       data.secret ?? "",
  };
}

/** SMTP config appropriate for a mailbox's platform. */
export function smtpConfigFor(platform: MailboxPlatform): { host: string; port: number; secure: boolean } {
  if (platform === "MICROSOFT") {
    // Azure / Microsoft 365 — STARTTLS on 587.
    return { host: "smtp.office365.com", port: 587, secure: false };
  }
  // Google Workspace / Gmail.
  return { host: "smtp.gmail.com", port: 587, secure: false };
}
