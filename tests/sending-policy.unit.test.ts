/**
 * Unit tests for the sending-policy filter — pure function, no DB.
 * Covers: exclusive / overflow / shared modes, exclusion override, and the
 * fail-safe fallback when a policy would leave the org with zero mailboxes.
 */
import { describe, it, expect } from "vitest";
import {
  filterPoolByPolicy,
  domainsIn,
  type SendingPolicy,
} from "@/infrastructure/notifications/sending-policy.service";

type MB = { fromEmail: string; label: string };

const pool: MB[] = [
  { fromEmail: "hr@nazahacareer.com",   label: "nz-hr" },
  { fromEmail: "info@nazahacareer.com", label: "nz-info" },
  { fromEmail: "ceo@nazahacareer.com",  label: "nz-ceo" },
  { fromEmail: "hr@sendifysaudi.com",   label: "ss-hr" },
  { fromEmail: "info@sendifysaudi.com", label: "ss-info" },
  { fromEmail: "hr@thesaudisearch.com", label: "ts-hr" },
  { fromEmail: "info@sendifysa.com",    label: "sa-info" },
];

function labels(xs: MB[]): string[] { return xs.map((m) => m.label); }

describe("domainsIn()", () => {
  it("returns a sorted deduplicated list of domains", () => {
    expect(domainsIn(pool)).toEqual([
      "nazahacareer.com", "sendifysa.com", "sendifysaudi.com", "thesaudisearch.com",
    ]);
  });
});

describe("filterPoolByPolicy()", () => {
  it("exclusive mode keeps only mailboxes from primary domains", () => {
    const p: SendingPolicy = { mode: "exclusive", primary: ["nazahacareer.com"], overflow: ["sendifysaudi.com"], excluded: [], dailyCapPerMailbox: 400, overflowThresholdPercent: 70 };
    expect(labels(filterPoolByPolicy(pool, p))).toEqual(["nz-hr", "nz-info", "nz-ceo"]);
  });

  it("overflow mode puts primary mailboxes first, then overflow", () => {
    const p: SendingPolicy = { mode: "overflow", primary: ["nazahacareer.com"], overflow: ["sendifysaudi.com"], excluded: [], dailyCapPerMailbox: 400, overflowThresholdPercent: 70 };
    expect(labels(filterPoolByPolicy(pool, p))).toEqual([
      "nz-hr", "nz-info", "nz-ceo",      // primary
      "ss-hr", "ss-info",                 // overflow
    ]);
  });

  it("shared mode uses primary → overflow → the rest (minus excluded)", () => {
    const p: SendingPolicy = { mode: "shared", primary: ["nazahacareer.com"], overflow: ["sendifysaudi.com"], excluded: [], dailyCapPerMailbox: 400, overflowThresholdPercent: 70 };
    expect(labels(filterPoolByPolicy(pool, p))).toEqual([
      "nz-hr", "nz-info", "nz-ceo",       // primary
      "ss-hr", "ss-info",                  // overflow
      "ts-hr", "sa-info",                  // unassigned → still eligible in shared
    ]);
  });

  it("excluded domain is dropped even if it also appears as primary", () => {
    const p: SendingPolicy = { mode: "shared", primary: ["nazahacareer.com", "sendifysa.com"], overflow: [], excluded: ["sendifysa.com"], dailyCapPerMailbox: 400, overflowThresholdPercent: 70 };
    const out = labels(filterPoolByPolicy(pool, p));
    expect(out).toContain("nz-hr");
    expect(out).not.toContain("sa-info");
  });

  it("falls back to the full non-excluded pool when policy would leave zero mailboxes", () => {
    const p: SendingPolicy = { mode: "exclusive", primary: ["doesnotexist.com"], overflow: [], excluded: [], dailyCapPerMailbox: 400, overflowThresholdPercent: 70 };
    expect(labels(filterPoolByPolicy(pool, p))).toEqual(labels(pool));
  });

  it("respects excluded even in the fail-safe fallback", () => {
    const p: SendingPolicy = { mode: "exclusive", primary: ["doesnotexist.com"], overflow: [], excluded: ["sendifysa.com"], dailyCapPerMailbox: 400, overflowThresholdPercent: 70 };
    const out = labels(filterPoolByPolicy(pool, p));
    expect(out).not.toContain("sa-info");
    expect(out.length).toBeGreaterThan(0);
  });
});
