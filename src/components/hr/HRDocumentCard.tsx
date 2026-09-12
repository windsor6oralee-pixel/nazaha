"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Eye,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { getDocStatusLabel, getDocStatusStyle } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import type { Document } from "@/types";

interface HRDocumentCardProps {
  document: Document;
}

const statusIcons = {
  not_uploaded: Upload,
  uploaded: Clock,
  under_review: Clock,
  approved: CheckCircle,
  rejected: XCircle,
};

export function HRDocumentCard({ document: doc }: HRDocumentCardProps) {
  const Icon = statusIcons[doc.status];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

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
    setTimeout(() => reasonRef.current?.focus(), 50);
  }

  return (
    <div
      className="rounded-xl border p-4 transition-all"
      style={{
        borderColor:
          doc.status === "approved"
            ? "#6EE7B7"
            : doc.status === "rejected"
            ? "#FCA5A5"
            : doc.status === "under_review"
            ? "#FCD34D"
            : "var(--color-border)",
        background:
          doc.status === "approved"
            ? "var(--color-success-bg)"
            : doc.status === "rejected"
            ? "var(--color-error-bg)"
            : doc.status === "under_review"
            ? "var(--color-warning-bg)"
            : "white",
      }}
    >
      <div className="flex items-start gap-3">
        {/* File icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--color-beige-dark)" }}
        >
          <FileText className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium" style={{ color: "var(--color-dark)" }}>
              {doc.nameAr}
            </p>
            {doc.required && (
              <span className="text-xs font-medium" style={{ color: "var(--color-error)" }}>
                * مطلوب
              </span>
            )}
          </div>

          <div className="mt-1">
            <Badge style={getDocStatusStyle(doc.status)}>
              <Icon className="w-3 h-3 ml-1" />
              {getDocStatusLabel(doc.status)}
            </Badge>
          </div>

          {doc.uploadedAt && (
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              رُفع بتاريخ {new Date(doc.uploadedAt).toLocaleDateString("ar-SA")}
            </p>
          )}

          {doc.rejectionReason && (
            <p className="text-xs mt-1" style={{ color: "var(--color-error)" }}>
              سبب الرفض: {doc.rejectionReason}
            </p>
          )}

          {error && (
            <div className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: "var(--color-error)" }}>
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View file */}
          {hasFile && (
            <a
              href={`/api/files/${doc.filePath}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
              style={{
                color: "var(--color-primary)",
                borderColor: "var(--color-primary)",
                background: "var(--color-primary-muted)",
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              عرض
            </a>
          )}

          {/* Approve */}
          {canReview && !showRejectForm && (
            <button
              onClick={() => submitReview("approve")}
              disabled={isPending}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
              style={{
                color: "#065F46",
                borderColor: "#6EE7B7",
                background: "#ECFDF5",
                opacity: isPending ? 0.6 : 1,
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              اعتماد
            </button>
          )}

          {/* Reject toggle */}
          {canReview && !showRejectForm && (
            <button
              onClick={handleRejectClick}
              disabled={isPending}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
              style={{
                color: "#991B1B",
                borderColor: "#FCA5A5",
                background: "#FEF2F2",
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              <XCircle className="w-3.5 h-3.5" />
              رفض
            </button>
          )}
        </div>
      </div>

      {/* Rejection reason form */}
      {showRejectForm && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: "#FCA5A5" }}>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-dark)" }}>
            سبب الرفض <span style={{ color: "var(--color-error)" }}>*</span>
          </label>
          <textarea
            ref={reasonRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="اكتب سبب الرفض ليُرسَل للمرشح..."
            className="w-full text-sm rounded-lg border px-3 py-2 resize-none outline-none transition-colors"
            style={{
              borderColor: "#FCA5A5",
              background: "white",
              color: "var(--color-dark)",
            }}
          />
          <div className="flex items-center gap-2 mt-2 justify-end">
            <button
              onClick={() => { setShowRejectForm(false); setReason(""); setError(null); }}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{ color: "var(--color-text-muted)", borderColor: "var(--color-border)" }}
            >
              إلغاء
            </button>
            <button
              onClick={() => submitReview("reject")}
              disabled={isPending || !reason.trim()}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
              style={{
                color: "#991B1B",
                borderColor: "#FCA5A5",
                background: "#FEF2F2",
                opacity: (isPending || !reason.trim()) ? 0.5 : 1,
                cursor: (isPending || !reason.trim()) ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              تأكيد الرفض
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
