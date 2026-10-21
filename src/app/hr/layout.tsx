import { redirect } from "next/navigation";
import { getTenantContext } from "@/infrastructure/tenant";
import { PortalShell } from "@/components/layout/PortalShell";

export default async function HRLayout({ children }: { children: React.ReactNode }) {
  // getTenantContext also verifies the user and organization are still active.
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "hr") {
    redirect("/auth/login?type=hr");
  }

  return (
    <PortalShell type="hr" ctx={ctx}>{children}</PortalShell>
  );
}
