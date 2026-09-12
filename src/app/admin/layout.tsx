import { redirect } from "next/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { PortalNavbar } from "@/components/layout/PortalNavbar";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user || session.user.sessionType !== "hr_user") {
    redirect("/auth/login");
  }

  if (!["admin", "hr_manager"].includes(session.user.role ?? "")) {
    redirect("/hr");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-beige)" }}>
      <PortalNavbar type="hr" />
      <main className="pt-16">{children}</main>
    </div>
  );
}
