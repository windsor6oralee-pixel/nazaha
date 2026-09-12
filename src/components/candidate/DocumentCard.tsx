"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Loader2,
} from "lucide-react";
import { getDocStatusLabel, getDocStatusStyle } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import type { Document } from "@/types";

interface DocumentCardProps {
  document: Document;
  /** When false (HR view), upload button is hidden */
  allowUpload?: boolean;
  candidateFirstName?: string;
}

const statusIcons = {
  not_uploaded: Upload,
  uploaded: Clock,
  under_review: Clock,
  approved: CheckCircle,
  rejected: XCircle,
};

const statusBorder: Record<Document["status"], string> = {
  not_uploaded: "var(--color-border)",
  uploaded: "var(--color-border)",
  under_review: "#FCD34D",
  approved: "#6EE7B7",
  rejected: "#FCA5A5",
};

const statusBg: Record<Document["status"], string> = {
  not_uploaded: "white",
  uploaded: "var(--color-surface-alt)",
  under_review: "var(--color-warning-bg)",
  approved: "var(--color-success-bg)",
  rejected: "var(--color-error-bg)",
};

export function DocumentCard({ document: doc, allowUpload = true, candidateFirstName }: DocumentCardProps) {
  const Icon = statusIcons[doc.status];
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const router = useRouter();

  const canUpload =
    allowUpload &&
    (doc.status === "not_uploaded" || doc.status === "rejected");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/documents/${doc.id}/upload`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? "فشل الرفع");
        return;
      }

      // Refresh server data
      router.refresh();
    });

    // Reset input so the same file can be selected again if needed
    e.target.value = "";
  }

  return (
    <div
      className="p-4 rounded-xl border transition-all"
      style={{
        borderColor: statusBorder[doc.status],
        background: statusBg[doc.status],
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background:
              doc.status === "approved"
                ? "var(--color-success-bg)"
                : doc.status === "rejected"
                ? "var(--color-error-bg)"
                : "var(--color-beige-dark)",
          }}
        >
          <FileText
            className="w-5 h-5"
            style={{
              color:
                doc.status === "approved"
                  ? "var(--color-success)"
                  : doc.status === "rejected"
                  ? "var(--color-error)"
                  : "var(--color-text-muted)",
            }}
          />
        </div>

        {/* Content */}
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

          {doc.rejectionReason && (
            <div className="mt-2 flex items-start gap-1.5 text-xs"
              style={{ color: "var(--color-error)" }}>
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <p>
                {candidateFirstName ? `${candidateFirstName}، ` : ""}
                {doc.rejectionReason}
              </p>
            </div>
          )}

          {uploadError && (
            <div className="mt-2 flex items-start gap-1.5 text-xs"
              style={{ color: "var(--color-error)" }}>
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <p>{uploadError}</p>
            </div>
          )}

          {doc.uploadedAt && doc.status !== "rejected" && (
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              رُفع بتاريخ {new Date(doc.uploadedAt).toLocaleDateString("ar-SA")}
            </p>
          )}
        </div>

        {/* Upload button */}
        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileChange}
              aria-label={`رفع ${doc.nameAr}`}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={isPending}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium border px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: "var(--color-primary-muted)",
                color: "var(--color-primary)",
                borderColor: "var(--color-primary)",
                opacity: isPending ? 0.6 : 1,
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  جارٍ الرفع...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  {doc.status === "rejected" ? "إعادة الرفع" : "رفع"}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
