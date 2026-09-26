"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDocStatusLabel, getDocStatusTone } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Document } from "@/types";

interface DocumentCardProps {
  document: Document;
  /** When false (HR view), upload button is hidden */
  allowUpload?: boolean;
  candidateFirstName?: string;
}

export function DocumentCard({ document: doc, allowUpload = true, candidateFirstName }: DocumentCardProps) {
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
    <div className="rounded-12 border border-border-100 bg-surface-000" style={{ padding: "var(--space-16)" }}>
      <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
        {/* Icon */}
        <div
          className="flex items-center justify-center rounded-8 bg-surface-100 text-ink-muted"
          style={{ width: 40, height: 40, flex: "none" }}
        >
          <Icon name="documents" size={24} label={false} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-ink" style={{ margin: 0, fontWeight: 500 }}>
              {doc.nameAr}
            </p>
            {doc.required && (
              <span className="text-ink-muted" style={{ fontSize: 13 }}>
                <span className="text-danger-500" aria-hidden>*</span> مطلوب
              </span>
            )}
          </div>

          <div style={{ marginTop: "var(--space-8)" }}>
            <Badge tone={getDocStatusTone(doc.status)} icon={doc.status === "not_uploaded" ? "upload" : undefined}>
              {getDocStatusLabel(doc.status)}
            </Badge>
          </div>

          {doc.rejectionReason && (
            <div className="flex items-start gap-2 text-danger-500" style={{ marginTop: "var(--space-8)", fontSize: 13 }}>
              <Icon name="flag" size={16} label={false} style={{ marginTop: 3 }} />
              <p style={{ margin: 0 }}>
                {candidateFirstName ? `${candidateFirstName}، ` : ""}
                {doc.rejectionReason}
              </p>
            </div>
          )}

          {uploadError && (
            <div className="flex items-start gap-2 text-danger-500" style={{ marginTop: "var(--space-8)", fontSize: 13 }}>
              <Icon name="flag" size={16} label={false} style={{ marginTop: 3 }} />
              <p style={{ margin: 0 }}>{uploadError}</p>
            </div>
          )}

          {doc.uploadedAt && doc.status !== "rejected" && (
            <p className="text-ink-muted" style={{ margin: "var(--space-8) 0 0", fontSize: 13 }}>
              رُفع بتاريخ <span className="font-numeric">{new Date(doc.uploadedAt).toLocaleDateString("ar-SA-u-nu-latn")}</span>
            </p>
          )}
        </div>

        {/* Upload button — full-width on mobile, compact on desktop */}
        {canUpload && (
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleFileChange}
            aria-label={`رفع ${doc.nameAr}`}
          />
        )}
        {canUpload && (
          <Button
            variant="secondary"
            icon="upload"
            loading={isPending}
            onClick={() => inputRef.current?.click()}
            className="w-full sm:w-auto"
            style={{ flex: "none" }}
          >
            {isPending ? "جارٍ الرفع..." : doc.status === "rejected" ? "إعادة رفع المستند" : "رفع المستند"}
          </Button>
        )}
      </div>
    </div>
  );
}
