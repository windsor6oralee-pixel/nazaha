/**
 * POST /api/admin/inboxkit/connect
 * Fetches credentials for the selected InboxKit mailbox,
 * then auto-saves SMTP config using Google Workspace SMTP settings.
 */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import {
  getInboxKitConfig,
  saveInboxKitConfig,
} from "@/infrastructure/notifications/inboxkit-config.service";
import { getInboxKitCredentials } from "@/infrastructure/notifications/inboxkit.service";
import { saveSmtpConfig } from "@/infrastructure/notifications/smtp-config.service";

export async function POST(req: Request) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;

  const orgId = ctx.organizationId;
  const body = await req.json().catch(() => ({}));
  const { apiKey, workspaceId, mailboxUid, mailboxEmail, fromName } = body;

  if (!apiKey || !workspaceId || !mailboxUid || !mailboxEmail) {
    return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 });
  }

  try {
    // 1. Fetch credentials from InboxKit
    const creds = await getInboxKitCredentials(apiKey, workspaceId, mailboxUid);
    const password = creds.app_password || creds.password;

    if (!password) {
      return NextResponse.json(
        { error: "لم يُعثر على كلمة مرور للصندوق. تأكد من أن الصندوق نشط." },
        { status: 422 }
      );
    }

    // 2. Save InboxKit config
    await saveInboxKitConfig(orgId, { apiKey, workspaceId, mailboxUid, mailboxEmail });

    // 3. Auto-configure SMTP with Google Workspace settings
    await saveSmtpConfig(orgId, {
      host:      "smtp.gmail.com",
      port:      587,
      secure:    false,
      user:      mailboxEmail,
      pass:      password,
      fromEmail: mailboxEmail,
      fromName:  fromName || "نزاهة التوظيف",
    });

    return NextResponse.json({ success: true, mailboxEmail });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل الربط مع InboxKit" },
      { status: 502 }
    );
  }
}
