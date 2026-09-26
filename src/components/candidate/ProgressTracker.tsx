import type { OnboardingStep } from "@/types";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { StatusDot, type BadgeTone } from "@/components/ui/Badge";

interface ProgressTrackerProps {
  steps: OnboardingStep[];
  completionPercentage: number;
}

const stepTone: Record<OnboardingStep["status"], BadgeTone> = {
  completed: "done",
  in_progress: "review",
  pending: "neutral",
  skipped: "neutral",
};

const stepLabel: Record<OnboardingStep["status"], string> = {
  completed: "مكتملة",
  in_progress: "قيد الإنجاز",
  pending: "لم تبدأ",
  skipped: "متجاوزة",
};

export function ProgressTracker({ steps, completionPercentage }: ProgressTrackerProps) {
  return (
    <Card title="تقدم رحلتك" description="خطوة بخطوة نحو الانطلاقة">
      <Progress value={completionPercentage} label="مكتمل" />

      <ol className="flex flex-col gap-2" style={{ listStyle: "none", padding: 0, margin: "var(--space-24) 0 0" }}>
        {steps.map((step, index) => {
          const current = step.status === "in_progress";
          return (
            <li
              key={step.id}
              aria-current={current ? "step" : undefined}
              className="flex items-center gap-4 p-4 rounded-12 border bg-surface-000"
              style={{
                borderColor: current ? "var(--gold-500)" : "var(--border-100)",
                opacity: step.status === "skipped" ? 0.6 : 1,
              }}
            >
              <span
                className="font-numeric text-ink-muted"
                style={{ fontSize: 13, flex: "none" }}
              >
                {index + 1}/{steps.length}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-ink" style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
                  {step.title}
                </p>
                {current && (
                  <p className="text-ink-muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
                    {step.description}
                  </p>
                )}
              </div>
              <StatusDot tone={stepTone[step.status]}>{stepLabel[step.status]}</StatusDot>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
