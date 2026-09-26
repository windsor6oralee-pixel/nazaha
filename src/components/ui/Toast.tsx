"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/*
 * تنبيه عائم: green-900 بنص ink-invert وحد جانبي بلون الحالة. يظهر 250ms، يبقى 4 ثوان،
 * ويختفي 175ms. قابل للإغلاق فورا. لا يستخدم للأخطاء التي تمنع المتابعة.
 */
type Tone = "success" | "error";
interface ToastItem { id: number; message: string; tone: Tone; leaving?: boolean }

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const STAY_MS = 4000;
const LEAVE_MS = 175;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((all) => all.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((all) => all.filter((t) => t.id !== id)), LEAVE_MS);
  }, []);

  const show = useCallback((message: string, tone: Tone = "success") => {
    const id = ++seq.current;
    setItems((all) => [...all, { id, message, tone }]);
    setTimeout(() => dismiss(id), STAY_MS);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="nz-toasts" dir="rtl">
        {items.map((t) => (
          <div
            key={t.id}
            className={`nz-toast nz-toast--${t.tone}`}
            role={t.tone === "error" ? "alert" : "status"}
            data-leaving={t.leaving || undefined}
          >
            <Icon name={t.tone === "error" ? "flag" : "approved"} size={20} label={false} />
            <span>{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="إغلاق التنبيه">
              <Icon name="close" size={16} label={false} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
