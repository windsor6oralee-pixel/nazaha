"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Progress } from "@/components/ui/Progress";

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

  const startDateLabel = new Date(startDate).toLocaleDateString("ar-SA-u-nu-latn", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (remainingDays < 0) return null;

  return (
    <Card>
      <div className="flex items-center gap-2" style={{ marginBottom: "var(--space-16)" }}>
        <Icon name="calendar" size={24} label={false} className="text-green-700" />
        <p className="text-ink" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
          {remainingDays === 0
            ? `${firstName}، اليوم هو يوم مباشرتك!`
            : `${firstName}، ${remainingDays} ${remainingDays === 1 ? "يوم" : "أيام"} حتى المباشرة`}
        </p>
      </div>

      <Progress value={progress} showValue={false} />

      <p className="text-ink-muted" style={{ margin: "var(--space-16) 0 0", fontSize: 13 }}>
        {startDateLabel}
      </p>
    </Card>
  );
}
