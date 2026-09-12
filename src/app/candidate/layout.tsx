import { auth } from "@/infrastructure/auth/auth";
import { redirect } from "next/navigation";
import { PortalNavbar } from "@/components/layout/PortalNavbar";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || session.user.sessionType !== "candidate") {
    redirect("/auth/candidate");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-beige)" }}>
      <PortalNavbar type="candidate" />
      <main className="pt-16">{children}</main>
    </div>
  );
}
