"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, X } from "lucide-react";

const noopSubscribe = () => () => {};

function shouldShowBanner() {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "default") return false;
  try { return !localStorage.getItem("push-banner-dismissed"); } catch { return false; }
}

export function PushPermissionBanner() {
  const [show, setShow] = useState(shouldShowBanner);
  // False during SSR and hydration, true afterwards — keeps server and client markup identical.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  function dismiss() {
    try { localStorage.setItem("push-banner-dismissed", "1"); } catch {}
    setShow(false);
  }

  async function requestPermission() {
    try {
      await Notification.requestPermission();
    } catch {}
    dismiss();
  }

  if (!hydrated || !show) return null;

  return (
    <div
      dir="rtl"
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        background: "var(--color-primary-dark)",
        color: "white",
        borderRadius: 16,
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
        maxWidth: "calc(100vw - 32px)",
        width: 420,
      }}
    >
      <Bell className="w-5 h-5 flex-shrink-0" style={{ color: "var(--color-gold-light)" }} />
      <p style={{ flex: 1, fontSize: 14, lineHeight: 1.5 }}>
        فعّل الإشعارات لتصلك تنبيهات الموارد البشرية فور صدورها
      </p>
      <button
        onClick={requestPermission}
        style={{
          background: "var(--color-gold)",
          color: "#1a1a1a",
          border: "none",
          borderRadius: 8,
          padding: "6px 14px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        تفعيل
      </button>
      <button
        onClick={dismiss}
        aria-label="إغلاق"
        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", padding: 4 }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
