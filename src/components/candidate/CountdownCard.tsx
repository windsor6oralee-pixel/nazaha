"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";

interface CountdownCardProps {
  firstName: string;
  startDate: string;
  acceptanceDate: string;
}

export function CountdownCard({ firstName, startDate, acceptanceDate }: CountdownCardProps) {
  // Captured once per mount so render stays pure (and SSR/CSR agree within the request).
  const [now] = useState(() => Date.now());
  const start = new Date(startDate).getTime();
  const accepted = new Date(acceptanceDate).getTime();

  const totalDays = Math.max(1, Math.round((start - accepted) / 86_400_000));
  const remainingDays = Math.round((start - now) / 86_400_000);
  const elapsed = totalDays - remainingDays;
  const progress = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));

  const startDateLabel = new Date(startDate).toLocaleDateString("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (remainingDays < 0) return null;

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: "white", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-primary)" }} />
        <p className="text-xs font-bold" style={{ color: "var(--color-dark)" }}>
          {remainingDays === 0
            ? `${firstName}، اليوم هو يوم مباشرتك!`
            : `${firstName}، ${remainingDays} ${remainingDays === 1 ? "يوم" : "أيام"} حتى المباشرة`}
        </p>
      </div>

      {/* Progress bar */}
      <div
        className="w-full rounded-full overflow-hidden mb-3"
        style={{ height: 6, background: "var(--color-border)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, var(--color-primary) 0%, var(--color-gold) 100%)",
          }}
        />
      </div>

      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        {startDateLabel}
      </p>
    </div>
  );
}
