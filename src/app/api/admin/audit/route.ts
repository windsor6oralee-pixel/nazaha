import { NextResponse } from "next/server";
import { requireHR, tenantPrisma } from "@/infrastructure/tenant";
import { listAuditLogs, parseAuditFilters } from "@/infrastructure/audit/audit.service";

// Read-only by design: the audit trail is append-only at the database level
// (REVOKE UPDATE/DELETE + trigger), and this module deliberately exports no
// mutating handlers — there is nothing here for PUT/PATCH/DELETE to call.

const ADMIN_ROLES = ["admin", "hr_manager"];

export async function GET(req: Request) {
  const ctx = await requireHR({ roles: ADMIN_ROLES });
  if (ctx instanceof NextResponse) return ctx;

  const sp = new URL(req.url).searchParams;
  const page = await listAuditLogs(tenantPrisma(ctx.organizationId), parseAuditFilters(sp), sp.get("cursor"));
  return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
}
