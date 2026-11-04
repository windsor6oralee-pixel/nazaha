/**
 * POST /api/platform/organizations/[id]/sending/bootstrap
 *
 * One-shot setup from the Platform Admin UI. Takes the InboxKit API key and
 * workspace id (optionally a comma-separated exclude list), saves the config
 * for this tenant, pulls every active mailbox across both Google and Microsoft
 * platforms, fetches credentials, and stores the pool blob. Equivalent to
 * running scripts/connect_inboxkit_pool.ts, but driven from the browser.
 */
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/infrastructure/tenant";

// Fetching credentials for every mailbox in a workspace can easily take minutes
// when the pool is in the hundreds. Give the serverless function the headroom.
export const maxDuration = 300;
export const runtime = "nodejs";
import { prisma } from "@/infrastructure/database/client";
import { saveInboxKitConfig } from "@/infrastructure/notifications/inboxkit-config.service";
import {
  listInboxKitMailboxes,
  getInboxKitCredentials,
  smtpConfigFor,
} from "@/infrastructure/notifications/inboxkit.service";
import { saveMailboxPool } from "@/infrastructure/notifications/mailbox-pool-config.service";

interface Ctx { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await requirePlatformAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const { id: orgId } = await params;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "الجهة غير موجودة" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    apiKey?: string; workspaceId?: string; excludeDomains?: string; fromName?: string;
  };
  const apiKey      = body.apiKey?.trim();
  const workspaceId = body.workspaceId?.trim();
  const fromName    = body.fromName?.trim() || "نزاهة التوظيف";
  const excludeDomains = (body.excludeDomains ?? "")
    .split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);

  if (!apiKey || !workspaceId) {
    return NextResponse.json({ error: "apiKey و workspaceId مطلوبان" }, { status: 400 });
  }

  try {
    const mailboxes = await listInboxKitMailboxes(apiKey, workspaceId);
    const pool: Array<{
      host: string; port: number; secure: boolean;
      user: string; pass: string; fromEmail: string; fromName: string; uid: string;
    }> = [];
    let skipped = 0;
    const failures: string[] = [];
    for (const mb of mailboxes) {
      const email = `${mb.username}@${mb.domain_name}`;
      if (excludeDomains.includes(mb.domain_name.toLowerCase())) { skipped++; continue; }
      try {
        const creds = await getInboxKitCredentials(apiKey, workspaceId, mb.uid);
        const smtp = smtpConfigFor(mb.platform);
        pool.push({
          host: smtp.host, port: smtp.port, secure: smtp.secure,
          user: email, pass: creds.app_password || creds.password,
          fromEmail: email, fromName, uid: mb.uid,
        });
      } catch (e) {
        failures.push(`${email}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }
    if (!pool.length) {
      return NextResponse.json({ error: "لم يُجلب أي صندوق — تحقق من المفتاح والـ workspace", failures }, { status: 502 });
    }

    // Persist the api key + workspace so later refreshes work without re-entering them.
    await saveInboxKitConfig(orgId, {
      apiKey,
      workspaceId,
      mailboxUid:   "",
      mailboxEmail: "",
    });
    await saveMailboxPool(orgId, pool);

    return NextResponse.json({
      ok: true,
      mailboxes: pool.length,
      skipped,
      domains: Array.from(new Set(pool.map((m) => m.fromEmail.split("@")[1]))).sort(),
      failures,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل الربط" },
      { status: 502 },
    );
  }
}
