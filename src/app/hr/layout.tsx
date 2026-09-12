import { auth } from "@/infrastructure/auth/auth";
import { redirect } from "next/navigation";
import { PortalNavbar } from "@/components/layout/PortalNavbar";

export default async function HRLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || session.user.sessionType !== "hr_user") {
    redirect("/auth/login?type=hr");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-beige)" }}>
      <PortalNavbar type="hr" />
      <main className="pt-16">{children}</main>
    </div>
  );
}
