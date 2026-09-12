import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: "green" | "blue" | "gold" | "red" | "muted";
  trend?: string;
}

const colorMap: Record<StatCardProps["color"], {
  bg: string; iconBg: string; iconColor: string; valueColor: string; trendColor: string;
}> = {
  green: {
    bg: "var(--color-success-bg)",
    iconBg: "rgba(34,122,78,0.15)",
    iconColor: "var(--color-success)",
    valueColor: "var(--color-success)",
    trendColor: "var(--color-success)",
  },
  blue: {
    bg: "#EBF2FB",
    iconBg: "rgba(29,95,168,0.15)",
    iconColor: "#1D5FA8",
    valueColor: "#1D5FA8",
    trendColor: "#1D5FA8",
  },
  gold: {
    bg: "var(--color-gold-muted)",
    iconBg: "rgba(201,169,74,0.2)",
    iconColor: "var(--color-gold-dark)",
    valueColor: "var(--color-gold-dark)",
    trendColor: "var(--color-gold-dark)",
  },
  red: {
    bg: "var(--color-error-bg)",
    iconBg: "rgba(168,58,48,0.15)",
    iconColor: "var(--color-error)",
    valueColor: "var(--color-error)",
    trendColor: "var(--color-error)",
  },
  muted: {
    bg: "var(--color-surface-alt)",
    iconBg: "rgba(110,118,115,0.15)",
    iconColor: "var(--color-text-muted)",
    valueColor: "var(--color-text-muted)",
    trendColor: "var(--color-text-muted)",
  },
};

export function StatCard({ label, value, icon: Icon, color, trend }: StatCardProps) {
  const c = colorMap[color];

  return (
    <div
      className="stat-card card-animate rounded-2xl border p-5"
      style={{
        background: c.bg,
        borderColor: "var(--color-border)",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
            {label}
          </p>
          <p className="text-3xl font-bold mt-1" style={{ color: c.valueColor, fontFamily: "'Inter', sans-serif" }}>
            {value}
          </p>
          {trend && (
            <p className="text-xs mt-1" style={{ color: c.trendColor, fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
              {trend}
            </p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: c.iconBg }}
        >
          <Icon className="w-5 h-5" style={{ color: c.iconColor }} />
        </div>
      </div>
    </div>
  );
}
