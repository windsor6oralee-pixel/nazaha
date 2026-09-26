"use client";

import { useState } from "react";
import { Server, Zap } from "lucide-react";

interface Props {
  defaultTab: "smtp" | "inboxkit";
  smtpForm: React.ReactNode;
  inboxKitForm: React.ReactNode;
}

export function EmailProviderTabs({ defaultTab, smtpForm, inboxKitForm }: Props) {
  const [tab, setTab] = useState<"smtp" | "inboxkit">(defaultTab);

  const tabs = [
    {
      key: "inboxkit" as const,
      label: "InboxKit",
      sublabel: "Google Workspace — موصى به",
      icon: Zap,
      badge: "تلقائي",
    },
    {
      key: "smtp" as const,
      label: "SMTP يدوي",
      sublabel: "أي خادم بريد مخصص",
      icon: Server,
      badge: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tab selector */}
      <div className="grid grid-cols-2 gap-3">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="relative flex items-start gap-3 p-4 rounded-2xl border text-right transition-all"
              style={{
                borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                background:  active ? "var(--color-primary-muted)" : "var(--color-surface)",
                cursor: "pointer",
                boxShadow: active ? "0 0 0 2px var(--color-primary)" : "none",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  background: active ? "var(--color-primary)" : "var(--color-surface-alt)",
                }}
              >
                <Icon className="w-4 h-4" style={{ color: active ? "white" : "var(--color-text-muted)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: "var(--color-dark)" }}>{t.label}</span>
                  {t.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={{ background: "var(--color-primary)", color: "white" }}>
                      {t.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{t.sublabel}</p>
              </div>
              {active && (
                <div className="absolute top-3 left-3 w-2 h-2 rounded-full" style={{ background: "var(--color-primary)" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-px" style={{ background: "var(--color-border)" }} />

      {/* Tab content */}
      {tab === "inboxkit" ? inboxKitForm : smtpForm}
    </div>
  );
}
