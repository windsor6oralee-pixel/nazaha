import { redirect } from "next/navigation";
import { getTenantContext } from "@/infrastructure/tenant";
import { PortalNavbar } from "@/components/layout/PortalNavbar";
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
    <div className="min-h-screen" style={{ background: "var(--color-beige)" }}>
      <PortalNavbar type="hr" />
      <main className="pt-16">{children}</main>
    </div>
  );
}
