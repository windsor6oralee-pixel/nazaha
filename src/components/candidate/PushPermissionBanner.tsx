"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

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

  // Rendered in the content flow at the top of <main> (no fixed positioning), aligned to the page width.
  return (
    <div className="nz-page" style={{ marginBottom: "var(--space-24)" }}>
      <div
        dir="rtl"
        role="region"
        aria-label="تفعيل الإشعارات"
        className="nz-alert nz-alert--gold nz-enter"
        style={{ alignItems: "center", flexWrap: "wrap" }}
      >
        <Icon name="notifications" size={20} label={false} style={{ marginTop: 0 }} />
        <p style={{ flex: "1 1 220px", margin: 0, lineHeight: 1.5 }}>
          فعّل الإشعارات لتصلك تنبيهات الموارد البشرية فور صدورها
        </p>
        <div className="flex items-center gap-2" style={{ flex: "none" }}>
          <Button variant="secondary" icon="notifications" onClick={requestPermission}>
            تفعيل الإشعارات
          </Button>
          <button type="button" onClick={dismiss} aria-label="إغلاق" className="nz-modal__close" style={{ margin: 0 }}>
            <Icon name="close" size={20} label={false} />
          </button>
        </div>
      </div>
    </div>
  );
}
