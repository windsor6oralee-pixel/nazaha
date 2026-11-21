/**
 * GET /api/hr/import-batches/[id]/report — the five-way separated report:
 *   1. frozen batch snapshot      (batch fields as stored)
 *   2. frozen final result        (resultSummary, written once at terminal)
 *   3. live Candidate state       (linked counts — LIVE, clearly labelled)
 *   4. live Application state     (linked counts — LIVE, clearly labelled)
 *   5. all email attempts         (per-status tally of every attempt)
 * Nothing is recomputed from live state into the frozen result.
 */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { buildBatchReport, listBatchEmailAttempts } from "@/infrastructure/services/import-batch.service";

export const runtime = "nodejs";

interface Params { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const ctx = await requireHR({ roles: ["admin", "hr_manager", "hr_officer"] });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const report = await buildBatchReport(ctx.organizationId, id);
  if (!report) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  // Section 5: every e-mail attempt for this batch, with full status detail.
  const attempts = await listBatchEmailAttempts(ctx.organizationId, id);

  return NextResponse.json({
    ok: true,
    batch: report.batch,                     // 1. frozen batch snapshot
    resultSummary: report.resultSummary,     // 2. frozen final result (once)
    itemStatusCounts: report.itemStatusCounts,
    live: report.live,                       // 3+4. live candidate/application state
    attempts,                                // 5. all email attempts
  });
}
