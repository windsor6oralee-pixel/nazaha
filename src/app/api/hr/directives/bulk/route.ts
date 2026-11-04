/**
 * POST /api/hr/directives/bulk — send one templated directive to many candidates.
 * Variables are rendered per-candidate from each one's own context.
 */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { bulkUpsertDirective } from "@/infrastructure/directives/directive.service";

// Can touch dozens of candidates — e-mails + DB writes — raise serverless cap.
export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => ({}))) as {
    candidateIds?: string[];
    type?: "INFO" | "URGENT" | "APPOINTMENT";
    title?: string; body?: string;
    allowReply?: boolean; notifyByEmail?: boolean;
    concurrency?: number; minGapMs?: number;
  };

  if (!Array.isArray(body.candidateIds) || !body.candidateIds.length) {
    return NextResponse.json({ error: "اختر مرشحاً واحداً على الأقل" }, { status: 400 });
  }
  if (body.candidateIds.length > 500) {
    return NextResponse.json({ error: "الحد الأقصى 500 مرشح في الدفعة" }, { status: 400 });
  }

  try {
    const clamp = (n: unknown, lo: number, hi: number, dflt: number): number => {
      const v = Number(n); if (!Number.isFinite(v)) return dflt;
      return Math.max(lo, Math.min(hi, Math.floor(v)));
    };
    const result = await bulkUpsertDirective(ctx.organizationId, ctx.userId, {
      candidateIds: body.candidateIds,
      type:         body.type ?? "INFO",
      title:        body.title ?? "",
      body:         body.body  ?? "",
      allowReply:   !!body.allowReply,
      notifyByEmail: !!body.notifyByEmail,
      concurrency:  clamp(body.concurrency, 1, 5, 2),
      minGapMs:     clamp(body.minGapMs,    0, 10000, 400),
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "فشل الإرسال الجماعي" }, { status: 400 });
  }
}
