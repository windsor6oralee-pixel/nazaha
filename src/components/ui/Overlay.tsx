"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

/*
 * Modal: تعتيم 200ms وتكبير 0.96←1 بمدة 300ms يبدآن معا، والمحتوى بعد 120ms.
 * الإغلاق بالعكس بـ 210ms. role="dialog" + aria-modal، Escape يغلق، والتركيز يعود لمن فتحها.
 * Drawer: انزلاق من اليمين 300ms.
 */

const CLOSE_MS = 210;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useOverlay(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  // Mount/unmount is derived from `open` with an exit animation in between.
  useEffect(() => {
    if (open) {
      returnTo.current = document.activeElement as HTMLElement | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing mount state to the open prop drives the exit animation
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
      returnTo.current?.focus?.();
    }, CLOSE_MS);
    return () => clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted || closing) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const a = items[0], b = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
      else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted, closing, onClose]);

  return { mounted, closing, panelRef };
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  /** الأزرار: التأكيد primary أولا ثم الإلغاء secondary. */
  actions?: ReactNode;
  wide?: boolean;
  /** يمنع الإغلاق بالنقر على الخلفية (للإجراءات الإلزامية). */
  dismissible?: boolean;
}

export function Modal({ open, onClose, title, children, actions, wide, dismissible = true }: ModalProps) {
  const noop = useCallback(() => {}, []);
  const { mounted, closing, panelRef } = useOverlay(open, dismissible ? onClose : noop);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div className="nz-modal" data-closing={closing || undefined} dir="rtl">
      <div className="nz-modal__scrim" onClick={dismissible ? onClose : undefined} />
      <div className="nz-modal__frame" onClick={(e) => { if (dismissible && e.target === e.currentTarget) onClose(); }}>
        <div ref={panelRef} className={cn("nz-modal__panel", wide && "nz-modal__panel--wide")} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}>
          <div className="nz-modal__inner">
            <div className="nz-modal__head">
              <h2 className="nz-modal__title">{title}</h2>
              {dismissible && (
                <button type="button" className="nz-modal__close" onClick={onClose} aria-label="إغلاق">
                  <Icon name="close" size={20} label={false} />
                </button>
              )}
            </div>
            {children && <div className="nz-modal__body">{children}</div>}
            {actions && <div className="nz-modal__actions">{actions}</div>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title?: ReactNode; children?: ReactNode }) {
  const { mounted, closing, panelRef } = useOverlay(open, onClose);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div className="nz-drawer nz-modal" data-closing={closing || undefined} dir="rtl">
      <div className="nz-modal__scrim" onClick={onClose} />
      <div ref={panelRef} className="nz-drawer__panel" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}>
        <div className="nz-modal__head">
          {title && <h2 className="nz-modal__title">{title}</h2>}
          <button type="button" className="nz-modal__close" onClick={onClose} aria-label="إغلاق">
            <Icon name="close" size={20} label={false} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
