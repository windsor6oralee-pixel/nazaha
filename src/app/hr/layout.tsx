import { redirect } from "next/navigation";
import { getTenantContext } from "@/infrastructure/tenant";
import { PortalNavbar } from "@/components/layout/PortalNavbar";

export default async function HRLayout({ children }: { children: React.ReactNode }) {
  // getTenantContext also verifies the user and organization are still active.
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "hr") {
    redirect("/auth/login?type=hr");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-beige)" }}>
      <PortalNavbar type="hr" />
      <main className="pt-16">{children}</main>
    </div>
  );
}
