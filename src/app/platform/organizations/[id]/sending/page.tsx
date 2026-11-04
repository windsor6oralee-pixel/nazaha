import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/infrastructure/tenant";
import { prisma } from "@/infrastructure/database/client";
import { getMailboxPool } from "@/infrastructure/notifications/mailbox-pool-config.service";
import { getSendingPolicy, domainsIn } from "@/infrastructure/notifications/sending-policy.service";
import { SendingPolicyEditor } from "@/components/platform/SendingPolicyEditor";

export default async function SendingPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;

  const org = await prisma.organization.findUnique({ where: { id }, select: { id: true, nameAr: true } });
  if (!org) return notFound();

  const { getUsageMap } = await import("@/infrastructure/notifications/usage-tracker.service");
  const { summarizeCapacity } = await import("@/infrastructure/notifications/sending-policy.service");
  const [policy, pool, usage] = await Promise.all([
    getSendingPolicy(id),
    getMailboxPool(id),
    getUsageMap(id),
  ]);
  const availableDomains = pool ? domainsIn(pool) : [];
  const todaySummary = pool && pool.length ? summarizeCapacity(pool, policy, usage) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/platform" className="hover:underline" style={{ color: "var(--color-primary)" }}>الجهات المشتركة</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: "var(--color-dark)" }}>خطة الإرسال — {org.nameAr}</span>
      </div>

      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-gold)" }}>إدارة المنصة</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-dark)" }}>خطة الإرسال — {org.nameAr}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          حدِّد الدومينات التي يُسمح لهذه الجهة الإرسال منها، وطريقة توزيع الحمل بينها.
        </p>
      </div>

      <SendingPolicyEditor
        organizationId={org.id}
        organizationName={org.nameAr}
        initial={policy}
        availableDomains={availableDomains}
        hasPool={!!(pool && pool.length)}
        poolSize={pool?.length ?? 0}
        todaySummary={todaySummary}
      />
    </div>
  );
}
