"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Play } from "lucide-react";

export function OrganizationActiveToggle({ id, isActive, nameAr }: { id: string; isActive: boolean; nameAr: string }) {
  const router = useRouter();
  const [isPending, start] = useTransition();

  function toggle() {
    const next = !isActive;
    if (!confirm(next ? `تفعيل "${nameAr}"؟` : `إيقاف "${nameAr}"؟ لن يتمكن موظفوها من الدخول حتى إعادة التفعيل.`)) return;
    start(async () => {
      await fetch(`/api/platform/organizations/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: next }),
      });
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={toggle} disabled={isPending}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border flex-shrink-0"
      style={{
        borderColor: isActive ? "rgba(168,58,48,0.3)" : "var(--color-primary)",
        color: isActive ? "var(--color-error)" : "var(--color-primary)",
        background: isActive ? "var(--color-error-bg)" : "var(--color-primary-muted)",
        cursor: "pointer",
      }}>
      {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      {isActive ? "إيقاف" : "تفعيل"}
    </button>
  );
}
