/**
 * GET  /api/platform/organizations/[id]/sending — current policy + available domains
 * PATCH /api/platform/organizations/[id]/sending — platform admin updates policy
 *
 * The "available domains" set is derived from the mailbox pool the org already
 * provisioned (via scripts/connect_inboxkit_pool). An org with no pool returns
 * an empty list and the UI tells the admin to run the connector first.
 */
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/infrastructure/tenant";
import { prisma } from "@/infrastructure/database/client";
import { getMailboxPool } from "@/infrastructure/notifications/mailbox-pool-config.service";
import {
  getSendingPolicy,
  saveSendingPolicy,
  domainsIn,
  type SendingPolicy,
} from "@/infrastructure/notifications/sending-policy.service";

interface Ctx { params: Promise<{ id: string }> }

async function loadOrgOrDeny(id: string) {
  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, nameAr: true },
  });
  if (!org) return null;
  return org;
}

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await requirePlatformAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const org = await loadOrgOrDeny(id);
  if (!org) return NextResponse.json({ error: "الجهة غير موجودة" }, { status: 404 });

  const { getUsageMap } = await import("@/infrastructure/notifications/usage-tracker.service");
  const { summarizeCapacity } = await import("@/infrastructure/notifications/sending-policy.service");
  const [policy, pool, usage] = await Promise.all([
    getSendingPolicy(id),
    getMailboxPool(id),
    getUsageMap(id),
  ]);

  const domains = pool ? domainsIn(pool) : [];
  const todaySummary = pool && pool.length ? summarizeCapacity(pool, policy, usage) : null;
  return NextResponse.json({
    organization: { id: org.id, nameAr: org.nameAr },
    policy,
    availableDomains: domains,
    hasPool: !!(pool && pool.length),
    poolSize: pool?.length ?? 0,
    todaySummary,
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await requirePlatformAdmin();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const org = await loadOrgOrDeny(id);
  if (!org) return NextResponse.json({ error: "الجهة غير موجودة" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Partial<SendingPolicy>;
  const saved = await saveSendingPolicy(id, body);
  return NextResponse.json({ policy: saved });
}
