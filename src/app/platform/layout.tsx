import type { ReactNode } from "react";
import { getPlatformContext } from "@/infrastructure/tenant";
import { PlatformHeader } from "@/components/platform/PlatformHeader";

// Access is enforced in middleware; this layout only decides whether to show the console chrome.
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const ctx = await getPlatformContext();

  return (
    <div className="min-h-screen" style={{ background: "var(--color-beige)" }} dir="rtl">
      {ctx && <PlatformHeader adminName={ctx.nameAr} />}
      <main className={ctx ? "pt-16" : ""}>{children}</main>
    </div>
  );
}
