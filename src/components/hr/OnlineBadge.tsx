"use client";

import { useEffect, useState, useRef } from "react";
import { Users, X } from "lucide-react";
import Link from "next/link";

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
        onClick={() => setOpen((p) => !p)}
        title="المرشحون المتصلون الآن"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 99,
          padding: "4px 12px 4px 8px",
          color: "white",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        <span style={{ position: "relative" }}>
          <Users className="w-4 h-4" />
          {count > 0 && (
            <span
              style={{
                position: "absolute",
                top: -5,
                left: -5,
                width: 8,
                height: 8,
                background: "#22C55E",
                borderRadius: "50%",
                border: "1.5px solid var(--color-primary-dark, #0f3d1f)",
                animation: "pulse-dot 2s ease-in-out infinite",
              }}
            />
          )}
        </span>
        <span style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          {count > 0 ? count : "—"}
        </span>
      </button>

      {open && (
        <div
          dir="rtl"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 300,
            background: "white",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
            zIndex: 200,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--color-surface-alt)",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-dark)" }}>
              المتصلون الآن
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 2 }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List */}
          {candidates.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
              لا يوجد مرشحون متصلون حالياً
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {candidates.map((c) => (
                <li
                  key={c.candidateId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#22C55E",
                      flexShrink: 0,
                    }}
                  />
                  {c.candidateId ? (
                    <Link
                      href={`/hr/candidates/${c.candidateId}`}
                      onClick={() => setOpen(false)}
                      style={{ fontSize: 13, color: "var(--color-primary)", fontWeight: 600, textDecoration: "none" }}
                    >
                      {c.nameAr}
                    </Link>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--color-dark)" }}>{c.nameAr}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35); opacity: 0.7; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="pulse-dot"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
