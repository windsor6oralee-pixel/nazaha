/**
 * GET /api/emails/track/[id]/click?to=<urlEncoded> — 302 redirect that logs
 * the click first. Public (no auth) because the recipient follows the link
 * from their mail client.
 *
 * Only redirects to URLs on our own base to prevent open-redirect abuse.
 */
import { NextResponse } from "next/server";
import { recordClick } from "@/infrastructure/notifications/email-log.service";

export const runtime = "nodejs";

function allowedDestination(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const baseHost = new URL(process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002").hostname;
    // Accept exact host or any subdomain of the platform host — prevents
    // attackers from bouncing arbitrary destinations through this endpoint.
    if (url.hostname === baseHost || url.hostname.endsWith("." + baseHost)) return url.toString();
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const to  = url.searchParams.get("to");
  const dest = allowedDestination(to) ?? (process.env.NEXTAUTH_URL ?? "/");

  // Fire-and-forget — never block the redirect on DB latency.
  recordClick(id).catch(() => {});

  return NextResponse.redirect(dest, 302);
}
