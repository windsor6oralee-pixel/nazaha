#!/usr/bin/env node
/**
 * CLASSIFIER for the 1316-candidate invitation target (read-only, no sends).
 * Categories:
 *   REAL      – deliverable-format email, non-reserved, non-test domain
 *   RESERVED  – RFC 2606 reserved (example.com/.net/.org and similar)
 *   TEST      – .local / .test / .invalid TLDs or obvious test markers
 *   INVALID   – missing @, empty, quotes/spaces in local part, etc.
 *   EMPTY/DUP – empty or duplicate emails within the target set
 */
import { readFileSync } from "fs";

const RESERVED = new Set(["example.com", "example.net", "example.org"]);
const TEST_TLDS = new Set(["local", "test", "invalid", "example", "test."]);

interface Row { id: string; email: string; loginEmail: string; invitationSent: string; hasHash: string; }

const raw = readFileSync("/tmp/opencode/target_1316.txt", "utf8").trim().split("\n").map((l) => l.split("|"));
const rows: Row[] = raw.map((f) => ({
  id: f[0], email: f[1] ?? "", loginEmail: f[2] ?? "", invitationSent: f[3] ?? "f", hasHash: f[4] ?? "f",
})).filter((r) => r.id);

function classify(email: string): string {
  const e = email.trim().toLowerCase();
  if (!e) return "EMPTY";
  if (e.includes("@") === false) return "INVALID";
  const at = e.lastIndexOf("@");
  if (at <= 0 || at === e.length - 1) return "INVALID";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (local.includes('"') || local.includes("'") || /\s/.test(local)) return "INVALID";
  const [sub, tldRaw] = domain.split(".");
  const tld = (tldRaw || "").toLowerCase();
  if (RESERVED.has(domain)) return "RESERVED";
  if (["local", "test", "invalid"].includes(tld)) return "TEST";
  if (tld === "" ) return "INVALID";
  if (tld.length < 2) return "INVALID";
  // crude deliverable check: has a plausible TLD and no reserved/test marker
  if (domain.includes("example")) return "RESERVED";
  return "REAL";
}

const counts: Record<string, number> = {};
const real: string[] = []; const reserved: string[] = []; const test: string[] = []; const invalid: string[] = [];
const emptyDup: string[] = [];

for (const r of rows) {
  const c = classify(r.email);
  counts[c] = (counts[c] ?? 0) + 1;
  if (c === "REAL") real.push(r.email);
  else if (c === "RESERVED") reserved.push(r.email);
  else if (c === "TEST") test.push(r.email);
  else if (c === "INVALID") invalid.push(r.email);
  else emptyDup.push(`${r.id}|${r.email}`);
}

const dupMap = new Map<string, number>();
for (const r of rows) { const k = r.email.trim().toLowerCase(); dupMap.set(k, (dupMap.get(k) ?? 0) + 1); }
const dups = [...dupMap.entries()].filter(([, n]) => n > 1).map(([e, n]) => `${e} (x${n})`);

console.log("TOTAL_ROWS=" + rows.length);
console.log("CATEGORY_COUNTS=" + JSON.stringify(counts));
console.log("REAL_LIST_START");
for (const e of real) console.log("REAL:" + e);
console.log("REAL_LIST_END");
console.log("RESERVED_LIST_START");
for (const e of reserved) console.log("RESERVED:" + e);
console.log("RESERVED_LIST_END");
console.log("TEST_LIST_START");
for (const e of test) console.log("TEST:" + e);
console.log("TEST_LIST_END");
console.log("INVALID_LIST_START");
for (const e of invalid) console.log("INVALID:" + e);
console.log("INVALID_LIST_END");
console.log("DUPLICATES_START");
for (const d of dups) console.log("DUP:" + d);
console.log("DUPLICATES_END");
console.log("NO_HASH_COUNT=" + rows.filter((r) => r.hasHash === "t").length);
