import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import {
  getInboxKitConfig,
  saveInboxKitConfig,
  deleteInboxKitConfig,
} from "@/infrastructure/notifications/inboxkit-config.service";

const ADMIN_ROLES = ["admin", "hr_manager"];

/** GET — return current InboxKit config (API key masked) */
export async function GET() {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  const config = await getInboxKitConfig(ctx.organizationId);
  if (!config) return NextResponse.json({ configured: false });

  return NextResponse.json({
    configured:   true,
    workspaceId:  config.workspaceId,
    mailboxEmail: config.mailboxEmail,
    mailboxUid:   config.mailboxUid,
    apiKeySet:    true,
  });
}

/** POST — save InboxKit config */
export async function POST(req: Request) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const { apiKey, workspaceId, mailboxUid, mailboxEmail } = body;

  if (!apiKey || !workspaceId) {
    return NextResponse.json({ error: "apiKey و workspaceId مطلوبان" }, { status: 400 });
  }

  await saveInboxKitConfig(ctx.organizationId, {
    apiKey,
    workspaceId,
    mailboxUid:   mailboxUid ?? "",
    mailboxEmail: mailboxEmail ?? "",
  });

  return NextResponse.json({ success: true });
}

/** DELETE — remove InboxKit config */
export async function DELETE() {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  await deleteInboxKitConfig(ctx.organizationId);
  return NextResponse.json({ success: true });
}
