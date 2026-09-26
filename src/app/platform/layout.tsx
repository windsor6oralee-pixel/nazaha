import type { ReactNode } from "react";
import { getPlatformContext } from "@/infrastructure/tenant";
import { AppShell } from "@/components/layout/AppShell";

// Access is enforced in middleware; this layout only decides whether to show the console chrome.
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const ctx = await getPlatformContext();
  if (!ctx) return <div dir="rtl">{children}</div>;

  return (
    <AppShell
      nav={[{ items: [{ href: "/platform", label: "الجهات المشتركة", icon: "dashboard", exact: true }] }]}
      homeHref="/platform"
      signOutUrl="/platform/login"
      userName={ctx.nameAr}
      context="إدارة المنصة"
    >
      {children}
    </AppShell>
  );
}
