import { redirect } from "next/navigation";
import { getTenantContext } from "@/infrastructure/tenant";
import { PortalNavbar } from "@/components/layout/PortalNavbar";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  // getTenantContext also verifies the organization is still active.
  const ctx = await getTenantContext();
  if (!ctx || ctx.kind !== "candidate") {
    redirect("/auth/candidate");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-beige)" }}>
      <PortalNavbar type="candidate" />
      <main className="pt-16">{children}</main>
    </div>
  );
}
