import type { ReactNode } from "react";
import { auth } from "@/infrastructure/auth/auth";
import { getPlatformContext } from "@/infrastructure/tenant";
import { AppShell } from "@/components/layout/AppShell";
import { PlatformSessionExpired } from "@/components/platform/PlatformSessionExpired";

// Access is enforced in middleware; this layout only decides whether to show the console chrome.
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const ctx = await getPlatformContext();
  if (!ctx) {
    // الرمز ما زال موقّعاً لكن الحساب لم يعد صالحاً (تغيّرت كلمة المرور أو
    // أُوقف) — نعرض شاشة إنهاء الجلسة بدل ترك المستخدم داخل بوابة بلا صلاحية.
    const session = await auth();
    if (session?.user?.sessionType === "platform_admin") {
      return <PlatformSessionExpired />;
    }
    return <div dir="rtl">{children}</div>;
  }

  return (
    <AppShell
      nav={[
        { items: [{ href: "/platform", label: "الجهات المشتركة", icon: "dashboard", exact: true }] },
        {
          label: "الإدارة",
          items: [{ href: "/platform/accounts", label: "حسابات الدخول", icon: "profile" }],
        },
      ]}
      homeHref="/platform"
      signOutUrl="/platform/login"
      userName={ctx.nameAr}
      context="إدارة المنصة"
    >
      {children}
    </AppShell>
  );
}
