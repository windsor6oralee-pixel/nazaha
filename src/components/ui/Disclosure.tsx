"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/* ---------- Tabs — مؤشر ذهبي سفلي ينزلق 150ms ---------- */
export function Tabs({
  items, active: controlled, onChange, defaultActive = 0,
}: {
  items: { label: ReactNode; content: ReactNode }[];
  active?: number;
  onChange?: (i: number) => void;
  defaultActive?: number;
}) {
  const [inner, setInner] = useState(defaultActive);
  const active = controlled ?? inner;
  const id = useId();
  const select = (i: number) => { setInner(i); onChange?.(i); };
  return (
    <div>
      <div className="nz-tabs__list" role="tablist">
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            id={`${id}-t${i}`}
            aria-selected={i === active}
            aria-controls={`${id}-p${i}`}
            tabIndex={i === active ? 0 : -1}
            className="nz-tabs__tab"
            onClick={() => select(i)}
            onKeyDown={(e) => {
              // RTL: ArrowLeft moves forward.
              if (e.key === "ArrowLeft") select((active + 1) % items.length);
              if (e.key === "ArrowRight") select((active - 1 + items.length) % items.length);
            }}
          >
            {it.label}
          </button>
        ))}
      </div>
      <div className="nz-tabs__panel" role="tabpanel" id={`${id}-p${active}`} aria-labelledby={`${id}-t${active}`}>
        {items[active]?.content}
      </div>
    </div>
  );
}

/* تبويبات تنقل بين صفحات (روابط) بنفس شكل Tabs. */
export function TabLinks({ items }: { items: { href: string; label: ReactNode; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav className="nz-tabs__list" aria-label="أقسام الصفحة">
      {items.map((it) => {
        const current = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link key={it.href} href={it.href} className="nz-tabs__tab" aria-current={current ? "page" : undefined}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* ---------- Menu — قائمة منسدلة تكبير 0.95←1 بمدة 160ms ---------- */
export function Menu({
  trigger, items, label = "خيارات",
}: {
  trigger: (props: { onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" }) => ReactNode;
  items: { label: ReactNode; icon?: IconName; disabled?: boolean; onSelect?: () => void; href?: string }[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="nz-menu-anchor" ref={ref}>
      {trigger({ onClick: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu" })}
      {open && (
        <ul className="nz-menu" role="menu" aria-label={label}>
          {items.map((it, i) => (
            <li key={i} role="none">
              {it.href ? (
                <Link role="menuitem" href={it.href} onClick={() => setOpen(false)}>
                  {it.icon && <Icon name={it.icon} size={20} label={false} />}
                  {it.label}
                </Link>
              ) : (
                <button type="button" role="menuitem" disabled={it.disabled} onClick={() => { setOpen(false); it.onSelect?.(); }}>
                  {it.icon && <Icon name={it.icon} size={20} label={false} />}
                  {it.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Accordion — توسع 240ms بارتفاع تلقائي وشفافية ---------- */
export function Accordion({
  items, defaultOpen = -1,
}: { items: { title: ReactNode; content: ReactNode }[]; defaultOpen?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="nz-acc">
      {items.map((it, i) => {
        const isOpen = i === open;
        return (
          <div key={i} className="nz-acc__item" data-open={isOpen}>
            <button
              type="button"
              className="nz-acc__head"
              aria-expanded={isOpen}
              aria-controls={`${id}-${i}`}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              <span>{it.title}</span>
              <Icon name="chevron" size={20} label={false} className="nz-acc__chev" />
            </button>
            <div className="nz-acc__body" id={`${id}-${i}`} role="region" inert={!isOpen}>
              <div><div className="nz-acc__content">{it.content}</div></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
