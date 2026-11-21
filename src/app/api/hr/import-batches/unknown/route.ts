/**
 * /api/hr/import-batches/unknown — manual reconciliation of uncertain sends.
 *
 * GET  ?batchId=  → every attempt whose outcome is uncertain (crash window or
 *                   explicit UNKNOWN). NEVER auto-resent.
 * POST { emailLogId, resolution: "SENT" | "NOT_SENT", note? }
 *                 → operator resolution: SENT locks the row as sent;
 *                   NOT_SENT records an explicit failure note, which unlocks a
 *                   NEW attempt (new idempotency key) on the next dispatch.
 *
 * Static segment "unknown" wins over the [id] dynamic segment in Next.js.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { listUnknownAttempts, reconcileUnknownAttempt } from "@/infrastructure/services/import-invitation.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager", "hr_officer"] });
  if (ctx instanceof NextResponse) return ctx;

  const batchId = request.nextUrl.searchParams.get("batchId");
  const rows = await listUnknownAttempts(ctx.organizationId, batchId ?? undefined);
  return NextResponse.json({ rows });
}

export async function POST(request: NextRequest) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager"] });
  if (ctx instanceof NextResponse) return ctx;

  const body = (await request.json().catch(() => null)) as {
    emailLogId?: unknown;
    resolution?: unknown;
    note?: unknown;
  } | null;
  if (!body || typeof body.emailLogId !== "string") {
    return NextResponse.json({ error: "emailLogId مطلوب" }, { status: 400 });
  }
  if (body.resolution !== "SENT" && body.resolution !== "NOT_SENT") {
    return NextResponse.json({ error: "resolution يجب أن يكون SENT أو NOT_SENT" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : undefined;

  const done = await reconcileUnknownAttempt(
    ctx.organizationId,
    body.emailLogId,
    body.resolution,
    note,
  );
  if (!done) return NextResponse.json({ error: "لا توجد محاولة غير مؤكدة بهذا المعرّف" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
