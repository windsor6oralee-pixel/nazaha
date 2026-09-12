"use client";

import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { CandidateRow } from "@/components/hr/CandidateRow";
import { cn } from "@/lib/utils";
import type { Candidate, ApplicationStatus } from "@/types";

const filterOptions: { label: string; value: ApplicationStatus | "all" }[] = [
  { label: "الكل", value: "all" },
  { label: "قيد الإنجاز", value: "in_progress" },
  { label: "تحت المراجعة", value: "under_review" },
  { label: "يحتاج إجراء", value: "pending" },
  { label: "مكتمل", value: "completed" },
  { label: "مرفوض", value: "rejected" },
];

interface Props {
  candidates: Candidate[];
}

export function CandidatesClient({ candidates }: Props) {
  const [filter, setFilter] = useState<ApplicationStatus | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = candidates.filter((c) => {
    const matchesFilter = filter === "all" || c.status === filter;
    const matchesSearch =
      search === "" ||
      c.name.includes(search) ||
      c.jobTitle.includes(search) ||
      c.department.includes(search);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--color-dark)" }}>
            إدارة المرشحين
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            {candidates.length} مرشح في المنصة
          </p>
        </div>
        <Link
          href="/hr/candidates/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: "var(--color-primary)",
            color: "white",
            fontFamily: "'IBM Plex Sans Arabic', sans-serif",
          }}
        >
          <UserPlus className="w-4 h-4" />
          إضافة مرشح جديد
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "var(--color-text-muted)" }} />
        <input
          type="text"
          placeholder="ابحث بالاسم، المسمى الوظيفي، أو الإدارة..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pr-10 pl-4 py-2.5 text-sm border rounded-xl outline-none transition-all bg-white"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
          onFocus={(e) => { e.target.style.borderColor = "var(--color-primary)"; }}
          onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; }}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filterOptions.map((opt) => {
          const count = opt.value === "all"
            ? candidates.length
            : candidates.filter((c) => c.status === opt.value).length;
          const active = filter === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
              style={{
                background: active ? "var(--color-primary)" : "white",
                color: active ? "white" : "var(--color-text-muted)",
                borderColor: active ? "var(--color-primary)" : "var(--color-border)",
              }}
            >
              {opt.label}
              <span className="mr-1 opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden"
        style={{ borderColor: "var(--color-border)" }}>
        <div className="divide-y" style={{ borderColor: "var(--color-beige-dark)" }}>
          {filtered.length > 0 ? (
            filtered.map((candidate) => (
              <CandidateRow key={candidate.id} candidate={candidate} />
            ))
          ) : (
            <div className="py-12 text-center text-sm"
              style={{ color: "var(--color-text-muted)" }}>
              لا توجد نتائج مطابقة للبحث
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
