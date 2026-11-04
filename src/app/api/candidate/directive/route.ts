/**
 * GET  /api/candidate/directive — the current HR directive (and marks it read)
 * POST /api/candidate/directive/reply — single-shot reply (if allowReply)
 */
import { NextResponse } from "next/server";
import { getTenantContext } from "@/infrastructure/tenant";
import {
  getDirectiveForApplication,
  markDirectiveRead,
  recordCandidateReply,
} from "@/infrastructure/directives/directive.service";

async function requireCandidateApplication() {
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "candidate" || !ctx.applicationId) return null;
  return ctx;
}

export async function GET() {
  const ctx = await requireCandidateApplication();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const directive = await getDirectiveForApplication(ctx.applicationId!);
  if (directive && !directive.candidateReadAt) {
    // Fire and forget — don't block the response on a trivial update.
    markDirectiveRead(ctx.applicationId!).catch(() => {});
  }
  return NextResponse.json({ directive });
}

export async function POST(req: Request) {
  const ctx = await requireCandidateApplication();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { reply?: string };
  try {
    const directive = await recordCandidateReply(ctx.applicationId!, body.reply ?? "");
    return NextResponse.json({ directive });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "فشل إرسال الرد" }, { status: 400 });
  }
}
