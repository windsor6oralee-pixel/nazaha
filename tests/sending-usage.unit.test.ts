/**
 * Unit tests for daily-cap enforcement and capacity summarization — pure
 * functions, no DB. Covers:
 *   - mailboxes at or past cap are dropped
 *   - overflow mode holds the overflow pool back until threshold is crossed
 *   - summary numbers add up to totalCap / used / remaining correctly
 *   - domain breakdown aggregates per-domain usage
 */
import { describe, it, expect } from "vitest";
import {
  pickEligibleMailboxes,
  summarizeCapacity,
  type SendingPolicy,
} from "@/infrastructure/notifications/sending-policy.service";

type MB = { fromEmail: string; label: string };
const pool: MB[] = [
  { fromEmail: "hr@nazahacareer.com",   label: "nz-hr"   },
  { fromEmail: "info@nazahacareer.com", label: "nz-info" },
  { fromEmail: "ceo@nazahacareer.com",  label: "nz-ceo"  },
  { fromEmail: "hr@sendifysaudi.com",   label: "ss-hr"   },
  { fromEmail: "info@sendifysaudi.com", label: "ss-info" },
  { fromEmail: "hr@thesaudisearch.com", label: "ts-hr"   },
];

const base: SendingPolicy = {
  mode: "overflow",
  primary: ["nazahacareer.com"],
  overflow: ["sendifysaudi.com"],
  excluded: [],
  dailyCapPerMailbox: 100,
  overflowThresholdPercent: 70,
};

const labels = (xs: MB[]) => xs.map((m) => m.label);
const usage = (entries: Array<[string, number]>) => new Map(entries.map(([k, v]) => [k.toLowerCase(), v]));

describe("pickEligibleMailboxes()", () => {
  it("drops a mailbox once its count reaches the cap", () => {
    const u = usage([["hr@nazahacareer.com", 100]]);
    const out = labels(pickEligibleMailboxes(pool, base, u));
    expect(out).not.toContain("nz-hr");
    expect(out).toContain("nz-info");
  });

  it("holds overflow back while primary consumption < threshold", () => {
    const u = usage([
      ["hr@nazahacareer.com",   50],
      ["info@nazahacareer.com", 50],
      ["ceo@nazahacareer.com",  50],  // 150 / 300 = 50% < 70%
    ]);
    const out = labels(pickEligibleMailboxes(pool, base, u));
    expect(out).toEqual(["nz-hr", "nz-info", "nz-ceo"]);  // overflow NOT admitted
  });

  it("admits overflow once primary consumption crosses threshold", () => {
    const u = usage([
      ["hr@nazahacareer.com",   80],
      ["info@nazahacareer.com", 80],
      ["ceo@nazahacareer.com",  80],  // 240 / 300 = 80% ≥ 70%
    ]);
    const out = labels(pickEligibleMailboxes(pool, base, u));
    expect(out).toContain("nz-hr");
    expect(out).toContain("ss-hr");       // overflow now in rotation
    expect(out).toContain("ss-info");
  });

  it("drops exhausted overflow mailboxes even when overflow is active", () => {
    const u = usage([
      ["hr@nazahacareer.com",   80],
      ["info@nazahacareer.com", 80],
      ["ceo@nazahacareer.com",  80],
      ["hr@sendifysaudi.com",  100],   // exhausted
    ]);
    const out = labels(pickEligibleMailboxes(pool, base, u));
    expect(out).not.toContain("ss-hr");
    expect(out).toContain("ss-info");
  });

  it("exclusive mode never admits overflow regardless of consumption", () => {
    const u = usage([
      ["hr@nazahacareer.com",   95],
      ["info@nazahacareer.com", 95],
      ["ceo@nazahacareer.com",  95],
    ]);
    const p: SendingPolicy = { ...base, mode: "exclusive" };
    const out = labels(pickEligibleMailboxes(pool, p, u));
    expect(out).toEqual(["nz-hr", "nz-info", "nz-ceo"]);
  });
});

describe("summarizeCapacity()", () => {
  it("adds up totalCap and used across effective mailboxes", () => {
    // shared mode so every mailbox counts
    const p: SendingPolicy = { ...base, mode: "shared" };
    const u = usage([
      ["hr@nazahacareer.com",   30],
      ["info@nazahacareer.com", 20],
      ["hr@sendifysaudi.com",   10],
    ]);
    const s = summarizeCapacity(pool, p, u);
    expect(s.cap).toBe(100);
    expect(s.totalCap).toBe(600);   // 6 mailboxes × 100
    expect(s.used).toBe(60);
    expect(s.remaining).toBe(540);
  });

  it("buckets usage by domain", () => {
    const p: SendingPolicy = { ...base, mode: "shared" };
    const u = usage([
      ["hr@nazahacareer.com",   40],
      ["info@nazahacareer.com", 10],
      ["hr@sendifysaudi.com",   25],
    ]);
    const s = summarizeCapacity(pool, p, u);
    const nz = s.byDomain.find((d) => d.domain === "nazahacareer.com")!;
    const ss = s.byDomain.find((d) => d.domain === "sendifysaudi.com")!;
    expect(nz.used).toBe(50);
    expect(nz.mailboxes).toBe(3);
    expect(nz.cap).toBe(300);
    expect(ss.used).toBe(25);
    expect(ss.mailboxes).toBe(2);
  });

  it("clamps per-mailbox used to the cap so stale counters can't inflate totals", () => {
    const p: SendingPolicy = { ...base, mode: "shared" };
    const u = usage([["hr@nazahacareer.com", 9999]]);  // somehow over cap
    const s = summarizeCapacity(pool, p, u);
    expect(s.used).toBe(100);  // clamped to cap
  });
});
