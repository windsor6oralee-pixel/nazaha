import { redirect } from "next/navigation";
import { getTenantContext } from "@/infrastructure/tenant";
import { PortalShell } from "@/components/layout/PortalShell";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getTenantContext();

  if (!ctx || ctx.kind !== "hr") {
    redirect("/auth/login");
  }

  if (!["admin", "hr_manager"].includes(ctx.role)) {
    redirect("/hr");
  }

  return (
    <PortalShell type="hr">{children}</PortalShell>
  );
}
