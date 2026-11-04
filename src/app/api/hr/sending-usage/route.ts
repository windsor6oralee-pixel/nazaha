/**
 * GET /api/hr/sending-usage
 *
 * HR-facing summary of this tenant's send capacity for the current UTC day.
 * Driven by the live per-mailbox counter and the active sending policy.
 * Response is intentionally small so the dashboard widget can poll it cheaply.
 */
import { NextResponse } from "next/server";
import { requireHR } from "@/infrastructure/tenant";
import { getMailboxPool } from "@/infrastructure/notifications/mailbox-pool-config.service";
import { getSendingPolicy, summarizeCapacity } from "@/infrastructure/notifications/sending-policy.service";
import { getUsageMap } from "@/infrastructure/notifications/usage-tracker.service";

export async function GET() {
  const ctx = await requireHR();
  if (ctx instanceof NextResponse) return ctx;
  const orgId = ctx.organizationId;

  const [pool, policy, usage] = await Promise.all([
    getMailboxPool(orgId),
    getSendingPolicy(orgId),
    getUsageMap(orgId),
  ]);

  if (!pool || !pool.length) {
    return NextResponse.json({
      configured: false,
      cap: policy.dailyCapPerMailbox,
      used: 0,
      totalCap: 0,
      remaining: 0,
      mode: policy.mode,
      byDomain: [],
    });
  }

  const summary = summarizeCapacity(pool, policy, usage);
  return NextResponse.json({
    configured: true,
    mode: policy.mode,
    ...summary,
  });
}
