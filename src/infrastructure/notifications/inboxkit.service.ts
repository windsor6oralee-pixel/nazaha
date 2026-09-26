/**
 * InboxKit API client
 * Base URL: https://api.inboxkit.com/v1
 * Auth: Bearer token in Authorization header + X-Workspace-Id header
 */

const BASE = "https://api.inboxkit.com/v1";

export interface InboxKitMailbox {
  uid: string;
  username: string;
  domain_name: string;
  platform: "GOOGLE" | "MICROSOFT";
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

/** Fetch active Google Workspace mailboxes for a workspace */
export async function listInboxKitMailboxes(
  apiKey: string,
  workspaceId: string
): Promise<InboxKitMailbox[]> {
  const res = await fetch(`${BASE}/api/mailboxes/list`, {
    method: "POST",
    headers: headers(apiKey, workspaceId),
    body: JSON.stringify({ page: 1, limit: 100, status: "active", platform: "GOOGLE" }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? `InboxKit error ${res.status}`);
  }

  const data = await res.json();
  return (data.mailboxes ?? []) as InboxKitMailbox[];
}

/** Retrieve credentials (app_password) for a specific mailbox */
export async function getInboxKitCredentials(
  apiKey: string,
  workspaceId: string,
  mailboxUid: string
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
