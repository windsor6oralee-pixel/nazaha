"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

/*
 * هيكل الشاشة: قائمة جانبية ثابتة بعرض sidebar-width يمينا (green-900، العنصر المحدد
 * green-700 وأيقونته gold-500)، ثم ترويسة ثابتة، ثم المحتوى. القائمة والترويسة لا تتحركان
 * عند التمرير؛ انتقال الصفحة داخل منطقة المحتوى فقط. تحت 1024 بكسل تصبح القائمة درجا.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** يطابق المسار حرفيا بدل البادئة. */
  exact?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface AppShellProps {
  nav: NavGroup[];
  homeHref: string;
  signOutUrl: string;
  userName?: string;
  /** اسم الجهة وشعارها — يظهران تحت شعار المنصة. */
  orgName?: string | null;
  orgLogoUrl?: string | null;
  /** لون القائمة الجانبية حين تخصصه الجهة (افتراضيا green-900). */
  sideColor?: string | null;
  /** سطر تعريفي تحت اسم المنصة (مثلا «إدارة المنصة»). */
  context?: string;
  /** عناصر في طرف الترويسة (المتصلون الآن…). */
  headerEnd?: ReactNode;
  children: ReactNode;
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AppShell({
  nav, homeHref, signOutUrl, userName, orgName, orgLogoUrl, sideColor, context, headerEnd, children,
}: AppShellProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  // Close the mobile drawer after navigating.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route change is an external event
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setNavOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  // The most specific matching item names the page.
  const all = nav.flatMap((g) => g.items);
  const current = all
    .filter((i) => isActive(pathname, i))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <div className="nz-shell" data-nav-open={navOpen || undefined} dir="rtl">
      <a href="#main" className="sr-only-focusable nz-btn nz-btn--gold" style={{ position: "fixed", top: 8, insetInlineEnd: 8, zIndex: 200 }}>
        تخط إلى المحتوى
      </a>

      <aside className="nz-shell__side" style={sideColor ? { background: sideColor } : undefined} aria-label="القائمة الرئيسية" id="nz-side">
        <Link href={homeHref} className="nz-shell__brand">
          <span className="nz-shell__brand-plate">
            <Image src="/nazaha-logo.png" alt="شعار نزاهة التوظيف" width={40} height={40} priority />
          </span>
          <span>
            <span className="nz-shell__brand-name" style={{ display: "block" }}>نزاهة التوظيف</span>
            <span className="nz-shell__brand-sub" style={{ display: "block" }}>{context ?? "Nazaha Employment"}</span>
          </span>
        </Link>

        {orgName && (
          <div className="nz-shell__org">
            {orgLogoUrl && <img src={orgLogoUrl} alt="" />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{orgName}</span>
          </div>
        )}

        <nav className="nz-shell__nav">
          {nav.map((group, gi) => (
            <div key={gi} style={{ display: "contents" }}>
              {group.label && <div className="nz-shell__nav-label">{group.label}</div>}
              {group.items.map((item) => {
                const active = item === current;
                return (
                  <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
                    <Icon name={item.icon} size={24} label={false} filled={active} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="nz-shell__foot">
          {userName && (
            <div className="nz-shell__user">
              <span className="nz-shell__avatar" aria-hidden>{userName.charAt(0)}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</span>
            </div>
          )}
          <button type="button" className="nz-shell__signout" onClick={() => signOut({ callbackUrl: signOutUrl })}>
            <Icon name="close" size={20} label={false} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="nz-shell__scrim" onClick={() => setNavOpen(false)} aria-hidden />

      <div className="nz-shell__main">
        <header className="nz-shell__head">
          <div className="nz-shell__head-start">
            <button
              type="button"
              className="nz-shell__menu-btn"
              aria-label="فتح القائمة"
              aria-expanded={navOpen}
              aria-controls="nz-side"
              onClick={() => setNavOpen((o) => !o)}
            >
              <Icon name="dashboard" size={20} label={false} />
            </button>
            <p className="nz-shell__title">{current?.label ?? "نزاهة التوظيف"}</p>
          </div>
          {headerEnd && <div className="nz-shell__head-end">{headerEnd}</div>}
        </header>
        <main id="main" className="nz-shell__content" key={pathname}>
          {children}
        </main>
      </div>
    </div>
  );
}
