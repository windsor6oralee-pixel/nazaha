/**
 * GET /api/emails/track/[id]/open.gif — 1×1 transparent pixel used for mail
 * open tracking. Public (no auth) because it's loaded by the recipient's mail
 * client. We never trust the hit to be a real human — many clients prefetch
 * images — so the UI labels this "فُتح (قد يكون تلقائياً)" rather than
 * "read by candidate".
 */
import { NextResponse } from "next/server";
import { recordOpen } from "@/infrastructure/notifications/email-log.service";

// 1×1 transparent GIF (43 bytes) — base64 encoded inline to avoid any file IO.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Best effort — never block the pixel response on DB latency or a missing id.
  recordOpen(id).catch(() => {});

  return new NextResponse(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type":  "image/gif",
      "Content-Length": String(PIXEL.length),
      // Explicitly uncached — Gmail's image proxy respects this so each client
      // open generates its own hit instead of a single cached bounce.
      "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
      "Pragma":        "no-cache",
      "Expires":       "0",
    },
  });
}
