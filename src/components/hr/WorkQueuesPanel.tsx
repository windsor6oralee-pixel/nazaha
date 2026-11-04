import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { WorkQueue } from "@/infrastructure/applications/work-queues.service";

function waited(days: number): string {
  if (days <= 0) return "اليوم";
  if (days === 1) return "منذ يوم";
  if (days === 2) return "منذ يومين";
  return days <= 10 ? `منذ ${days} أيام` : `منذ ${days} يوماً`;
}

/* مركز العمليات: ما ينتظر الموارد البشرية أولاً، ثم ما ينتظر المرشحين. */
export function WorkQueuesPanel({ queues }: { queues: WorkQueue[] }) {
  const ordered = [...queues].sort((a, b) => (a.owner === b.owner ? 0 : a.owner === "hr" ? -1 : 1));
  const hrTotal = queues.filter((q) => q.owner === "hr").reduce((n, q) => n + q.count, 0);

  return (
    <Card
      title="مركز العمليات"
      description={hrTotal > 0 ? `${hrTotal} عنصراً ينتظر قراراً من فريقك` : "لا شيء ينتظر قرار فريقك الآن"}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        {ordered.map((q) => (
          <section
            key={q.key}
            aria-labelledby={`queue-${q.key}`}
            style={{
              border: "1px solid var(--border-100)",
              borderRadius: "var(--radius-12)",
              padding: "var(--space-16)",
              background: q.count > 0 && q.owner === "hr" ? "var(--surface-100)" : "var(--surface-000)",
              minWidth: 0,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 id={`queue-${q.key}`} style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
                {q.labelAr}
              </h3>
              <Badge tone={q.count === 0 ? "neutral" : q.owner === "hr" ? "review" : "brand"}>
                <span className="font-numeric">{q.count}</span>
              </Badge>
            </div>
            <p className="ds-caption" style={{ margin: "4px 0 0", color: "var(--ink-muted)" }}>
              {q.hintAr} · {q.owner === "hr" ? "إجراء الفريق" : "بانتظار المرشح"}
            </p>
            {q.items.length > 0 && (
              <ul style={{ listStyle: "none", margin: "var(--space-12) 0 0", padding: 0 }} className="flex flex-col gap-1">
                {q.items.map((item) => (
                  <li key={item.applicationId}>
                    <Link
                      href={`/hr/candidates/${item.candidateId}`}
                      className="flex items-center justify-between gap-2 hover:underline"
                      style={{ minHeight: "var(--tap-target-min)", color: "var(--green-700)", fontSize: 14 }}
                    >
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.nameAr} <span style={{ color: "var(--ink-muted)" }}>· {item.jobTitle}</span>
                      </span>
                      <span className="ds-caption font-numeric" style={{ color: "var(--ink-muted)", flexShrink: 0 }}>
                        {waited(item.waitingDays)}
                      </span>
                    </Link>
                  </li>
                ))}
                {q.count > q.items.length && (
                  <li className="ds-caption" style={{ color: "var(--ink-muted)" }}>
                    و<span className="font-numeric">{q.count - q.items.length}</span> غيرهم
                  </li>
                )}
              </ul>
            )}
          </section>
        ))}
      </div>
    </Card>
  );
}
