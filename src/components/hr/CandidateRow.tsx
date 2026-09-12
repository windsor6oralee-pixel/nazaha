import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { getStatusLabel, getStatusStyle, formatDate } from "@/lib/utils";
import type { Candidate } from "@/types";

interface CandidateRowProps {
  candidate: Candidate;
}

export function CandidateRow({ candidate }: CandidateRowProps) {
  return (
    <div className="candidate-row flex items-center gap-4 p-4 rounded-xl group">
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--color-primary)", boxShadow: "0 2px 6px rgba(25,92,48,0.3)" }}
      >
        <span className="text-white text-sm font-bold" style={{ fontFamily: "'Noto Kufi Arabic', sans-serif" }}>
          {candidate.name.charAt(0)}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--color-dark)" }}>{candidate.name}</p>
        <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{candidate.jobTitle} · {candidate.department}</p>
      </div>

      {/* Progress */}
      <div className="hidden sm:flex flex-col items-center gap-1 min-w-16">
        <p className="text-sm font-bold" style={{ color: "var(--color-primary)", fontFamily: "'Inter', sans-serif" }}>
          {candidate.completionPercentage}%
        </p>
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${candidate.completionPercentage}%`, background: "var(--color-primary)" }}
          />
        </div>
      </div>

      {/* Status */}
      <div className="hidden md:block">
        <Badge style={getStatusStyle(candidate.status)}>
          {getStatusLabel(candidate.status)}
        </Badge>
      </div>

      {/* Date */}
      <p className="hidden lg:block text-xs flex-shrink-0" style={{ color: "var(--color-text-muted)", fontFamily: "'Inter', sans-serif" }}>
        {formatDate(candidate.acceptanceDate)}
      </p>

      {/* Action */}
      <Link
        href={`/hr/candidates/${candidate.id}`}
        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-medium"
        style={{ color: "var(--color-primary)" }}
      >
        عرض
        <ArrowLeft className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
