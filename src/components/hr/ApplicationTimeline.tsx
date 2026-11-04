import { Card } from "@/components/ui/Card";
import { ACTION_LABELS } from "@/infrastructure/audit/audit.service";
import { APPLICATION_STATUS_AR } from "@/infrastructure/applications/lifecycle";
import type { ApplicationStatus } from "@prisma/client";

export interface TimelineEntry {
  id: string;
  action: string;
  actorType: string;
  actorName: string | null;
  createdAt: Date;
  metadata: unknown;
}

function describe(e: TimelineEntry): string {
  const label = ACTION_LABELS[e.action] ?? e.action;
  const meta = (e.metadata ?? {}) as { to?: string; reason?: string | null };
  if (e.action === "application.status_changed" && meta.to) {
    return `${label}: ${APPLICATION_STATUS_AR[meta.to as ApplicationStatus] ?? meta.to}`;
  }
  return label;
}

/* سجل الطلب زمنياً — من سجل التدقيق نفسه، فلا يمكن أن يخالفه. */
export function ApplicationTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <Card title="سجل الطلب" description="آخر الأحداث على هذا الطلب" className="mt-6">
      {entries.length === 0 ? (
        <p className="ds-caption" style={{ margin: 0, color: "var(--ink-muted)" }}>لا توجد أحداث بعد</p>
      ) : (
        <ol className="flex flex-col gap-3" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {entries.map((e) => {
            const reason = (e.metadata as { reason?: string | null } | null)?.reason;
            return (
              <li key={e.id} style={{ borderInlineStart: "2px solid var(--border-100)", paddingInlineStart: "var(--space-12)" }}>
                <p style={{ margin: 0, fontWeight: 600, color: "var(--ink)" }}>{describe(e)}</p>
                {reason && <p className="ds-caption" style={{ margin: "2px 0 0", color: "var(--ink-muted)" }}>{reason}</p>}
                <p className="ds-caption font-numeric" style={{ margin: "2px 0 0", color: "var(--ink-muted)" }}>
                  {e.actorType === "CANDIDATE" ? "المرشح" : e.actorType === "SYSTEM" ? "النظام" : e.actorName ?? "موظف"}
                  {" · "}
                  {e.createdAt.toLocaleString("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
