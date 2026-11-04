/**
 * POST /api/platform/organizations/[id]/sending/refresh
 *
 * Re-pulls the InboxKit mailbox list for this org's stored workspace, grabs
 * fresh credentials for each mailbox, and overwrites the mailbox pool blob.
 * The sending-policy JSON is left untouched — platform admin keeps whatever
 * primary/overflow/excluded choices they already made.
 *
 * Fails gracefully if the org has no InboxKit config yet (the admin needs to
 * run the initial connect flow before this button becomes useful).
 */
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/infrastructure/tenant";

// Same reasoning as the bootstrap route — refreshing 200+ mailboxes blows past
// the default serverless timeout.
export const maxDuration = 300;
export const runtime = "nodejs";
import { getInboxKitConfig } from "@/infrastructure/notifications/inboxkit-config.service";
import {
  listInboxKitMailboxes,
  getInboxKitCredentials,
  smtpConfigFor,
} from "@/infrastructure/notifications/inboxkit.service";
import { saveMailboxPool } from "@/infrastructure/notifications/mailbox-pool-config.service";

interface Ctx { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Ctx) {
  const ctx = await requirePlatformAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const { id: orgId } = await params;
  const config = await getInboxKitConfig(orgId);
  if (!config) {
    return NextResponse.json(
      { error: "لم تُربط هذه الجهة بـ InboxKit بعد — شغّل سكربت الربط أولاً" },
      { status: 400 },
    );
  }

  try {
    const mailboxes = await listInboxKitMailboxes(config.apiKey, config.workspaceId);
    const pool: Array<{
      host: string; port: number; secure: boolean;
      user: string; pass: string; fromEmail: string; fromName: string; uid: string;
    }> = [];
    const failures: string[] = [];
    for (const mb of mailboxes) {
      const email = `${mb.username}@${mb.domain_name}`;
      try {
        const pass = await getInboxKitCredentials(config.apiKey, config.workspaceId, mb.uid);
        const smtp = smtpConfigFor(mb.platform);
        pool.push({
          host: smtp.host, port: smtp.port, secure: smtp.secure,
          user: email, pass: pass.app_password || pass.password,
          fromEmail: email, fromName: "نزاهة التوظيف",
          uid: mb.uid,
        });
      } catch (e) {
        failures.push(`${email}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }
    if (!pool.length) {
      return NextResponse.json({ error: "لم يُجلب أي صندوق — تحقق من مفتاح API", failures }, { status: 502 });
    }
    await saveMailboxPool(orgId, pool);
    return NextResponse.json({
      ok: true,
      mailboxes: pool.length,
      domains: Array.from(new Set(pool.map((m) => m.fromEmail.split("@")[1]))).sort(),
      failures,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل تحديث الصناديق" },
      { status: 502 },
    );
  }
}
