"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

interface WelcomeMessageProps {
  firstName: string;
  department: string;
  jobTitle: string;
  hrWelcomeNote?: string | null;
}

function MessageTile() {
  return (
    <div
      className="flex items-center justify-center rounded-8 bg-gold-200 text-ink"
      style={{ width: 40, height: 40, flex: "none" }}
    >
      <Icon name="messages" size={24} label={false} />
    </div>
  );
}

export function WelcomeMessage({ firstName, department, jobTitle, hrWelcomeNote }: WelcomeMessageProps) {
  const [dismissed, setDismissed] = useState(false);

  // ── HR custom note banner (takes priority, dismissable) ──────────────────
  if (hrWelcomeNote && !dismissed) {
    return (
      <Card plain style={{ borderColor: "var(--gold-500)" }}>
        <div className="flex items-start gap-4">
          <MessageTile />
          <div className="flex-1 min-w-0">
            <p className="text-ink-muted" style={{ margin: "0 0 var(--space-8)", fontSize: 13, fontWeight: 500 }}>
              رسالة من إدارة الموارد البشرية
            </p>
            <p className="text-ink whitespace-pre-line" style={{ margin: 0 }}>
              {hrWelcomeNote}
            </p>
            <p className="text-ink-muted" style={{ margin: "var(--space-8) 0 0", fontSize: 13, fontWeight: 500 }}>
              — إدارة الموارد البشرية
            </p>
          </div>
          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="nz-modal__close"
            aria-label="إغلاق الرسالة"
          >
            <Icon name="close" size={20} label={false} />
          </button>
        </div>
      </Card>
    );
  }

  // ── Generic welcome (shown when no HR note, or after dismissal) ──────────
  if (dismissed) return null;

  return (
    <Card>
      <div className="flex items-start gap-4">
        <MessageTile />
        <div className="flex-1 min-w-0">
          <p className="text-ink" style={{ margin: "0 0 var(--space-8)", fontWeight: 600 }}>
            أهلاً بك يا {firstName}
          </p>
          <p className="text-ink-muted" style={{ margin: 0, fontSize: 15 }}>
            يسعدنا انضمامك إلى فريق{" "}
            <strong className="text-ink">{department}</strong>{" "}
            بوصفك{" "}
            <strong className="text-ink">{jobTitle}</strong>.
            نتطلع لبدء مسيرتك المهنية معنا — أكمل الخطوات أدناه للتجهيز ليومك الأول.
          </p>
          <p className="text-green-700" style={{ margin: "var(--space-8) 0 0", fontSize: 13, fontWeight: 500 }}>
            — إدارة الموارد البشرية
          </p>
        </div>
      </div>
    </Card>
  );
}
