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
  const inputRef  = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const router = useRouter();

  const canUpload =
    allowUpload &&
    (doc.status === "not_uploaded" || doc.status === "rejected");

  // Pre-upload yes/no question. Only applies when the rule declares it, the
  // candidate hasn't uploaded anything yet, and there's a configured external
  // route to send the "no" answer to.
  const [hasOwnCopy, setHasOwnCopy] = useState<boolean | null>(null);
  const askFirst =
    allowUpload &&
    doc.askBeforeUpload === true &&
    doc.status === "not_uploaded" &&
    !!doc.externalActionUrl;
  const showQuestion   = askFirst && hasOwnCopy === null;
  const showExternal   = !!doc.externalActionUrl && allowUpload && (
    doc.status === "rejected" ||          // HR rejected → steer them to issuance
    (askFirst && hasOwnCopy === false)    // candidate said "no, I don't have one"
  );
  const effectiveCanUpload = canUpload && !askFirst || (askFirst && hasOwnCopy === true && canUpload);

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

          {/* Yes/no question — only when the rule asks for it. */}
          {showQuestion && (
            <div
              className="rounded-xl p-3"
              style={{
                marginTop: "var(--space-12)",
                background: "var(--color-primary-muted)",
                border: "1px solid rgba(25,92,48,0.25)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--color-dark)", margin: 0 }}>
                هل لديك {doc.nameAr} جاهزة ومستوفية لشروط التوظيف؟
              </p>
              <div className="flex items-center gap-2" style={{ marginTop: "var(--space-8)" }}>
                <button
                  type="button"
                  onClick={() => setHasOwnCopy(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: "#013A2B", color: "white", cursor: "pointer" }}
                >
                  نعم — سأرفعها
                </button>
                <button
                  type="button"
                  onClick={() => setHasOwnCopy(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border"
                  style={{
                    borderColor: "rgba(201,169,74,0.5)",
                    background: "#FBF6E4",
                    color: "#7A5500",
                    cursor: "pointer",
                  }}
                >
                  لا — أحتاج استخراجها
                </button>
              </div>
            </div>
          )}

          {/* HR-configured external action — shown on rejection or on "no" answer. */}
          {showExternal && (
            <div
              className="rounded-xl p-3"
              style={{
                marginTop: "var(--space-12)",
                background: "#FBF6E4",
                border: "1px solid rgba(201,169,74,0.4)",
              }}
            >
              <p className="text-xs" style={{ color: "#7A5500", margin: 0 }}>
                لم تستخرج هذه الوثيقة بعد؟ تصدر لغايات التوظيف من الجهة التالية
                {doc.externalFeeLabel && <> — <strong>{doc.externalFeeLabel}</strong></>}.
              </p>
              <a
                href={doc.externalActionUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: "#013A2B", color: "white", textDecoration: "none" }}
              >
                <Icon name="integrity" size={16} label={false} />
                {doc.externalActionLabel ?? "اذهب لإصدار المستند"}
              </a>
              {doc.candidateEmail && (
                <p className="text-[11px] mt-2" style={{ color: "#7A5500" }}>
                  سيُفتح الموقع ويُرفَق بريدك: <span dir="ltr">{doc.candidateEmail}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Upload button — full-width on mobile, compact on desktop */}
        {effectiveCanUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFileChange}
              aria-label={`رفع ${doc.nameAr}`}
            />
            {/* Dedicated capture input so mobile browsers open the rear camera. */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
              aria-label={`التقط ${doc.nameAr} بالكاميرا`}
            />
          </>
        )}
        {effectiveCanUpload && (
          <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2" style={{ flex: "none" }}>
            <Button
              variant="secondary"
              icon="upload"
              loading={isPending}
              onClick={() => inputRef.current?.click()}
              className="w-full sm:w-auto"
            >
              {isPending ? "جارٍ الرفع..." : doc.status === "rejected" ? "إعادة الرفع" : "اختر ملف"}
            </Button>
            <Button
              variant="secondary"
              icon="documents"
              onClick={() => cameraRef.current?.click()}
              className="w-full sm:w-auto"
              disabled={isPending}
            >
              التقط بالكاميرا
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
