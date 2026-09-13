"use client";

import { useEffect } from "react";

const INTERVAL_MS = 60_000;

export function CandidateHeartbeat() {
  useEffect(() => {
    async function ping() {
      try {
        await fetch("/api/candidate/heartbeat", { method: "POST" });
      } catch {
        // silent — offline or error; next tick will retry
      }
    }

    ping();
    const id = setInterval(ping, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
