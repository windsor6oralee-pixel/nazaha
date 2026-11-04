"use client";

import { useEffect, useState } from "react";
import { MessageCircle, UserRound } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  role: string;
  whatsappUrl: string;
}

/**
 * List of HR staff the candidate can reach on WhatsApp — each row opens a
 * pre-filled chat when tapped. Nothing is rendered when no staff has a
 * WhatsApp number on file, so the card never shows "empty".
 */
export function HRStaffContacts() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/candidate/hr-staff", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setContacts(j.contacts ?? []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  if (!contacts || contacts.length === 0) return null;

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <div className="flex items-center gap-2 mb-3">
        <UserRound className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>
          تواصل مع فريق الموارد البشرية
        </p>
      </div>
      <p className="text-[11px] mb-3" style={{ color: "var(--color-text-muted)" }}>
        للاستفسار المباشر، تواصل مع أحد الموظفين عبر واتساب برسالة مُعبّأة باسمك وجهتك.
      </p>
      <div className="space-y-2">
        {contacts.map((c) => (
          <a
            key={c.id}
            href={c.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors"
            style={{
              borderColor: "rgba(37,211,102,0.3)",
              background: "rgba(37,211,102,0.07)",
              textDecoration: "none",
            }}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--color-dark)" }}>{c.name}</p>
              <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{c.role}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl flex-shrink-0"
              style={{ background: "#25D366", color: "white" }}>
              <MessageCircle className="w-3.5 h-3.5" />
              واتساب
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
