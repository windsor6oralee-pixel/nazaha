/** GET /api/hr/stats — dashboard summary; refreshes the overview widget. */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { getDashboardStats } from "@/infrastructure/applications/dashboard-stats.service";

export async function GET() {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;
  const stats = await getDashboardStats(ctx.organizationId);
  return NextResponse.json(stats);
}
