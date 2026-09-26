"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

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

  // Mandatory alert: the modal cannot be dismissed — only acknowledged.
  const noop = useCallback(() => {}, []);

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
    <Modal
      open
      onClose={noop}
      dismissible={false}
      title={current.titleAr}
      actions={
        <Button
          block
          variant={isHigh ? "danger" : "primary"}
          icon="approved"
          loading={isAcking}
          onClick={() => acknowledge(current.id)}
        >
          فهمت وأقرّ بالاستلام
        </Button>
      }
    >
      {/* Priority badge */}
      <div style={{ marginBottom: "var(--space-16)" }}>
        {isHigh ? (
          <Badge tone="rejected" icon="flag">تنبيه عاجل</Badge>
        ) : (
          <Badge tone="brand" icon="messages">رسالة من الموارد البشرية</Badge>
        )}
      </div>

      <p className="text-ink" style={{ margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
        {current.bodyAr}
      </p>
    </Modal>
  );
}
