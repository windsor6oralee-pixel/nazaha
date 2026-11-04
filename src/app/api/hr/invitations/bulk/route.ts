/**
 * POST /api/hr/invitations/bulk — resend login credentials to many candidates.
 *
 * Each call rotates the password: sendInvitation() generates a fresh one, emails
 * it, and only commits the new hash after a transport-backed delivery. Use it
 * to deliver credentials to accepted candidates who never opened the first mail.
 *
 * Throttled through runPaced to avoid tripping SMTP rate caps.
 */
import { NextResponse } from "next/server";
import { requireHR, tenantPrisma } from "@/infrastructure/tenant";
import { sendInvitation } from "@/infrastructure/services/invitation.service";
import { runPaced } from "@/infrastructure/notifications/paced-runner";

export const maxDuration = 300;
export const runtime = "nodejs";

interface Body {
  candidateIds?: unknown;
  /** When true, candidates who already logged in are skipped — keeps their current password. */
  skipActivated?: unknown;
  concurrency?: unknown;   // 1..5, default 2
  minGapMs?:    unknown;   // 0..10000, default 500
}

function clamp(n: unknown, lo: number, hi: number, dflt: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return dflt;
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

export async function POST(req: Request) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager", "hr_officer"] });
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => ({}))) as Body;
  const ids  = Array.isArray(body.candidateIds) ? body.candidateIds.filter((x): x is string => typeof x === "string") : [];
  const skipActivated = body.skipActivated !== false; // default: skip those who already logged in

  if (!ids.length) {
    return NextResponse.json({ error: "اختر مرشحاً واحداً على الأقل" }, { status: 400 });
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: "الحد الأقصى 500 مرشح في الدفعة" }, { status: 400 });
  }

  const db = tenantPrisma(ctx.organizationId);
  // Tenant-scoped lookup — an id from another org drops silently.
  const candidates = await db.candidate.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, lastLoginAt: true, invitationSent: true },
  });

  type Row = (typeof candidates)[number];
  const skipped: Array<{ candidateId: string; email: string | null; reason: string }> = [];
  const toSend: Row[] = [];
  for (const c of candidates) {
    if (!c.email) {
      skipped.push({ candidateId: c.id, email: null, reason: "no_email" });
      continue;
    }
    if (skipActivated && c.lastLoginAt) {
      skipped.push({ candidateId: c.id, email: c.email, reason: "already_logged_in" });
      continue;
    }
    toSend.push(c);
  }

  const paced = await runPaced(toSend, async (c) => { await sendInvitation(c.id); }, {
    concurrency: clamp(body.concurrency, 1, 5, 2),
    minGapMs:    clamp(body.minGapMs,    0, 10000, 500),
  });

  let succeeded = 0, failed = 0;
  const details: Array<{ candidateId: string; email: string | null; status: "ok" | "error" | "skipped"; error?: string; reason?: string }> = [];
  for (const r of paced) {
    if (r.status === "ok") { succeeded++; details.push({ candidateId: r.item.id, email: r.item.email, status: "ok" }); }
    else {
      failed++;
      const msg = r.error ?? "failed";
      const human = msg.includes("EMAIL_TAKEN")
        ? "البريد مستخدم لحساب آخر"
        : msg.includes("NO_PROVIDER")
          ? "لا يوجد مزود بريد مفعّل"
          : msg;
      details.push({ candidateId: r.item.id, email: r.item.email, status: "error", error: human });
    }
  }
  for (const s of skipped) details.push({ ...s, status: "skipped" });

  return NextResponse.json({ succeeded, failed, skipped: skipped.length, details });
}
