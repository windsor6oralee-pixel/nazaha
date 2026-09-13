"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Alert {
  id: string;
  titleAr: string;
  bodyAr: string;
  priority: string;
  createdAt: string;
}

const POLL_MS = 30_000;
const HIGH_FREQ = [523, 659, 784]; // C5 E5 G5

function playTone() {
  try {
    const ctx = new AudioContext();
    HIGH_FREQ.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.35);
    });
  } catch {
    // AudioContext blocked — no tone
  }
}

export function AlertGate() {
  const [queue, setQueue] = useState<Alert[]>([]);
  const [isAcking, setIsAcking] = useState(false);
  const current = queue[0] ?? null;
  const tonesPlayed = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/candidate/alerts/pending");
      if (!res.ok) return;
      const data = (await res.json()) as { alerts: Alert[] };
      setQueue(data.alerts);
    } catch {
      // offline
    }
  }, []);

  useEffect(() => {
    // Defer the first poll so no state update runs synchronously in the effect.
    const initial = setTimeout(poll, 0);
    const id = setInterval(poll, POLL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [poll]);

  // Play the tone once per HIGH alert when it reaches the top of the queue
  useEffect(() => {
    if (current?.priority === "HIGH" && !tonesPlayed.current.has(current.id)) {
      tonesPlayed.current.add(current.id);
      playTone();
    }
  }, [current]);

  async function acknowledge(alertId: string) {
    setIsAcking(true);
    try {
      await fetch(`/api/candidate/alerts/${alertId}/acknowledge`, { method: "POST" });
      setQueue((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      // retry next poll
    } finally {
      setIsAcking(false);
    }
  }

  if (!current) return null;

  const isHigh = current.priority === "HIGH";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isHigh ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        padding: "1rem",
      }}
    >
      <div
        dir="rtl"
        style={{
          background: "white",
          borderRadius: 20,
          maxWidth: 460,
          width: "100%",
          padding: "2rem",
          boxShadow: isHigh
            ? "0 0 0 4px #DC2626, 0 20px 60px rgba(0,0,0,0.4)"
            : "0 8px 40px rgba(0,0,0,0.25)",
          textAlign: "center",
        }}
      >
        {/* Priority badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: isHigh ? "#FEE2E2" : "var(--color-primary-muted)",
            color: isHigh ? "#DC2626" : "var(--color-primary)",
            borderRadius: 99,
            padding: "4px 14px",
            fontSize: 12,
            fontWeight: 700,
            marginBottom: "1.25rem",
          }}
        >
          {isHigh ? "⚠ تنبيه عاجل" : "رسالة من الموارد البشرية"}
        </div>

        <h2
          id="alert-title"
          style={{
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "var(--color-dark)",
            marginBottom: "0.75rem",
            fontFamily: "'Noto Kufi Arabic', sans-serif",
          }}
        >
          {current.titleAr}
        </h2>

        <p
          style={{
            fontSize: "0.95rem",
            color: "var(--color-text)",
            lineHeight: 1.7,
            marginBottom: "1.75rem",
            whiteSpace: "pre-wrap",
          }}
        >
          {current.bodyAr}
        </p>

        <button
          onClick={() => acknowledge(current.id)}
          disabled={isAcking}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 12,
            border: "none",
            background: isHigh ? "#DC2626" : "var(--color-primary)",
            color: "white",
            fontSize: "1rem",
            fontWeight: 700,
            cursor: isAcking ? "not-allowed" : "pointer",
            opacity: isAcking ? 0.7 : 1,
            fontFamily: "'Noto Kufi Arabic', sans-serif",
          }}
        >
          {isAcking ? "..." : "فهمت وأقرّ بالاستلام"}
        </button>
      </div>
    </div>
  );
}
