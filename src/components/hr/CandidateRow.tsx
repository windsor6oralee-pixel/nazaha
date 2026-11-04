import type { ReactNode } from "react";
import Link from "next/link";
import { StatusDot } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Progress } from "@/components/ui/Progress";
import { Table, Td } from "@/components/ui/Table";
import { getStatusLabel, getStatusTone, formatDate } from "@/lib/utils";
import type { Candidate } from "@/types";

interface CandidateRowProps {
  candidate: Candidate;
}

const EMAIL_TONE: Record<string, { label: string; bg: string; color: string }> = {
  not_sent: { label: "لم تُرسَل",  bg: "#F5F5F5", color: "#6E7673" },
  sent:     { label: "أُرسلت",      bg: "#E6F0E9", color: "#013A2B" },
  opened:   { label: "فُتحت",       bg: "#E6F0E9", color: "#227A4E" },
  clicked:  { label: "ضُغطت",       bg: "#013A2B", color: "#E8D27A" },
  bounced:  { label: "ارتدَّت",     bg: "#FAECEB", color: "#A83A30" },
  failed:   { label: "فشلت",       bg: "#FAECEB", color: "#A83A30" },
};

function EmailStatusBadge({ status }: { status?: string }) {
  const tone = EMAIL_TONE[status ?? "not_sent"] ?? EMAIL_TONE.not_sent;
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-md inline-block font-semibold"
      style={{ background: tone.bg, color: tone.color }}>
      {tone.label}
    </span>
  );
}

/** صف مرشح داخل جدول المرشحين (CandidatesTable). */
export function CandidateRow({ candidate }: CandidateRowProps) {
  return (
    <tr>
      {/* Name + job */}
      <Td>
        <div className="flex items-center gap-4 min-w-0">
          <span
            aria-hidden
            className="inline-grid place-items-center flex-none rounded-8 font-kufi"
            style={{
              width: 40,
              height: 40,
              background: "var(--green-700)",
              color: "var(--ink-invert)",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {candidate.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate" style={{ margin: 0, fontWeight: 600, color: "var(--ink)" }}>
              {candidate.name}
            </p>
            <p className="ds-caption truncate" style={{ margin: 0, color: "var(--ink-muted)" }}>
              {candidate.jobTitle} · {candidate.department}
            </p>
          </div>
        </div>
      </Td>

      {/* Progress */}
      <Td hideBelow="sm" style={{ minWidth: 120 }}>
        <Progress value={candidate.completionPercentage} />
      </Td>

      {/* Status */}
      <Td>
        <StatusDot tone={getStatusTone(candidate.status)}>
          {getStatusLabel(candidate.status)}
        </StatusDot>
      </Td>

      {/* Email engagement */}
      <Td hideBelow="md" style={{ whiteSpace: "nowrap" }}>
        <EmailStatusBadge status={candidate.emailStatus} />
      </Td>

      {/* Date */}
      <Td numeric hideBelow="lg" style={{ whiteSpace: "nowrap", color: "var(--ink-muted)", fontSize: 13 }}>
        {formatDate(candidate.acceptanceDate)}
      </Td>

      {/* Action */}
      <Td>
        <Link
          href={`/hr/candidates/${candidate.id}`}
          className="nz-btn nz-btn--ghost nz-btn--sm"
          style={{ minHeight: "var(--tap-target-min)" }}
          aria-label={`عرض ملف ${candidate.name}`}
        >
          عرض
          <Icon name="chevron" size={16} label={false} style={{ transform: "rotate(90deg)" }} />
        </Link>
      </Td>
    </tr>
  );
}

/** جدول المرشحين الموحد: الاسم والوظيفة، نسبة الإنجاز، الحالة، تاريخ القبول، ورابط العرض. */
export function CandidatesTable({
  candidates,
  emptyText = "لا يوجد مرشحون",
  empty,
}: {
  candidates: Candidate[];
  emptyText?: string;
  empty?: ReactNode;
}) {
  return (
    <Table
      caption="قائمة المرشحين"
      columns={[
        "المرشح",
        { label: "نسبة الإنجاز", hideBelow: "sm" },
        "الحالة",
        { label: "البريد", hideBelow: "md" },
        { label: "تاريخ القبول", hideBelow: "lg" },
        { label: <span className="sr-only">إجراءات</span>, width: "1%" },
      ]}
      empty={empty ?? <EmptyState icon="candidates" title={emptyText} />}
    >
      {candidates.map((candidate) => (
        <CandidateRow key={candidate.id} candidate={candidate} />
      ))}
    </Table>
  );
}
