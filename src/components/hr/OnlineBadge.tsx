"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

interface OnlineCandidate {
  candidateId: string;
  nameAr: string;
  applicationId: string | null;
  lastAccessAt: string;
}

const POLL_MS = 30_000;

export function OnlineBadge() {
  const [count, setCount] = useState(0);
  const [candidates, setCandidates] = useState<OnlineCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function poll() {
    try {
      const res = await fetch("/api/hr/online-candidates");
      if (!res.ok) return;
      const data = (await res.json()) as { count: number; candidates: OnlineCandidate[] };
      setCount(data.count);
      setCandidates(data.candidates);
    } catch {}
  }

  useEffect(() => {
    // Defer the first poll so no state update runs synchronously in the effect.
    const initial = setTimeout(poll, 0);
    const id = setInterval(poll, POLL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  // Close popover on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        title="المرشحون المتصلون الآن"
        aria-label={`المرشحون المتصلون الآن: ${count}`}
        aria-expanded={open}
        aria-haspopup="true"
        className="nz-btn nz-btn--secondary nz-btn--sm"
        style={{
          borderRadius: "var(--radius-full)",
          minHeight: "var(--tap-target-min)",
          gap: "var(--space-8)",
          padding: "0 var(--space-16)",
          fontWeight: 600,
        }}
      >
        <OnlineDot muted={count === 0} />
        <Icon name="candidates" size={16} label={false} />
        <span className="font-numeric">{count > 0 ? count : "—"}</span>
        <span className="max-sm:hidden" style={{ fontWeight: 500 }}>متصل الآن</span>
      </button>

      {open && (
        <div
          dir="rtl"
          role="dialog"
          aria-label="المتصلون الآن"
          style={{
            position: "absolute",
            top: "calc(100% + var(--space-8))",
            insetInlineEnd: 0,
            width: 300,
            maxWidth: "calc(100vw - var(--space-32))",
            background: "var(--surface-000)",
            borderRadius: "var(--radius-12)",
            boxShadow: "var(--shadow-menu)",
            border: "1px solid var(--border-100)",
            overflow: "hidden",
            zIndex: 60,
            transformOrigin: "top center",
            animation: "nz-menu-in 160ms var(--ease-enter) both",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-8)",
              paddingInlineStart: "var(--space-16)",
              borderBottom: "1px solid var(--border-100)",
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
              المتصلون الآن
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
              className="nz-modal__close"
              style={{ margin: 0 }}
            >
              <Icon name="close" size={20} label={false} />
            </button>
          </div>

          {/* List */}
          {candidates.length === 0 ? (
            <div style={{ padding: "var(--space-24) var(--space-16)", textAlign: "center", color: "var(--ink-muted)", fontSize: 13 }}>
              لا يوجد مرشحون متصلون حالياً
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: "var(--space-8)" }}>
              {candidates.map((c) => (
                <li key={c.candidateId}>
                  {c.candidateId ? (
                    <Link
                      href={`/hr/candidates/${c.candidateId}`}
                      onClick={() => setOpen(false)}
                      className="hover:bg-surface-100"
                      style={{ ...rowStyle, fontWeight: 600, textDecoration: "none" }}
                    >
                      <OnlineDot />
                      {c.nameAr}
                    </Link>
                  ) : (
                    <span style={rowStyle}>
                      <OnlineDot />
                      {c.nameAr}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-8)",
  minHeight: "var(--tap-target-min)",
  padding: "0 var(--space-16)",
  borderRadius: "var(--radius-8)",
  fontSize: 15,
  color: "var(--ink)",
} as const;

function OnlineDot({ muted }: { muted?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: "var(--radius-full)",
        background: muted ? "var(--neutral-500)" : "var(--success-500)",
        flex: "none",
      }}
    />
  );
}
