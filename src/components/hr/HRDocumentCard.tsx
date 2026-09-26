"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDocStatusLabel, getDocStatusTone } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { Document } from "@/types";

interface HRDocumentCardProps {
  document: Document;
}

const statusIcons: Record<Document["status"], IconName> = {
  not_uploaded: "upload",
  uploaded: "pending",
  under_review: "pending",
  approved: "approved",
  rejected: "close",
};

export function HRDocumentCard({ document: doc }: HRDocumentCardProps) {
  const statusIcon = statusIcons[doc.status];
  const reasonId = useId();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canReview = doc.status === "uploaded" || doc.status === "under_review";
  const hasFile = Boolean(doc.filePath);

  function submitReview(action: "approve" | "reject") {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/documents/${doc.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "حدث خطأ");
        return;
      }
      setShowRejectForm(false);
      setReason("");
      router.refresh();
    });
  }

  function handleRejectClick() {
    setShowRejectForm(true);
    setTimeout(() => document.getElementById(reasonId)?.focus(), 50);
  }

  return (
    <div
      style={{
        padding: "var(--space-16)",
        borderRadius: "var(--radius-12)",
        border: "1px solid var(--border-100)",
        background: "var(--surface-000)",
      }}
    >
      <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
        {/* File icon */}
        <span
          aria-hidden
          className="inline-grid place-items-center flex-none"
          style={{ width: 40, height: 40, borderRadius: "var(--radius-8)", background: "var(--surface-100)", color: "var(--green-700)" }}
        >
          <Icon name="documents" size={24} label={false} />
        </span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p style={{ margin: 0, fontWeight: 600, color: "var(--ink)" }}>
              {doc.nameAr}
            </p>
            {doc.required && (
              <span className="ds-caption" style={{ color: "var(--danger-500)", fontWeight: 500 }}>
                * مطلوب
              </span>
            )}
          </div>

          <div className="mt-2">
            <Badge tone={getDocStatusTone(doc.status)} icon={statusIcon}>
              {getDocStatusLabel(doc.status)}
            </Badge>
          </div>

          {doc.uploadedAt && (
            <p className="ds-caption" style={{ margin: "var(--space-8) 0 0", color: "var(--ink-muted)" }}>
              رُفع بتاريخ <span className="font-numeric">{new Date(doc.uploadedAt).toLocaleDateString("ar-SA-u-nu-latn")}</span>
            </p>
          )}

          {doc.rejectionReason && (
            <p className="ds-caption" style={{ margin: "4px 0 0", color: "var(--danger-500)" }}>
              سبب الرفض: {doc.rejectionReason}
            </p>
          )}

          {error && <Alert tone="error" className="mt-2">{error}</Alert>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {/* View file */}
          {hasFile && (
            <a
              href={`/api/files/${doc.filePath}`}
              target="_blank"
              rel="noopener noreferrer"
              className="nz-btn nz-btn--ghost nz-btn--sm"
              style={{ minHeight: "var(--tap-target-min)" }}
            >
              <Icon name="review" size={20} label={false} />
              عرض الملف
            </a>
          )}

          {/* Approve */}
          {canReview && !showRejectForm && (
            <Button
              variant="secondary"
              size="sm"
              icon="approved"
              onClick={() => submitReview("approve")}
              loading={isPending}
              style={{ minHeight: "var(--tap-target-min)" }}
            >
              اعتماد المستند
            </Button>
          )}

          {/* Reject toggle */}
          {canReview && !showRejectForm && (
            <Button
              variant="danger"
              size="sm"
              icon="close"
              onClick={handleRejectClick}
              disabled={isPending}
              style={{ minHeight: "var(--tap-target-min)" }}
            >
              رفض المستند
            </Button>
          )}
        </div>
      </div>

      {/* Rejection reason form */}
      {showRejectForm && (
        <div className="mt-4 pt-4 flex flex-col gap-4" style={{ borderTop: "1px solid var(--border-100)" }}>
          <Textarea
            id={reasonId}
            label="سبب الرفض"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="اكتب سبب الرفض ليُرسَل للمرشح..."
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="danger"
              size="sm"
              icon="close"
              onClick={() => submitReview("reject")}
              disabled={!reason.trim()}
              loading={isPending}
              style={{ minHeight: "var(--tap-target-min)" }}
            >
              تأكيد الرفض
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowRejectForm(false); setReason(""); setError(null); }}
              style={{ minHeight: "var(--tap-target-min)" }}
            >
              إلغاء
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
