"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { CandidatesTable } from "@/components/hr/CandidateRow";
import { type StatusFilter } from "@/lib/candidate-filter";
import type { Candidate } from "@/types";

const filterOptions: { label: string; value: StatusFilter }[] = [
  { label: "الكل", value: "all" },
  { label: "مقبول", value: "approved" },
  { label: "قيد الإنجاز", value: "in_progress" },
  { label: "تحت المراجعة", value: "under_review" },
  { label: "يحتاج إجراء", value: "pending" },
  { label: "مكتمل", value: "completed" },
  { label: "مرفوض", value: "rejected" },
];

interface Props {
  candidates: Candidate[];
  /** التصفية التي طُلبت عبر ?status= — تُستعمل عند فتح الصفحة من عدّاد اللوحة. */
  initialStatus?: StatusFilter;
}

export function CandidatesClient({ candidates, initialStatus = "all" }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>(initialStatus);
  const [search, setSearch] = useState("");

  /* تغيير التصفية يحدّث الرابط — يبقى الفلاتر قابلاً للمشاركة والرجوع إليه. */
  function changeFilter(value: StatusFilter) {
    setFilter(value);
    const query = value === "all" ? "" : `?status=${value}`;
    router.replace(`/hr/candidates${query}`, { scroll: false });
  }

  /* Follow ?status= when it changes under us (e.g. the sidebar link to the list). */
  const [syncedStatus, setSyncedStatus] = useState(initialStatus);
  if (initialStatus !== syncedStatus) {
    setSyncedStatus(initialStatus);
    setFilter(initialStatus);
  }

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
            {filter === "all" && search === "" ? (
              <>
                <span className="font-numeric">{candidates.length}</span> مرشح في المنصة
              </>
            ) : (
              <>
                <span className="font-numeric">{filtered.length}</span> مرشح مطابق
                {filter !== "all" && (
                  <> — {filterOptions.find((o) => o.value === filter)?.label}</>
                )}
              </>
            )}
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
          onChange={(e) => changeFilter(e.target.value as StatusFilter)}
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
