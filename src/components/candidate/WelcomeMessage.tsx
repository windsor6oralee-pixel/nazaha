"use client";

import { useState } from "react";
import { Sparkles, MessageSquare, X } from "lucide-react";

interface WelcomeMessageProps {
  firstName: string;
  department: string;
  jobTitle: string;
  hrWelcomeNote?: string | null;
}

export function WelcomeMessage({ firstName, department, jobTitle, hrWelcomeNote }: WelcomeMessageProps) {
  const [dismissed, setDismissed] = useState(false);

  // ── HR custom note banner (takes priority, dismissable) ──────────────────
  if (hrWelcomeNote && !dismissed) {
    return (
      <div
        className="rounded-2xl p-5 mb-4 relative"
        style={{
          background: "linear-gradient(135deg, #1A3A2A 0%, var(--color-primary) 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
          style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" }}
          aria-label="إغلاق الرسالة"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-start gap-3 pr-1">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium mb-1.5" style={{ color: "#A8D5B8" }}>
              رسالة من إدارة الموارد البشرية
            </p>
            <p className="text-sm leading-relaxed text-white whitespace-pre-line">
              {hrWelcomeNote}
            </p>
            <p className="text-xs mt-2.5 font-medium" style={{ color: "#A8D5B8" }}>
              — إدارة الموارد البشرية
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Generic welcome (shown when no HR note, or after dismissal) ──────────
  if (dismissed) return null;

  return (
    <div
      className="rounded-2xl p-5 mb-4"
      style={{
        background: "linear-gradient(135deg, var(--color-beige) 0%, #EEE8D8 100%)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--color-gold)", opacity: 0.9 }}
        >
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold mb-1" style={{ color: "var(--color-dark)" }}>
            أهلاً بك يا {firstName}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            يسعدنا انضمامك إلى فريق{" "}
            <strong style={{ color: "var(--color-dark)" }}>{department}</strong>{" "}
            بوصفك{" "}
            <strong style={{ color: "var(--color-dark)" }}>{jobTitle}</strong>.
            نتطلع لبدء مسيرتك المهنية معنا — أكمل الخطوات أدناه للتجهيز ليومك الأول.
          </p>
          <p className="text-xs mt-2.5 font-medium" style={{ color: "var(--color-primary)" }}>
            — إدارة الموارد البشرية
          </p>
        </div>
      </div>
    </div>
  );
}
