/**
 * GET /api/hr/emails — paginated outbound email log for this tenant.
 * Query params: search, status, from (ISO date), to (ISO date), cursor, limit.
 */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { listEmailsForOrg, getEmailSummaryForOrg, type EmailStatusCode } from "@/infrastructure/notifications/email-log.service";

export async function GET(req: Request) {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")  ?? undefined;
  const status = (url.searchParams.get("status") as EmailStatusCode | null) ?? undefined;
  const fromS  = url.searchParams.get("from");
  const toS    = url.searchParams.get("to");
  const limit  = Number(url.searchParams.get("limit") ?? "25");
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const [list, summary] = await Promise.all([
    listEmailsForOrg(ctx.organizationId, {
      search, status,
      from: fromS ? new Date(fromS) : undefined,
      to:   toS   ? new Date(toS)   : undefined,
      limit, cursor,
    }),
    getEmailSummaryForOrg(ctx.organizationId),
  ]);
  return NextResponse.json({ ...list, summary });
}
