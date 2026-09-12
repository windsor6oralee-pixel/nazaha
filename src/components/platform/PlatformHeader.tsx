"use client";

import { signOut } from "next-auth/react";
import { LogOut, ServerCog } from "lucide-react";
import { NazahaLogo } from "@/components/ui/NazahaLogo";

export function PlatformHeader({ adminName }: { adminName: string }) {
  return (
    <header className="fixed top-0 inset-x-0 z-50" dir="rtl" style={{ background: "#0B1F18" }}>
      <div style={{ height: 3, background: "var(--color-gold)" }} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between" style={{ height: 60 }}>
        <div className="flex items-center gap-3">
          <NazahaLogo variant="light" size="sm" />
          <span aria-hidden style={{ width: 1, height: 28, background: "rgba(255,255,255,0.2)" }} />
          <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--color-gold-light)", fontFamily: "'Noto Kufi Arabic', sans-serif" }}>
            <ServerCog className="w-4 h-4" /> إدارة المنصة
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>{adminName}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/platform/login" })}
            className="flex items-center gap-1.5 text-xs px-3 rounded-lg"
            style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", background: "transparent", height: 36, cursor: "pointer" }}
          >
            <LogOut className="w-3.5 h-3.5" /> خروج
          </button>
        </div>
      </div>
    </header>
  );
}
