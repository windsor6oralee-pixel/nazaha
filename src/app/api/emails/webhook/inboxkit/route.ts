/**
 * POST /api/emails/webhook/inboxkit — receives delivery / bounce / open events
 * from InboxKit when webhooks are configured.
 *
 * Secured with a shared secret in the `X-Webhook-Secret` header (or Bearer),
 * compared against INBOXKIT_WEBHOOK_SECRET env. Absent env ⇒ endpoint stays
 * off (returns 503) to prevent spoofed updates landing in production.
 *
 * Event payload is matched by InboxKit's own messageId (stored in our
 * `providerMessageId` column at send time). Events for unknown ids are
 * accepted (200) but recorded nowhere — safe no-op.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/client";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";

interface InboxKitEvent {
  event: "delivered" | "bounced" | "opened" | "clicked" | "complained" | "failed" | string;
  message_id?: string;
  messageId?: string;
  email?: string;
  timestamp?: string | number;
  reason?: string;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a); const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function POST(req: Request) {
  const secret = process.env.INBOXKIT_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });

  // Accept the shared secret in whichever channel the provider supports:
  //   1. X-Webhook-Secret header  (most providers)
  //   2. Authorization: Bearer …   (standard)
  //   3. ?secret=…  query param    (fallback for UIs that only expose a URL field — InboxKit is like this)
  const url = new URL(req.url);
  const supplied =
    req.headers.get("x-webhook-secret") ||
    (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("secret") ||
    "";
  if (!supplied || !safeEqual(supplied, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // InboxKit may post a single event or a batch — handle both.
  const body = await req.json().catch(() => null);
  const events: InboxKitEvent[] = Array.isArray(body) ? body
    : Array.isArray((body as { events?: InboxKitEvent[] })?.events) ? (body as { events: InboxKitEvent[] }).events
    : body ? [body as InboxKitEvent] : [];
  if (!events.length) return NextResponse.json({ ok: true, processed: 0 });

  let touched = 0;
  for (const e of events) {
    const providerId = (e.message_id ?? e.messageId ?? "").trim();
    if (!providerId) continue;
    const row = await prisma.emailLog.findFirst({ where: { providerMessageId: providerId }, select: { id: true } });
    if (!row) continue;
    const ts = e.timestamp ? new Date(typeof e.timestamp === "number" ? e.timestamp * 1000 : e.timestamp) : new Date();
    const data: Record<string, unknown> = {};
    switch (e.event) {
      case "delivered":  data.status = "DELIVERED"; data.deliveredAt = ts; break;
      case "bounced":    data.status = "BOUNCED";   data.errorMessage = e.reason ?? "bounced"; break;
      case "complained": data.status = "BOUNCED";   data.errorMessage = e.reason ?? "complained"; break;
      case "failed":     data.status = "FAILED";    data.errorMessage = e.reason ?? "provider failure"; break;
      case "opened":
        data.lastOpenedAt = ts;
        data.openCount = { increment: 1 };
        // Use updateMany so we can conditionally set firstOpenedAt only when null.
        await prisma.emailLog.updateMany({ where: { id: row.id, firstOpenedAt: null }, data: { firstOpenedAt: ts } });
        break;
      case "clicked":
        data.lastClickedAt = ts;
        data.clickCount = { increment: 1 };
        await prisma.emailLog.updateMany({ where: { id: row.id, firstClickedAt: null }, data: { firstClickedAt: ts } });
        break;
    }
    if (Object.keys(data).length) {
      await prisma.emailLog.update({ where: { id: row.id }, data });
    }
    touched++;
  }
  return NextResponse.json({ ok: true, processed: touched });
}
