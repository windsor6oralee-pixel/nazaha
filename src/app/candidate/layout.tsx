import { redirect } from "next/navigation";
import { getTenantContext } from "@/infrastructure/tenant";
import { PortalShell } from "@/components/layout/PortalShell";
import { CandidateHeartbeat } from "@/components/candidate/CandidateHeartbeat";
import { AlertGate } from "@/components/candidate/AlertGate";
import { PushPermissionBanner } from "@/components/candidate/PushPermissionBanner";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  // getTenantContext also verifies the organization is still active.
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "candidate") {
    redirect("/auth/candidate");
  }

  return (
    <PortalShell type="candidate" ctx={ctx}>
      <CandidateHeartbeat />
      <AlertGate />
      <PushPermissionBanner />
      {children}
    </PortalShell>
  );
}
