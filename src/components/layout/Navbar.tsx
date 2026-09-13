"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { NazahaLogo } from "@/components/ui/NazahaLogo";
import { OnlineBadge } from "@/components/hr/OnlineBadge";

interface NavbarProps {
  type: "candidate" | "hr";
  userName?: string;
  orgName?: string;
  orgLogoUrl?: string | null;
  headerColor?: string | null;
  showAdmin?: boolean;
}

export function Navbar({ type, userName, orgName, orgLogoUrl, headerColor, showAdmin }: NavbarProps) {
  const pathname = usePathname();

  const hrLinks = [
    { href: "/hr",            label: "لوحة التحكم" },
    { href: "/hr/candidates", label: "المرشحون" },
    { href: "/hr/reports",    label: "التقارير" },
    ...(showAdmin ? [{ href: "/admin", label: "الإعدادات" }] : []),
  ];

  const candidateLinks = [
    { href: "/candidate",           label: "رحلتي" },
    { href: "/candidate/documents", label: "المستندات" },
    { href: "/candidate/contract",  label: "العقد" },
  ];

  const links = type === "hr" ? hrLinks : candidateLinks;
  const homeHref = type === "hr" ? "/hr" : "/candidate";
  const signoutUrl = type === "hr" ? "/auth/login" : "/auth/candidate";

  function isActive(href: string) {
    if (href === "/hr" || href === "/candidate") return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <header
      className="fixed top-0 inset-x-0 z-50"
      dir="rtl"
      style={{ background: headerColor || "var(--color-primary-dark)" }}
    >
      {/* Gold top accent line */}
      <div style={{ height: 3, background: "var(--color-gold)" }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: 60 }}>

          {/* Logo + tenant identity */}
          <Link
            href={homeHref}
            className="flex items-center gap-3 min-w-0"
            style={{ outline: "none" }}
          >
            <NazahaLogo variant="light" size="sm" />
            {orgName && (
              <>
                <span aria-hidden style={{ width: 1, height: 28, background: "rgba(255,255,255,0.2)" }} />
                <span className="flex items-center gap-2 min-w-0">
                  {orgLogoUrl && (
                    <img
                      src={orgLogoUrl}
                      alt=""
                      className="w-7 h-7 rounded-md object-contain flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.9)", padding: 2 }}
                    />
                  )}
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: "rgba(255,255,255,0.85)", fontFamily: "'Noto Kufi Arabic', sans-serif", maxWidth: 200 }}
                  >
                    {orgName}
                  </span>
                </span>
              </>
            )}
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                  style={{
                    fontFamily: "'Noto Kufi Arabic', sans-serif",
                    color: active ? "#FFFFFF" : "rgba(255,255,255,0.65)",
                    background: active ? "rgba(201,169,74,0.15)" : "transparent",
                    transition: `background var(--motion-fast) var(--ease-enter),
                                 color var(--motion-fast) var(--ease-enter)`,
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {link.label}
                  {active && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: 12,
                        right: 12,
                        height: 2,
                        borderRadius: 9999,
                        background: "var(--color-gold)",
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User info + sign out */}
          <div className="flex items-center gap-3">
            {type === "hr" && <OnlineBadge />}
            {userName && (
              <div className="hidden sm:flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: "rgba(201,169,74,0.2)",
                    color: "var(--color-gold-light)",
                    border: "1px solid rgba(201,169,74,0.35)",
                    fontFamily: "'Noto Kufi Arabic', sans-serif",
                  }}
                >
                  {userName.charAt(0)}
                </div>
                <span
                  className="text-sm"
                  style={{ color: "rgba(255,255,255,0.85)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
                >
                  {userName}
                </span>
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: signoutUrl })}
              className="flex items-center gap-1.5 text-xs px-3 rounded-lg transition-colors"
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                color: "rgba(255,255,255,0.7)",
                background: "transparent",
                height: 36,
                fontFamily: "'IBM Plex Sans Arabic', sans-serif",
                transition: `background var(--motion-fast) var(--ease-enter),
                             color var(--motion-fast) var(--ease-enter)`,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)";
                (e.currentTarget as HTMLButtonElement).style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)";
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
