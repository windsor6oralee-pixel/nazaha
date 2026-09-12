import { CheckCircle, Circle, Clock } from "lucide-react";
import type { OnboardingStep } from "@/types";

interface ProgressTrackerProps {
  steps: OnboardingStep[];
  completionPercentage: number;
}

const statusIcons = {
  completed: CheckCircle,
  in_progress: Clock,
  pending: Circle,
  skipped: Circle,
};

const statusStyle: Record<OnboardingStep["status"], React.CSSProperties> = {
  completed: {
    color: "#227A4E",
    background: "#E8F5EE",
    borderColor: "rgba(34,122,78,0.3)",
  },
  in_progress: {
    color: "#1D5FA8",
    background: "#EBF2FB",
    borderColor: "rgba(29,95,168,0.35)",
    boxShadow: "0 0 0 3px rgba(29,95,168,0.1)",
  },
  pending: {
    color: "var(--color-text-muted)",
    background: "var(--color-surface)",
    borderColor: "var(--color-border)",
  },
  skipped: {
    color: "var(--color-text-muted)",
    background: "var(--color-surface-alt)",
    borderColor: "var(--color-border)",
    opacity: 0.6,
  },
};

const textStyle: Record<OnboardingStep["status"], React.CSSProperties> = {
  completed: { color: "#195C30" },
  in_progress: { color: "#1D5FA8" },
  pending: { color: "var(--color-text-muted)" },
  skipped: { color: "var(--color-text-muted)" },
};

export function ProgressTracker({ steps, completionPercentage }: ProgressTrackerProps) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-base" style={{ color: "var(--color-dark)", fontFamily: "'Noto Kufi Arabic', sans-serif" }}>
            تقدم رحلتك
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>خطوة بخطوة نحو الانطلاقة</p>
        </div>
        <div className="text-left">
          <p className="text-2xl font-bold" style={{ color: "var(--color-primary)", fontFamily: "'Inter', sans-serif" }}>
            {completionPercentage}%
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>مكتمل</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full mb-6 overflow-hidden" style={{ background: "var(--color-border)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${completionPercentage}%`,
            background: `linear-gradient(to left, var(--color-primary), var(--color-primary-dark))`,
            transition: `width var(--motion-slow) var(--ease-enter)`,
          }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, index) => {
          const Icon = statusIcons[step.status];
          return (
            <div
              key={step.id}
              className="flex items-center gap-3 p-3 rounded-xl border"
              style={{
                ...statusStyle[step.status],
                transition: `background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard)`,
              }}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={textStyle[step.status]}>
                  {step.title}
                </p>
                {step.status === "in_progress" && (
                  <p className="text-xs mt-0.5" style={{ color: "#1D5FA8" }}>{step.description}</p>
                )}
              </div>
              <span className="text-xs flex-shrink-0" style={{ color: "var(--color-text-muted)", fontFamily: "'Inter', sans-serif" }}>
                {index + 1}/{steps.length}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
