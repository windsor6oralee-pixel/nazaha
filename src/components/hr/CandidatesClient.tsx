"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { CandidatesTable } from "@/components/hr/CandidateRow";
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
    <div className="nz-page">
      <div className="nz-page__head">
        <div>
          <h1 className="nz-page__title">إدارة المرشحين</h1>
          <p className="nz-page__lead">
            <span className="font-numeric">{candidates.length}</span> مرشح في المنصة
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href="/hr/candidates/import" icon="candidates" variant="secondary">
            استيراد جماعي
          </ButtonLink>
          <ButtonLink href="/hr/candidates/new" icon="candidates">
            إضافة مرشح جديد
          </ButtonLink>
        </div>
      </div>

      {/* Search + filter */}
      <div className="grid gap-4 sm:grid-cols-[1fr_280px]">
        <Input
          label="البحث"
          icon="search"
          type="search"
          placeholder="ابحث بالاسم، المسمى الوظيفي، أو الإدارة..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          label="تصفية حسب الحالة"
          icon="filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as ApplicationStatus | "all")}
        >
          {filterOptions.map((opt) => {
            const count = opt.value === "all"
              ? candidates.length
              : candidates.filter((c) => c.status === opt.value).length;
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({count})
              </option>
            );
          })}
        </Select>
      </div>

      {/* Table */}
      <Card flush animate={false}>
        <CandidatesTable
          candidates={filtered}
          empty={<EmptyState icon="search" title="لا توجد نتائج مطابقة للبحث" />}
        />
      </Card>
    </div>
  );
}
